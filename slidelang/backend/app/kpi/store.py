"""KPI store + metrics. The frontend beacons events (generate, edit, regenerate,
apply_merge, publish); this computes the PRD's success metrics from them so the
panel can see the product measured, not asserted.

In-memory by default; set SLIDELANG_KPI_FILE to persist to a JSONL file. In
production this would be a real event store; the metric definitions are what
matter and they live here.
"""
from __future__ import annotations
import json
import os
import threading
import time
from typing import Any

_LOCK = threading.Lock()
_EVENTS: list[dict] = []
_FILE = os.getenv("SLIDELANG_KPI_FILE")

# Event kinds we understand:
#   generate {deck_id, slides, errors, repairs, used_model, latency_ms}
#   edit     {deck_id, slide_id, field}
#   regenerate {deck_id, preserved, changed, conflicts}
#   clobber  {deck_id, count}          # edits lost (should stay ~0)
#   apply_merge {deck_id}
#   ship     {deck_id, edited_slides, total_slides, seconds_since_generate}
#   drift    {deck_id, count}          # headline/chart number mismatches caught


def record(event: dict) -> dict:
    event = {**event, "ts": time.time()}
    with _LOCK:
        _EVENTS.append(event)
        if _FILE:
            with open(_FILE, "a") as fh:
                fh.write(json.dumps(event) + "\n")
    return event


def _by(kind: str) -> list[dict]:
    return [e for e in _EVENTS if e.get("kind") == kind]


def metrics() -> dict[str, Any]:
    gens = _by("generate")
    regens = _by("regenerate")
    ships = _by("ship")
    clobbers = _by("clobber")
    drifts = _by("drift")

    def avg(xs: list[float]) -> float:
        xs = [x or 0 for x in xs]
        return round(sum(xs) / len(xs), 2) if xs else 0.0

    first_pass_valid = avg([1.0 if (g.get("errors") or 0) == 0 and (g.get("repairs") or 0) == 0 else 0.0 for g in gens]) * 100
    accepted_unedited = avg([
        1.0 if s.get("total_slides") and (s.get("edited_slides") or 0) == 0 else
        round(1 - (s.get("edited_slides") or 0) / max(1, s.get("total_slides") or 1), 3)
        for s in ships
    ]) * 100
    edit_to_ship_s = avg([s.get("seconds_since_generate") or 0 for s in ships])
    preserved = sum((r.get("preserved") or 0) for r in regens)
    clobbered = sum((c.get("count") or 0) for c in clobbers)
    clobber_rate = round(clobbered / max(1, preserved + clobbered) * 100, 2)

    return {
        "events_total": len(_EVENTS),
        "decks_generated": len(gens),
        "regenerations": len(regens),
        "first_pass_spec_validity_pct": round(first_pass_valid, 1),
        "slides_accepted_unedited_pct": round(accepted_unedited, 1),
        "edit_to_ship_seconds": edit_to_ship_s,
        "edits_preserved_on_regen": preserved,
        "regenerate_clobber_rate_pct": clobber_rate,
        "number_drift_incidents": sum((d.get("count") or 0) for d in drifts),
        "avg_gen_latency_ms": int(avg([g.get("latency_ms") or 0 for g in gens])),
    }


def reset() -> None:
    with _LOCK:
        _EVENTS.clear()
