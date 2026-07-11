"""Runtime settings, read from environment. No secrets in code."""
from __future__ import annotations
import os


class Settings:
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    model: str = os.getenv("SLIDELANG_MODEL", "claude-sonnet-4-6")
    request_timeout_s: float = float(os.getenv("SLIDELANG_TIMEOUT", "30"))
    max_retries: int = int(os.getenv("SLIDELANG_MAX_RETRIES", "2"))
    max_repair_attempts: int = int(os.getenv("SLIDELANG_MAX_REPAIR", "3"))
    allow_origins: list[str] = os.getenv("SLIDELANG_CORS", "*").split(",")

    @property
    def model_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


settings = Settings()
