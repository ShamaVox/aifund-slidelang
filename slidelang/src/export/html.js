// Export a compiled deck to a self-contained, presentable HTML file.
// Renders a simplified but faithful static version (arrow-key navigation).
import { THEMES } from "../compiler/parser.js";

function esc(x) { return String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function slideBody(s, th) {
  if (s.type === "title") return `<div class="center"><div class="bar big"></div><h1>${esc(s.heading)}</h1>${s.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : ""}</div>`;
  if (s.type === "section") return `<div class="center"><h1 style="color:${th.accent}">${esc(s.heading)}</h1></div>`;
  if (s.type === "quote") return `<div class="center"><blockquote>“${esc(s.quote)}”</blockquote>${s.cite ? `<p class="sub">— ${esc(s.cite)}</p>` : ""}</div>`;
  let inner = `<h2>${esc(s.heading)}</h2><div class="bar"></div>`;
  if (s.type === "bullets") inner += `<ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
  if (s.type === "metrics") inner += `<div class="metrics">${s.metrics.map((m) => `<div class="metric"><span class="ml">${esc(m.label)}</span><span class="mv">${esc(m.value)} <em>${esc(m.delta)}</em></span></div>`).join("")}</div>`;
  if (s.type.startsWith("chart.")) { const max = Math.max(...s.data.map((d) => d.value), 1); inner += `<div class="chart">${s.data.map((d) => `<div class="col"><div class="cbar" style="height:${(d.value / max) * 100}%"></div><span>${esc(d.name)}</span></div>`).join("")}</div>`; }
  if (s.type === "table") inner += `<table><tr>${s.cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  if (s.type === "math") inner += `<div class="formula">${esc(s.formula)}</div>`;
  if (s.type === "image") inner += `<div class="imgph">image · ${esc(s.image)}</div>`;
  return inner;
}

export function exportHTML(ast, slides) {
  const th = THEMES[ast.theme] || THEMES.midnight;
  const slidesHTML = slides.map((s, i) => `<section class="slide" data-i="${i}">${slideBody(s, th)}</section>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(ast.title)}</title>
<style>
  :root{--bg:${th.bg};--fg:${th.fg};--muted:${th.muted};--accent:${th.accent};--rule:${th.rule}}
  *{box-sizing:border-box;margin:0}body{background:#0a0a0a;font-family:system-ui,sans-serif}
  .slide{display:none;width:100vw;height:100vh;background:var(--bg);color:var(--fg);padding:6vh 7vw;flex-direction:column}
  .slide.on{display:flex}
  .center{margin:auto 0}h1{font-size:5vw;letter-spacing:-1px}h2{font-size:3.2vw}
  .sub{color:var(--muted);font-size:2vw;margin-top:2vh}
  .bar{width:4vw;height:.3vh;background:var(--accent);margin:1.4vh 0 2.4vh}.bar.big{width:6vw;height:.5vh;margin-bottom:2.4vh}
  ul{margin-left:2vw}li{font-size:2vw;line-height:1.5;margin:1vh 0}
  blockquote{font-size:3.4vw;font-family:Georgia,serif;line-height:1.3}
  .metrics{display:grid;grid-template-columns:1fr 1fr;gap:2vh}
  .metric{border:1px solid var(--rule);border-radius:12px;padding:2.5vh 2vw}
  .ml{color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:1.2vw}
  .mv{display:block;font-size:3.2vw;font-weight:800;margin-top:1vh}.mv em{font-size:1.6vw;color:var(--accent);font-style:normal}
  .chart{display:flex;align-items:flex-end;gap:2vw;height:40vh;margin-top:2vh}
  .col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end}
  .cbar{width:70%;background:var(--accent);border-radius:6px 6px 0 0}.col span{color:var(--muted);font-size:1.2vw;margin-top:1vh}
  table{width:100%;border-collapse:collapse;margin-top:2vh}th{color:var(--muted);text-align:left;padding:1.5vh 1vw;border-bottom:2px solid var(--accent);text-transform:uppercase;font-size:1.2vw}
  td{padding:1.5vh 1vw;border-bottom:1px solid var(--rule);font-size:1.7vw}
  .formula{font-size:3.5vw;color:var(--accent);font-family:Georgia,serif;margin-top:4vh}
  .imgph{height:40vh;border:1px solid var(--rule);border-radius:14px;background:linear-gradient(135deg,var(--accent),var(--rule));display:flex;align-items:flex-end;padding:2vh;color:var(--muted);font-family:monospace;margin-top:2vh}
  .nav{position:fixed;bottom:2vh;left:50%;transform:translateX(-50%);color:var(--muted);font-family:monospace;font-size:14px}
</style></head><body>
${slidesHTML}
<div class="nav"><span id="n">1</span> / ${slides.length} — arrow keys</div>
<script>
  let i=0;const S=[...document.querySelectorAll('.slide')];
  function show(n){i=Math.max(0,Math.min(S.length-1,n));S.forEach(s=>s.classList.remove('on'));S[i].classList.add('on');document.getElementById('n').textContent=i+1;}
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')show(i+1);if(e.key==='ArrowLeft')show(i-1);});
  show(0);
</script></body></html>`;
}
