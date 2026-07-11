import React from "react";
import { THEMES } from "../compiler/parser.js";
import { CANVAS } from "../compiler/layout.js";
import Formula from "./Formula.jsx";
import Chart from "./Chart.jsx";

export default function SlideView({ s, theme, scale = 1, assets = {} }) {
  const th = THEMES[theme] || THEMES.midnight;
  const pad = { padding: `${CANVAS.padY * scale}px ${CANVAS.padX * scale}px` };
  const rule = <div style={{ width: 40 * scale, height: 3 * scale, background: th.accent, margin: `${14 * scale}px 0 ${22 * scale}px`, borderRadius: 2 }} />;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: th.bg, color: th.fg, overflow: "hidden", display: "flex", flexDirection: "column", ...pad }}>
      {s._overflow && (
        <div style={{ position: "absolute", top: 10 * scale, right: 12 * scale, fontSize: 11 * scale, color: "#E8A44C", background: "rgba(232,164,76,.12)", padding: "2px 8px", borderRadius: 6, fontFamily: "ui-monospace" }}>overflow</div>
      )}

      {s.type === "title" ? (
        <div style={{ margin: "auto 0" }}>
          <div style={{ width: 54 * scale, height: 4 * scale, background: th.accent, marginBottom: 22 * scale, borderRadius: 2 }} />
          <div style={{ fontSize: 58 * scale, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{s.heading}</div>
          {s.subtitle && <div style={{ fontSize: 24 * scale, color: th.muted, marginTop: 18 * scale }}>{s.subtitle}</div>}
        </div>
      ) : s.type === "section" ? (
        <div style={{ margin: "auto 0" }}>
          <div style={{ fontSize: 46 * scale, fontWeight: 800, color: th.accent }}>{s.heading}</div>
        </div>
      ) : s.type === "quote" ? (
        <div style={{ margin: "auto 0" }}>
          <div style={{ fontSize: 34 * scale, fontWeight: 600, lineHeight: 1.3, fontFamily: "'IBM Plex Serif', Georgia, serif" }}>“{s.quote}”</div>
          {s.cite && <div style={{ fontSize: 18 * scale, color: th.muted, marginTop: 18 * scale }}>— {s.cite}</div>}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 40 * scale, fontWeight: 700, color: th.fg, lineHeight: 1.1, letterSpacing: -0.5 }}>{s.heading}</div>
          {rule}
          <div style={{ flex: 1, minHeight: 0 }}>
            {s.type === "bullets" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 * scale }}>
                {s.points.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 14 * scale, alignItems: "flex-start" }}>
                    <div style={{ width: 8 * scale, height: 8 * scale, borderRadius: 2, background: th.accent, marginTop: 10 * scale, flexShrink: 0 }} />
                    <div style={{ fontSize: 24 * scale, lineHeight: 1.35 }}>{p}</div>
                  </div>
                ))}
              </div>
            )}

            {s.type === "metrics" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 * scale }}>
                {s.metrics.map((m, i) => (
                  <div key={i} style={{ border: `1px solid ${th.rule}`, borderRadius: 12 * scale, padding: `${18 * scale}px ${20 * scale}px` }}>
                    <div style={{ fontSize: 15 * scale, color: th.muted, textTransform: "uppercase", letterSpacing: 1 }}>{m.label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 * scale, marginTop: 6 * scale }}>
                      <div style={{ fontSize: 40 * scale, fontWeight: 800 }}>{m.value}</div>
                      {m.delta && <div style={{ fontSize: 18 * scale, color: /^-/.test(m.delta) ? "#E5637A" : "#3FB8AF", fontWeight: 600 }}>{m.delta}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {s.type.startsWith("chart.") && <Chart s={s} th={th} scale={scale} />}

            {s.type === "table" && (
              <div style={{ width: "100%" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, s.cols.length)}, 1fr)`, gap: 0 }}>
                  {s.cols.map((c, i) => (
                    <div key={i} style={{ fontSize: 15 * scale, color: th.muted, textTransform: "uppercase", letterSpacing: 1, padding: `${8 * scale}px ${10 * scale}px`, borderBottom: `2px solid ${th.accent}` }}>{c}</div>
                  ))}
                  {s.rows.map((r, ri) => r.map((cell, ci) => (
                    <div key={ri + "-" + ci} style={{ fontSize: 20 * scale, padding: `${10 * scale}px`, borderBottom: `1px solid ${th.rule}` }}>{cell}</div>
                  )))}
                </div>
              </div>
            )}

            {s.type === "math" && (
              <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <Formula src={s.formula} color={th.accent} />
              </div>
            )}

            {s.type === "image" && (
              (s.imageRef && assets[s.imageRef]) ? (
                <img src={assets[s.imageRef]} alt={s.image || "image"} style={{ width: "100%", height: 280 * scale, objectFit: "cover", borderRadius: 14 * scale, border: `1px solid ${th.rule}`, display: "block" }} />
              ) : (
                <div style={{ height: 280 * scale, borderRadius: 14 * scale, background: `linear-gradient(135deg, ${th.accent}22, ${th.rule})`, border: `1px solid ${th.rule}`, display: "flex", alignItems: "flex-end", padding: 20 * scale }}>
                  <div style={{ fontSize: 15 * scale, color: th.muted, fontFamily: "ui-monospace" }}>image · {s.image}{s.imageRef ? " · (generate to render)" : ""}</div>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
