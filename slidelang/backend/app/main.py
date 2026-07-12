"""SlideLang API (FastAPI).

Routes:
  POST /api/author     {prompt, use_model?, basis?}  -> agent authoring result + trace
  POST /api/compile    {spec}                          -> compiler build result
  POST /api/publish    {spec}                          -> {id, url}
  GET  /d/{id}                                          -> published deck (JSON build)
  POST /api/kpi/event  {kind, ...}                      -> record a KPI event
  GET  /api/kpi/metrics                                 -> computed success metrics
  GET  /api/eval                                        -> run the compiler eval suite
  GET  /api/health                                      -> liveness + model status
"""
from __future__ import annotations
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .agent.loop import author
from .compiler.pipeline import build
from .config import settings
from .eval.harness import run_compiler_evals
from .image.provider import get_provider
from .image.verifier import verify as verify_image
from .kpi import store as kpi
from .logging_conf import configure, log_event, new_request_id
from .schemas import AgentGoalRequest, AuthorRequest, CompileRequest, ImageRequest, KpiEvent, PublishRequest

configure()
log = logging.getLogger("slidelang.api")
app = FastAPI(title="SlideLang API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=settings.allow_origins,
    allow_methods=["*"], allow_headers=["*"],
)

_PUBLISHED: dict[str, str] = {}


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = new_request_id()
    start = time.time()
    response = await call_next(request)
    log_event(log, "request", method=request.method, path=request.url.path,
              status=response.status_code, latency_ms=int((time.time() - start) * 1000))
    response.headers["x-request-id"] = rid
    return response


@app.get("/api/health")
async def health():
    return {"ok": True, "model_enabled": settings.model_enabled, "model": settings.model}


@app.post("/api/author")
async def api_author(req: AuthorRequest):
    # Bulletproof: never return an empty body. If anything throws, recover with a
    # deterministic, known-compilable deck so the client always gets valid JSON.
    try:
        result = await author(req.prompt, use_model=req.use_model, basis=req.basis)
        return result.to_dict()
    except Exception as e:  # noqa: BLE001
        log_event(log, "author_route_error", error=type(e).__name__)
        from .agent.deterministic import simulate_author
        spec = simulate_author(req.prompt)
        return {
            "spec": spec, "used_model": False, "errors": 0, "repairs": 0, "attempts": 0,
            "trace": [{"stage": "author", "ok": False, "detail": f"recovered from {type(e).__name__}"}],
        }


@app.post("/api/agent")
async def api_agent(req: AgentGoalRequest):
    """Live agentic authoring: an LLM operates the compiler as a tool, iterating
    until the deck is clean. Returns a step-by-step trace of what the agent did."""
    from .agent.agentic import run_agent
    return await run_agent(req.goal)


@app.post("/api/image")
async def api_image(req: ImageRequest):
    """Generate a visual for an image slide, gated by the verifier.
    Deterministic: the same prompt returns the same asset id, so a regenerate can
    reuse a pinned image instead of making a new one."""
    verdict = verify_image(req.prompt)
    if not verdict.ok:
        return JSONResponse({"ok": False, "score": verdict.score, "flags": verdict.flags}, status_code=422)
    asset = get_provider().generate(req.prompt)
    log_event(log, "image_generated", asset_id=asset.id, provider=asset.provider, score=verdict.score)
    return {"ok": True, "id": asset.id, "data_url": asset.data_url, "provider": asset.provider,
            "score": verdict.score, "flags": verdict.flags}


@app.post("/api/compile")
async def api_compile(req: CompileRequest):
    return build(req.spec)


@app.post("/api/publish")
async def api_publish(req: PublishRequest):
    import uuid
    did = uuid.uuid4().hex[:7]
    _PUBLISHED[did] = req.spec
    return {"id": did, "url": f"/d/{did}"}


@app.get("/d/{deck_id}")
async def api_get_deck(deck_id: str):
    spec = _PUBLISHED.get(deck_id)
    if spec is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return build(spec)


@app.post("/api/kpi/event")
async def api_kpi_event(ev: KpiEvent):
    rec = kpi.record(ev.model_dump())
    return {"recorded": True, "ts": rec["ts"]}


@app.get("/api/kpi/metrics")
async def api_kpi_metrics():
    return kpi.metrics()


@app.get("/api/eval")
async def api_eval():
    return run_compiler_evals()
