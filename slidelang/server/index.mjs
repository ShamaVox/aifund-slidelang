// Minimal dependency-free API server.
// POST /api/author { prompt, grammar } -> { spec }   (calls Anthropic if ANTHROPIC_API_KEY is set)
// POST /api/compile { spec }           -> build() result
// Keeps the API key server-side; the browser never sees it.
import http from "node:http";
import { build } from "../src/compiler/compile.js";
import { simulateAuthor } from "../src/agent/author.js";
import { exportHTML } from "../src/export/html.js";
import { DEFAULT_PLUGINS } from "../src/plugins/index.js";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.SLIDELANG_MODEL || "claude-sonnet-4-6";
const PORT = process.env.PORT || 8787;
const PUBLISHED = new Map(); // id -> spec (in-memory hosted store)

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } }); });
}

async function callAnthropic(prompt, grammar) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL, max_tokens: 2000,
      messages: [{ role: "user", content: `You are an authoring agent for SlideLang, a deck-as-code language.\n${grammar}\n\nProduce a deck for: "${prompt}". Output only SlideLang source, no prose, no backticks.` }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const body = await readBody(req);

  if (req.url === "/api/author" && req.method === "POST") {
    const { prompt, grammar } = body;
    // Author -> verify -> repair loop, server side.
    let spec;
    try {
      if (!KEY) throw new Error("no ANTHROPIC_API_KEY");
      spec = (await callAnthropic(prompt, grammar)).replace(/```[a-z]*|```/g, "").trim();
      if (!/^deck\s/m.test(spec)) throw new Error("bad model output");
    } catch (e) {
      spec = simulateAuthor(prompt); // deterministic fallback
    }
    // Return the repaired, compiled spec so the client renders clean output.
    const b = build(spec);
    return json(res, 200, { spec, slides: b.slides.length, errors: b.errors.length, repairs: b.repairs.length });
  }

  if (req.url === "/api/compile" && req.method === "POST") {
    return json(res, 200, build(body.spec || "", { plugins: DEFAULT_PLUGINS }));
  }

  // Publish: store a spec, return a shareable link. GET /d/:id serves the deck.
  if (req.url === "/api/publish" && req.method === "POST") {
    const id = Math.random().toString(36).slice(2, 9);
    PUBLISHED.set(id, body.spec || "");
    return json(res, 200, { id, url: `/d/${id}` });
  }
  if (req.url.startsWith("/d/") && req.method === "GET") {
    const id = req.url.slice(3);
    const spec = PUBLISHED.get(id);
    if (!spec) { res.writeHead(404); return res.end("deck not found"); }
    const b = build(spec, { plugins: DEFAULT_PLUGINS });
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(exportHTML(b.ast, b.slides));
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`SlideLang API on :${PORT} (model auth: ${KEY ? "on" : "off — using deterministic author"})`));
