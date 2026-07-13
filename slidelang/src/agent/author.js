// Deterministic author: prompt -> valid SlideLang, no model required.
// This is the SAFETY NET, not the product. It cannot understand an arbitrary
// prompt, so it aims to be well-structured and honestly generic — never crude.
// It derives a clean title (never dumps the raw prompt into the heading) and
// uses takeaway-style headlines. Kept in parity with backend deterministic.py.
const STOP = new Set(["a", "an", "the", "for", "about", "on", "of", "our", "my", "to", "with", "and"]);

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
  const subject = title.toLowerCase();
  const isPitch = /pitch|seed|invest|raise|fundrais|series [a-c]|deck/.test(p);
  const isTech = /architect|technical|system|pipeline|design review|infra|api|engineering/.test(p);
  const theme = /light|paper|clean|formal/.test(p) ? "paper"
    : /green|forest|climate|sustain/.test(p) ? "forest"
      : /consumer|brand|retail|launch|buyer|shop/.test(p) ? "sunrise" : "midnight";
  const subtitle = isPitch ? "Seed round" : isTech ? "Technical design review" : "A structured overview";

  const L = [`deck "${title}"`, `theme ${theme}`, ""];
  L.push("slide title", `  heading "${title}"`, `  subtitle "${subtitle}"`,
    `  notes "Open with the one-line thesis, then the problem."`, "");

  // Prompt-derived, honestly generic. No fabricated metrics, no SlideLang thesis.
  if (isPitch) {
    L.push("slide bullets", `  heading "The problem ${subject} solves"`,
      `  point "Describe the pain your customer feels today"`,
      `  point "Explain why existing tools fall short"`,
      `  point "Show why now is the moment"`, "");
    L.push("slide bullets", `  heading "How ${title} works"`,
      `  point "The core insight behind the product"`,
      `  point "What the product actually does for the user"`,
      `  point "Why it is hard to copy"`, "");
    L.push("slide metrics", `  heading "Traction (replace with your real numbers)"`,
      `  metric "Revenue" "\u2014" ""`, `  metric "Growth" "\u2014" ""`, `  metric "Retention" "\u2014" ""`, "");
    L.push("slide chart.line", `  heading "Growth over time (replace with your data)"`, "  data Q1 1, Q2 2, Q3 3, Q4 4", "");
  } else if (isTech) {
    L.push("slide bullets", `  heading "What ${title} is"`,
      `  point "The problem this system addresses"`,
      `  point "The core design principle"`,
      `  point "The main components and how they connect"`, "");
    L.push("slide bullets", `  heading "Key design decisions"`,
      `  point "Decision one and the tradeoff behind it"`,
      `  point "Decision two and why the alternative was rejected"`, "");
    L.push("slide chart.bar", `  heading "Where the work goes (replace with your data)"`, "  data Plan 3, Build 5, Test 2, Ship 1", "");
  } else {
    L.push("slide bullets", `  heading "Overview of ${subject}"`,
      `  point "The first key point"`,
      `  point "The second key point"`,
      `  point "The third key point"`, "");
    L.push("slide metrics", `  heading "Key numbers (replace with your data)"`,
      `  metric "Metric one" "\u2014" ""`, `  metric "Metric two" "\u2014" ""`, "");
  }

  L.push("slide bullets", `  heading "What to remember"`,
    `  point "The single most important takeaway"`,
    `  point "The clear next step"`, "");
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
