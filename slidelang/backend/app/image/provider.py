"""Image providers with real multi-vendor fallback.

Chain: OpenAI gpt-image -> Google Gemini ("nano banana") -> deterministic SVG.
Anthropic/Claude is intentionally NOT here: it does not generate images.

Env:
  SLIDELANG_IMAGE_PROVIDER=openai     (turns on real generation)
  OPENAI_API_KEY=...                  (OpenAI gpt-image)
  SLIDELANG_IMAGE_MODEL=gpt-image-2   (preferred OpenAI model)
  GEMINI_API_KEY=...                  (optional nano-banana fallback)
"""
from __future__ import annotations
import base64
import hashlib
import logging
import os
from dataclasses import dataclass

log = logging.getLogger("slidelang.image")


@dataclass
class ImageAsset:
    id: str
    data_url: str
    provider: str


def asset_id(prompt: str) -> str:
    return hashlib.sha256(prompt.strip().lower().encode()).hexdigest()[:16]


def _style(prompt: str) -> str:
    return (f"{prompt}. Professional editorial photograph, clean composition, natural "
            f"lighting, high detail, muted tasteful color palette, no text, no watermark.")


# ---------- deterministic placeholder (never fails) ----------
def _palette(seed: int):
    h1 = seed % 360
    return f"hsl({h1},70%,22%)", f"hsl({(h1 + 40) % 360},65%,40%)", f"hsl({(h1 + 200) % 360},80%,60%)"


def _esc(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class PlaceholderProvider:
    name = "placeholder-svg"

    def generate(self, prompt: str) -> ImageAsset:
        seed = int(asset_id(prompt), 16)
        bg1, bg2, accent = _palette(seed)
        shapes, s = [], seed
        for _ in range(5):
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            cx = 80 + (s % 600); cy = 60 + ((s >> 8) % 280)
            r = 30 + ((s >> 16) % 90); op = 0.12 + ((s >> 4) % 20) / 100
            shapes.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{accent}" opacity="{op:.2f}"/>')
        label = (prompt[:48] + "…") if len(prompt) > 48 else prompt
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="768" height="400" viewBox="0 0 768 400">'
               f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
               f'<stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient></defs>'
               f'<rect width="768" height="400" fill="url(#g)"/>' + "".join(shapes)
               + f'<text x="32" y="372" font-family="monospace" font-size="15" fill="rgba(255,255,255,.7)">{_esc(label)}</text></svg>')
        b64 = base64.b64encode(svg.encode()).decode()
        return ImageAsset(asset_id(prompt), f"data:image/svg+xml;base64,{b64}", self.name)


# ---------- OpenAI gpt-image (raises on total failure) ----------
class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        self.key = os.getenv("OPENAI_API_KEY", "")
        preferred = os.getenv("SLIDELANG_IMAGE_MODEL", "gpt-image-2")
        chain = [preferred, "gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini", "gpt-image-1"]
        seen, self.models = set(), []
        for m in chain:
            if m and m not in seen:
                seen.add(m); self.models.append(m)
        self.timeout = float(os.getenv("SLIDELANG_IMAGE_TIMEOUT", "55"))

    def generate(self, prompt: str) -> ImageAsset:
        import httpx
        styled = _style(prompt)
        headers = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        last = "unknown"
        for model in self.models:
            body = {"model": model, "prompt": styled, "n": 1, "size": "1536x1024"}
            try:
                with httpx.Client(timeout=self.timeout) as c:
                    r = c.post("https://api.openai.com/v1/images/generations", json=body, headers=headers)
                    if r.status_code >= 400:
                        try:
                            last = f"{model}: {r.json().get('error', {}).get('message', r.status_code)}"
                        except Exception:
                            last = f"{model}: http {r.status_code}"
                        log.warning("openai (%s) rejected: %s", model, last)
                        continue
                    item = r.json()["data"][0]
                    b64 = item.get("b64_json")
                    if not b64 and item.get("url"):
                        b64 = base64.b64encode(c.get(item["url"]).content).decode()
                if not b64:
                    last = f"{model}: no image data"; continue
                return ImageAsset(asset_id(prompt), f"data:image/png;base64,{b64}", f"openai:{model}")
            except Exception as e:  # noqa: BLE001
                last = f"{model}: {type(e).__name__}"; continue
        raise RuntimeError(last)


# ---------- Google Gemini "nano banana" (raises on failure) ----------
class GeminiProvider:
    name = "gemini"

    def __init__(self) -> None:
        self.key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
        self.model = os.getenv("SLIDELANG_GEMINI_MODEL", "gemini-2.5-flash-image")
        self.timeout = float(os.getenv("SLIDELANG_IMAGE_TIMEOUT", "55"))

    def generate(self, prompt: str) -> ImageAsset:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        headers = {"x-goog-api-key": self.key, "Content-Type": "application/json"}
        body = {"contents": [{"parts": [{"text": _style(prompt)}]}]}
        with httpx.Client(timeout=self.timeout) as c:
            r = c.post(url, json=body, headers=headers)
        if r.status_code >= 400:
            try:
                raise RuntimeError(f"gemini: {r.json().get('error', {}).get('message', r.status_code)}")
            except Exception:
                raise RuntimeError(f"gemini: http {r.status_code}")
        # find the inline image part in the response
        for cand in r.json().get("candidates", []):
            for part in cand.get("content", {}).get("parts", []):
                inline = part.get("inlineData") or part.get("inline_data")
                if inline and inline.get("data"):
                    mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                    return ImageAsset(asset_id(prompt), f"data:{mime};base64,{inline['data']}", f"gemini:{self.model}")
        raise RuntimeError("gemini: no image in response")


# ---------- multi-vendor chain with graceful placeholder ----------
class MultiProvider:
    name = "multi"

    def __init__(self) -> None:
        self.providers = []
        if os.getenv("OPENAI_API_KEY"):
            self.providers.append(OpenAIProvider())
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            self.providers.append(GeminiProvider())
        self.placeholder = PlaceholderProvider()

    def generate(self, prompt: str) -> ImageAsset:
        errors = []
        for p in self.providers:
            try:
                return p.generate(prompt)
            except Exception as e:  # noqa: BLE001
                msg = str(e) or type(e).__name__
                log.warning("%s failed: %s", p.name, msg)
                errors.append(msg)
        a = self.placeholder.generate(prompt)
        reason = "; ".join(errors)[:140] if errors else "no image provider configured"
        return ImageAsset(a.id, a.data_url, f"placeholder-fallback ({reason})")


def get_provider():
    choice = os.getenv("SLIDELANG_IMAGE_PROVIDER", "").lower()
    if choice in ("openai", "gemini", "multi", "auto") and (
        os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    ):
        return MultiProvider()
    return PlaceholderProvider()
