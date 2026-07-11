import React from "react";

// Lightweight LaTeX-ish renderer: \times \cdot \prod \sum \frac{a}{b} ^ _
export default function Formula({ src, color }) {
  let s = (src || "")
    .replace(/\\times/g, "×").replace(/\\cdot/g, "·")
    .replace(/\\prod/g, "∏").replace(/\\sum/g, "∑")
    .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥").replace(/\\approx/g, "≈");

  const parts = [];
  let key = 0;
  const fracRe = /\\frac\{([^{}]*)\}\{([^{}]*)\}/;
  while (fracRe.test(s)) {
    const m = s.match(fracRe);
    parts.push(<span key={key++}>{s.slice(0, m.index)}</span>);
    parts.push(
      <span key={key++} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", verticalAlign: "middle", margin: "0 6px" }}>
        <span>{m[1]}</span>
        <span style={{ borderTop: `2px solid ${color}`, padding: "2px 10px 0" }}>{m[2]}</span>
      </span>
    );
    s = s.slice(m.index + m[0].length);
  }
  // super/subscripts on the remaining tail
  const tail = s.split(/(\^\{[^}]*\}|_\{[^}]*\}|\^\w|_\w)/).map((tok, i) => {
    if (/^\^/.test(tok)) return <sup key={i}>{tok.replace(/^\^\{?|\}$/g, "")}</sup>;
    if (/^_/.test(tok)) return <sub key={i}>{tok.replace(/^_\{?|\}$/g, "")}</sub>;
    return <span key={i}>{tok}</span>;
  });
  parts.push(<span key={key++}>{tail}</span>);

  return <div style={{ fontSize: 40, color, fontFamily: "'IBM Plex Serif', Georgia, serif", letterSpacing: 0.5, lineHeight: 1.4 }}>{parts}</div>;
}
