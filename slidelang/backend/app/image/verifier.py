"""Image verifier — the trustworthy half of image generation.

Generation is easy; the hard, differentiated part is not shipping a visual that is
off-brand, irrelevant, or a copyrighted/real-logo lookalike. This is the image
analog of the deck verifier: a cheap, deterministic check that gates the asset
before it lands on a slide. A production version would add a vision-model check
for relevance and safety; the contract (score + flags, gate on threshold) is the
part that matters and is exercised here.
"""
from __future__ import annotations
from dataclasses import dataclass, field

# Terms that suggest a real-brand/logo or unsafe request — blocked, not rendered.
BANNED = [
    "logo", "trademark", "brand mark", "nike", "apple logo", "coca-cola", "disney",
    "marvel", "nsfw", "explicit", "gore", "real person", "celebrity",
]


@dataclass
class Verdict:
    ok: bool
    score: float               # 0..1 confidence the asset is safe to ship
    flags: list[str] = field(default_factory=list)


def verify(prompt: str) -> Verdict:
    p = (prompt or "").lower()
    flags: list[str] = []
    score = 1.0
    for term in BANNED:
        if term in p:
            flags.append(f"blocked term: {term}")
            score -= 0.5
    if not p.strip():
        flags.append("empty prompt")
        score = 0.0
    if len(p) > 400:
        flags.append("prompt too long")
        score -= 0.1
    score = max(0.0, min(1.0, score))
    return Verdict(ok=score >= 0.6 and not any(f.startswith("blocked") for f in flags), score=round(score, 2), flags=flags)
