import React from "react";
import { Braces, Sparkles, Zap, FileCode2, Terminal, ChevronRight } from "lucide-react";

const C = {
  bg: "#09090B", panel: "#111318", line: "#20242E", line2: "#2A2F3A",
  text: "#ECEEF2", dim: "#8B93A1", faint: "#5A6272",
  amber: "#E8A44C", amber2: "#F0B75E", teal: "#3FB8AF",
};

const PROMPTS = [
  "Seed pitch for an AI-native retail platform",
  "Series A deck for a developer tools startup",
  "Technical architecture review for a data pipeline",
];

// A subtle, non-interactive ghost of the studio: code tree left, 16:9 preview right.
function GhostPreview() {
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 860, margin: "44px auto 0", opacity: 0.5, pointerEvents: "none",
      maskImage: "linear-gradient(to bottom, #000 55%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, #000 55%, transparent)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, background: "rgba(255,255,255,.015)" }}>
        {/* code tree */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, fontFamily: "ui-monospace", fontSize: 11.5, color: C.faint, lineHeight: 1.9 }}>
          <div style={{ color: C.dim }}>deck <span style={{ color: C.amber }}>"Q4 Review"</span></div>
          <div>theme midnight</div>
          <div style={{ color: C.dim }}>dataset arr</div>
          <div style={{ paddingLeft: 14 }}>row Q1 <span style={{ color: C.teal }}>1.2</span></div>
          <div style={{ paddingLeft: 14 }}>row Q4 <span style={{ color: C.teal }}>4.4</span></div>
          <div style={{ color: C.dim }}>slide chart.area</div>
          <div style={{ paddingLeft: 14 }}>bind arr</div>
        </div>
        {/* 16:9 preview */}
        <div style={{ background: "#0F1621", border: `1px solid ${C.line2}`, borderRadius: 10, aspectRatio: "16/9", padding: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ width: 40, height: 3, background: "#59B4FF", borderRadius: 2 }} />
          <div style={{ marginTop: 12, height: 14, width: "62%", background: "rgba(255,255,255,.16)", borderRadius: 4 }} />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: "48%", marginTop: 22 }}>
            {[40, 62, 78, 100].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, background: "#59B4FF", opacity: 0.35 + i * 0.16, borderRadius: "4px 4px 0 0" }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeView({ prompt, setPrompt, onGenerate, onWriteSpec, running, apiOnline }) {
  const go = () => { if (!running) onGenerate(true); };
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto", display: "flex", flexDirection: "column" }}>
      {/* nav */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, backdropFilter: "blur(8px)", background: "rgba(9,9,11,.8)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.amber}, #E5637A)`, display: "grid", placeItems: "center" }}><Braces size={16} color="#0C0F14" /></div>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.3 }}>SlideLang</span>
          <span style={{ fontSize: 10, fontFamily: "ui-monospace", letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, border: `1px solid ${C.line2}`, padding: "2px 7px", borderRadius: 5 }}>deck-as-code</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, fontFamily: "ui-monospace", color: C.dim }}>
          <span>v1.0</span>
          <div style={{ width: 1, height: 14, background: C.line2 }} />
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: apiOnline ? C.teal : C.amber, background: apiOnline ? "rgba(63,184,175,.1)" : "rgba(232,164,76,.1)", padding: "3px 9px", borderRadius: 6, border: `1px solid ${apiOnline ? "rgba(63,184,175,.25)" : "rgba(232,164,76,.25)"}` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: apiOnline ? C.teal : C.amber, animation: "pulse 2s infinite" }} />
            {apiOnline ? "Compiler online" : "Local mode"}
          </span>
        </div>
      </header>

      {/* hero */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "72px 24px 48px", maxWidth: 980, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontFamily: "ui-monospace", color: C.amber, background: "rgba(232,164,76,.06)", border: `1px solid rgba(232,164,76,.2)`, padding: "5px 12px", borderRadius: 20, marginBottom: 28 }}>
          <Sparkles size={13} /> Data-bound charts · validate + repair · no-clobber regenerate
        </div>

        <h1 style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1.4, textAlign: "center", lineHeight: 1.06, maxWidth: 720, margin: 0, background: `linear-gradient(180deg, #fff, #A7ADBA)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          The slide compiler for humans and AI agents
        </h1>
        <p style={{ fontSize: 16, color: C.dim, textAlign: "center", maxWidth: 600, lineHeight: 1.55, marginTop: 20 }}>
          Turn a prompt or a structured spec into editable, data-bound slides. The compiler validates the spec, repairs what it can, and never silently overwrites your edits.
        </p>

        {/* command bar */}
        <div style={{ width: "100%", maxWidth: 720, marginTop: 36, background: "rgba(255,255,255,.02)", border: `1px solid ${C.line2}`, borderRadius: 16, padding: 10, boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.amber, fontSize: 18, fontFamily: "ui-monospace", paddingLeft: 10 }}>❯</span>
            <input
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="Generate a 5-slide technical architecture review with a bar chart for latency metrics…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, padding: "12px 6px" }}
            />
            <button onClick={go} disabled={running}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `linear-gradient(90deg, ${C.amber}, ${C.amber2})`, color: "#0C0F14", fontWeight: 700, fontSize: 14, border: "none", borderRadius: 11, padding: "12px 18px", cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.6 : 1, whiteSpace: "nowrap" }}>
              <Zap size={15} /> Generate deck
            </button>
          </div>
        </div>

        {/* prompt pills */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 22 }}>
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => { setPrompt(p); if (!running) onGenerate(true); }}
              style={{ fontSize: 12.5, fontFamily: "ui-monospace", background: C.panel, border: `1px solid ${C.line2}`, color: C.dim, padding: "8px 13px", borderRadius: 9, cursor: "pointer" }}>
              {p}
            </button>
          ))}
        </div>

        {/* alt entry points */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 30, fontSize: 13, fontFamily: "ui-monospace", color: C.faint }}>
          <button onClick={() => !running && onGenerate(false)} style={altBtn}><Zap size={13} /> Try the simulated agent (no API key)</button>
          <div style={{ width: 1, height: 12, background: C.line2 }} />
          <button onClick={onWriteSpec} style={altBtn}><FileCode2 size={13} /> Write a spec yourself <ChevronRight size={13} /></button>
        </div>

        <GhostPreview />
      </main>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        button:hover{filter:brightness(1.08)}`}</style>
    </div>
  );
}

const altBtn = { display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", color: "#8B93A1", cursor: "pointer", fontFamily: "ui-monospace", fontSize: 13 };
