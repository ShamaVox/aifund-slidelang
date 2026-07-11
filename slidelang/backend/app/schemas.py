"""Request/response models. Pydantic gives us validation at the edge."""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field


class AuthorRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    use_model: bool = True
    basis: str | None = None  # existing spec to update (grounds a regenerate)


class CompileRequest(BaseModel):
    spec: str = Field(max_length=100_000)


class PublishRequest(BaseModel):
    spec: str = Field(max_length=100_000)


class KpiEvent(BaseModel):
    kind: str
    deck_id: str | None = None
    # free-form numeric/string fields the metrics layer understands
    slides: int | None = None
    errors: int | None = None
    repairs: int | None = None
    used_model: bool | None = None
    latency_ms: int | None = None
    slide_id: str | None = None
    field: str | None = None
    preserved: int | None = None
    changed: int | None = None
    conflicts: int | None = None
    count: int | None = None
    edited_slides: int | None = None
    total_slides: int | None = None
    seconds_since_generate: float | None = None
