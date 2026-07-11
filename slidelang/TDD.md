# SlideLang — TDD

Show-your-work: for each choice, the alternatives and why this one. Built for one user — the AI-startup founder with recurring, data-bound, high-stakes decks.

## Architecture

```
prompt --> author agent --> SlideLang spec (source of truth) <-- datasets
                                  |
   lexer -> parser -> AST -> [plugins] -> linter -> repair(fixed point)
                          -> bind resolve -> layout IR -> renderer
                                  |
        diagnostics {code,line,msg,fix} --> back to agent (self-repair)
                                  |
   round-trip editor <-> spec --> three-way merge (regenerate) --> publish / present
```

The **spec is the single source of truth**; agent, editor, renderer, exporter, CLI, and server all read/write it. Nothing renders from pixels.

## 1. Deck spec schema (the DSL) — and why a DSL over JSON

Line-oriented, indentation-aware. Top level: `deck`, `theme`, `dataset`, `slide`. A `slide <type> [#id]` opens a block; 2-space-indented lines are properties.

**Why a line/block DSL, not JSON:** (a) low-token and ergonomic for an LLM to emit — JSON burns tokens on braces and is easy to malform; (b) diffable and human-readable for review; (c) trivially parseable with exact line numbers, which is what makes diagnostics precise. **Trade-off accepted:** a bespoke grammar needs its own parser and has no editor tooling; mitigated by keeping the grammar tiny and the parser a single pass. The DSL is designed as an *agent action space* first (its error messages are the agent's feedback channel), human format second.

The parser lowers to a typed AST: `{ title, theme, datasets, slides:[{ type,id,heading,subtitle,points,metrics,data,rows,cols,formula,image,quote,cite,notes,bind }] }`.

## 2. Compiler — stages and trade-offs

- **Lexer/parser:** single pass over lines, indentation nests properties under the current slide/dataset; quoted-arg aware. *Alternative considered:* a tokenizer + grammar (PEG). *Why not:* overkill for a line-oriented format; a hand pass is smaller and gives better error messages.
- **Linter:** rules over the AST producing `{sev,code,line,msg,fix?}`. `fix` marks auto-repairable. *Why diagnostics are structured, not strings:* they are consumed by both the UI and the agent, so they must be machine-legible.
- **Repair:** deterministic transforms (split overflowing bullets/metrics, synthesize/trim headings, drop non-numeric data, pad table rows), run to a **fixed point, bounded to 4 passes**. *Why deterministic, not an LLM fix:* repair must be reliable and free; only genuinely ambiguous fixes should cost a model call. *Bug found and fixed:* a split can surface a new fixable diagnostic, so a naive loop recurses — hence the bound.
- **Bind resolution:** at compile, a slide's `bind <dataset>` resolves the dataset rows into `data`/`metrics`. *Why resolve at compile, not parse:* keeps the AST a faithful record of what the author wrote (bind stays a bind) so round-trip and merge operate on intent, not resolved values.
- **Layout compiler:** lowers to a positioned IR on a 960x540 canvas; estimates rendered text height to detect real overflow (surfaced as `C900`). *Trade-off:* estimation is approximate vs. measuring the DOM; chosen because it is deterministic and runs server-side/CLI without a browser.
- **Renderer:** pure function IR -> React; charts data-bound (recharts), math from a formula string, image as a prompt-bound primitive.

## 3. AI planning flow (prompt -> spec) — and model choice

Two interchangeable authors behind one interface. **Live model:** a system prompt embeds the grammar; the model returns SlideLang source, stripped and header-checked. **Deterministic planner (fallback):** always emits valid spec, so the workflow never dead-ends without a key.

**Model choice / retrieval stance:** for *authoring* a small structured spec, a strong general model with the grammar in context beats fine-tuning — the task is low-volume and schema-constrained, so prompt + constrained output is the right tool, and fine-tuning would be premature. In production this A/B-routes across models (e.g. Claude + GPT) and selects per-context, because frontier models tie on most inputs but fail differently; the reliability comes from the validator, which is model-agnostic. **When the model is wrong:** the verifier ignores the model's self-confidence and checks invariants; unresolved errors flag for a human. **Self-repair loop:** author -> compile -> feed diagnostics back -> regenerate, bounded by attempt count.

## 4. Browser editor state model

`src` (DSL text) is the source of truth; `build(src)` is memoized to `{ast,slides,diagnostics,repairs}`. Two editing surfaces, one source: the text editor mutates `src`; the inspector edits a structured field, mutates the AST, **serializes back to DSL**, and recompiles. Edits are keyed to slide id, which is what lets a regenerate merge without clobbering.

## 5. Validation and repair pipeline

Covered in 2. Key property for this user: **number integrity.** Binding removes drift (one source), and the linter catches a stale bind (`E310`) and non-numeric data (`E302`) before render. A plugin hook (section 8) adds domain checks (e.g. brand-guard, computed totals) without touching the core.

## 6. Chart / math / image primitive rendering

- **Charts (data-bound):** bar/line/area/pie via recharts; `bind` or inline `data`. *Why data-bound, not a rendered image:* the moment a chart is a PNG, the number can drift and can't be edited — the exact failure this product exists to prevent.
- **Math:** a lightweight LaTeX-ish renderer (`\times`, `\frac`, `\prod`, sub/superscripts). *Production:* KaTeX; kept dependency-free in the prototype.
- **Image:** a prompt-bound primitive with a caption. *Production:* image-gen behind a verifier (on-brand, relevant, license-safe) before it lands on a slide.

## 7. Regeneration engine (regenerate without clobbering)

The hardest and most differentiating piece; `src/merge/`. Stable slide ids survive text round-trips; on regenerate, `matchSlides` pairs new to old by type + heading overlap + position and carries ids. Human edits are an **override layer** keyed to id+field (+ pin). `threeWayMerge(oldBase, newBase, overrides)` resolves per field: human-edited + agent-unchanged -> **preserve**; both changed -> **conflict** (default keep human); untouched + agent-changed -> **update**; an edited slide the agent drops -> **conflict-removed**. Output is a merged AST + a diff report rendered for approval. After apply, the new agent output becomes the base and overrides persist as the human delta, so the guarantee holds across repeated updates. This is the deck analog of storing human corrections as keyed overrides that reprocessing cannot silently overwrite.

## 8. Hosted API, publishing, CLI/plugin

- **Hosted API** (`server/index.mjs`, dependency-free Node): `POST /api/author {prompt}` (model behind the server, key never client-side; deterministic fallback), `POST /api/compile {spec}`, `POST /api/publish {spec}` -> `{id,url}`, `GET /d/:id` serves a self-contained deck. *Why a proxy:* the browser can't hold the API key and CORS blocks a direct call.
- **Publishing:** publish stores the spec and returns a share link; present mode + HTML/PDF export for offline. *Production:* PPTX/PDF fidelity and a hosted share surface.
- **CLI + plugins:** `slidelang build|lint|author|export` wrap the same compiler (CI-friendly, exit 1 on errors). The plugin API (`src/plugins/`) runs `transform(ast)` and `lint(ast)` hooks — shipped examples: computed table totals and a brand-guard. This is the extension point for data sources and org rules.

## 9. Python backend: agentic service, reliability, observability

`backend/` (FastAPI) is the production agent + analytics tier; the JS client remains authoritative for rendering.

- **Multi-step agent loop** (`app/agent/loop.py`): plan → author → verify → repair, emitting a structured trace (stage, ok, latency, diagnostics). The verifier is a Python port of the compiler contract (`app/compiler/pipeline.py`) so the loop closes server-side without a browser. *Trade-off:* the validation contract is duplicated in Python and JS. Chosen deliberately — the server needs a headless verifier and the client needs a renderer; the contract is small and covered by tests in both. *Alternative rejected:* calling back into the JS compiler from Python (network hop, tighter coupling, worse latency).
- **Reliability** (`app/agent/client.py`): retries with capped exponential backoff, a hard request timeout, and a deterministic fallback. A model that is slow, rate-limited (429), or returns junk never breaks authoring — it degrades to the deterministic author. This is the same generate-and-verify-with-fallback posture that makes stochastic output shippable: the reliability lives in the layer around the model, not the model.
- **Model choice:** authoring a small, schema-constrained spec favors prompt + constrained output over fine-tuning (low volume, grammar in context). Production would A/B-route across models and select per context, because frontier models tie on most inputs but fail differently; the verifier is model-agnostic, so accuracy comes from it, not the model pick. When the model is wrong, the verifier checks invariants (not the model's self-confidence) and unresolved errors flag for a human.
- **Observability** (`app/logging_conf.py`, `app/kpi/`): structured JSON logs (request id, stage, latency, outcome) and a KPI pipeline. The frontend beacons events; `app/kpi/store.py` computes the PRD's success metrics, surfaced live in the app's KPIs panel and at `GET /api/kpi/metrics`.
- **Eval** (`app/eval/harness.py`): golden specs with seeded defects assert diagnostics fire and repair resolves them; agent evals measure spec-validity. Run in CI.
- **Tests + CI**: 16 pytest tests (compiler, agent, KPI, API) plus the frontend build and eval, gated in GitHub Actions.

**Deploy:** Vercel (`vercel.json`) builds the frontend and serves FastAPI as a Python function (`api/index.py`); serverless is stateless so KPIs are ephemeral there. For a persistent metrics dashboard, deploy the backend as a service (`backend/Dockerfile`, `render.yaml`).

## Prototype scope vs. production

Built and runnable now: DSL + compiler (lexer/parser/linter/repair/layout/render), data binding, the agentic author->verify->repair loop (live model + deterministic fallback), the three-way merge regeneration engine with a diff UI, round-trip editing, charts/math/image, reviewer agent, plugin API, hosted API with publish, present, HTML/PDF export, and a CLI. Deferred: multi-tenant hosting, PPTX fidelity, KaTeX, image-gen with a verifier, multi-model routing, and live data connectors.
