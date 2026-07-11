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

SYSTEM = "You are an authoring agent for SlideLang, a deck-as-code language.\n" + GRAMMAR


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
