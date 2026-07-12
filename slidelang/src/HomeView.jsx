import React from "react";
import { Braces, Sparkles, Bot, Zap, FileCode2, ChevronRight, Wand2, ShieldCheck, MonitorPlay } from "lucide-react";

const EXAMPLES = [
  "Seed pitch for an AI-native retail platform",
  "Series A deck for a developer tools startup",
  "Technical architecture review for a data pipeline",
];

const STEPS = [
  { icon: Wand2, k: "01", t: "Author", d: "Type a prompt or write a structured spec. An agent drafts a typed deck; you stay in control of every line." },
  { icon: ShieldCheck, k: "02", t: "Compile", d: "The compiler validates the spec, repairs layout and text issues to a fixed point, and scores render reliability." },
  { icon: MonitorPlay, k: "03", t: "Present", d: "Edit in the browser, regenerate without losing your edits, then publish or present from one workflow." },
];

export default function HomeView({ prompt, setPrompt, onGenerate, onWriteSpec, running, apiOnline, onAgentApi }) {
  return (
    <div className="home">
      <div className="home-bg" aria-hidden />
      <header className="home-nav">
        <div className="brand">
          <div className="logo"><Braces size={15} color="#0C0F14" /></div>
          <b>SlideLang</b><span className="tag">deck-as-code</span>
        </div>
        <div className="spacer" />
        <span className="ver">v1.0</span>
        <span className={"status " + (apiOnline ? "on" : "off")}>
          <span className="dot" /> {apiOnline ? "Compiler online" : "Compiler offline"}
        </span>
      </header>

      <main className="home-hero">
        <div className="hero-eyebrow">
          <Sparkles size={13} /> Data-bound charts · validate + repair · no-clobber regenerate
        </div>

        <h1 className="hero-title">The slide compiler for<br />humans and AI agents</h1>

        <p className="hero-sub">
          Turn a prompt or a structured spec into editable, data-bound slides. The compiler
          validates the spec, repairs what it can, and never silently overwrites your edits.
        </p>

        <div className="hero-console">
          <div className="hero-input">
            <ChevronRight size={16} className="chev" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && prompt.trim() && !running) onGenerate(true); }}
              placeholder="Describe the deck you want…"
              autoFocus
            />
          </div>
          <button className="btn primary hero-go" disabled={running || !prompt.trim()} onClick={() => onGenerate(true)}>
            {running ? <Sparkles size={15} className="spin" /> : <Bot size={15} />} Generate deck
          </button>
        </div>

        <div className="hero-chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip-ex" disabled={running} onClick={() => { setPrompt(ex); onGenerate(true); }}>{ex}</button>
          ))}
        </div>

        <div className="hero-alt">
          <button className="link-btn" disabled={running} onClick={() => onGenerate(false)}>
            <Zap size={13} /> Try the simulated agent <span className="sub">no API key</span>
          </button>
          <span className="sep" />
          <button className="link-btn" onClick={onWriteSpec}>
            <FileCode2 size={13} /> Write a spec yourself
          </button>
          {onAgentApi && (
            <>
              <span className="sep" />
              <button className="link-btn" onClick={onAgentApi}>
                <Bot size={13} /> Agent builds it (API)
              </button>
            </>
          )}
        </div>
      </main>

      <section className="home-steps">
        {STEPS.map((s) => {
          const Ic = s.icon;
          return (
            <div key={s.k} className="step">
              <div className="step-top">
                <div className="step-ic"><Ic size={17} /></div>
                <span className="step-k">{s.k}</span>
              </div>
              <div className="step-t">{s.t}</div>
              <div className="step-d">{s.d}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
