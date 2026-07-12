"""SlideLang compiler (Python port of the validation contract).

The authoritative renderer lives in the JS client. This Python compiler mirrors
the *validation contract* — parse, lint, repair — so the agent service can close
its own verify->repair loop server-side without a browser. Keeping the contract
in both places is deliberate: the server validates fast and headless; the client
compiles and renders. Diagnostics are structured so the agent can self-correct.
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Any

SLIDE_TYPES = [
    "title", "section", "bullets", "metrics", "chart.bar", "chart.line",
    "chart.area", "chart.pie", "table", "math", "image", "quote",
]
CHART_TYPES = {"chart.bar", "chart.line", "chart.area", "chart.pie"}
LIMITS = {"bullets": 6, "heading_chars": 90, "metrics": 4, "cols": 5}


def _split_args(s: str) -> list[str]:
    out, cur, q = [], "", False
    for ch in s:
        if ch == '"':
            q = not q
            continue
        if ch == " " and not q:
            if cur:
                out.append(cur)
                cur = ""
            continue
        cur += ch
    if cur:
        out.append(cur)
    return out


def parse(src: str) -> dict[str, Any]:
    ast: dict[str, Any] = {"title": None, "theme": "midnight", "slides": [], "datasets": {}}
    diags: list[dict] = []
    cur: dict | None = None
    for i, raw in enumerate(src.replace("\t", "  ").split("\n")):
        line = i + 1
        if not raw.strip() or raw.strip().startswith("//"):
            continue
        indent = len(raw) - len(raw.lstrip())
        t = raw.strip()
        kw, _, rest = t.partition(" ")
        rest = rest.strip()
        val = rest.strip('"')
        if indent == 0:
            if kw == "deck":
                ast["title"] = val or None; cur = None
            elif kw == "theme":
                ast["theme"] = rest; cur = None
            elif kw == "dataset":
                cur = {"_kind": "dataset", "name": rest, "rows": [], "line": line}
                ast["datasets"][rest] = cur
            elif kw == "slide":
                m = re.match(r"^(\S+)\s+#(\S+)$", rest)
                stype, sid = (m.group(1), m.group(2)) if m else (rest or "bullets", None)
                cur = {"_kind": "slide", "type": stype, "id": sid, "line": line, "heading": None,
                       "subtitle": None, "points": [], "metrics": [], "data": [], "rows": [],
                       "cols": [], "formula": None, "image": None, "quote": None, "cite": None,
                       "notes": None, "bind": None}
                ast["slides"].append(cur)
            else:
                diags.append({"sev": "error", "code": "E100", "line": line,
                              "msg": f'Unexpected top-level keyword "{kw}".'})
            continue
        if cur is None:
            diags.append({"sev": "error", "code": "E101", "line": line,
                          "msg": f'"{kw}" indented but not inside a slide or dataset.'})
            continue
        if cur.get("_kind") == "dataset":
            if kw == "row":
                parts = rest.replace("=", " ").split()
                try:
                    value = float(parts[1]); bad = False
                except (IndexError, ValueError):
                    value, bad = 0.0, True
                cur["rows"].append({"name": parts[0] if parts else "", "value": value, "_bad": bad})
            continue
        if kw in ("heading", "subtitle", "formula", "image", "quote", "cite"):
            cur[kw] = val
        elif kw == "notes":
            cur["notes"] = (cur["notes"] + " " if cur["notes"] else "") + val
        elif kw == "point":
            cur["points"].append(val)
        elif kw == "bind":
            cur["bind"] = rest.strip()
        elif kw == "metric":
            a = _split_args(rest)
            cur["metrics"].append({"label": a[0] if a else "", "value": a[1] if len(a) > 1 else "",
                                   "delta": a[2] if len(a) > 2 else ""})
        elif kw == "cols":
            cur["cols"] = _split_args(rest)
        elif kw == "row":
            cur["rows"].append(_split_args(rest))
        elif kw == "data":
            pts = []
            for chunk in rest.split(","):
                p = chunk.strip().replace("=", " ").split()
                try:
                    value = float(p[1]); bad = False
                except (IndexError, ValueError):
                    value, bad = 0.0, True
                if p:
                    pts.append({"name": p[0], "value": value, "_bad": bad})
            cur["data"] = pts
        else:
            diags.append({"sev": "warn", "code": "W110", "line": line, "msg": f'Unknown property "{kw}".'})
    return {"ast": ast, "parse_diagnostics": diags}


def lint(ast: dict) -> list[dict]:
    d: list[dict] = []
    if not ast["title"]:
        d.append({"sev": "error", "code": "E001", "line": 1, "msg": "Deck has no title.", "fix": "title"})
    if not ast["slides"]:
        d.append({"sev": "error", "code": "E002", "line": 1, "msg": "Deck has no slides."})
    seen: dict[str, bool] = {}
    for s in ast["slides"]:
        if s["type"] not in SLIDE_TYPES:
            d.append({"sev": "error", "code": "E401", "line": s["line"], "msg": f'Unknown slide type "{s["type"]}".'})
        if s["type"] not in ("section", "quote") and not s["heading"]:
            d.append({"sev": "warn", "code": "W101", "line": s["line"], "msg": "Slide missing a heading.", "fix": "heading"})
        if s["heading"] and len(s["heading"]) > LIMITS["heading_chars"]:
            d.append({"sev": "warn", "code": "W202", "line": s["line"], "msg": "Heading overflow risk.", "fix": "trimHeading"})
        if s["heading"]:
            k = s["heading"].lower()
            if seen.get(k):
                d.append({"sev": "info", "code": "I601", "line": s["line"], "msg": "Duplicate heading."})
            seen[k] = True
        if s["type"] == "bullets":
            if len(s["points"]) > LIMITS["bullets"]:
                d.append({"sev": "warn", "code": "W201", "line": s["line"], "msg": "Too many bullets.", "fix": "splitBullets"})
        if s["type"] == "metrics" and len(s["metrics"]) > LIMITS["metrics"]:
            d.append({"sev": "warn", "code": "W205", "line": s["line"], "msg": "Too many metrics.", "fix": "splitMetrics"})
        if s["type"] in CHART_TYPES:
            if not s["bind"] and not s["data"]:
                d.append({"sev": "error", "code": "E301", "line": s["line"], "msg": "Chart has no data or bind."})
            for pt in s["data"]:
                if pt.get("_bad"):
                    d.append({"sev": "error", "code": "E302", "line": s["line"], "msg": f'Non-numeric value "{pt["name"]}".', "fix": "dropBadData"})
        if s["bind"] and s["bind"] not in ast["datasets"]:
            d.append({"sev": "error", "code": "E310", "line": s["line"], "msg": f'Unknown dataset "{s["bind"]}".'})
    return d


def repair(ast: dict) -> dict:
    import copy
    nxt = copy.deepcopy(ast)
    repairs, slides = [], []
    if not nxt["title"]:
        nxt["title"] = "Untitled deck"; repairs.append({"code": "E001", "msg": "Inserted title."})
    for s in nxt["slides"]:
        if s["type"] not in ("section", "quote") and not s["heading"]:
            s["heading"] = (s["points"][0][:40] if s["points"] else s["type"].capitalize())
            repairs.append({"code": "W101", "msg": f'Synthesized heading (line {s["line"]}).'})
        if s["heading"] and len(s["heading"]) > LIMITS["heading_chars"]:
            cut = s["heading"][:LIMITS["heading_chars"]]
            at = cut.rfind(" ")
            s["heading"] = (cut[:at] if at > 40 else cut).rstrip() + "\u2026"
            repairs.append({"code": "W202", "msg": f'Trimmed heading (line {s["line"]}).'})
        if s["type"] in CHART_TYPES:
            before = len(s["data"]); s["data"] = [p for p in s["data"] if not p.get("_bad")]
            if len(s["data"]) != before:
                repairs.append({"code": "E302", "msg": f'Dropped bad data (line {s["line"]}).'})
        if s["type"] == "bullets" and len(s["points"]) > LIMITS["bullets"]:
            head = dict(s); head["points"] = s["points"][:LIMITS["bullets"]]
            tail = dict(s); tail["heading"] = (s["heading"] or "Continued") + " (cont.)"; tail["points"] = s["points"][LIMITS["bullets"]:]
            slides.extend([head, tail]); repairs.append({"code": "W201", "msg": f'Split bullets (line {s["line"]}).'}); continue
        if s["type"] == "metrics" and len(s["metrics"]) > LIMITS["metrics"]:
            head = dict(s); head["metrics"] = s["metrics"][:LIMITS["metrics"]]
            tail = dict(s); tail["heading"] = (s["heading"] or "Metrics") + " (cont.)"; tail["metrics"] = s["metrics"][LIMITS["metrics"]:]
            slides.extend([head, tail]); repairs.append({"code": "W205", "msg": f'Split metrics (line {s["line"]}).'}); continue
        slides.append(s)
    nxt["slides"] = slides
    return {"ast": nxt, "repairs": repairs}


def build(src: str) -> dict:
    parsed = parse(src)
    working = parsed["ast"]
    lint_d = lint(working)
    repairs, passes = [], 0
    while passes < 4 and any(d.get("fix") for d in lint_d):
        r = repair(working)
        working = r["ast"]; repairs += r["repairs"]; lint_d = lint(working); passes += 1
    diagnostics = parsed["parse_diagnostics"] + lint_d
    return {
        "ast": working, "diagnostics": diagnostics, "repairs": repairs, "passes": passes,
        "slides": len(working["slides"]),
        "errors": [d for d in diagnostics if d["sev"] == "error"],
        "warnings": [d for d in diagnostics if d["sev"] == "warn"],
    }
