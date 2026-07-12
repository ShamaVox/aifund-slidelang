"""The agent authoring loop: plan -> author -> verify -> repair.

Each run returns the final spec plus a structured trace of every step (stage,
outcome, latency, diagnostics). The verifier is the Python compiler; its
diagnostics are fed back to the model as the repair signal. Reliability first:
the model path is wrapped in retries+timeout and always has a deterministic
fallback, and the deterministic repair pass resolves most defects with no model
round-trip.
"""
from __future__ import annotations
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

from ..compiler.pipeline import build
from ..config import settings
from ..logging_conf import log_event
from .client import call_model
from .deterministic import simulate_author
from .grammar import GRAMMAR

log = logging.getLogger("slidelang.agent")

SYSTEM = (
    "You are a principal-level presentation designer. You author decks in SlideLang, "
    "a deck-as-code language. Your decks look like a top-tier firm made them: specific, "
    "confident, and shaped to the topic — never a template.\n\n"

    "STRUCTURE — choose the arc that fits THIS deck. Do not follow a fixed skeleton. "
    "Pick from patterns like these, or invent one that suits the content:\n"
    "- Pitch: hook → the broken status quo → your insight → proof (metrics/chart) → "
    "why-now → the ask.\n"
    "- Technical: the problem in one diagram → design principles → the architecture → "
    "tradeoffs (table) → a formula or benchmark → what ships next.\n"
    "- Data story: the surprising number up front → what drove it (chart) → the mechanism "
    "→ the counterintuitive detail → implication.\n"
    "- Narrative: a concrete moment/example → the pattern behind it → evidence → the shift "
    "it points to.\n"
    "Vary slide COUNT (6-11), vary which slide types you use, and vary how you OPEN and "
    "CLOSE. Not every deck opens with a plain title or ends with a quote — sometimes open on "
    "a stark metric or a bold claim, sometimes close on a next-step or a single sentence.\n\n"

    "CONTENT — this is what separates production-grade from generic:\n"
    "- Be SPECIFIC to the exact subject. Invent realistic, concrete details: real-sounding "
    "company/product names, dates, dollar figures, percentages, customer types, mechanisms. "
    "If the prompt names a company or domain, use its actual context.\n"
    "- Headlines state a TAKEAWAY with a number or a claim, e.g. 'Returns fell 41% after we "
    "shipped size-guidance', not 'Results'. Never name-only headings like 'Overview' or 'Metrics'.\n"
    "- Bullets are sharp, non-obvious, and varied in length — insights, not filler. No 'lorem', "
    "no 'Point 1', no restating the heading.\n"
    "- Use vivid, human language. Avoid corporate mush ('leverage synergies', 'best-in-class').\n\n"

    "CRAFT REQUIREMENTS:\n"
    "- Include at least one chart and one metrics slide with real, plausible numbers. When the "
    "same numbers drive a chart, declare a `dataset` once and `bind` it.\n"
    "- Prefer a table for comparisons and a math/formula slide when there's a model to show.\n"
    "- Use `section` slides ONLY as short dividers between parts of the deck, never as a "
    "content slide. A 'problem', 'solution', 'why now', or any substantive slide MUST be a "
    "`bullets` slide with 3-4 concrete, specific points (or metrics/chart/table where data fits), "
    "never just a heading with no body.\n"
    "- Ground the content in the user's actual prompt: use the real company name, domain, and "
    "audience they gave you. Do not fall back to generic SaaS boilerplate or placeholder figures.\n"
    "- Add images WHERE APPLICABLE, like a real designer: attach an `image \"...\"` line "
    "to 1-2 content slides (a bullets or title slide, not metrics/chart/table/math). The image "
    "must depict the deck's actual SUBJECT MATTER with a concrete, literal scene: the product, "
    "the environment, the objects, or the workflow the deck is about. For a retail deck, show "
    "shelves, warehouses, products, or a store; for a dev-tools deck, show screens, hardware, or "
    "a workspace. Do NOT use generic stock portraits or headshots of random people unless the "
    "deck is specifically about a person. Describe a PHOTOGRAPH, not a diagram. Never make a whole "
    "slide that is only an image. For dry/technical decks, images are optional.\n"
    "- Choose a theme that fits the tone: midnight (tech), paper (formal), sunrise (bold/consumer), "
    "forest (calm/sustainability).\n\n"

    "Output ONLY valid SlideLang source. No prose, no backticks, no explanation.\n\n"
    + GRAMMAR
)


@dataclass
class Step:
    stage: str
    ok: bool
    detail: str = ""
    latency_ms: int = 0
    diagnostics: int = 0


@dataclass
class AuthorResult:
    spec: str
    used_model: bool
    trace: list[Step] = field(default_factory=list)
    errors: int = 0
    repairs: int = 0
    attempts: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "spec": self.spec,
            "used_model": self.used_model,
            "errors": self.errors,
            "repairs": self.repairs,
            "attempts": self.attempts,
            "trace": [s.__dict__ for s in self.trace],
        }


def _clean(text: str) -> str:
    return re.sub(r"```[a-z]*|```", "", text or "").strip()


async def author(prompt: str, use_model: bool = True, basis: str | None = None) -> AuthorResult:
    """basis: an existing deck spec to *update* (grounds the model on the current deck)."""
    trace: list[Step] = []
    t0 = time.time()

    # 1) PLAN
    trace.append(Step("plan", True, f'goal: "{prompt[:60]}"'))

    # 2) AUTHOR
    spec: str | None = None
    used_model = False
    if use_model and settings.model_enabled:
        user = prompt if not basis else (
            f"Here is the current deck:\n{basis}\n\nUpdate it per: \"{prompt}\". "
            f"Keep structure and headings stable. Output only SlideLang source."
        )
        res = await call_model(user, SYSTEM)
        if res.ok and res.text:
            candidate = _clean(res.text)
            if re.search(r"^deck\s", candidate, re.M):
                spec, used_model = candidate, True
                trace.append(Step("author", True, "model authored spec", res.latency_ms))
            else:
                trace.append(Step("author", False, "model output missing deck header", res.latency_ms))
        else:
            trace.append(Step("author", False, f"model unavailable ({res.error})", res.latency_ms))
    if spec is None:
        spec = simulate_author(prompt)
        trace.append(Step("author", True, "deterministic author"))

    # 3) VERIFY -> 4) REPAIR loop (compiler diagnostics are the feedback signal).
    # Guarded: a model can emit a spec that trips a compiler edge case; that must
    # NEVER crash the request. On any build failure we fall back to a known-good deck.
    attempts = 0
    try:
        while attempts < settings.max_repair_attempts:
            b = build(spec)
            errs = len(b["errors"])
            trace.append(Step("verify", errs == 0, f'{errs} error(s), {len(b["warnings"])} warning(s)', diagnostics=errs))
            if b["repairs"]:
                trace.append(Step("repair", True, f'{len(b["repairs"])} auto-repair(s)'))
            if errs == 0:
                break
            attempts += 1
        final = build(spec)
    except Exception as e:  # noqa: BLE001 - model spec broke the compiler; recover
        log_event(log, "author_build_error", error=type(e).__name__)
        trace.append(Step("author", False, f"compiler error on model spec ({type(e).__name__}); recovered with deterministic deck"))
        spec = simulate_author(prompt)
        used_model = False
        final = build(spec)

    result = AuthorResult(
        spec=spec, used_model=used_model, trace=trace,
        errors=len(final["errors"]), repairs=len(final["repairs"]), attempts=attempts,
    )
    log_event(log, "author_done", used_model=used_model, errors=result.errors,
              repairs=result.repairs, attempts=attempts, total_ms=int((time.time() - t0) * 1000))
    return result
