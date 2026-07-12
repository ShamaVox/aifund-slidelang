// Model client + agentic author->verify->repair loop.
// In the browser we call a same-origin proxy (/api/author) so the API key never
// ships to the client. If the proxy or key is missing, we fall back to the
// deterministic author so the workflow always completes.
import { GRAMMAR } from "./grammar.js";
import { simulateAuthor, updateAuthor } from "./author.js";
import { serialize } from "../compiler/serialize.js";
import { build } from "../compiler/compile.js";
import { critiqueAndImprove, planEdits } from "./reasoning.js";

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
  // used_model tells us whether the LLM actually authored this, or the backend
  // fell back to its deterministic planner. We surface the truth, not a guess.
  return { dsl, usedModel: !!data.used_model };
}

// onStep(stageId, payload) lets the UI animate the pipeline + stream a log.
export async function authorDeck(prompt, { useModel = true, onStep = () => {} } = {}) {
  onStep("plan", { log: `author agent · goal: "${prompt}"`, kind: "head" });

  let dsl = null;
  if (useModel) {
    try {
      onStep("spec", { log: "calling model via /api/author …", kind: "muted" });
      const r = await callAuthorAPI(prompt);
      dsl = r.dsl;
      if (r.usedModel) {
        onStep("spec", { log: "live model authored the spec", kind: "ok" });
      } else {
        // proxy answered, but the BACKEND fell back to its deterministic planner
        // (no key, bad model name, or an API error). Tell the truth.
        onStep("spec", { log: "model unavailable server-side — deterministic planner (check API key / SLIDELANG_MODEL)", kind: "warn" });
      }
    } catch (e) {
      onStep("spec", { log: `proxy unreachable (${e.message}); using built-in planner.`, kind: "warn" });
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
  // SELF-CRITIQUE: the agent reviews its own draft and applies safe revisions,
  // surfacing (not silently applying) anything it leaves for the human.
  current = critiqueAndImprove(current, { onStep });
  const final = build(current);
  onStep("done", { log: `compiled ${final.slides.length} slides · ${final.repairs.length} auto-repair(s) · ${final.errors.length} unresolved error(s)`, kind: "head" });
  return current;
}

// Second-prompt regeneration: produce a NEW base from an update instruction,
// grounded in the current deck so it updates rather than starts over.
export async function regenerate(baseAst, prompt, { useModel = true, overrides = {}, onStep = () => {} } = {}) {
  onStep("plan", { log: `regenerate · "${prompt}"`, kind: "head" });
  // EDIT-PLAN: state what will change and what is protected BEFORE touching anything.
  planEdits(baseAst, prompt, overrides, { onStep });
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
      onStep("spec", { log: data.used_model ? "live model updated the spec" : "model unavailable server-side — deterministic update", kind: data.used_model ? "ok" : "warn" });
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
