import React from "react";
import { THEMES } from "../compiler/parser.js";
import { CANVAS } from "../compiler/layout.js";
import Formula from "./Formula.jsx";
import Chart from "./Chart.jsx";

// Display serif for headings/quotes, clean sans for body — the pairing is what
// reads as "designed" rather than "rendered by a script".
const DISPLAY = "'Fraunces', 'Playfair Display', Georgia, serif";
const SANS = "'Archivo', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

// Deterministic, on-brand generative art for image slides. Same prompt -> same
// composition, so it doubles as a stable visual asset and never looks broken.
function ArtFallback({ prompt, th, scale, radius }) {
  let h = 2166136261;
  const str = (prompt || "image").toLowerCase();
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  let sd = h >>> 0;
  const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const blobs = Array.from({ length: 6 }).map(() => ({
    cx: 10 + rnd() * 80, cy: 10 + rnd() * 80, r: 12 + rnd() * 34, o: 0.10 + rnd() * 0.22,
  }));
  return (
    <div style={{
      position: "relative", width: "100%", height: 300 * scale, borderRadius: radius,
      overflow: "hidden", border: `1px solid ${th.rule}`,
      background: `linear-gradient(135deg, ${th.bg}, ${th.rule})`,
    }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <radialGradient id="artglow">
            <stop offset="0%" stopColor={th.accent} stopOpacity="0.5" />
            <stop offset="100%" stopColor={th.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        {blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={i % 2 ? "url(#artglow)" : th.accent} opacity={b.o} />
        ))}
      </svg>
      <div style={{
        position: "absolute", left: 18 * scale, bottom: 16 * scale, fontFamily: MONO,
        fontSize: 12 * scale, color: th.muted, letterSpacing: 0.3,
        background: "rgba(0,0,0,.25)", padding: `${4 * scale}px ${9 * scale}px`, borderRadius: 6,
      }}>{(prompt || "image").slice(0, 46)}</div>
    </div>
  );
}

export default function SlideView({ s, theme, scale = 1, assets = {}, deckTitle = "", total = 0 }) {
  const th = THEMES[theme] || THEMES.midnight;
  const dark = th.fg > th.bg; // fg lighter than bg => dark theme (string compare works for these tokens)
  const pad = { padding: `${CANVAS.padY * scale}px ${CANVAS.padX * scale}px` };
  const showChrome = scale >= 0.3; // hide footer/eyebrow on tiny thumbnails
  const isCover = s.type === "title" || s.type === "section" || s.type === "quote";

  const bgLayers = (
    <>
      <div style={{ position: "absolute", inset: 0, background: th.bg }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(120% 80% at ${isCover ? "82% 12%" : "100% 0%"}, ${th.accent}${isCover ? "22" : "14"}, transparent 60%)`,
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(180deg, transparent 60%, ${dark ? "rgba(0,0,0,.28)" : "rgba(0,0,0,.05)"})`,
      }} />
    </>
  );

  const eyebrow = (label) => (showChrome && label) ? (
    <div style={{
      fontFamily: MONO, fontSize: 12.5 * scale, letterSpacing: 2, textTransform: "uppercase",
      color: th.accent, marginBottom: 14 * scale, fontWeight: 600,
    }}>{label}</div>
  ) : null;

  const footer = (showChrome && !isCover) ? (
    <div style={{
      position: "absolute", left: CANVAS.padX * scale, right: CANVAS.padX * scale, bottom: 26 * scale, zIndex: 2,
      display: "flex", alignItems: "center", gap: 10 * scale,
      fontFamily: MONO, fontSize: 12 * scale, color: th.muted, letterSpacing: 0.5,
    }}>
      <span style={{ textTransform: "uppercase" }}>{deckTitle || "SlideLang"}</span>
      <div style={{ flex: 1, height: 1, background: th.rule }} />
      {total > 0 && <span>{String((s._index ?? 0) + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>}
    </div>
  ) : null;

  const rule = <div style={{ width: 44 * scale, height: 3 * scale, background: th.accent, margin: `${16 * scale}px 0 ${26 * scale}px`, borderRadius: 3 }} />;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", color: th.fg, overflow: "hidden", fontFamily: SANS, display: "flex", flexDirection: "column", ...pad }}>
      {bgLayers}

      {s._overflow && (
        <div style={{ position: "absolute", top: 12 * scale, right: 14 * scale, zIndex: 3, fontSize: 11 * scale, color: "#E8A44C", background: "rgba(232,164,76,.14)", padding: "2px 9px", borderRadius: 6, fontFamily: MONO }}>overflow</div>
      )}

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>
        {s.type === "title" ? (
          <div style={{ margin: "auto 0", maxWidth: "92%" }}>
            {eyebrow(deckTitle && deckTitle !== s.heading ? deckTitle : "SlideLang · deck-as-code")}
            <div style={{ width: 64 * scale, height: 4 * scale, background: th.accent, marginBottom: 26 * scale, borderRadius: 3 }} />
            <div style={{ fontFamily: DISPLAY, fontSize: 66 * scale, fontWeight: 600, lineHeight: 1.02, letterSpacing: -1.5 }}>{s.heading}</div>
            {s.subtitle && <div style={{ fontSize: 25 * scale, color: th.muted, marginTop: 22 * scale, lineHeight: 1.35, maxWidth: "80%" }}>{s.subtitle}</div>}
          </div>
        ) : s.type === "section" ? (
          <div style={{ margin: "auto 0" }}>
            {eyebrow("Section")}
            <div style={{ fontFamily: DISPLAY, fontSize: 52 * scale, fontWeight: 600, color: th.accent, letterSpacing: -1 }}>{s.heading}</div>
          </div>
        ) : s.type === "quote" ? (
          <div style={{ margin: "auto 0", maxWidth: "88%" }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 120 * scale, lineHeight: 0.6, color: th.accent, opacity: 0.5, marginBottom: 10 * scale }}>&ldquo;</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 38 * scale, fontWeight: 500, lineHeight: 1.3, fontStyle: "italic" }}>{s.quote}</div>
            {s.cite && <div style={{ fontFamily: MONO, fontSize: 16 * scale, color: th.muted, marginTop: 24 * scale, letterSpacing: 1 }}>&mdash; {s.cite}</div>}
          </div>
        ) : (
          <>
            {eyebrow(s.type.startsWith("chart.") ? "Data" : s.type === "metrics" ? "Metrics" : s.type === "table" ? "Detail" : s.type === "math" ? "Model" : "")}
            <div style={{ fontFamily: DISPLAY, fontSize: 42 * scale, fontWeight: 600, color: th.fg, lineHeight: 1.08, letterSpacing: -0.8 }}>{s.heading}</div>
            {rule}
            <div style={{ flex: 1, minHeight: 0, paddingBottom: 40 * scale }}>
              {s.type === "bullets" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 * scale, maxWidth: "88%" }}>
                  {s.points.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 16 * scale, alignItems: "flex-start" }}>
                      <div style={{ fontFamily: MONO, fontSize: 15 * scale, color: th.accent, fontWeight: 700, marginTop: 4 * scale, minWidth: 22 * scale }}>{String(i + 1).padStart(2, "0")}</div>
                      <div style={{ fontSize: 24 * scale, lineHeight: 1.4, color: th.fg }}>{p}</div>
                    </div>
                  ))}
                </div>
              )}

              {s.type === "metrics" && (
                <div style={{ display: "grid", gridTemplateColumns: s.metrics.length > 2 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 16 * scale }}>
                  {s.metrics.map((m, i) => (
                    <div key={i} style={{
                      borderRadius: 14 * scale, padding: `${22 * scale}px`,
                      background: dark ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.02)",
                      border: `1px solid ${th.rule}`, position: "relative", overflow: "hidden",
                    }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3 * scale, background: th.accent }} />
                      <div style={{ fontFamily: MONO, fontSize: 12.5 * scale, color: th.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>{m.label}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10 * scale, marginTop: 12 * scale, flexWrap: "wrap" }}>
                        <div style={{ fontFamily: DISPLAY, fontSize: 46 * scale, fontWeight: 600, lineHeight: 1, letterSpacing: -1 }}>{m.value}</div>
                        {m.delta && (
                          <div style={{
                            fontSize: 15 * scale, fontWeight: 700, fontFamily: MONO,
                            color: /^-/.test(m.delta) ? "#E5637A" : th.accent,
                            background: /^-/.test(m.delta) ? "rgba(229,99,122,.12)" : `${th.accent}1e`,
                            padding: `${2 * scale}px ${8 * scale}px`, borderRadius: 20,
                          }}>{m.delta}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {s.type.startsWith("chart.") && (
                <div style={{ background: dark ? "rgba(255,255,255,.025)" : "rgba(0,0,0,.015)", border: `1px solid ${th.rule}`, borderRadius: 14 * scale, padding: `${16 * scale}px ${12 * scale}px ${8 * scale}px` }}>
                  <Chart s={s} th={th} scale={scale} />
                </div>
              )}

              {s.type === "table" && (
                <div style={{ width: "100%", border: `1px solid ${th.rule}`, borderRadius: 12 * scale, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, s.cols.length)}, 1fr)` }}>
                    {s.cols.map((c, i) => (
                      <div key={i} style={{ fontFamily: MONO, fontSize: 13 * scale, color: th.accent, textTransform: "uppercase", letterSpacing: 1, padding: `${13 * scale}px ${14 * scale}px`, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", fontWeight: 600 }}>{c}</div>
                    ))}
                    {s.rows.map((r, ri) => r.map((cell, ci) => (
                      <div key={ri + "-" + ci} style={{ fontSize: 19 * scale, padding: `${13 * scale}px ${14 * scale}px`, borderTop: `1px solid ${th.rule}`, background: ri % 2 ? (dark ? "rgba(255,255,255,.015)" : "rgba(0,0,0,.012)") : "transparent", color: th.fg }}>{cell}</div>
                    )))}
                  </div>
                </div>
              )}

              {s.type === "math" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.015)", border: `1px solid ${th.rule}`, borderRadius: 14 * scale, padding: 24 * scale }}>
                  <Formula src={s.formula} color={th.fg} />
                </div>
              )}

              {s.type === "image" && (
                (s.imageRef && assets[s.imageRef])
                  ? <img src={assets[s.imageRef]} alt={s.image || "image"} style={{ width: "100%", height: 300 * scale, objectFit: "cover", borderRadius: 14 * scale, border: `1px solid ${th.rule}`, display: "block" }} />
                  : <ArtFallback prompt={s.image} th={th} scale={scale} radius={14 * scale} />
              )}
            </div>
          </>
        )}
      </div>

      {footer}
    </div>
  );
}
