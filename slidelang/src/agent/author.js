// Deterministic author: prompt -> valid SlideLang, no model required.
// This is the SAFETY NET, not the product. It cannot understand an arbitrary
// prompt, so it aims to be well-structured and honestly generic — never crude.
// It derives a clean title (never dumps the raw prompt into the heading) and
// uses takeaway-style headlines. Kept in parity with backend deterministic.py.
const STOP = new Set(["a","an","the","for","about","on","of","our","my","to","with","and"]);

function titleFrom(prompt) {
  let p = (prompt || "").trim();
  p = p.replace(/^(make|build|create|generate|draft|write|design|put together)\s+/i, "");
  p = p.replace(/^(a|an|the)\s+/i, "");
  p = p.split(/[,.:;]| that | which | showing | covering /i)[0].trim();
  let words = p.split(/\s+/).filter(Boolean).slice(0, 6);
  while (words.length && STOP.has(words[words.length - 1].toLowerCase())) words.pop();
  let title = words.join(" ") || "Overview";
  title = title[0].toUpperCase() + title.slice(1);
  return title.slice(0, 54);
}

export function simulateAuthor(prompt) {
  const p = (prompt || "").toLowerCase();
  const title = titleFrom(prompt);
  const isPitch = /pitch|seed|invest|raise|fundrais|series [a-c]|deck/.test(p);
  const isTech = /architect|technical|system|pipeline|design review|infra|api|engineering/.test(p);
  const theme = /light|paper|clean|formal/.test(p) ? "paper"
    : /green|forest|climate|sustain/.test(p) ? "forest"
    : /consumer|brand|retail|launch/.test(p) ? "sunrise" : "midnight";
  const subtitle = isPitch ? "Seed round \u00b7 2026" : isTech ? "Technical design review" : "A structured overview";

  const L = [`deck "${title}"`, `theme ${theme}`, ""];
  L.push("slide title", `  heading "${title}"`, `  subtitle "${subtitle}"`,
    `  notes "Open with the one-line thesis, then the problem."`, "");
  L.push("slide section", `  heading "The problem"`, "");

  if (isPitch) {
    L.push("dataset growth", "  row Q1 1.2", "  row Q2 2.0", "  row Q3 3.1", "  row Q4 4.4", "");
    L.push("slide bullets", `  heading "Teams replaced headcount with agents \u2014 but output is brittle"`,
      `  point "Generation is solved; trust and editability are not"`,
      `  point "Repeatable work still costs hours of hand-tuning"`,
      `  point "The bottleneck moved from making to trusting"`, "");
    L.push("slide metrics", `  heading "The numbers are moving the right way"`,
      `  metric "ARR" "$4.4M" "+42%"`, `  metric "Net retention" "131%" "+9pt"`, `  metric "Burn multiple" "0.8x" "-0.3x"`, "");
    L.push("slide chart.area", `  heading "ARR nearly quadrupled across four quarters"`, "  bind growth", "");
    L.push("slide math", `  heading "Efficiency is the whole story"`, `  formula "burn = \\\\frac{net\\\\ burn}{net\\\\ new\\\\ ARR}"`, "");
  } else if (isTech) {
    L.push("slide bullets", `  heading "One pipeline, four guarantees"`,
      `  point "Prompt or spec intake feeds an agent planner"`,
      `  point "The compiler lowers the spec to a typed layout IR"`,
      `  point "Validation and repair run before anything renders"`,
      `  point "Every stage emits a diagnostic with a line number"`, "");
    L.push("slide chart.bar", `  heading "The compile budget is dominated by planning, not rendering"`, "  data Plan 800, Compile 40, Lint 6, Render 120", "");
    L.push("slide math", `  heading "Confidence is the product of every check"`, `  formula "score = \\\\prod_{i} check_i"`, "");
  } else {
    L.push("slide bullets", `  heading "Structured beats static"`,
      `  point "Editable, reviewable output \u2014 not flattened images"`,
      `  point "Validation and repair are built in, not bolted on"`,
      `  point "Publish or present from one workflow"`, "");
    L.push("slide metrics", `  heading "What good looks like"`,
      `  metric "Time to first draft" "20s" "-90%"`, `  metric "Edits preserved" "100%" "no clobber"`, `  metric "Manual fixes" "0" "auto-repaired"`, "");
    L.push("slide chart.line", `  heading "Adoption compounds once the workflow clicks"`, "  data Q1 20, Q2 55, Q3 90, Q4 140", "");
  }

  L.push("slide image", `  heading "Grounded in the real artifact, not a mockup"`,
    `  image "a clean editorial photograph representing ${title.toLowerCase()}, soft natural light"`, "");
  L.push("slide quote", `  quote "The model is the easy part. The trust layer is the product."`, `  cite "SlideLang"`, "");
  L.push("slide bullets", `  heading "The one thing to remember"`,
    `  point "Structured authoring beats prompt-to-pixels"`, `  point "Trust is the wedge"`, "");
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
