// SlideLang parser: line-oriented, indentation-aware DSL -> typed AST.
// The DSL is designed as an agent action space first: low-token, diffable,
// and every construct maps to a line number so diagnostics are precise.

export const THEMES = {
  midnight: { bg: "#0F1621", fg: "#F2F6FB", muted: "#8FA3BC", accent: "#59B4FF", rule: "#24334A" },
  paper:    { bg: "#FBFAF6", fg: "#141821", muted: "#6B7482", accent: "#C6712E", rule: "#E5E1D6" },
  sunrise:  { bg: "#1A1220", fg: "#FBF2F6", muted: "#C79BB4", accent: "#FF8FA3", rule: "#3A2436" },
  forest:   { bg: "#0E1A14", fg: "#EAF6EE", muted: "#8FB8A0", accent: "#4FD08A", rule: "#1E3328" },
};

export const SLIDE_TYPES = [
  "title", "section", "bullets", "metrics", "chart.bar", "chart.line",
  "chart.area", "chart.pie", "table", "math", "image", "quote",
];

function splitArgs(s) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') { q = !q; continue; }
    if (ch === " " && !q) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseData(rest) {
  return rest.split(",").map((chunk) => {
    const parts = chunk.trim().replace("=", " ").split(/\s+/);
    const name = parts[0];
    const value = Number(parts[1]);
    return { name, value, _bad: parts[1] === undefined || Number.isNaN(value) };
  }).filter((d) => d.name);
}

export function parse(src) {
  const lines = src.replace(/\t/g, "  ").split("\n");
  const ast = { title: null, theme: "midnight", slides: [], datasets: {} };
  const diagnostics = [];
  let cur = null;

  lines.forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim() || raw.trim().startsWith("//")) return;
    const indent = raw.length - raw.trimStart().length;
    const t = raw.trim();
    const sp = t.indexOf(" ");
    const kw = sp === -1 ? t : t.slice(0, sp);
    const rest = sp === -1 ? "" : t.slice(sp + 1).trim();
    const val = rest.replace(/^"|"$/g, "");

    if (indent === 0) {
      if (kw === "deck") { ast.title = val || null; cur = null; return; }
      if (kw === "theme") { ast.theme = THEMES[rest] ? rest : "midnight"; cur = null; return; }
      if (kw === "dataset") {
        // named, reusable data source: bind slides to it (change once, updates everywhere)
        cur = { _kind: "dataset", name: rest, rows: [], line };
        ast.datasets[rest] = cur;
        return;
      }
      if (kw === "slide") {
        // optional stable id:  "slide title #s1_ab2"
        let type = rest || "bullets", id = null;
        const m = type.match(/^(\S+)\s+#(\S+)$/);
        if (m) { type = m[1]; id = m[2]; }
        cur = {
          _kind: "slide", type, id, line, heading: null, subtitle: null,
          points: [], metrics: [], data: [], rows: [], cols: [],
          formula: null, image: null, quote: null, cite: null, notes: null, bind: null,
        };
        ast.slides.push(cur);
        return;
      }
      diagnostics.push({ sev: "error", code: "E100", line, msg: `Unexpected top-level keyword "${kw}". Expected deck, theme, dataset, or slide.` });
      return;
    }

    if (!cur) { diagnostics.push({ sev: "error", code: "E101", line, msg: `"${kw}" is indented but not inside a slide or dataset.` }); return; }

    if (cur._kind === "dataset") {
      if (kw === "row") { const parts = rest.replace("=", " ").split(/\s+/); const value = Number(parts[1]); cur.rows.push({ name: parts[0], value, _bad: parts[1] === undefined || Number.isNaN(value) }); }
      else diagnostics.push({ sev: "warn", code: "W120", line, msg: `Unknown property "${kw}" in dataset.` });
      return;
    }

    switch (kw) {
      case "heading": cur.heading = val; break;
      case "subtitle": cur.subtitle = val; break;
      case "point": cur.points.push(val); break;
      case "formula": cur.formula = val; break;
      case "image": cur.image = val; break;
      case "quote": cur.quote = val; break;
      case "cite": cur.cite = val; break;
      case "notes": cur.notes = (cur.notes ? cur.notes + " " : "") + val; break;
      case "metric": { const a = splitArgs(rest); cur.metrics.push({ label: a[0] || "", value: a[1] || "", delta: a[2] || "" }); break; }
      case "data": cur.data = parseData(rest); break;
      case "bind": cur.bind = rest.trim(); break;
      case "cols": cur.cols = splitArgs(rest); break;
      case "row": cur.rows.push(splitArgs(rest)); break;
      default: diagnostics.push({ sev: "warn", code: "W110", line, msg: `Unknown property "${kw}" on slide.` });
    }
  });

  return { ast, parseDiagnostics: diagnostics };
}
