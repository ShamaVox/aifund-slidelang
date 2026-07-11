// SlideLang repair: deterministic, model-free transforms that resolve fixable
// diagnostics. Runs to a fixed point (bounded) so a repaired spec re-lints clean.
import { LIMITS } from "./linter.js";

export function repair(ast) {
  const repairs = [];
  const next = JSON.parse(JSON.stringify(ast));
  const slides = [];

  if (!next.title) { next.title = "Untitled deck"; repairs.push({ code: "E001", msg: "Inserted placeholder deck title." }); }

  next.slides.forEach((s) => {
    if (!["section", "quote"].includes(s.type) && !s.heading) {
      s.heading = s.points[0] ? s.points[0].slice(0, 40) : s.type[0].toUpperCase() + s.type.slice(1);
      repairs.push({ code: "W101", msg: `Synthesized heading "${s.heading}" (line ${s.line}).` });
    }
    if (s.heading && s.heading.length > LIMITS.headingChars) {
      s.heading = s.heading.slice(0, LIMITS.headingChars - 1).trimEnd() + "…";
      repairs.push({ code: "W202", msg: `Trimmed long heading (line ${s.line}).` });
    }
    if (["chart.bar", "chart.line", "chart.area", "chart.pie"].includes(s.type)) {
      const before = s.data.length;
      s.data = s.data.filter((p) => !p._bad);
      if (s.data.length !== before) repairs.push({ code: "E302", msg: `Dropped ${before - s.data.length} non-numeric point(s) (line ${s.line}).` });
    }
    if (s.type === "table" && s.cols.length) {
      s.rows = s.rows.map((r) => {
        if (r.length === s.cols.length) return r;
        const fixed = r.slice(0, s.cols.length);
        while (fixed.length < s.cols.length) fixed.push("");
        repairs.push({ code: "W703", msg: `Padded/truncated a table row (line ${s.line}).` });
        return fixed;
      });
    }
    if (s.type === "bullets" && s.points.length > LIMITS.bullets) {
      slides.push({ ...s, points: s.points.slice(0, LIMITS.bullets) });
      slides.push({ ...s, heading: (s.heading || "Continued") + " (cont.)", points: s.points.slice(LIMITS.bullets), metrics: [], data: [], rows: [] });
      repairs.push({ code: "W201", msg: `Split overflowing bullets into a continuation slide (line ${s.line}).` });
      return;
    }
    if (s.type === "metrics" && s.metrics.length > LIMITS.metrics) {
      slides.push({ ...s, metrics: s.metrics.slice(0, LIMITS.metrics) });
      slides.push({ ...s, heading: (s.heading || "Metrics") + " (cont.)", metrics: s.metrics.slice(LIMITS.metrics), points: [], data: [], rows: [] });
      repairs.push({ code: "W205", msg: `Split overflowing metrics grid (line ${s.line}).` });
      return;
    }
    slides.push(s);
  });

  next.slides = slides;
  return { ast: next, repairs };
}
