"""Live agentic authoring — an LLM operates SlideLang's compiler as a TOOL.

Given a goal, the model writes a SlideLang spec, calls the `compile` tool to
validate it, reads the diagnostics, fixes any errors, and re-compiles until the
deck is clean. This is the brief's "AI agents create structured deck specs"
made live: the agent is in the driver's seat, using the compiler to self-correct.

Returns a step-by-step trace so the UI can replay what the agent did.
"""
from __future__ import annotations
import json
import logging
from typing import Any

import httpx

from ..config import settings
from ..compiler.pipeline import build
from .grammar import GRAMMAR

log = logging.getLogger("slidelang.agentic")

TOOLS = [{
    "name": "compile",
    "description": (
        "Validate a SlideLang spec. Returns slide count, errors, warnings, and "
        "auto-repairs. Call this to check your spec; fix any errors it reports and "
        "compile again until there are 0 errors."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "spec": {"type": "string", "description": "The full SlideLang source to validate."},
        },
        "required": ["spec"],
    },
}]

SYSTEM = (
    "You are an autonomous agent that authors presentation decks in SlideLang, a "
    "deck-as-code language. Given a goal:\n"
    "1. Write a SlideLang spec (7-10 slides, a clear narrative arc, concrete content).\n"
    "2. Call the `compile` tool to validate it.\n"
    "3. Read the compiler's diagnostics and FIX any errors, then compile again.\n"
    "4. Repeat until the deck compiles with 0 errors.\n"
    "When it is clean, reply with the final SlideLang spec ONLY — no prose, no backticks.\n\n"
    + GRAMMAR
)


async def run_agent(goal: str, max_turns: int = 5) -> dict[str, Any]:
    if not settings.model_enabled:
        return {"ok": False, "error": "no_api_key", "trace": [], "spec": None, "slides": 0, "errors": 0}

    headers = {
        "x-api-key": settings.anthropic_api_key or "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    messages: list[dict[str, Any]] = [{"role": "user", "content": f"Goal: {goal}"}]
    trace: list[dict[str, Any]] = [{"kind": "goal", "detail": goal}]
    final_spec: str | None = None
    last_compiled: str | None = None

    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_s) as client:
            for _turn in range(max_turns):
                body = {
                    "model": settings.model, "max_tokens": 4000,
                    "system": SYSTEM, "tools": TOOLS, "messages": messages,
                }
                resp = await client.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                content = data.get("content", [])
                text = "".join(b.get("text", "") for b in content if b.get("type") == "text").strip()
                tool_uses = [b for b in content if b.get("type") == "tool_use"]

                if tool_uses:
                    if text:
                        trace.append({"kind": "think", "detail": text[:220]})
                    messages.append({"role": "assistant", "content": content})
                    tool_results = []
                    for tu in tool_uses:
                        if tu.get("name") == "compile":
                            spec = (tu.get("input") or {}).get("spec", "")
                            b = build(spec)
                            last_compiled = spec
                            summary = {
                                "slides": b["slides"], "errors": len(b["errors"]),
                                "warnings": len(b["warnings"]), "repairs": len(b["repairs"]),
                            }
                            trace.append({
                                "kind": "tool", "detail":
                                f"compile → {summary['slides']} slides, {summary['errors']} errors, "
                                f"{summary['warnings']} warnings, {summary['repairs']} auto-repairs",
                                "spec": spec,
                            })
                            tool_results.append({
                                "type": "tool_result", "tool_use_id": tu["id"],
                                "content": json.dumps(summary),
                            })
                    messages.append({"role": "user", "content": tool_results})
                    continue

                # no tool call -> the model returned the final spec
                spec = text.replace("```slidelang", "").replace("```", "").strip()
                final_spec = spec if spec.startswith("deck") else (last_compiled or spec)
                trace.append({"kind": "final", "detail": "agent finished — deck is clean", "spec": final_spec})
                break
            else:
                final_spec = last_compiled
                trace.append({"kind": "final", "detail": "reached step limit", "spec": final_spec})
    except Exception as e:  # noqa: BLE001
        log.warning("agent loop failed: %s", type(e).__name__)
        return {"ok": False, "error": type(e).__name__, "trace": trace, "spec": last_compiled,
                "slides": 0, "errors": 0}

    fb = build(final_spec) if final_spec else {"slides": 0, "errors": []}
    return {"ok": True, "spec": final_spec, "trace": trace,
            "slides": fb["slides"], "errors": len(fb["errors"])}
