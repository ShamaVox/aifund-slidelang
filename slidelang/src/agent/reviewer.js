// Reviewer agent: a second, deterministic pass that critiques a *compiled* deck
// for quality issues a linter can't catch structurally (pacing, balance, story).
// Mirrors the "consensus / second opinion" idea: an independent check, surfaced
// as review notes, never silently mutating the deck.
export function reviewDeck(build) {
  const notes = [];
  const s = build.slides;
  const n = s.length;

  if (n < 4) notes.push({ kind: "pacing", msg: `Only ${n} slides — a business deck usually wants 6-10 for a clear arc.` });
  if (n > 14) notes.push({ kind: "pacing", msg: `${n} slides is long — consider cutting to tighten the story.` });

  const hasTitle = s[0]?.type === "title";
  if (!hasTitle) notes.push({ kind: "structure", msg: "No opening title slide — start with a title + one-line thesis." });

  const hasClose = /clos|next|thank|ask|call/i.test(s[n - 1]?.heading || "");
  if (n > 3 && !hasClose) notes.push({ kind: "structure", msg: "No clear closing slide — end on the ask or the takeaway." });

  const charts = s.filter((x) => x.type.startsWith("chart.")).length;
  const bulletSlides = s.filter((x) => x.type === "bullets").length;
  if (charts === 0 && n > 4) notes.push({ kind: "evidence", msg: "No data slides — a business/technical deck is stronger with at least one chart." });
  if (bulletSlides > n * 0.6) notes.push({ kind: "balance", msg: "Mostly bullet slides — vary with a metric, chart, or quote to hold attention." });

  const overflow = s.filter((x) => x._overflow).length;
  if (overflow) notes.push({ kind: "layout", msg: `${overflow} slide(s) still crowd the canvas — trim copy or split.` });

  const noNotes = s.filter((x) => !x.notes).length;
  if (noNotes > n / 2) notes.push({ kind: "delivery", msg: "Most slides have no speaker notes — add notes for a smoother present." });

  const score = Math.max(0, Math.min(100, 100 - notes.length * 9 - overflow * 6 - build.errors.length * 20));
  return { score, notes };
}
