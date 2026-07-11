# SlideLang

A hosted **deck-as-code** authoring platform. Humans and AI agents write a structured
deck spec (SlideLang) that a real compiler validates, repairs, and renders into
editable, reviewable, presentable slides — not static images.

> The model is the easy part. The trust layer is the product.

## Why this exists

Prompt-to-slides gives you a picture you can't edit, can't review, and can't trust.
SlideLang treats a deck as source code: an agent emits a **spec**, a **compiler**
lexes → parses → lints → repairs → lays out → renders it, and every diagnostic is
machine-legible so the agent can self-correct. Because the spec is structured, edits
are diffs (not redos), and a regenerate merges without clobbering human changes.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173  (IDE)
```

Agent authoring works out of the box with the built-in deterministic author.
For the full agentic backend (multi-step loop, retries/timeout/fallback, KPIs,
eval), run the Python API in a second terminal:

```bash
pip install -r backend/requirements.txt
export ANTHROPIC_API_KEY=sk-...      # optional; omit to use the deterministic author
npm run api                           # FastAPI on :8000 (Vite proxies /api and /d here)
```

The key stays server-side; the browser only calls `/api/*`. Tests + eval:

```bash
npm run api:test                      # pytest (16 tests)
cd backend && python -m app.eval.harness   # compiler + agent eval suite
```

### Deploy (Vercel)

`vercel.json` builds the Vite frontend and serves the FastAPI app as a Python
serverless function (`api/index.py`); `/api/*` and `/d/*` rewrite to it. Set
`ANTHROPIC_API_KEY` in the Vercel project. Serverless is stateless, so the KPI
store is ephemeral there — for a persistent metrics dashboard, deploy the backend
as a service (`backend/Dockerfile`, `backend/render.yaml`) and point the frontend
at it. A zero-Python fallback server (`server/index.mjs`, `npm run server`) is also
included.

## CLI (deck-as-code developer surface)

```bash
npm run cli -- author "Seed pitch for an AI-native retail platform" > deck.slide
npm run cli -- build deck.slide      # compile + diagnostics + reviewer score
npm run cli -- lint  deck.slide      # exit 1 on errors (CI-friendly)
npm run cli -- export deck.slide     # write a self-contained deck.html
```

## The differentiator: regenerate without clobbering

Anyone can turn a prompt into slides. The hard part is the *second* prompt. You
generate a deck, hand-edit it, then ask the agent to update the numbers — and your
edits have to survive. SlideLang treats this as a **three-way merge at the spec
layer**, not a re-generation:

- Every slide carries a **stable id** (`slide title #s1_ab2`) that survives regeneration.
- Human edits become an **override layer** keyed to id + field (with an optional pin).
- On regenerate, the engine matches new slides to old by type + heading, then merges:
  untouched fields take the new value, **human-edited fields are preserved**, and fields
  both sides changed surface as **conflicts** you resolve — never silently clobbered.
- A **readable diff** (added / updated / preserved / conflict / removed) is shown for
  approval before anything lands. See `src/merge/`.

Demo path: `Agent authors` → edit a heading + pin a slide → type an update instruction →
`Update & merge` → review the diff → `Apply`.

## What's in the box

- **The language + compiler** — `src/compiler/`: `parser` (lexer + AST), `linter`
  (rule set with fixable diagnostics), `repair` (deterministic fixed-point repair),
  `layout` (overflow detection on a 960×540 canvas), `serialize` (AST → DSL for
  round-trip), `compile` (the full pipeline).
- **The agents** — `src/agent/`: `author` (deterministic planner + `updateAuthor`),
  `loop` (author → verify → repair, plus `regenerate` for the update flow),
  `reviewer` (an independent second-pass critique with a score), `grammar`
  (the agent's action-space contract).
- **Regeneration engine** — `src/merge/`: `identity` (stable ids + slide matching)
  and `merge` (three-way merge → merged AST + diff). This is the no-clobber guarantee.
- **Rendering** — `src/render/`: `SlideView` (all slide types), `Chart`
  (bar/line/area/pie, data-bound), `Formula` (LaTeX-ish math).
- **Export** — `src/export/html.js` (self-contained presentable HTML). PDF via the
  browser print button.
- **Hosted API** — `server/index.mjs`: `/api/author`, `/api/compile`.
- **IDE** — `src/App.jsx`: prompt bar, animated compile pipeline, code editor,
  live preview + thumbnails, round-trip inspector (with speaker notes),
  diagnostics / reviewer / agent-log / repairs panels, present mode, exports.

## Slide types

`title · section · bullets · metrics · chart.bar · chart.line · chart.area ·
chart.pie · table · math · image · quote` — any slide may add `notes` for speaker notes.

## The DSL, briefly

```
deck "Acme AI — Investor Update"
theme midnight

dataset arr           # one source of truth
  row Q1 1.2
  row Q4 4.4

slide chart.area
  heading "ARR by quarter ($M)"
  bind arr            # change the dataset, this slide updates
  notes "Land on 3.7x growth."
```

Line-oriented, 2-space indentation. Designed as an agent action space first
(low-token, diffable, precise line numbers for diagnostics), human format second.
`dataset` + `bind` make the deck a view over a single source of truth, so a number
can't be right in one slide and wrong in another.

## Publish & plugins

- **Publish** — the header "Publish" button stores the spec via `/api/publish` and
  returns a shareable `/d/:id` link (falls back to HTML download with no server).
- **Plugins** (`src/plugins/`) — `transform(ast)` / `lint(ast)` hooks; shipped
  examples: computed table totals and a brand-guard. The extension point for data
  sources and org rules.

## Architecture

```
prompt ─▶ author agent ─▶ SlideLang spec (source of truth)
                              │
     lexer ─▶ parser ─▶ AST ─▶ linter ─▶ repair(fixed-point) ─▶ layout IR ─▶ renderer
                              │
        diagnostics {code,line,msg,fix} ─▶ back to agent (self-repair)
                              │
   round-trip editor ◀─▶ spec ─▶ reviewer agent ─▶ present / export (HTML, PDF)
```

See `PRD.md` and `TDD.md` for the product and technical design.

## Python backend (agentic + observability)

`backend/` is a FastAPI service — the production agent + analytics tier.

- **Agentic loop** (`app/agent/loop.py`): plan → author → verify → repair, returning
  a structured trace of every step. The verifier is a Python port of the compiler
  (`app/compiler/pipeline.py`); its diagnostics are the repair signal.
- **Reliability** (`app/agent/client.py`): retries with capped backoff, hard timeout,
  and a deterministic fallback — a model failure degrades softly, never dead-ends.
- **KPIs** (`app/kpi/`): the frontend beacons events; `/api/kpi/metrics` computes the
  PRD's success metrics (first-pass validity, accepted-unedited, edit-to-ship,
  regenerate-clobber rate, number-drift). Live in the app's **KPIs** panel.
- **Eval** (`app/eval/harness.py`): a golden set for compiler + agent, run in CI.
- **Structured logging** (`app/logging_conf.py`): JSON lines with request id, stage,
  latency, outcome.
- **Tests**: `backend/tests/` (16, pytest). CI (`.github/workflows/ci.yml`) runs the
  frontend build, pytest, and the eval suite on every push.

Endpoints: `POST /api/author`, `POST /api/compile`, `POST /api/publish`, `GET /d/:id`,
`POST /api/kpi/event`, `GET /api/kpi/metrics`, `GET /api/eval`, `GET /api/health`.

## Images (generation + verifier + no-clobber assets)

Image slides generate a visual via `POST /api/image` (`backend/app/image/`): a
pluggable **provider** (default: deterministic SVG so demos never flake; a real
image model implements the same interface) gated by a **verifier** that blocks
brand/logo lookalikes and unsafe prompts. The generated asset has a stable id per
prompt and is tracked on the slide as `imageRef`, so it joins the no-clobber merge:
a **pinned** image is kept on regenerate, an **unchanged** prompt reuses the cached
asset, and only a **changed** prompt on an unpinned slide regenerates. Generate/pin
an image in the inspector.
