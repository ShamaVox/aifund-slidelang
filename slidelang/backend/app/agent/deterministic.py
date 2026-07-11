"""Deterministic author + updater. No model required; guarantees a valid, clean
spec so the workflow never dead-ends. This is the SAFETY NET, not the product:
it cannot understand an arbitrary prompt, so it aims to be well-structured and
honestly generic — never crude. It derives a proper title (it never dumps the
raw prompt into the heading) and uses takeaway-style headlines. Kept in parity
with the JS planner in src/agent/author.js.
"""
from __future__ import annotations
import re

_STOP = {"a", "an", "the", "for", "about", "on", "of", "our", "my", "to", "with", "and"}


def _title_from(prompt: str) -> str:
    """Extract a short, clean title from a natural-language prompt."""
    p = (prompt or "").strip()
    p = re.sub(r"^(make|build|create|generate|draft|write|design|put together)\s+", "", p, flags=re.I)
    p = re.sub(r"^(a|an|the)\s+", "", p, flags=re.I)
    p = re.split(r"[,.:;]| that | which | showing | covering ", p, flags=re.I)[0].strip()
    words = [w for w in p.split() if w]
    if not words:
        return "Overview"
    # keep it tight: first 6 meaningful words, drop trailing stopwords
    words = words[:6]
    while words and words[-1].lower() in _STOP:
        words.pop()
    title = " ".join(words) or "Overview"
    title = title[0].upper() + title[1:]
    return title[:54]


def simulate_author(prompt: str) -> str:
    p = (prompt or "").lower()
    title = _title_from(prompt)
    is_pitch = bool(re.search(r"pitch|seed|invest|raise|fundrais|series [a-c]|deck", p))
    is_tech = bool(re.search(r"architect|technical|system|pipeline|design review|infra|api|engineering", p))
    theme = "paper" if re.search(r"light|paper|clean|formal", p) else "forest" if re.search(r"green|forest|climate|sustain", p) else "sunrise" if re.search(r"consumer|brand|retail|launch", p) else "midnight"
    subtitle = "Seed round · 2026" if is_pitch else "Technical design review" if is_tech else "A structured overview"

    L = [f'deck "{title}"', f"theme {theme}", ""]
    L += ["slide title", f'  heading "{title}"', f'  subtitle "{subtitle}"',
          '  notes "Open with the one-line thesis, then the problem."', ""]
    L += ["slide section", '  heading "The problem"', ""]

    if is_pitch:
        L += ["dataset growth", "  row Q1 1.2", "  row Q2 2.0", "  row Q3 3.1", "  row Q4 4.4", ""]
        L += ["slide bullets", '  heading "Teams replaced headcount with agents — but output is brittle"',
              '  point "Generation is solved; trust and editability are not"',
              '  point "Repeatable work still costs hours of hand-tuning"',
              '  point "The bottleneck moved from making to trusting"', ""]
        L += ["slide metrics", '  heading "The numbers are moving the right way"',
              '  metric "ARR" "$4.4M" "+42%"', '  metric "Net retention" "131%" "+9pt"', '  metric "Burn multiple" "0.8x" "-0.3x"', ""]
        L += ["slide chart.area", '  heading "ARR nearly quadrupled across four quarters"', "  bind growth", ""]
        L += ["slide math", '  heading "Efficiency is the whole story"', '  formula "burn = \\\\frac{net\\\\ burn}{net\\\\ new\\\\ ARR}"', ""]
    elif is_tech:
        L += ["slide bullets", '  heading "One pipeline, four guarantees"',
              '  point "Prompt or spec intake feeds an agent planner"',
              '  point "The compiler lowers the spec to a typed layout IR"',
              '  point "Validation and repair run before anything renders"',
              '  point "Every stage emits a diagnostic with a line number"', ""]
        L += ["slide chart.bar", '  heading "The compile budget is dominated by planning, not rendering"', "  data Plan 800, Compile 40, Lint 6, Render 120", ""]
        L += ["slide math", '  heading "Confidence is the product of every check"', '  formula "score = \\\\prod_{i} check_i"', ""]
    else:
        L += ["slide bullets", '  heading "Structured beats static"',
              '  point "Editable, reviewable output — not flattened images"',
              '  point "Validation and repair are built in, not bolted on"',
              '  point "Publish or present from one workflow"', ""]
        L += ["slide metrics", '  heading "What good looks like"',
              '  metric "Time to first draft" "20s" "-90%"', '  metric "Edits preserved" "100%" "no clobber"', '  metric "Manual fixes" "0" "auto-repaired"', ""]
        L += ["slide chart.line", '  heading "Adoption compounds once the workflow clicks"', "  data Q1 20, Q2 55, Q3 90, Q4 140", ""]

    L += ["slide image", '  heading "Grounded in the real artifact, not a mockup"',
          f'  image "a clean editorial photograph representing {title.lower()}, soft natural light"', ""]
    L += ["slide quote", '  quote "The model is the easy part. The trust layer is the product."', '  cite "SlideLang"', ""]
    L += ["slide bullets", '  heading "The one thing to remember"',
          '  point "Structured authoring beats prompt-to-pixels"', '  point "Trust is the wedge"', ""]
    return "\n".join(L)
