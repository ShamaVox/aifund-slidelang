"""Vercel Python entrypoint. Exposes the FastAPI ASGI app; Vercel's @vercel/python
runtime serves it. All /api/* and /d/* routes rewrite here (see vercel.json)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.main import app  # noqa: E402,F401  (Vercel serves `app`)
