"""Request/response models. Pydantic validates at the edge.
Uses typing.Optional (not `X | None`) so the backend runs on Python 3.9+."""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class AuthorRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    use_model: bool = True
    basis: Optional[str] = None  # existing spec to update (grounds a regenerate)


class AgentGoalRequest(BaseModel):
    goal: str = Field(min_length=1, max_length=2000)


class CompileRequest(BaseModel):
    spec: str = Field(max_length=100_000)


class PublishRequest(BaseModel):
    spec: str = Field(max_length=100_000)


class ImageRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=400)


class KpiEvent(BaseModel):
    kind: str
    deck_id: Optional[str] = None
    slides: Optional[int] = None
    errors: Optional[int] = None
    repairs: Optional[int] = None
    used_model: Optional[bool] = None
    latency_ms: Optional[int] = None
    slide_id: Optional[str] = None
    field: Optional[str] = None
    preserved: Optional[int] = None
    changed: Optional[int] = None
    conflicts: Optional[int] = None
    count: Optional[int] = None
    edited_slides: Optional[int] = None
    total_slides: Optional[int] = None
    seconds_since_generate: Optional[float] = None
