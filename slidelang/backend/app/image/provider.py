"""Image generation providers.

The interface is `generate(prompt) -> ImageAsset`. Generation is a commodity;
the value in this product is making the result trustworthy (see verifier) and
*stable* — the same prompt yields the same asset id, which is what lets the merge
layer reuse a pinned image instead of regenerating it.

The default provider renders a deterministic SVG so the app never depends on a
flaky external call in a demo. A real image model (an image API) implements the
same `generate` signature and slots in via SLIDELANG_IMAGE_PROVIDER.
"""
from __future__ import annotations
import base64
import hashlib
from dataclasses import dataclass


@dataclass
class ImageAsset:
    id: str            # stable hash of the prompt — same prompt, same id
    data_url: str      # renderable inline (data:image/svg+xml;base64,...)
    provider: str


def asset_id(prompt: str) -> str:
    return hashlib.sha256(prompt.strip().lower().encode()).hexdigest()[:16]


def _palette(seed: int) -> tuple[str, str, str]:
    h1 = seed % 360
    h2 = (h1 + 40) % 360
    return f"hsl({h1},70%,22%)", f"hsl({h2},65%,40%)", f"hsl({(h1 + 200) % 360},80%,60%)"


class PlaceholderProvider:
    """Deterministic SVG 'image'. A real, stable visual artifact — not model pixels,
    but a genuine asset with a stable id, so the merge/caching story is real."""
    name = "placeholder-svg"

    def generate(self, prompt: str) -> ImageAsset:
        seed = int(asset_id(prompt), 16)
        bg1, bg2, accent = _palette(seed)
        # a few deterministic shapes positioned by the hash
        shapes = []
        s = seed
        for i in range(5):
            s = (s * 1103515245 + 12345) & 0x7FFFFFFF
            cx = 80 + (s % 600)
            cy = 60 + ((s >> 8) % 280)
            r = 30 + ((s >> 16) % 90)
            op = 0.12 + ((s >> 4) % 20) / 100
            shapes.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{accent}" opacity="{op:.2f}"/>')
        label = (prompt[:48] + "…") if len(prompt) > 48 else prompt
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="768" height="400" viewBox="0 0 768 400">'
            f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient></defs>'
            f'<rect width="768" height="400" fill="url(#g)"/>'
            + "".join(shapes)
            + f'<text x="32" y="372" font-family="monospace" font-size="15" fill="rgba(255,255,255,.7)">{_esc(label)}</text>'
            f'</svg>'
        )
        b64 = base64.b64encode(svg.encode()).decode()
        return ImageAsset(id=asset_id(prompt), data_url=f"data:image/svg+xml;base64,{b64}", provider=self.name)


def _esc(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def get_provider() -> PlaceholderProvider:
    # A real provider (image API) would be selected here by env; interface is identical.
    return PlaceholderProvider()
