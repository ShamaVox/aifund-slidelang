// Full pipeline: parse -> lint -> repair(to fixed point) -> compile.
// Returns everything the UI, CLI, and server need.
import { parse } from "./parser.js";
import { lint } from "./linter.js";
import { repair } from "./repair.js";
import { compile } from "./layout.js";

export function build(src, { plugins = [] } = {}) {
  const { ast, parseDiagnostics } = parse(src);
  // plugin transforms run after parse, before lint
  let working = plugins.reduce((a, p) => (p.transform ? p.transform(a) : a), ast);
  let lintD = lint(working);
  // plugin lint contributions
  plugins.forEach((p) => { if (p.lint) lintD = lintD.concat(p.lint(working)); });
  let allRepairs = [];
  let passes = 0;

  // deterministic repair loop, bounded to avoid pathological recursion
  while (passes < 4 && lintD.some((d) => d.fix)) {
    const r = repair(working);
    working = r.ast;
    allRepairs = allRepairs.concat(r.repairs);
    lintD = lint(working);
    plugins.forEach((p) => { if (p.lint) lintD = lintD.concat(p.lint(working)); });
    passes++;
  }

  const { slides, compileDiagnostics } = compile(working);
  const diagnostics = [...parseDiagnostics, ...lintD, ...compileDiagnostics];
  return {
    ast: working,
    slides,
    diagnostics,
    repairs: allRepairs,
    passes,
    errors: diagnostics.filter((d) => d.sev === "error"),
    warnings: diagnostics.filter((d) => d.sev === "warn"),
  };
}
