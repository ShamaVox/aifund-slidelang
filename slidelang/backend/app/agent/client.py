"""Model client: retries with backoff, a hard timeout, and a graceful fallback.

Reliability is the point of this module. A model call can be slow, rate-limited,
or return junk; none of that is allowed to break the authoring workflow. On any
failure we surface a typed result and let the caller fall back to the
deterministic author, so the product degrades softly instead of dead-ending.
"""
from __future__ import annotations
import logging
import time
from dataclasses import dataclass

import httpx

from ..config import settings
from ..logging_conf import log_event

log = logging.getLogger("slidelang.model")


@dataclass
class ModelResult:
    text: str | None
    ok: bool
    attempts: int
    error: str | None = None
    latency_ms: int = 0


async def call_model(prompt: str, system: str) -> ModelResult:
    if not settings.model_enabled:
        return ModelResult(text=None, ok=False, attempts=0, error="no_api_key")

    body = {
        "model": settings.model,
        "max_tokens": 8000,
        # Prompt caching: the system prompt (grammar + authoring rules) is large and
        # identical on every call, so we cache it. Repeat calls within the cache TTL
        # skip re-processing it, which cuts latency and cost. Safe if under the min
        # cacheable size: the API silently ignores the directive.
        "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": settings.anthropic_api_key or "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    start = time.time()
    last_err = "unknown"
    for attempt in range(1, settings.max_retries + 2):  # initial + retries
        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout_s) as client:
                resp = await client.post("https://api.anthropic.com/v1/messages", json=body, headers=headers)
            if resp.status_code == 429 or resp.status_code >= 500:
                last_err = f"http_{resp.status_code}"
                raise httpx.HTTPError(last_err)
            resp.raise_for_status()
            data = resp.json()
            text = "\n".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()
            ms = int((time.time() - start) * 1000)
            log_event(log, "model_call_ok", attempt=attempt, latency_ms=ms)
            return ModelResult(text=text, ok=True, attempts=attempt, latency_ms=ms)
        except Exception as e:  # noqa: BLE001 - deliberately broad; we degrade on any failure
            last_err = type(e).__name__ if str(e) == "" else str(e)
            log_event(log, "model_call_retry", attempt=attempt, error=last_err)
            time.sleep(min(2 ** (attempt - 1) * 0.25, 2.0))  # backoff, capped
    ms = int((time.time() - start) * 1000)
    log_event(log, "model_call_failed", attempts=settings.max_retries + 1, error=last_err, latency_ms=ms)
    return ModelResult(text=None, ok=False, attempts=settings.max_retries + 1, error=last_err, latency_ms=ms)
