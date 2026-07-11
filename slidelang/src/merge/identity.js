// Slide identity across regenerations.
// Regeneration produces fresh content, so we match new slides to old ones by
// type + heading similarity + position, and carry the stable id forward. That
// id is what human edits (overrides) are keyed to — it's the whole reason an
// edit can survive a regenerate.

let _counter = 0;
export function newId() { _counter += 1; return "s" + _counter + "_" + Math.random().toString(36).slice(2, 6); }

export function assignIds(ast, force = false) {
  const next = JSON.parse(JSON.stringify(ast));
  next.slides.forEach((s) => { if (force || !s.id) s.id = newId(); });
  return next;
}

function tokens(str) {
  return new Set((str || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean));
}
function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let hit = 0; A.forEach((t) => { if (B.has(t)) hit++; });
  return hit / Math.max(A.size, B.size);
}

// Similarity in [0,1]: type match dominates, heading overlap refines, index proximity breaks ties.
function similarity(a, b, ia, ib, n) {
  const typeScore = a.type === b.type ? 0.5 : (a.type.split(".")[0] === b.type.split(".")[0] ? 0.3 : 0);
  const headScore = 0.4 * overlap(a.heading || a.quote, b.heading || b.quote);
  const posScore = 0.1 * (1 - Math.abs(ia - ib) / Math.max(1, n));
  return typeScore + headScore + posScore;
}

// Carry ids from oldAst onto newAst by greedy best-match. Returns a new AST
// where each slide has .id (matched or fresh) and ._match (the old slide id or null).
export function matchSlides(oldAst, newAst) {
  const out = JSON.parse(JSON.stringify(newAst));
  const oldSlides = oldAst.slides;
  const usedOld = new Set();
  const n = Math.max(oldSlides.length, out.slides.length);

  out.slides.forEach((ns, i) => {
    let best = -1, bestScore = 0.35; // threshold: below this, treat as a new slide
    oldSlides.forEach((os, j) => {
      if (usedOld.has(j)) return;
      const sc = similarity(os, ns, j, i, n);
      if (sc > bestScore) { bestScore = sc; best = j; }
    });
    if (best >= 0) { usedOld.add(best); ns.id = oldSlides[best].id || newId(); ns._match = oldSlides[best].id; }
    else { ns.id = newId(); ns._match = null; }
  });

  // record which old slides were dropped (for the diff "removed" section)
  out._removed = oldSlides.filter((_, j) => !usedOld.has(j));
  return out;
}
