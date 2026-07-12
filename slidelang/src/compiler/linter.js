// SlideLang linter: rules over the AST. Every diagnostic is machine-legible
// { sev, code, line, msg, fix? }. `fix` marks it as auto-repairable and is the
// signal the agent uses to self-correct.
import { SLIDE_TYPES } from "./parser.js";

export const LIMITS = { bullets: 6, headingChars: 90, metrics: 4, pointChars: 92, rows: 8, cols: 5 };
const CHART_TYPES = ["chart.bar", "chart.line", "chart.area", "chart.pie"];

export function lint(ast) {
  const d = [];
  if (!ast.title) d.push({ sev: "error", code: "E001", line: 1, msg: 'Deck has no title. Add: deck "Your title"', fix: "title" });
  if (ast.slides.length === 0) d.push({ sev: "error", code: "E002", line: 1, msg: "Deck has no slides." });

  const seen = {};
  ast.slides.forEach((s) => {
    if (!SLIDE_TYPES.includes(s.type))
      d.push({ sev: "error", code: "E401", line: s.line, msg: `Unknown slide type "${s.type}". Known: ${SLIDE_TYPES.join(", ")}`, slide: s });

    if (!["section", "quote"].includes(s.type) && !s.heading)
      d.push({ sev: "warn", code: "W101", line: s.line, msg: "Slide missing a heading.", slide: s, fix: "heading" });

    if (s.heading && s.heading.length > LIMITS.headingChars)
      d.push({ sev: "warn", code: "W202", line: s.line, msg: `Heading is ${s.heading.length} chars; overflow risk (> ${LIMITS.headingChars}).`, slide: s, fix: "trimHeading" });

    if (s.heading) { const k = s.heading.toLowerCase(); if (seen[k]) d.push({ sev: "info", code: "I601", line: s.line, msg: `Duplicate heading "${s.heading}".`, slide: s }); seen[k] = true; }

    if (s.type === "bullets") {
      if (s.points.length === 0) d.push({ sev: "warn", code: "W203", line: s.line, msg: "Bullets slide has no points.", slide: s });
      if (s.points.length > LIMITS.bullets) d.push({ sev: "warn", code: "W201", line: s.line, msg: `${s.points.length} bullets exceeds ${LIMITS.bullets}; content will overflow.`, slide: s, fix: "splitBullets" });
      s.points.forEach((p) => { if (p.length > LIMITS.pointChars) d.push({ sev: "info", code: "I204", line: s.line, msg: `A bullet is ${p.length} chars; consider tightening.`, slide: s }); });
    }

    if (s.type === "metrics" && s.metrics.length > LIMITS.metrics)
      d.push({ sev: "warn", code: "W205", line: s.line, msg: `${s.metrics.length} metrics exceeds ${LIMITS.metrics}; grid will overflow.`, slide: s, fix: "splitMetrics" });

    if (CHART_TYPES.includes(s.type)) {
      if (!s.bind && s.data.length === 0) d.push({ sev: "error", code: "E301", line: s.line, msg: "Chart has no data. Add: data A 120, B 90 — or bind a dataset.", slide: s });
      s.data.forEach((pt) => { if (pt._bad) d.push({ sev: "error", code: "E302", line: s.line, msg: `Non-numeric value for "${pt.name}".`, slide: s, fix: "dropBadData" }); });
    }

    if (s.bind && !(ast.datasets && ast.datasets[s.bind]))
      d.push({ sev: "error", code: "E310", line: s.line, msg: `Slide binds to unknown dataset "${s.bind}".`, slide: s });

    if (s.type === "table") {
      if (s.rows.length === 0) d.push({ sev: "warn", code: "W701", line: s.line, msg: "Table has no rows.", slide: s });
      if (s.cols.length > LIMITS.cols) d.push({ sev: "warn", code: "W702", line: s.line, msg: `${s.cols.length} columns exceeds ${LIMITS.cols}.`, slide: s });
      s.rows.forEach((r, i) => { if (s.cols.length && r.length !== s.cols.length) d.push({ sev: "warn", code: "W703", line: s.line, msg: `Row ${i + 1} has ${r.length} cells; expected ${s.cols.length}.`, slide: s, fix: "padRow" }); });
    }

    if (s.type === "image" && !s.image) d.push({ sev: "warn", code: "W501", line: s.line, msg: "image slide has no prompt.", slide: s });
    if (s.type === "math" && !s.formula) d.push({ sev: "warn", code: "W502", line: s.line, msg: "math slide has no formula.", slide: s });
    if (s.type === "quote" && !s.quote) d.push({ sev: "warn", code: "W503", line: s.line, msg: "quote slide has no quote.", slide: s });
  });

  return d;
}
