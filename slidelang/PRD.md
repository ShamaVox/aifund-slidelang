# SlideLang — PRD

**One line:** A deck-as-code platform for founders who live in recurring high-stakes decks. Agents author a structured spec that a compiler validates, repairs, binds to data, and renders — so investor and board decks are editable, trustworthy, and safe to regenerate.

## The user (one, specific)

**The founding team of an early-stage AI startup** — usually two or three people who build their investor updates, board decks, fundraise narratives, and technical design reviews *together*. The CEO owns the narrative, the technical cofounder owns the numbers and the systems content, and they are all editing the same living deck. One account, one shared workflow.

We slice by stakes and frequency, not by job title: these decks are the highest-consequence (a wrong number in front of investors is unrecoverable) and the highest-frequency (rebuilt every time ARR, burn, or pipeline moves), usually the night before a board call.

Their two sharp pains are *sharper* because more than one person touches the deck: drift between the CEO's headline and the cofounder's chart, and edits getting clobbered when someone regenerates on new numbers.

**Their two sharp pains:**
1. **The living deck.** They regenerate when the numbers change and lose every hand-edit from last time — the reordered slides, the sharpened headline, the note to self. Regeneration means redoing the polish.
2. **The wrong number.** One stale or mismatched figure in front of investors is unrecoverable. The metric in the headline must match the chart, and both must match the source of truth.

Every feature maps to those two pains. Features that didn't were cut.

## Why structured authoring beats prompt-to-static

A prompted slide is a picture: you can't edit it without fighting it, can't diff it, can't check it, and a regenerate throws away your changes. SlideLang treats a deck as source code — an agent emits a **spec**, a **compiler** lowers it to slides — which unlocks the three things this user needs:

- **Data-bound, so numbers stay right.** Metrics and charts `bind` a named dataset. Change ARR in one place; the KPI slide and the chart both update. No retyping, no drift between headline and chart. (Pain 2.)
- **Editable that sticks.** Every slide has a stable id; human edits live in an override layer; a regenerate is a three-way merge that preserves edits and surfaces conflicts. (Pain 1.)
- **Trustworthy by construction.** A linter checks rules that must hold (bound number resolves, chart data numeric, content fits); deterministic repair fixes what it can; low-confidence items are flagged, not shipped.

## What makes the deck trustworthy and editable

1. **Real compiler, not a template** — lexer to parser to linter to repair to layout (with overflow detection) to renderer; every diagnostic carries code, line, and a fix.
2. **Data binding** — `dataset` + `bind` make the deck a view over a single source of truth, so a number can't be right in one slide and wrong in another.
3. **Regenerate without clobbering** — the hardest decision, made visible in the product: author, edit, pin, then update, and watch a diff show what was preserved vs. updated. The feature the user feels most.
4. **Validation + repair as a loop** — the agent's diagnostics are machine-legible, so it self-corrects; humans approve the rest.

## User feedback shaped the build

We put the prototype in front of target users (early-stage founders) before submitting.
[Fill with your real sessions: who, what they did, what they ignored, what changed.]
The signal we designed around: "I don't trust it to regenerate, so I copy to PowerPoint so it can't eat my edits." That sentence is why regeneration-with-a-diff, not one-shot generation, is the center of the product. [Confirm or replace with your own quotes.]

## The wedge, then the platform

**Wedge:** the founder's recurring, data-bound, high-stakes decks (investor update, board deck, design review). Highest pain, highest frequency, clearest "safe regenerate" value.
**Expansion:** the same spec + compiler + safe-regeneration engine serves anyone who owns a recurring, data-bound deck — chief of staff, finance, PM, technical or not; we start with the founding team because their pain is sharpest. From there: shared datasets and themes across a company, live data connectors, an agent API/CLI so decks generate in pipelines.

**On collaboration:** the three-way merge is *asynchronous* team collaboration — edits are preserved and merged across regenerations and versions, not live multiplayer cursors. That is deliberate: for decks that regenerate from changing data, the hard problem is edit-preservation across regeneration, not simultaneous typing. Real-time multiplayer is a roadmap item that sits on top of this engine.

## Validation plan

- **Compiler correctness** — golden specs with known output; assert diagnostics fire on seeded defects (overflow, non-numeric data, unknown bind) and repair resolves them to zero errors. A broken deck with four seeded defects compiles to zero errors via auto-repair.
- **Data-binding integrity** — assert bound slides resolve from the dataset and a stale or absent binding is caught (E310).
- **Edit durability** — regenerate after an edit; assert the edit survives and the diff reports it preserved.
- **Agent reliability** — first-pass spec-validity rate; error-resolution rate after N repair passes.

## Success metrics

- **Edit-to-ship time** — minutes from generated deck to approved deck (target down 70% vs. hand-tuning).
- **Percent of slides accepted unedited** — real quality, not "looks nice."
- **Regenerate-clobber rate** — percent of human edits lost on regenerate (target ~0).
- **Number-drift incidents** — mismatches between headline and chart (target 0, enforced by binding + lint).
- **First-pass spec validity** — percent of agent generations that compile clean.
