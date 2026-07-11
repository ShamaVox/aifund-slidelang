// Three-way merge: old base (what the agent produced last), new base (what the
// agent just produced), and human overrides (edits keyed to slide id + field).
//
// Rule per field:
//   - human overrode it, agent left it unchanged  -> keep human edit   (PRESERVED)
//   - human overrode it, agent also changed it     -> CONFLICT (default: keep human)
//   - human didn't touch it, agent changed it      -> take new value    (CHANGED)
//   - human didn't touch it, agent left it          -> unchanged
//   - slide only in new base                        -> ADDED
//   - edited slide only in old base                 -> CONFLICT (would be removed)
//
// This is the regenerate-without-clobbering guarantee, at the spec layer.
import { matchSlides } from "./identity.js";

export const MERGE_FIELDS = ["heading", "subtitle", "notes", "points", "metrics", "data", "formula", "image", "quote", "cite"];
const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// overrides: { [slideId]: { [field]: value, _pinned?: bool } }
export function threeWayMerge(oldBase, newBase, overrides = {}) {
  const matched = matchSlides(oldBase, newBase);
  const diff = [];
  const oldById = Object.fromEntries(oldBase.slides.map((s) => [s.id, s]));

  const mergedSlides = matched.slides.map((ns) => {
    const os = ns._match ? oldById[ns._match] : null;
    const ov = overrides[ns.id] || {};
    const merged = { ...ns };
    delete merged._match;

    if (!os) {
      diff.push({ slideId: ns.id, heading: ns.heading || ns.quote || ns.type, field: "slide", kind: "added" });
      return merged;
    }

    MERGE_FIELDS.forEach((f) => {
      const hasOverride = Object.prototype.hasOwnProperty.call(ov, f);
      const newVal = ns[f], oldVal = os[f];
      if (hasOverride) {
        if (eq(newVal, oldVal)) {
          merged[f] = ov[f];
          diff.push({ slideId: ns.id, heading: ns.heading, field: f, kind: "preserved", mine: ov[f] });
        } else {
          merged[f] = ov[f]; // default: human wins; user can flip to "take new"
          diff.push({ slideId: ns.id, heading: ns.heading, field: f, kind: "conflict", mine: ov[f], theirs: newVal });
        }
      } else if (!eq(newVal, oldVal)) {
        merged[f] = newVal;
        diff.push({ slideId: ns.id, heading: ns.heading, field: f, kind: "changed", theirs: newVal, was: oldVal });
      }
    });

    // Image asset reuse vs. regenerate:
    //  - pinned slide            -> keep the existing image (edit-in-place feel)
    //  - prompt unchanged        -> reuse the cached asset (no needless regen)
    //  - prompt changed, unpinned-> drop the asset so it regenerates from the new prompt
    if (ns.type === "image") {
      const pinned = !!ov._pinned;
      if (pinned || eq(merged.image, os.image)) {
        merged.imageRef = os.imageRef || null;
        if (pinned && os.imageRef) diff.push({ slideId: ns.id, heading: ns.heading, field: "image", kind: "preserved", mine: "pinned image kept" });
      } else {
        merged.imageRef = null; // regenerate to match the new prompt
        if (os.imageRef) diff.push({ slideId: ns.id, heading: ns.heading, field: "image", kind: "changed", theirs: "new image (prompt changed)" });
      }
    }
    return merged;
  });

  // edited-but-removed slides become conflicts so a human decides, not the agent
  (matched._removed || []).forEach((os) => {
    const hadEdits = overrides[os.id] && Object.keys(overrides[os.id]).some((k) => k !== "_pinned");
    if (hadEdits || overrides[os.id]?._pinned) {
      diff.push({ slideId: os.id, heading: os.heading || os.type, field: "slide", kind: "conflict-removed", mine: os });
    } else {
      diff.push({ slideId: os.id, heading: os.heading || os.type, field: "slide", kind: "removed" });
    }
  });

  const mergedAst = { ...newBase, slides: mergedSlides };
  const summary = {
    added: diff.filter((d) => d.kind === "added").length,
    changed: diff.filter((d) => d.kind === "changed").length,
    preserved: diff.filter((d) => d.kind === "preserved").length,
    conflicts: diff.filter((d) => d.kind === "conflict" || d.kind === "conflict-removed").length,
    removed: diff.filter((d) => d.kind === "removed").length,
  };
  return { mergedAst, diff, summary };
}

// Apply a conflict resolution: keep "mine" (already applied) or "take new".
export function resolveConflict(mergedAst, oldBase, newBase, diffEntry, choice) {
  const ast = JSON.parse(JSON.stringify(mergedAst));
  const slide = ast.slides.find((s) => s.id === diffEntry.slideId);
  if (slide && choice === "theirs" && diffEntry.field !== "slide") slide[diffEntry.field] = diffEntry.theirs;
  return ast;
}
