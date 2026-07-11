#!/usr/bin/env node
// SlideLang CLI — the deck-as-code developer surface.
//   slidelang build <file.slide>     compile + report diagnostics
//   slidelang lint  <file.slide>     lint only (non-zero exit on errors)
//   slidelang author "<prompt>"      generate a spec (deterministic author)
//   slidelang export <file.slide>    write a self-contained .html deck
import fs from "node:fs";
import { build } from "../src/compiler/compile.js";
import { simulateAuthor } from "../src/agent/author.js";
import { reviewDeck } from "../src/agent/reviewer.js";
import { exportHTML } from "../src/export/html.js";
import { DEFAULT_PLUGINS } from "../src/plugins/index.js";

const [cmd, arg] = process.argv.slice(2);
const read = (f) => fs.readFileSync(f, "utf8");
const compileFile = (f) => build(read(f), { plugins: DEFAULT_PLUGINS });

function report(b) {
  b.diagnostics.forEach((d) => console.log(`  ${d.sev.toUpperCase().padEnd(5)} ${d.code}  line ${d.line}  ${d.msg}`));
  if (b.repairs.length) { console.log("\n  repairs:"); b.repairs.forEach((r) => console.log(`    ⟳ ${r.code} ${r.msg}`)); }
  console.log(`\n  ${b.slides.length} slides · ${b.errors.length} errors · ${b.warnings.length} warnings · ${b.repairs.length} auto-repairs`);
}

if (cmd === "build" && arg) {
  const b = compileFile(arg); console.log(`\nSlideLang build: ${arg}\n`); report(b);
  const rev = reviewDeck(b); console.log(`  reviewer score: ${rev.score}/100 (${rev.notes.length} notes)`);
  process.exit(b.errors.length ? 1 : 0);
} else if (cmd === "lint" && arg) {
  const b = compileFile(arg); report(b); process.exit(b.errors.length ? 1 : 0);
} else if (cmd === "author" && arg) {
  console.log(simulateAuthor(arg));
} else if (cmd === "export" && arg) {
  const b = compileFile(arg); const out = arg.replace(/\.\w+$/, "") + ".html";
  fs.writeFileSync(out, exportHTML(b.ast, b.slides)); console.log(`wrote ${out}`);
} else {
  console.log(`SlideLang CLI
  slidelang build <file.slide>     compile + diagnostics + reviewer score
  slidelang lint  <file.slide>     lint (exit 1 on errors)
  slidelang author "<prompt>"      generate a spec
  slidelang export <file.slide>    write self-contained .html`);
  process.exit(1);
}
