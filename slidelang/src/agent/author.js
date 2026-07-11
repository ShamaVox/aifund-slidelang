// Deterministic author: prompt -> valid SlideLang, no model required.
// Guarantees the workflow never dead-ends when no API key is present.
export function simulateAuthor(prompt) {
  const p = (prompt || "").toLowerCase();
  const topic = (prompt || "Product overview").replace(/^(make|build|create|generate|draft)\s+(a|an|the)?\s*/i, "").trim();
  const isPitch = /pitch|seed|invest|raise|fundrais/.test(p);
  const isTech = /architect|technical|system|pipeline|design review|infra|api/.test(p);
  const theme = /light|paper|clean/.test(p) ? "paper" : /green|forest/.test(p) ? "forest" : "midnight";
  const title = topic.length > 4 ? topic[0].toUpperCase() + topic.slice(1) : "Deck";
  const L = [`deck "${title.slice(0, 54)}"`, `theme ${theme}`, ""];

  L.push(`slide title`, `  heading "${title.slice(0, 54)}"`,
    `  subtitle "${isPitch ? "Seed round — 2026" : isTech ? "Technical design review" : "Overview"}"`,
    `  notes "Open with the one-line thesis, then the problem."`, "");

  if (isPitch) {
    L.push(`slide bullets`, `  heading "The problem"`,
      `  point "Teams replaced headcount with agents, but agent output is brittle"`,
      `  point "Generation is solved; trust and editability are not"`,
      `  point "Repeatable decks still cost hours of hand-tuning"`, "");
    L.push(`slide metrics`, `  heading "Traction"`,
      `  metric "Design partners" "12" "+9"`, `  metric "Weekly decks" "480" "+140"`,
      `  metric "Edit-to-ship" "6 min" "-72%"`, "");
    L.push(`slide chart.line`, `  heading "Decks generated per week"`, `  data Jan 40, Feb 95, Mar 190, Apr 310, May 480`, "");
    L.push(`slide bullets`, `  heading "Why now"`,
      `  point "Frontier models make structured authoring reliable"`,
      `  point "Deck-as-code turns review into a diff, not a redo"`,
      `  point "Agents author the spec; humans approve it"`, "");
    L.push(`slide math`, `  heading "Unit economics"`, `  formula "LTV = ARPU \\times \\frac{1}{churn}"`, "");
  } else if (isTech) {
    L.push(`slide bullets`, `  heading "System overview"`,
      `  point "Prompt or spec intake feeds an agent planner"`,
      `  point "Compiler lowers the spec to a typed layout IR"`,
      `  point "Validation and repair run before render"`, "");
    L.push(`slide chart.bar`, `  heading "Latency budget (ms)"`, `  data Plan 800, Compile 40, Lint 6, Render 120`, "");
    L.push(`slide table`, `  heading "Stages"`, `  cols "Stage" "Deterministic" "Cost"`,
      `  row "Parse" "yes" "low"`, `  row "Author" "no" "high"`, `  row "Repair" "yes" "low"`, "");
    L.push(`slide math`, `  heading "Confidence"`, `  formula "score = \\prod checks_i"`, "");
  } else {
    L.push(`slide bullets`, `  heading "Highlights"`,
      `  point "Structured, editable, reviewable output"`,
      `  point "Validation and repair built in"`,
      `  point "Publish or present from one workflow"`, "");
    L.push(`slide chart.area`, `  heading "Adoption"`, `  data Q1 20, Q2 55, Q3 90, Q4 140`, "");
  }

  L.push(`slide quote`, `  quote "The model is the easy part. The trust layer is the product."`, `  cite "SlideLang"`, "");
  L.push(`slide bullets`, `  heading "Close"`, `  point "Structured authoring beats prompt-to-pixels"`, `  point "Trust is the wedge"`, "");
  return L.join("\n");
}

// Deterministic "regenerate with fresh data": takes the current base AST and
// returns an updated version with the SAME structure but changed numbers, so a
// merge produces a meaningful diff (mostly preserved + updated). Emulates what a
// real model does on a second prompt like "update the Q4 numbers".
import { serialize } from "../compiler/serialize.js";
export function updateAuthor(baseAst, prompt) {
  const next = JSON.parse(JSON.stringify(baseAst));
  const bump = (v) => Math.round(v * (1.15 + Math.random() * 0.35));
  next.slides.forEach((s) => {
    if (s.type.startsWith("chart.")) s.data = s.data.map((d) => ({ ...d, value: bump(d.value) }));
    if (s.type === "metrics") s.metrics = s.metrics.map((m, i) => i === 0
      ? { ...m, value: /\$/.test(m.value) ? "$" + bump(parseFloat(m.value.replace(/[^0-9.]/g, "")) || 4) + "M" : m.value, delta: m.delta }
      : m);
    if (s.type === "title" && s.subtitle) s.subtitle = s.subtitle.replace(/Q[1-4]/, "Q4").replace(/2026/, "2026 · updated");
  });
  // strip ids so the new base is matched to the old base by content (not by carried id)
  next.slides.forEach((s) => { delete s.id; });
  return serialize(next);
}
