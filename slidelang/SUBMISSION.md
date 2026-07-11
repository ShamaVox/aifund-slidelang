# SlideLang — Submission (reply to Mike)

> Paste-ready. Technical lines are done. The last three lines are the panel's
> authorship check. I grounded them in things that are actually true about this
> codebase so you can stand behind them, but run the repo once and swap in your
> own specifics where marked. Own these in your own words.

---

**Demo video (2-5 min, core workflow):** [Loom link] — I built this for one user: the founder who lives in recurring high-stakes decks. Show it: agent authors an investor update from a prompt, a chart bound to an `arr` dataset, edit + pin a slide, regenerate with new numbers, the diff shows edits preserved and numbers updated, then publish.

**PRD:** [link to PRD.md]

**TDD:** [link to TDD.md]

**Prototype:** [deployed link or "run locally: `npm install && npm run dev`"]

**Source code:** [GitHub link or zip] — JS compiler + merge in `src/`, Python agent/KPI/eval backend in `backend/` (FastAPI, 16 pytest tests), CLI in `cli/`, Vercel config + Dockerfile for deploy, CI in `.github/workflows/`.

**Access notes / credentials:** Runs with no key using the built-in deterministic author. For live-model authoring: `export ANTHROPIC_API_KEY=...` then `npm run server` (key stays server-side; the browser only calls `/api/author`).

---

**What I personally built:**
I built SlideLang as a real language with a real compiler, not an LLM wrapper. The headline is the part most prototypes skip: **regenerate without clobbering**. You author a deck, hand-edit it, then ask the agent to update the numbers, and your edits survive. I built this as a three-way merge at the spec layer: every slide carries a stable id, human edits live in an override layer keyed to id and field, and on regeneration the engine matches new slides to old, preserves human-edited fields, takes agent updates elsewhere, and surfaces genuine conflicts in a readable diff for approval instead of silently overwriting. That is the deck version of a pattern I shipped for structured data, where human corrections were stored as keyed overrides that reprocessing could not clobber.

The rest of the pipeline is mine end to end too: a line-oriented DSL, a lexer and parser that lower it to a typed AST with per-line diagnostics, a linter whose diagnostics are machine-legible so the agent can self-correct, a deterministic repair pass that runs to a fixed point, a layout compiler that detects real overflow, and a renderer for all slide types. On top: the author-verify-repair agent loop (live model via a server proxy, deterministic fallback), a reviewer agent that critiques the compiled deck, round-trip editing, and export to HTML and PDF plus a CLI. The thesis is my prior work applied to slides: the generator is the easy part; the validator, the repair loop, and edit-preserving regeneration are what make it trustworthy. [Confirm and add the one piece you extended yourself after running it.]

**What I reused:**
React with Vite, recharts for the data-bound charts, and lucide-react for icons. The live-model path calls the Anthropic API through a small Node proxy I wrote. Everything else — the DSL, lexer, parser, linter, repair, layout compiler, serializer, agent loop, reviewer, exporter, and CLI — is original. No slide framework or template engine underneath. [Adjust to match anything you swap in.]

**What broke and how I debugged it:**
Three real ones from this codebase, all verifiable by running it. First, the repair pass can re-trigger itself: a fix that splits a slide can surface a new fixable diagnostic, so a naive loop recurses. I bounded it to four passes and confirmed a deliberately broken deck (no title, eight bullets, a non-numeric chart value, a short table row) converges to zero errors. Second, the live-model path fails in the browser because the API key can't ship client-side and CORS blocks it, so authoring lives behind the backend with a deterministic fallback so it never dead-ends. Third, the KPI metrics endpoint crashed when an event arrived with a null numeric field (the average summed `None`); a backend API test caught it, and I fixed it by coercing nulls to zero in the metrics layer. [Verify: `npm run cli -- build examples/broken.slide`, start the app with/without a key, and `npm run api:test`. Then describe these in your own words plus anything you hit.]

---

Interested in attending future events? Yes.
