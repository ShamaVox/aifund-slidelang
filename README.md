# SlideLang

**Deck-as-code.** A compiler for presentations: humans and AI agents author a
structured spec, and the compiler makes it correct, repairable, and safe to edit.

Live: https://aifund-slidelang.vercel.app

Generation is solved. Trust is the product.

---

## What it does

- **Prompt to deck.** Type intent in plain English; an agent authors a SlideLang
  spec and the compiler renders it. Non-technical users never see the language.
- **Spec to deck.** Write or paste SlideLang directly, or have an external agent
  POST it to the API. Same compiler path either way.
- **Edit in the browser.** Review-first render; click any text on a slide to edit
  it inline. No syntax required.
- **Validate and repair.** Every spec is linted; fixable issues are auto-repaired
  and reported. Nothing fails silently.
- **Regenerate without losing work.** A three-way merge on stable slide IDs means
  an agent regeneration never clobbers human edits.
- **Present, publish, export.** Full-screen present mode, a publish link, and HTML
  export.

---

## Quickstart

```bash
# 1. Frontend (Vite + React)
npm install
npm run dev

# 2. Backend (FastAPI), in a second shell
export ANTHROPIC_API_KEY=sk-ant-...
export SLIDELANG_MODEL=claude-sonnet-5
cd backend && uvicorn app.main:app --port 8000
```

Open the local dev URL. Type a prompt and hit **Generate**, or open **Code** to
write a spec by hand.

### Optional: real image generation

```bash
export SLIDELANG_IMAGE_PROVIDER=openai
export OPENAI_API_KEY=sk-...
export SLIDELANG_IMAGE_MODEL=gpt-image-1-mini      # fast; gpt-image-2 for best quality
export GEMINI_API_KEY=...                          # optional nano-banana fallback
```

Images generate automatically for slides that carry an `image` prompt, and appear
beside the slide content. Without a key, a deterministic placeholder renders so the
app never dead-ends. (Anthropic does not generate images; image generation uses
OpenAI or Google.)

---

## The DSL

```
deck "Quiet luxury, loud loyalty"
theme sunrise

dataset growth
  row Q1 1.2
  row Q4 4.4

slide bullets
  heading "Craft you can feel"
  point "Full-grain leather, cut by hand"
  point "Every piece numbered and traceable"
  image "a folded cashmere sweater on warm linen, soft daylight"

slide chart.area
  heading "Repeat revenue compounds"
  bind growth
```

Indentation-based, one idea per slide. `image` attaches to any content slide and
renders beside the text. Slide types: `title`, `section`, `bullets`, `metrics`,
`chart.bar` / `chart.line` / `chart.area` / `chart.pie`, `table`, `math`, `image`,
`quote`.

---

## Project structure

```
src/                     Vite React frontend
  App.jsx                Studio: authoring, editing, merge, present
  HomeView.jsx           Landing / prompt entry
  AgentApiDemo.jsx       "Agent via API" and live-agent demo
  compiler/              DSL parser, serializer, layout, compile pipeline
  render/                SlideView, Chart, Formula
  agent/                 Frontend authoring loop, reasoning, three-way merge
backend/
  app/main.py            FastAPI routes: /api/author, /api/agent, /api/compile,
                         /api/image, /api/publish, /api/health
  app/agent/             Authoring, deterministic fallback, live agent loop, grammar
  app/compiler/          Python compile pipeline (parse, lint, repair)
  app/image/             Image providers (OpenAI, Gemini, placeholder)
api/index.py             Vercel serverless entrypoint (serves the FastAPI app)
vercel.json              Build config + function maxDuration
examples/                Sample .slide specs
```

---

## API

- `POST /api/author` — `{prompt}` → agent-authored spec (returns `used_model`).
- `POST /api/compile` — `{spec}` → compiled deck (slides, diagnostics, repairs).
- `POST /api/agent` — `{goal}` → live agent loop that uses the compiler as a tool
  and returns a clean deck plus a step trace.
- `POST /api/image` — `{prompt}` → generated image (or placeholder), with the
  provider named in the response.
- `GET /api/health` — service and model status.

---

## Architecture notes

- **One typed boundary.** Prompt or spec, human or agent, everything resolves to a
  `Deck` with stable slide IDs.
- **Deterministic pipeline.** normalize → validate → repair → render.
- **Three-way merge.** Human base vs. agent regeneration vs. human overrides,
  keyed on slide IDs; human edits win on conflict.
- **Graceful degradation.** Missing model key → deterministic planner. Missing
  image key → placeholder. The response always reports which path ran.

---

## Deploy

Pushes to `main` deploy to Vercel. Set `ANTHROPIC_API_KEY`, `SLIDELANG_MODEL`, and
(for images) `SLIDELANG_IMAGE_PROVIDER` + `OPENAI_API_KEY` in the project's
environment variables, scoped to **All Environments** so previews work too.
`vercel.json` sets the API function `maxDuration` for image generation headroom.
