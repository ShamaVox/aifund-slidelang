// SlideLang layout compiler: lowers the repaired AST to a positioned layout IR
// on a 960x540 canvas and detects real overflow by estimating rendered height.
export const CANVAS = { w: 960, h: 540, padX: 72, padY: 64 };

function estLines(text, fontPx, boxW) {
  const cpl = Math.max(6, Math.floor(boxW / (fontPx * 0.54)));
  return Math.max(1, Math.ceil((text || "").length / cpl));
}

export function compile(ast) {
  const compileDiagnostics = [];
  const bodyW = CANVAS.w - CANVAS.padX * 2;
  const avail = CANVAS.h - CANVAS.padY * 2;
  const datasets = ast.datasets || {};

  const slides = ast.slides.map((s0, i) => {
    // resolve data binding: change the dataset once, every bound slide updates
    const s = { ...s0 };
    if (s.bind && datasets[s.bind]) {
      const rows = datasets[s.bind].rows.filter((r) => !r._bad);
      if (s.type.startsWith("chart.")) s.data = rows;
      if (s.type === "metrics") s.metrics = rows.map((r) => ({ label: r.name, value: String(r.value), delta: "" }));
      s._bound = s.bind;
    }
    let used = 0;
    if (s.heading) used += estLines(s.heading, 40, bodyW) * 48;
    if (s.subtitle) used += estLines(s.subtitle, 22, bodyW) * 30;
    if (s.type === "bullets") used += s.points.reduce((a, p) => a + estLines(p, 24, bodyW - 40) * 34 + 10, 0);
    if (s.type === "metrics") used += Math.ceil(s.metrics.length / 2) * 110;
    if (s.type.startsWith("chart.")) used += 300;
    if (s.type === "table") used += 60 + s.rows.length * 44;
    if (s.type === "math") used += 160;
    if (s.type === "image") used += 300;
    if (s.type === "quote") used += 220;

    const over = used > avail;
    if (over) compileDiagnostics.push({ sev: "warn", code: "C900", line: s.line, msg: `Compiled slide ${i + 1} overflows canvas (${Math.round(used)} > ${avail}px).`, slide: s });
    return { ...s, _index: i, _fill: Math.min(1, used / avail), _overflow: over };
  });

  return { slides, compileDiagnostics };
}
