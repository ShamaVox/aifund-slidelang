"""Eval harness. Runs a golden set of prompts/specs through the compiler and
(optionally) the agent, and reports the metrics the panel will ask about:
spec-validity, repair-resolution, and binding integrity. Deterministic by
default so it runs in CI without an API key.

Run:  python -m app.eval.harness
"""
from __future__ import annotations
import asyncio
import json

from ..agent.deterministic import simulate_author
from ..compiler.pipeline import build

# Golden specs with seeded defects and the expected post-repair outcome.
GOLDENS = [
    {
        "name": "clean_pitch",
        "src": simulate_author("Seed pitch for an AI-native retail platform"),
        "expect_errors_after_repair": 0,
    },
    {
        "name": "overflow_bullets",
        "src": "deck \"x\"\ntheme paper\n" + "slide bullets\n  heading \"h\"\n" + "".join(f"  point \"p{i}\"\n" for i in range(9)),
        "expect_errors_after_repair": 0,
        "expect_repair_code": "W201",
    },
    {
        "name": "bad_chart_data",
        "src": "deck \"x\"\ntheme paper\nslide chart.bar\n  heading \"h\"\n  data A 10, B nope, C 30",
        "expect_errors_after_repair": 0,
        "expect_repair_code": "E302",
    },
    {
        "name": "unknown_bind",
        "src": "deck \"x\"\ntheme paper\nslide chart.bar\n  heading \"h\"\n  bind missing",
        "expect_errors_after_repair": 1,  # E310 is not auto-repairable
        "expect_error_code": "E310",
    },
    {
        "name": "missing_title_and_heading",
        "src": "slide bullets\n  point \"only a point\"",
        "expect_errors_after_repair": 0,
    },
]


def run_compiler_evals() -> dict:
    results = []
    for g in GOLDENS:
        b = build(g["src"])
        errs = len(b["errors"])
        codes = {d["code"] for d in b["diagnostics"]}
        repair_codes = {r["code"] for r in b["repairs"]}
        ok = errs == g["expect_errors_after_repair"]
        if "expect_repair_code" in g:
            ok = ok and g["expect_repair_code"] in repair_codes
        if "expect_error_code" in g:
            ok = ok and g["expect_error_code"] in codes
        results.append({"name": g["name"], "pass": ok, "errors": errs, "repairs": len(b["repairs"])})
    passed = sum(1 for r in results if r["pass"])
    return {
        "suite": "compiler",
        "passed": passed,
        "total": len(results),
        "pass_rate_pct": round(passed / len(results) * 100, 1),
        "results": results,
    }


async def run_agent_evals(use_model: bool = False) -> dict:
    from ..agent.loop import author
    prompts = ["Seed pitch for an AI startup", "Technical design review", "Quarterly board update"]
    rows = []
    for p in prompts:
        r = await author(p, use_model=use_model)
        rows.append({"prompt": p, "errors": r.errors, "repairs": r.repairs, "used_model": r.used_model})
    valid = sum(1 for r in rows if r["errors"] == 0)
    return {
        "suite": "agent",
        "spec_validity_pct": round(valid / len(rows) * 100, 1),
        "results": rows,
    }


def main() -> None:
    comp = run_compiler_evals()
    agent = asyncio.run(run_agent_evals(use_model=False))
    print(json.dumps({"compiler": comp, "agent": agent}, indent=2))
    if comp["passed"] != comp["total"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
