// Agentic reasoning layer — the "clever" that reinforces the trust story instead
// of chasing autonomy. Three capabilities, all deterministic so they always demo:
//   1) critiqueAndImprove — the agent reviews its OWN draft and revises it.
//   2) groundData         — bind charts to real numbers; flag what it can't verify.
//   3) planEdits          — before regenerating, the agent states its plan and
//                           what it will NOT touch (your protected edits).
import { build } from "../compiler/compile.js";
import { serialize } from "../compiler/serialize.js";
import { reviewDeck } from "./reviewer.js";

// ---- 1) SELF-CRITIQUE ------------------------------------------------------
function deriveNotes(s) {
  switch (s.type) {
    case "title": return "Open with the one-line thesis, then set up the problem.";
    case "section": return "Beat of silence — signal a new act.";
    case "bullets": return "Walk the top point; let the rest land visually.";
    case "metrics": return s.metrics?.[0] ? `Lead with ${s.metrics[0].label} at ${s.metrics[0].value}.` : "Lead with the headline metric.";
    case "table": return "Read the one row that matters, not the whole table.";
    case "math": return "Say the formula in one plain-English sentence.";
    case "quote": return "Pause after the quote; let it breathe.";
    case "image": return "One sentence of context, then move on.";
    default: return s.type.startsWith("chart.") ? "Point at the trend, not every value." : "One idea, one breath.";
  }
}

// The agent reviews its own compiled deck, then applies safe revisions and
// re-scores. Bounded, transparent, never destructive.
export function critiqueAndImprove(spec, { onStep = () => {} } = {}) {
  let ast = build(spec).ast;
  const before = reviewDeck(build(serialize(ast)));
  onStep("review", { log: `self-review · score ${before.score}/100 · ${before.notes.length} note(s)`, kind: "head" });
  before.notes.slice(0, 4).forEach((n) => onStep("review", { log: `critique · ${n.kind}: ${n.msg}`, kind: "muted" }));

  let revised = 0;
  // Actionable fix #1 (delivery): synthesize speaker notes where the deck has none.
  ast.slides.forEach((s) => { if (!s.notes) { s.notes = deriveNotes(s); revised++; } });

  const outSpec = serialize(ast);
  const after = reviewDeck(build(outSpec));
  if (revised) onStep("revise", { log: `revised ${revised} slide(s) · score ${before.score} → ${after.score}`, kind: "fix" });
  else onStep("revise", { log: "no safe auto-revision needed — deck reads clean", kind: "ok" });
  // Anything the agent chose NOT to auto-change is surfaced, not silently applied.
  after.notes.forEach((n) => onStep("review", { log: `left for you · ${n.kind}: ${n.msg}`, kind: "muted" }));
  return outSpec;
}

// ---- 2) DATA-GROUNDING -----------------------------------------------------
// Accepts JSON ({"Q1":1.2,...} or [{name,value}] or {labels:{...}}) or plain
// lines ("Q1 1.2"). Injects a dataset, binds the first chart to it, and reports
// which numbers are now grounded vs. still model-invented (unverified).
function parseData(text) {
  const t = (text || "").trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t);
    const obj = j.labels || j.data || j;
    if (Array.isArray(obj)) return obj.map((r) => ({ name: String(r.name ?? r.label), value: Number(r.value) })).filter((r) => r.name && !Number.isNaN(r.value));
    if (obj && typeof obj === "object") return Object.entries(obj).map(([name, value]) => ({ name, value: Number(value) })).filter((r) => !Number.isNaN(r.value));
  } catch { /* fall through to line parsing */ }
  return t.split(/\n|,/).map((line) => {
    const m = line.trim().replace("=", " ").split(/\s+/);
    return { name: m[0], value: Number(m[1]) };
  }).filter((r) => r.name && !Number.isNaN(r.value));
}

export function groundData(spec, dataText, { onStep = () => {} } = {}) {
  const rows = parseData(dataText);
  if (!rows.length) { onStep("ground", { log: "no parseable data — expected JSON or 'Label value' lines", kind: "warn" }); return { spec, grounded: [], unverified: [] }; }

  const ast = build(spec).ast;
  ast.datasets = ast.datasets || {};
  ast.datasets.grounded = { name: "grounded", rows: rows.map((r) => ({ ...r })), line: 0 };
  onStep("ground", { log: `grounding ${rows.length} value(s) from your data`, kind: "head" });

  // bind the first chart to the grounded dataset (source of truth = your numbers)
  let bound = null;
  for (const s of ast.slides) {
    if (s.type && s.type.startsWith("chart.")) { s.bind = "grounded"; s.data = []; bound = s.heading || s.type; break; }
  }
  if (bound) onStep("ground", { log: `bound "${bound}" to grounded data — edit once, updates everywhere`, kind: "fix" });

  // report: what's grounded vs. what remains model-asserted (metrics, other charts)
  const grounded = rows.map((r) => `${r.name}=${r.value}`);
  const unverified = [];
  ast.slides.forEach((s) => {
    if (s.type === "metrics") s.metrics?.forEach((m) => unverified.push(`${m.label}: ${m.value}`));
    if (s.type && s.type.startsWith("chart.") && s.bind !== "grounded" && s.data?.length) unverified.push(`chart "${s.heading}" (inline numbers)`);
  });
  unverified.slice(0, 6).forEach((u) => onStep("ground", { log: `unverified · ${u} — provide data to ground`, kind: "warn" }));
  onStep("ground", { log: `${grounded.length} grounded · ${unverified.length} still model-asserted`, kind: "head" });
  return { spec: serialize(ast), grounded, unverified };
}

// ---- 3) EDIT-PLAN REASONING -----------------------------------------------
// Before regenerate, the agent states what it intends to change and — crucially —
// what it will NOT touch: your edited/pinned slides. Reads like a diff preview,
// so regeneration feels deliberate, not a black box.
export function planEdits(baseAst, prompt, overrides = {}, { onStep = () => {} } = {}) {
  const p = (prompt || "").toLowerCase();
  const wants = [];
  if (/chart|graph|trend|traction|revenue|growth|arr/.test(p)) wants.push("chart / data slides");
  if (/number|metric|kpi|figure|stat/.test(p)) wants.push("metric values");
  if (/q[1-4]|quarter|month|week/.test(p)) wants.push("time-series values");
  if (/title|headline|subtitle/.test(p)) wants.push("title / headings");
  if (/close|closing|ask|cta|takeaway/.test(p)) wants.push("closing slide");
  if (/tone|reword|tighten|punch|copy|text/.test(p)) wants.push("copy / wording");
  if (!wants.length) wants.push("content matching your instruction");

  const protectedSlides = [];
  (baseAst?.slides || []).forEach((s) => {
    const ov = overrides[s.id];
    if (ov && (ov._pinned || Object.keys(ov).some((k) => k !== "_pinned"))) {
      protectedSlides.push({ heading: s.heading || s.id, pinned: !!ov._pinned });
    }
  });

  onStep("plan", { log: `edit plan · will touch: ${wants.join(", ")}`, kind: "head" });
  if (protectedSlides.length) {
    protectedSlides.forEach((s) => onStep("plan", { log: `protected · "${s.heading}" ${s.pinned ? "(pinned)" : "(you edited it)"} — will NOT overwrite`, kind: "ok" }));
  } else {
    onStep("plan", { log: "no protected edits yet — nothing to preserve on this pass", kind: "muted" });
  }
  return { wants, protected: protectedSlides };
}
