// Plugin API. A plugin can transform the AST (before lint) and/or contribute
// diagnostics. This is the extension surface behind "CLI/plugin integration":
// data sources, brand guards, and computed content plug in here without touching
// the compiler core.
//
// Plugin shape: { name, transform?(ast)=>ast, lint?(ast)=>diagnostics[] }

// Example 1 — computed totals: append a "Total" row to any table of numbers.
export const computedTotals = {
  name: "computed-totals",
  transform(ast) {
    ast.slides.forEach((s) => {
      if (s.type !== "table" || !s.rows.length || !s.cols.length) return;
      if (s.rows.some((r) => r[0] === "Total")) return;
      const totals = s.cols.map((_, ci) => {
        if (ci === 0) return "Total";
        const nums = s.rows.map((r) => parseFloat(String(r[ci]).replace(/[^0-9.-]/g, ""))).filter((n) => !Number.isNaN(n));
        return nums.length ? String(Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100) : "";
      });
      s.rows = [...s.rows, totals];
    });
    return ast;
  },
};

// Example 2 — brand guard: warn when a heading uses a banned word (off-message).
export function brandGuard(bannedWords = ["synergy", "disrupt", "revolutionary"]) {
  return {
    name: "brand-guard",
    lint(ast) {
      const d = [];
      ast.slides.forEach((s) => {
        const h = (s.heading || "").toLowerCase();
        bannedWords.forEach((w) => { if (h.includes(w)) d.push({ sev: "info", code: "P801", line: s.line, msg: `brand-guard: heading uses "${w}" — consider rephrasing.`, slide: s }); });
      });
      return d;
    },
  };
}

export const DEFAULT_PLUGINS = [computedTotals];
