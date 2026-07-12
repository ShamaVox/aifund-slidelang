# SlideLang — deck-as-code

**A compiler for presentations. Humans and AI agents author a structured spec;
the compiler makes it correct, repairable, and safe to edit.**

Live: https://aifund-slidelang.vercel.app

---

## The thesis

Everyone can generate slides now. The hard part is *trusting* the output and
*editing* it without starting over. SlideLang treats a deck as code: a typed,
structured language that a human's intent or an agent's output both compile to.
Because the deck is a spec and not a flattened image, we can validate it, repair
it, and merge human edits without ever silently overwriting them.

**Generation is solved. Trust is the product.**

---

## For non-technical users AND agents

The brief calls for a system where humans *and* AI agents create structured deck
specs. SlideLang serves both without compromise, because the audiences touch
different layers:

- **A non-technical human never sees the language.** They type intent in plain
  English, the agent authors the SlideLang spec, and they edit by clicking text
  directly on the slide. No syntax, no code.
- **An agent authors the spec directly.** It can POST SlideLang source to
  `/api/compile`, or hand a goal to `/api/agent` and let the model write the spec,
  call the compiler as a tool, read the diagnostics, and self-correct until clean.
- **A power user can open the spec.** The `Code` panel exposes the DSL for anyone
  who wants to hand-author or inspect it.

The language exists so the output is structured, diffable, and mergeable — which
is exactly what makes the trust layer possible.

---

## How it maps to the brief

| Brief requirement | How SlideLang does it |
| --- | --- |
| Prompt **or** structured-spec intake | Prompt box (NL → agent authors spec) and a live SlideLang editor |
| A deck compiler | `deck.slide` DSL compiles: normalize → parse → lint → repair → render |
| Browser review and editing | Review-first render; click any text on the slide to edit inline |
| Validation and repair | Every spec is linted; fixable issues are auto-repaired and reported |
| Chart / math / image primitives | `chart.*`, `math` (LaTeX), datasets with `bind`, and images beside content |
| Publish / present | Present mode, publish link, HTML export |
| Humans **and agents** create specs | Same compiler path for a human's spec or an agent's; live agent loop + API |

---

## Architecture

**One typed boundary.** Everything is a `Deck` with stable slide IDs. Intent
comes in as a prompt or a spec; both resolve to the same typed structure.

**Deterministic compile pipeline.** `normalize → validate → repair → score`.
The validator catches structural problems; the repair pass fixes what it safely
can (trimming overflow, dropping malformed data points) and records every change.
Nothing fails silently.

**The trust layer — a three-way merge on stable IDs.** When an agent regenerates
a deck, human edits are not lost. We diff the human's base, the agent's new
version, and the human's overrides, keyed on stable slide IDs. Human edits win on
conflict; the AI never clobbers your work. This is the hard, valuable part and the
thing users will not live without.

**Agents as first-class authors.** `/api/compile` accepts an agent-written spec.
`/api/agent` runs a live loop: the LLM is given the compiler as a tool, writes a
spec, validates it, fixes its own errors, and returns a clean deck — with a
step-by-step trace of what it did.

**Graceful degradation everywhere.** No API key → a deterministic planner still
produces a valid deck. Image provider down → a deterministic placeholder renders.
The app never dead-ends, and it always tells you which path ran.

---

## The DSL, briefly

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

Indentation-based, one idea per slide, images attach to content slides where they
fit. A human reads it like an outline; an agent emits it like code; the compiler
guarantees it renders.

---

## What ships next

- **Real-time multiplayer.** Single-user today with a human↔agent merge. The hard
  part — stable IDs and a three-way merge — already exists, so multi-human sync is
  a tractable extension, not a rearchitecture.
- **Richer primitives** (more chart types, layout variants).
- **Reliability score as a product surface** — the render-confidence signal the
  compiler already computes, exposed to the author.

---

## Run it

```bash
# frontend
npm install && npm run dev

# backend (in another shell, with your key)
export ANTHROPIC_API_KEY=sk-ant-...
cd backend && uvicorn app.main:app --port 8000
```

Set `SLIDELANG_MODEL` (e.g. `claude-sonnet-5`) for live authoring, and
`SLIDELANG_IMAGE_PROVIDER=openai` + `OPENAI_API_KEY` for real images.
