// Model client + agentic author->verify->repair loop.
// In the browser we call a same-origin proxy (/api/author) so the API key never
// ships to the client. If the proxy or key is missing, we fall back to the
// deterministic author so the workflow always completes.
import { GRAMMAR } from "./grammar.js";
import { simulateAuthor, updateAuthor } from "./author.js";
import { serialize } from "../compiler/serialize.js";
import { build } from "../compiler/compile.js";

async function callAuthorAPI(prompt) {
  const res = await fetch("/api/author", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, grammar: GRAMMAR }),
  });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const data = await res.json();
  const dsl = (data.spec || "").replace(/```[a-z]*|```/g, "").trim();
  if (!/^deck\s/m.test(dsl)) throw new Error("model output missing 'deck' header");
  return dsl;
}

// onStep(stageId, payload) lets the UI animate the pipeline + stream a log.
export async function authorDeck(prompt, { useModel = true, onStep = () => {} } = {}) {
  onStep("plan", { log: `author agent · goal: "${prompt}"`, kind: "head" });

  let dsl = null;
  if (useModel) {
    try {
      onStep("spec", { log: "calling model via /api/author …", kind: "muted" });
      dsl = await callAuthorAPI(prompt);
      onStep("spec", { log: "model returned a spec", kind: "ok" });
    } catch (e) {
      onStep("spec", { log: `model unavailable (${e.message}); using built-in planner.`, kind: "warn" });
      dsl = null;
    }
  }
  if (!dsl) { dsl = simulateAuthor(prompt); onStep("spec", { log: "planner emitted spec (deterministic)", kind: "ok" }); }

  // verify -> repair loop: compiler diagnostics are the feedback signal.
  onStep("parse", {});
  let attempt = 0;
  let current = dsl;
  while (attempt < 3) {
    const b = build(current);
    onStep("lint", { log: `lint pass ${attempt + 1}: ${b.errors.length} error(s), ${b.warnings.length} warning(s)`, kind: b.errors.length ? "warn" : "ok" });
    if (b.repairs.length) { onStep("repair", {}); b.repairs.forEach((r) => onStep("repair", { log: `repair · ${r.msg}`, kind: "fix" })); }
    if (b.errors.length === 0) break;
    attempt++;
  }
  onStep("compile", {});
  onStep("render", {});
  const final = build(current);
  onStep("done", { log: `compiled ${final.slides.length} slides · ${final.repairs.length} auto-repair(s) · ${final.errors.length} unresolved error(s)`, kind: "head" });
  return current;
}

// Second-prompt regeneration: produce a NEW base from an update instruction,
// grounded in the current deck so it updates rather than starts over.
export async function regenerate(baseAst, prompt, { useModel = true, onStep = () => {} } = {}) {
  onStep("plan", { log: `regenerate · "${prompt}"`, kind: "head" });
  const basisSpec = serialize(baseAst);
  let dsl = null;
  if (useModel) {
    try {
      onStep("spec", { log: "calling model to update the deck …", kind: "muted" });
      const res = await fetch("/api/author", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, use_model: true, basis: basisSpec }),
      });
      if (!res.ok) throw new Error(`proxy ${res.status}`);
      const data = await res.json();
      dsl = (data.spec || "").replace(/```[a-z]*|```/g, "").trim();
      if (!/^deck\s/m.test(dsl)) throw new Error("bad model output");
      onStep("spec", { log: "model returned an updated spec", kind: "ok" });
    } catch (e) {
      onStep("spec", { log: `model unavailable (${e.message}); using deterministic update.`, kind: "warn" });
      dsl = null;
    }
  }
  if (!dsl) { dsl = updateAuthor(baseAst, prompt); onStep("spec", { log: "deterministic update emitted", kind: "ok" }); }
  onStep("parse", {}); onStep("lint", {}); onStep("compile", {}); onStep("render", {});
  const b = build(dsl);
  onStep("done", { log: `regenerated ${b.slides.length} slides · ${b.repairs.length} repair(s)`, kind: "head" });
  return dsl;
}
