"""Image generation providers.

Interface: generate(prompt) -> ImageAsset. The default provider renders a
deterministic SVG so the app never depends on a flaky external call. Set
SLIDELANG_IMAGE_PROVIDER=openai (+ OPENAI_API_KEY) for real generated images.
"""
from __future__ import annotations
import base64
import hashlib
from dataclasses import dataclass


@dataclass
class ImageAsset:
    id: str
    data_url: str
    provider: str


def asset_id(prompt: str) -> str:
    return hashlib.sha256(prompt.strip().lower().encode()).hexdigest()[:16]


def _palette(seed: int):
    h1 = seed % 360
    h2 = (h1 + 40) % 360
    return f"hsl({h1},70%,22%)", f"hsl({h2},65%,40%)", f"hsl({(h1 + 200) % 360},80%,60%)"


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
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="768" height="400" viewBox="0 0 768 400">'
            f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient></defs>'
            f'<rect width="768" height="400" fill="url(#g)"/>' + "".join(shapes)
            + f'<text x="32" y="372" font-family="monospace" font-size="15" fill="rgba(255,255,255,.7)">{_esc(label)}</text></svg>'
        )
        b64 = base64.b64encode(svg.encode()).decode()
        return ImageAsset(id=asset_id(prompt), data_url=f"data:image/svg+xml;base64,{b64}", provider=self.name)


class OpenAIProvider:
    """Real image generation via OpenAI. Tries a chain of gpt-image models (which
    exist on current accounts), keeps the stable asset id, and surfaces the real
    error instead of silently degrading."""
    name = "openai"

    def __init__(self) -> None:
        import os
        self.key = os.getenv("OPENAI_API_KEY", "")
        preferred = os.getenv("SLIDELANG_IMAGE_MODEL", "gpt-image-2")
        chain = [preferred, "gpt-image-2", "gpt-image-1.5", "gpt-image-1-mini", "gpt-image-1"]
        seen, self.models = set(), []
        for m in chain:
            if m and m not in seen:
                seen.add(m); self.models.append(m)
        self.timeout = float(os.getenv("SLIDELANG_IMAGE_TIMEOUT", "55"))
        self._fallback = PlaceholderProvider()

    def _body_for(self, model: str, styled: str) -> dict:
        if model.startswith("dall-e"):
            size = "1792x1024" if model == "dall-e-3" else "1024x1024"
            return {"model": model, "prompt": styled[:900], "n": 1, "size": size}
        return {"model": model, "prompt": styled, "n": 1, "size": "1536x1024"}

    def generate(self, prompt: str) -> ImageAsset:
        import httpx
        import logging
        log = logging.getLogger("slidelang.image")
        styled = (
            f"{prompt}. Professional editorial photograph, clean composition, natural "
            f"lighting, high detail, muted tasteful color palette, no text, no watermark."
        )
        headers = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        last_err = "unknown"
        for model in self.models:
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.post("https://api.openai.com/v1/images/generations",
                                       json=self._body_for(model, styled), headers=headers)
                if resp.status_code >= 400:
                    try:
                        last_err = f"{model}: {resp.json().get('error', {}).get('message', resp.status_code)}"
                    except Exception:
                        last_err = f"{model}: http {resp.status_code}"
                    log.warning("openai image (%s) rejected: %s", model, last_err)
                    continue
                item = resp.json()["data"][0]
                b64 = item.get("b64_json")
                if not b64 and item.get("url"):
                    b64 = base64.b64encode(client.get(item["url"]).content).decode()
                if not b64:
                    last_err = f"{model}: no image data"; continue
                log.info("openai image ok via %s", model)
                return ImageAsset(id=asset_id(prompt), data_url=f"data:image/png;base64,{b64}", provider=f"openai:{model}")
            except Exception as e:  # noqa: BLE001
                last_err = f"{model}: {type(e).__name__}"
                log.warning("openai image (%s) failed: %s", model, last_err)
                continue
        log.warning("all openai models failed; last error: %s", last_err)
        asset = self._fallback.generate(prompt)
        return ImageAsset(id=asset.id, data_url=asset.data_url, provider=f"placeholder-fallback ({last_err})")


def get_provider():
    import os
    choice = os.getenv("SLIDELANG_IMAGE_PROVIDER", "").lower()
    if choice == "openai" and os.getenv("OPENAI_API_KEY"):
        return OpenAIProvider()
    return PlaceholderProvider()
