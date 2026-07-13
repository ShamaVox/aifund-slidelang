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
    subject = title.lower()
    is_pitch = bool(re.search(r"pitch|seed|invest|raise|fundrais|series [a-c]|deck", p))
    is_tech = bool(re.search(r"architect|technical|system|pipeline|design review|infra|api|engineering", p))
    theme = "paper" if re.search(r"light|paper|clean|formal", p) else "forest" if re.search(r"green|forest|climate|sustain", p) else "sunrise" if re.search(r"consumer|brand|retail|launch|buyer|shop", p) else "midnight"
    subtitle = "Seed round" if is_pitch else "Technical design review" if is_tech else "A structured overview"

    L = [f'deck "{title}"', f"theme {theme}", ""]
    L += ["slide title", f'  heading "{title}"', f'  subtitle "{subtitle}"',
          '  notes "Open with the one-line thesis, then the problem."', ""]

    # A prompt-derived, honestly-generic outline. No fabricated metrics, no
    # SlideLang-specific claims. This is the safety net, so it stays neutral and
    # clearly reflects the prompt rather than pretending to be a specific company.
    if is_pitch:
        L += ["slide bullets", f'  heading "The problem {subject} solves"',
              '  point "Describe the pain your customer feels today"',
              '  point "Explain why existing tools fall short"',
              '  point "Show why now is the moment"', ""]
        L += ["slide bullets", f'  heading "How {title} works"',
              '  point "The core insight behind the product"',
              '  point "What the product actually does for the user"',
              '  point "Why it is hard to copy"', ""]
        L += ["slide metrics", '  heading "Traction (replace with your real numbers)"',
              '  metric "Revenue" "—" ""', '  metric "Growth" "—" ""', '  metric "Retention" "—" ""', ""]
        L += ["slide chart.line", '  heading "Growth over time (replace with your data)"', "  data Q1 1, Q2 2, Q3 3, Q4 4", ""]
    elif is_tech:
        L += ["slide bullets", f'  heading "What {title} is"',
              '  point "The problem this system addresses"',
              '  point "The core design principle"',
              '  point "The main components and how they connect"', ""]
        L += ["slide bullets", '  heading "Key design decisions"',
              '  point "Decision one and the tradeoff behind it"',
              '  point "Decision two and why the alternative was rejected"', ""]
        L += ["slide chart.bar", '  heading "Where the work goes (replace with your data)"', "  data Plan 3, Build 5, Test 2, Ship 1", ""]
    else:
        L += ["slide bullets", f'  heading "Overview of {subject}"',
              '  point "The first key point"',
              '  point "The second key point"',
              '  point "The third key point"', ""]
        L += ["slide metrics", '  heading "Key numbers (replace with your data)"',
              '  metric "Metric one" "—" ""', '  metric "Metric two" "—" ""', ""]

    L += ["slide bullets", '  heading "What to remember"',
          '  point "The single most important takeaway"',
          '  point "The clear next step"', ""]
    return "\n".join(L)
