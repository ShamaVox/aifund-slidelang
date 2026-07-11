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
    "You are a principal-level presentation designer and strategist. You author decks in "
    "SlideLang, a deck-as-code language, and your decks look like a top-tier firm made them: "
    "a deliberate narrative arc, one idea per slide, and headlines that state the takeaway "
    "rather than name the topic.\n\n"
    "From the user's prompt, infer the audience and purpose, then build 7-10 slides with an arc:\n"
    "1. Title  — the thesis, not just a name.\n"
    "2. Context or problem  — why this matters now.\n"
    "3-7. The argument  — ALTERNATE slide types: bullets for claims, a metrics slide for proof, "
    "a chart for a trend, a table for detail, math for a model. Use concrete, specific content and "
    "realistic numbers. Never use placeholders like 'Metric 1' or 'lorem'.\n"
    "8. One image slide with a vivid, literal description of the picture.\n"
    "9. A close  — the single thing to remember, ideally a quote.\n\n"
    "Quality rules:\n"
    "- Headlines are full takeaways: 'Extraction accuracy climbed to 96% in one quarter', not 'Accuracy'.\n"
    "- Vary slide types across the deck. Every deck MUST include at least one chart, one metrics slide, "
    "and one image slide.\n"
    "- When the same numbers drive a chart, declare a `dataset` once and `bind` it (data-bound slides).\n"
    "- Choose a theme that fits the tone: midnight (tech/default), paper (clean/formal), "
    "sunrise (bold/consumer), forest (calm/sustainability).\n"
    "- Specific, real words only. No filler, no TODO, no empty fields.\n\n"
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

    # 3) VERIFY -> 4) REPAIR loop (compiler diagnostics are the feedback signal)
    attempts = 0
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
    result = AuthorResult(
        spec=spec, used_model=used_model, trace=trace,
        errors=len(final["errors"]), repairs=len(final["repairs"]), attempts=attempts,
    )
    log_event(log, "author_done", used_model=used_model, errors=result.errors,
              repairs=result.repairs, attempts=attempts, total_ms=int((time.time() - t0) * 1000))
    return result
