// Serialize an AST back to SlideLang source. Used by round-trip structured
// edits and by the repair "apply fix" path so the text stays the source of truth.
export function serialize(ast) {
  const L = [`deck "${ast.title || "Untitled deck"}"`, `theme ${ast.theme || "midnight"}`, ""];
  // datasets first, so bound slides can reference them
  Object.values(ast.datasets || {}).forEach((ds) => {
    L.push(`dataset ${ds.name}`);
    (ds.rows || []).forEach((r) => L.push(`  row ${r.name} ${r.value}`));
    L.push("");
  });
  ast.slides.forEach((s) => {
    L.push(`slide ${s.type}${s.id ? ` #${s.id}` : ""}`);
    if (s.heading != null) L.push(`  heading "${s.heading}"`);
    if (s.subtitle) L.push(`  subtitle "${s.subtitle}"`);
    (s.points || []).forEach((p) => L.push(`  point "${p}"`));
    if (s.bind) L.push(`  bind ${s.bind}`);
    (s.metrics || []).forEach((m) => L.push(`  metric "${m.label}" "${m.value}" "${m.delta}"`));
    if (!s.bind && s.data && s.data.length) L.push(`  data ${s.data.map((d) => `${d.name} ${d.value}`).join(", ")}`);
    if (s.cols && s.cols.length) L.push(`  cols ${s.cols.map((c) => `"${c}"`).join(" ")}`);
    (s.rows || []).forEach((r) => L.push(`  row ${r.map((c) => `"${c}"`).join(" ")}`));
    if (s.formula) L.push(`  formula "${s.formula}"`);
    if (s.image) L.push(`  image "${s.image}"`);
    if (s.quote) L.push(`  quote "${s.quote}"`);
    if (s.cite) L.push(`  cite "${s.cite}"`);
    if (s.notes) L.push(`  notes "${s.notes}"`);
    L.push("");
  });
  return L.join("\n");
}
