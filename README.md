SlideLang

Deck-as-code. A compiler for presentations: humans and AI agents author a structured spec, and the compiler makes it correct, repairable, and safe to edit.

Live demo 
https://aifund-slidelang.vercel.app/


Generation is solved. Trust is the product.

Why this repository matters

SlideLang demonstrates a broader production-AI pattern: keep the model at the uncertain edge, then use typed boundaries, deterministic validation, bounded repair, stable identifiers, and explicit merge rules to protect user work.

What it does

•
Prompt to deck

•
Spec to deck

•
Browser editing without syntax knowledge

•
Validation and bounded repair

•
Three-way merge that preserves human edits

•
Present, publish, and HTML export

Quickstart

Bash


npm install
npm run dev

# In a second shell, start the backend as documented in the project files.



Architecture

Plain Text


prompt or spec
      ↓
authoring agent or human editor
      ↓
typed Deck boundary
      ↓
normalize → validate → repair
      ↓
render / edit / merge / publish



Prototype boundary

Before production use, add authentication, authorization, rate limiting, durable persistence, structured logging, cost controls, and a security review for user-supplied prompts and generated content.

