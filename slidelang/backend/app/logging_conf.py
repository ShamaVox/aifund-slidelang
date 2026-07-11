"""Structured JSON logging. Every request and agent step emits a line with a
request id, stage, latency, and outcome — the observability the panel can read.
"""
from __future__ import annotations
import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

request_id: ContextVar[str] = ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": round(time.time(), 3),
            "level": record.levelname,
            "logger": record.name,
            "rid": request_id.get(),
            "msg": record.getMessage(),
        }
        if hasattr(record, "extra_fields"):
            payload.update(record.extra_fields)  # type: ignore[attr-defined]
        return json.dumps(payload)


def configure() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(logging.INFO)


def log_event(logger: logging.Logger, msg: str, **fields) -> None:
    rec = logger.makeRecord(logger.name, logging.INFO, __file__, 0, msg, None, None)
    rec.extra_fields = fields
    logger.handle(rec)


def new_request_id() -> str:
    rid = uuid.uuid4().hex[:12]
    request_id.set(rid)
    return rid
