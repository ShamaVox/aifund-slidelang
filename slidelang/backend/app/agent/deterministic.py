"""Deterministic author + updater. No model required; guarantees a valid spec so
the workflow never dead-ends. Ported from the JS planner to keep parity."""
from __future__ import annotations
import re


def simulate_author(prompt: str) -> str:
    p = (prompt or "").lower()
    topic = re.sub(r"^(make|build|create|generate|draft)\s+(a|an|the)?\s*", "", prompt or "Product overview", flags=re.I).strip()
    is_pitch = bool(re.search(r"pitch|seed|invest|raise|fundrais", p))
    is_tech = bool(re.search(r"architect|technical|system|pipeline|design review|infra|api", p))
    theme = "paper" if re.search(r"light|paper|clean", p) else "forest" if re.search(r"green|forest", p) else "midnight"
    title = (topic[:54][0].upper() + topic[:54][1:]) if len(topic) > 4 else "Deck"
    L = [f'deck "{title}"', f"theme {theme}", ""]
    L += ["slide title", f'  heading "{title}"',
          f'  subtitle "{"Seed round — 2026" if is_pitch else "Technical design review" if is_tech else "Overview"}"',
          '  notes "Open with the one-line thesis."', ""]
    if is_pitch:
        L += ["dataset arr", "  row Q1 1.2", "  row Q2 2.0", "  row Q3 3.1", "  row Q4 4.4", ""]
        L += ["slide bullets", '  heading "The problem"',
              '  point "Teams replaced headcount with agents, but output is brittle"',
              '  point "Generation is solved; trust and editability are not"',
              '  point "Repeatable decks still cost hours of hand-tuning"', ""]
        L += ["slide metrics", '  heading "Traction"',
              '  metric "ARR" "$4.4M" "+42%"', '  metric "NRR" "131%" "+9pt"', '  metric "Burn multiple" "0.8x" "-0.3x"', ""]
        L += ["slide chart.area", '  heading "ARR by quarter ($M)"', "  bind arr", ""]
        L += ["slide math", '  heading "Efficiency"', '  formula "burn = \\\\frac{net burn}{net new ARR}"', ""]
    elif is_tech:
        L += ["slide bullets", '  heading "System overview"',
              '  point "Prompt or spec intake feeds an agent planner"',
              '  point "Compiler lowers the spec to a typed layout IR"',
              '  point "Validation and repair run before render"', ""]
        L += ["slide chart.bar", '  heading "Latency budget (ms)"', "  data Plan 800, Compile 40, Lint 6, Render 120", ""]
        L += ["slide math", '  heading "Confidence"', '  formula "score = \\\\prod checks_i"', ""]
    else:
        L += ["slide bullets", '  heading "Highlights"',
              '  point "Structured, editable, reviewable output"',
              '  point "Validation and repair built in"',
              '  point "Publish or present from one workflow"', ""]
        L += ["slide chart.line", '  heading "Adoption"', "  data Q1 20, Q2 55, Q3 90, Q4 140", ""]
    L += ["slide quote", '  quote "The model is the easy part. The trust layer is the product."', '  cite "SlideLang"', ""]
    L += ["slide bullets", '  heading "Close"', '  point "Structured authoring beats prompt-to-pixels"', '  point "Trust is the wedge"', ""]
    return "\n".join(L)
