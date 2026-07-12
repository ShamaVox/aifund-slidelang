import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Play, Terminal, AlertTriangle, CheckCircle2, XCircle, Wrench, Bot, FileCode2,
  Presentation, Copy, ChevronRight, ChevronLeft, Zap, Braces, ScanLine,
  LayoutTemplate, Sparkles, RefreshCw, Eye, Download, ClipboardCheck, Star, Activity,
} from "lucide-react";
import { build } from "./compiler/compile.js";
import { serialize } from "./compiler/serialize.js";
import { THEMES } from "./compiler/parser.js";
import { authorDeck, regenerate } from "./agent/loop.js";
import { reviewDeck } from "./agent/reviewer.js";
import { exportHTML } from "./export/html.js";
import { assignIds } from "./merge/identity.js";
import { threeWayMerge } from "./merge/merge.js";
import { DEFAULT_PLUGINS } from "./plugins/index.js";
import { kpi, fetchMetrics } from "./agent/kpi.js";
import SlideView from "./render/SlideView.jsx";
import AgentApiDemo from "./AgentApiDemo.jsx";
import HomeView from "./HomeView.jsx";

const C = {
  ink: "#0C0F14", panel: "#141922", panel2: "#1B2230", line: "#263143",
  text: "#E6EDF3", dim: "#8B98A9", faint: "#5A6675",
  amber: "#E8A44C", teal: "#3FB8AF", coral: "#E5637A", violet: "#8B7BE8",
};

// Greyed placeholder text shown in the empty editor — never loaded as content.
const SPEC_PLACEHOLDER = `deck "Your title"
theme midnight

dataset numbers
  row Q1 1.2
  row Q2 2.0

slide title
  heading "Your title"
  subtitle "Subtitle"

slide chart.area
  heading "Revenue"
  bind numbers

# ...or just type a prompt above and click "Agent authors".`;

const STAGES = [
  { id: "plan", label: "Plan", icon: Bot }, { id: "spec", label: "Spec", icon: Braces },
  { id: "parse", label: "Parse", icon: FileCode2 }, { id: "lint", label: "Lint", icon: ScanLine },
  { id: "repair", label: "Repair", icon: Wrench }, { id: "compile", label: "Compile", icon: LayoutTemplate },
  { id: "render", label: "Render", icon: Presentation },
];
const sevMeta = {
  error: { icon: XCircle, color: C.coral }, warn: { icon: AlertTriangle, color: C.amber }, info: { icon: CheckCircle2, color: C.teal },
};

function short(v) {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.map((x) => x.name ?? x.label ?? (typeof x === "object" ? JSON.stringify(x) : x)).join(", ").slice(0, 48);
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 48 ? s.slice(0, 47) + "…" : s;
}

export default function App() {
  const [src, setSrc] = useState("");
  const [prompt, setPrompt] = useState("Seed pitch for an AI-native retail platform");
  const [sel, setSel] = useState(0);
  const [present, setPresent] = useState(false);
  const [active, setActive] = useState({});
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("diagnostics");
  const [toast, setToast] = useState(null);
  // regeneration engine state
  const [baseAst, setBaseAst] = useState(null);      // last agent-produced base (with stable ids)
  const [overrides, setOverrides] = useState({});    // human edits keyed by slideId -> {field: value, _pinned}
  const [updatePrompt, setUpdatePrompt] = useState("Update the numbers for Q4 and refresh the traction chart");
  const [diffModal, setDiffModal] = useState(null);  // { mergedAst, diff, summary, newBase, resolutions }
  const [deckId, setDeckId] = useState(null);
  const genTime = useRef(0);
  const [metrics, setMetrics] = useState(null);
  const [imageAssets, setImageAssets] = useState({}); // assetId -> data_url (session cache)
  const [imgBusy, setImgBusy] = useState(false);
  const [view, setView] = useState("home");      // "home" landing | "studio" IDE
  const [apiOnline, setApiOnline] = useState(false);
  // progressive disclosure: hide developer surfaces until asked. The slide is the hero.
  const [showCode, setShowCode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [pipeOpen, setPipeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [editMode, setEditMode] = useState(false); // review by default; opt-in to edit
  const [agentDemo, setAgentDemo] = useState(false); // "agent via API" demo modal

  const built = useMemo(() => build(src, { plugins: DEFAULT_PLUGINS }), [src]);
  const isEmpty = !src.trim();
  const { slides, diagnostics, repairs, ast, errors, warnings } = built;
  const review = useMemo(() => reviewDeck(built), [built]);
  const cur = slides[Math.min(sel, Math.max(0, slides.length - 1))];

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  // Wipe every piece of deck-scoped state so a new deck never inherits the old
  // one's base spec, human edits, cached images, or an open diff. Called on both
  // entry points (generate + write-a-spec) to guarantee a clean slate.
  const resetDeckState = () => {
    setBaseAst(null);
    setOverrides({});
    setDeckId(null);
    setDiffModal(null);
    setImageAssets({});
    setSel(0);
    setLog([]);
    setActive({});
    setEditMode(false);
  };

  const generate = async (useModel) => {
    if (running) return;
    resetDeckState();
    setRunning(true); setLog([]); setActive({});
    const finalSrc = await authorDeck(prompt, {
      useModel,
      onStep: (stage, payload) => {
        if (stage !== "done") setActive((a) => ({ ...a, [stage]: true }));
        if (payload.log) setLog((l) => [...l, { m: payload.log, kind: payload.kind || "info" }]);
      },
    });
    // establish this as the base: assign stable ids, reset human overrides
    const withIds = assignIds(build(finalSrc).ast, true);
    const b = build(serialize(withIds), { plugins: DEFAULT_PLUGINS });
    const id = "d" + Math.random().toString(36).slice(2, 8);
    setBaseAst(withIds); setOverrides({}); setDeckId(id); genTime.current = Date.now();
    kpi("generate", { deck_id: id, slides: b.slides.length, errors: b.errors.length, repairs: b.repairs.length, used_model: useModel });
    setSrc(serialize(withIds)); setSel(0); setActive({}); setRunning(false); setTab("agent"); setView("studio");
    // deck is now on screen; generate images for any image slides in the background
    autoGenerateImages(withIds);
  };

  // Auto-fill images for EVERY slide that carries an image prompt (image beside
  // content, or a standalone image slide), in parallel for speed. The deck is
  // already on screen; photos drop in as they resolve. Best-effort per slide.
  const autoGenerateImages = async (deckAst) => {
    const targets = deckAst.slides
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.image);
    if (!targets.length) return;
    const refs = {};
    const applyRefs = () => {
      const a = JSON.parse(JSON.stringify(deckAst));
      for (const [idx, rid] of Object.entries(refs)) if (a.slides[idx]) a.slides[idx].imageRef = rid;
      setSrc(serialize(a));
      setBaseAst((prev) => {
        const b = JSON.parse(JSON.stringify(prev || a));
        for (const [idx, rid] of Object.entries(refs)) if (b.slides[idx]) b.slides[idx].imageRef = rid;
        return b;
      });
    };
    await Promise.all(targets.map(async ({ s, i }) => {
      try {
        const res = await fetch("/api/image", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: s.image }),
        });
        if (!res.ok) return;
        const { id, data_url } = await res.json();
        if (!id || !data_url) return;
        setImageAssets((m) => ({ ...m, [id]: data_url }));
        refs[i] = id;
        applyRefs(); // update as each photo resolves
      } catch { /* skip this image */ }
    }));
  };

  // real "Compiler online" indicator: ping the backend health endpoint
  useEffect(() => {
    let alive = true;
    fetch("/api/health").then((r) => r.ok ? r.json() : null).then((d) => alive && setApiOnline(!!d?.ok)).catch(() => alive && setApiOnline(false));
    return () => { alive = false; };
  }, []);

  const writeSpec = () => { resetDeckState(); setSrc(""); setView("studio"); setShowCode(true); setTab("diagnostics"); };
  // load a spec that came from the Agent API demo into the app (renders the deck)
  const loadAgentSpec = (spec) => { resetDeckState(); setSrc(spec); setShowCode(true); setView("studio"); setAgentDemo(false); };

  const editField = (patch) => {
    const a = JSON.parse(JSON.stringify(ast));
    const slide = a.slides[cur._index];
    if (!slide) return;
    Object.assign(slide, patch);
    setSrc(serialize(a));
    // record the edit as an override keyed to the slide's stable id (survives regenerate)
    if (slide.id) setOverrides((o) => ({ ...o, [slide.id]: { ...(o[slide.id] || {}), ...patch } }));
  };

  const togglePin = () => {
    if (!cur?.id) return;
    setOverrides((o) => {
      const s = { ...(o[cur.id] || {}) };
      s._pinned = !s._pinned;
      return { ...o, [cur.id]: s };
    });
    flash(overrides[cur?.id]?._pinned ? "Unpinned" : "Pinned — protected on regenerate");
  };

  // second prompt: agent regenerates, we merge against the base + human overrides
  const updateDeck = async (useModel) => {
    if (running || !baseAst) return;
    setRunning(true); setLog([]); setActive({}); setTab("agent");
    const newSrc = await regenerate(baseAst, updatePrompt, {
      useModel,
      overrides,
      onStep: (stage, payload) => {
        if (stage !== "done") setActive((a) => ({ ...a, [stage]: true }));
        if (payload.log) setLog((l) => [...l, { m: payload.log, kind: payload.kind || "info" }]);
      },
    });
    const newBase = build(newSrc).ast;
    const { mergedAst, diff, summary } = threeWayMerge(baseAst, newBase, overrides);
    setActive({}); setRunning(false);
    setDiffModal({ mergedAst, diff, summary, newBase, resolutions: {} });
  };

  const setResolution = (idx, choice) =>
    setDiffModal((m) => ({ ...m, resolutions: { ...m.resolutions, [idx]: choice } }));

  const applyMerge = () => {
    const { mergedAst, diff, newBase, resolutions } = diffModal;
    const finalAst = JSON.parse(JSON.stringify(mergedAst));
    let tookTheirs = 0;
    // apply any "take new" conflict resolutions
    diff.forEach((d, i) => {
      if ((d.kind === "conflict") && resolutions[i] === "theirs" && d.field !== "slide") {
        const s = finalAst.slides.find((x) => x.id === d.slideId);
        if (s) { s[d.field] = d.theirs; tookTheirs++; }
      }
    });
    kpi("regenerate", { deck_id: deckId, preserved: diffModal.summary.preserved, changed: diffModal.summary.changed, conflicts: diffModal.summary.conflicts });
    if (tookTheirs) kpi("clobber", { deck_id: deckId, count: tookTheirs }); // human chose to drop their own edits
    setSrc(serialize(finalAst));
    setBaseAst(assignIds(newBase, false)); // new agent base; overrides persist as the human delta
    setDiffModal(null); setSel(0);
    flash("Merged — your edits preserved");
  };
  const editTheme = (t) => { const a = JSON.parse(JSON.stringify(ast)); a.theme = t; setSrc(serialize(a)); };

  // Generate (or reuse) the image asset for an image slide. Deterministic: the
  // backend returns a stable id per prompt, so a pinned/unchanged image is reused.
  const generateImage = async (slideIndex, force = false) => {
    const s = ast.slides[slideIndex];
    if (!s || !s.image) return;   // any slide carrying an image prompt can generate
    if (imgBusy) return;
    setImgBusy(true);
    try {
      const res = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: s.image }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); flash(e.flags ? `Image blocked: ${e.flags[0]}` : "Image blocked by verifier"); setImgBusy(false); return; }
      const { id, data_url } = await res.json();
      setImageAssets((m) => ({ ...m, [id]: data_url }));
      const a = JSON.parse(JSON.stringify(ast));
      a.slides[slideIndex].imageRef = id;
      setSrc(serialize(a));
      flash("Image generated");
    } catch { flash("Start the API to generate images (npm run api)"); }
    setImgBusy(false);
  };
  const applyRepairs = () => { const b = build(src); if (b.repairs.length) { setSrc(serialize(b.ast)); flash("Applied repairs"); } };

  const downloadHTML = () => {
    const html = exportHTML(ast, slides);
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${(ast.title || "deck").replace(/\W+/g, "-")}.html`; a.click();
    flash("Exported HTML");
  };

  const publish = async () => {
    try {
      const res = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec: src }) });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      const full = location.origin + url;
      navigator.clipboard?.writeText(full);
      kpi("ship", { deck_id: deckId, edited_slides: Object.keys(overrides).length, total_slides: slides.length, seconds_since_generate: genTime.current ? Math.round((Date.now() - genTime.current) / 1000) : 0 });
      kpi("publish", { deck_id: deckId });
      flash(`Published — link copied: ${url}`);
    } catch {
      downloadHTML(); // graceful fallback when the hosted server isn't running
    }
  };

  useEffect(() => {
    if (!present) return;
    const h = (e) => {
      if (e.key === "ArrowRight") setSel((i) => Math.min(slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setSel((i) => Math.max(0, i - 1));
      if (e.key === "Escape") setPresent(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [present, slides.length]);

  useEffect(() => {
    if (tab !== "kpi") return;
    let alive = true;
    const load = async () => { const m = await fetchMetrics(); if (alive) setMetrics(m); };
    load();
    const iv = setInterval(load, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [tab]);

  const lineCount = src.split("\n").length;

  if (view === "home") {
    return (
      <>
        <HomeView prompt={prompt} setPrompt={setPrompt} onGenerate={generate} onWriteSpec={writeSpec} running={running} apiOnline={apiOnline} onAgentApi={() => setAgentDemo(true)} />
        {agentDemo && <AgentApiDemo onClose={() => setAgentDemo(false)} onLoad={loadAgentSpec} />}
      </>
    );
  }

  return (
    <div className="app">
      <header>
        <div className="brand" onClick={() => setView("home")} style={{ cursor: "pointer" }}>
          <div className="logo"><Braces size={15} color="#0C0F14" /></div>
          <b>SlideLang</b><span className="tag">deck-as-code</span>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => setAgentDemo(true)} title="Show an agent building a deck via the API"><Bot size={14} /> Agent API</button>
        <button className="btn" onClick={() => { resetDeckState(); setSrc(""); setView("home"); }}><FileCode2 size={14} /> New deck</button>
        <button className="btn primary" onClick={() => setPresent(true)}><Play size={14} /> Present</button>
        <div className="exportmenu">
          <button className="btn" onClick={() => setExportOpen((v) => !v)}><Download size={14} /> Export ▾</button>
          {exportOpen && (
            <div className="menu" onMouseLeave={() => setExportOpen(false)}>
              <button onClick={() => { publish(); setExportOpen(false); }}><Sparkles size={13} /> Publish link</button>
              <button onClick={() => { downloadHTML(); setExportOpen(false); }}><Download size={13} /> Export HTML</button>
              <button onClick={() => { window.print(); setExportOpen(false); }}><Download size={13} /> Print / PDF</button>
              <button onClick={() => { navigator.clipboard?.writeText(src); flash("Spec copied"); setExportOpen(false); }}><Copy size={13} /> Copy spec</button>
            </div>
          )}
        </div>
      </header>

      <div className="promptbar">
        <div className="row">
          <div className="inputwrap">
            <Sparkles size={15} color={C.amber} className="ic" />
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe a deck for an agent to author…" onKeyDown={(e) => { if (e.key === "Enter" && !running && prompt.trim()) generate(true); }} />
          </div>
          <button className="btn primary" disabled={running} onClick={() => generate(true)}>
            {running ? <RefreshCw size={14} className="spin" /> : <Bot size={14} />} Generate
          </button>
          <button className="btn" disabled={running} onClick={() => generate(false)} title="Deterministic, no API key"><Zap size={14} /> Sim</button>
          {(slides.length > 0 || running) && (
            <button className={"statuspill " + (running ? "run" : errors.length ? "warn" : "ok")} onClick={() => setPipeOpen((v) => !v)} title="Show the compile pipeline">
              {running ? <RefreshCw size={12} className="spin" /> : <span className="dotmark" />}
              {running ? "Working…" : errors.length ? `${errors.length} error${errors.length > 1 ? "s" : ""}${repairs.length ? ` · ${repairs.length} fixed` : ""}` : `Ready · ${slides.length} slide${slides.length === 1 ? "" : "s"}`}
            </button>
          )}
          {baseAst && (
            <button className={"btn" + (showRegen ? " primary" : "")} onClick={() => setShowRegen((v) => !v)}><RefreshCw size={14} /> Regenerate</button>
          )}
        </div>

        {(pipeOpen || running) && (
          <div className="pipeline">
            {STAGES.map((st, i) => {
              const on = active[st.id]; const Ic = st.icon;
              return (
                <React.Fragment key={st.id}>
                  <div className={"stage" + (on ? " on" : "")}><Ic size={14} /><span>{st.label}</span></div>
                  {i < STAGES.length - 1 && <ChevronRight size={13} color={C.faint} />}
                </React.Fragment>
              );
            })}
            <div className="spacer" />
            <div className="counts">
              <span style={{ color: errors.length ? C.coral : C.teal }}>{errors.length} err</span>
              <span style={{ color: warnings.length ? C.amber : C.dim }}>{warnings.length} warn</span>
              <span style={{ color: C.violet }}>{repairs.length} repaired</span>
              <span style={{ color: C.dim }}>{slides.length} slides</span>
            </div>
          </div>
        )}

        {showRegen && baseAst && (
          <div className="row updaterow">
            <span className="uplbl"><RefreshCw size={13} /> Update</span>
            <div className="inputwrap">
              <input value={updatePrompt} onChange={(e) => setUpdatePrompt(e.target.value)} placeholder="How should the agent update the deck? (your edits are preserved)" />
            </div>
            <button className="btn primary" disabled={running} onClick={() => updateDeck(true)}><RefreshCw size={14} /> Update &amp; merge</button>
            <button className="btn" disabled={running} onClick={() => updateDeck(false)}>Sim</button>
            <span className="ovbadge">{Object.keys(overrides).length} edited · {Object.values(overrides).filter((o) => o._pinned).length} pinned</span>
          </div>
        )}
      </div>

      <div className="main" style={{ gridTemplateColumns: [showCode ? "minmax(280px,.8fr)" : null, "minmax(440px,1.7fr)", showDetails ? "minmax(300px,.85fr)" : null].filter(Boolean).join(" ") }}>
        {showCode && (
          <section className="col editor">
            <div className="head"><FileCode2 size={14} /><span>deck.slide</span><div className="spacer" /><small>{lineCount} lines</small></div>
            <div className="code">
              <div className="gutter">{Array.from({ length: lineCount }).map((_, i) => <div key={i}>{i + 1}</div>)}</div>
              <textarea value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} placeholder={SPEC_PLACEHOLDER} />
            </div>
          </section>
        )}

        {/* preview */}
        <section className="col preview">
          <div className="head"><Eye size={14} /><span>{editMode ? "Editing" : "Slide"}</span><div className="spacer" />
            <div className="themes">{Object.keys(THEMES).map((k) => (
              <button key={k} title={k} onClick={() => editTheme(k)} className={"sw" + (ast.theme === k ? " on" : "")} style={{ background: THEMES[k].bg }} />
            ))}</div>
            {cur && <button className={"toggle editbtn" + (editMode ? " on" : "")} onClick={() => setEditMode((v) => !v)}>{editMode ? "✓ Done" : "✎ Edit"}</button>}
            <button className={"toggle" + (showCode ? " on" : "")} onClick={() => setShowCode((v) => !v)} title="Show the deck source code"><FileCode2 size={13} /> Code</button>
            <button className={"toggle" + (showDetails ? " on" : "")} onClick={() => setShowDetails((v) => !v)} title="Diagnostics, agent log, KPIs"><Activity size={13} /> Details</button>
          </div>
          <div className="canvaswrap">
            {cur && editMode && <div className="edit-hint">✎ editing — click any highlighted text to change it</div>}
            <div className={"canvas" + (editMode ? " editing" : "")}>{cur ? <SlideView s={cur} theme={ast.theme} scale={0.62} assets={imageAssets} deckTitle={ast.title} total={slides.length} editable={editMode} onEdit={editField} /> : (
              <div className="welcome">
                <div className="wtitle">No deck yet</div>
                <div className="wsub">Type a prompt above and hit <b>Generate</b>. Review it, then click <b>Edit</b> to change anything.</div>
              </div>
            )}</div>
            <div className="thumbs">
              {slides.map((s, i) => (
                <button key={i} onClick={() => setSel(i)} className={"thumb" + (i === sel ? " on" : "")}>
                  <SlideView s={s} theme={ast.theme} scale={0.12} assets={imageAssets} />
                  <span>{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
          {cur && editMode && (
            <div className="inspector">
              <div className="lbl">
                ✎ Edit slide {sel + 1} · {cur.type}
                <div className="spacer" />
                {cur.id && overrides[cur.id] && !overrides[cur.id]._pinned && Object.keys(overrides[cur.id]).length > 0 && <span className="edited">edited</span>}
                <button className={"pin" + (overrides[cur?.id]?._pinned ? " on" : "")} onClick={togglePin} title="Protect this slide on regenerate">
                  {overrides[cur?.id]?._pinned ? "📌 pinned" : "pin"}
                </button>
              </div>
              <div className="hint2">Click any text on the slide to edit it. Buttons below add or remove structure.</div>
              <div className="quickbar">
                {cur.type === "bullets" && <button className="rowadd" onClick={() => editField({ points: [...(cur.points || []), "New point"] })}>+ bullet</button>}
                {cur.type === "metrics" && <button className="rowadd" onClick={() => editField({ metrics: [...(cur.metrics || []), { label: "Metric", value: "0", delta: "" }] })}>+ metric</button>}
                {cur.type === "table" && <button className="rowadd" onClick={() => editField({ rows: [...(cur.rows || []), (cur.cols || ["", "", ""]).map(() => "")] })}>+ row</button>}
                {cur.type && cur.type.startsWith("chart.") && !cur.bind && <button className="rowadd" onClick={() => editField({ data: [...(cur.data || []), { name: "X", value: 0 }] })}>+ data point</button>}
              </div>

              {cur.type && cur.type.startsWith("chart.") && !cur.bind && (
                <>
                  <div className="field-label">Chart data · label / value</div>
                  {(cur.data || []).map((d, i) => (
                    <div key={i} className="editrow metricrow">
                      <input value={d.name} onChange={(e) => editField({ data: cur.data.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                      <input value={d.value} onChange={(e) => editField({ data: cur.data.map((x, j) => j === i ? { ...x, value: Number(e.target.value) || 0 } : x) })} />
                      <button className="rowdel" onClick={() => editField({ data: cur.data.filter((_, j) => j !== i) })}>×</button>
                    </div>
                  ))}
                </>
              )}
              {cur.type && cur.type.startsWith("chart.") && cur.bind && (
                <div className="field-label">Bound to dataset "{cur.bind}" — edit rows in the spec (updates everywhere)</div>
              )}

              {cur.type === "math" && (
                <>
                  <div className="field-label">Formula (LaTeX)</div>
                  <input value={cur.formula || ""} onChange={(e) => editField({ formula: e.target.value })} placeholder="LTV = ARPU \\times \\frac{1}{churn}" />
                </>
              )}

              {cur.type === "image" && (
                <>
                  <div className="field-label">Image prompt · edit and regenerate to change the picture</div>
                  <input value={cur.image || ""} onChange={(e) => editField({ image: e.target.value })} placeholder="describe the image you want" />
                  <button className="btn primary" style={{ justifyContent: "center" }} disabled={imgBusy} onClick={() => generateImage(cur._index, true)}>
                    {imgBusy ? <><RefreshCw size={14} className="spin" /> Generating…</> : <><Sparkles size={14} /> {cur.imageRef && imageAssets[cur.imageRef] ? "Regenerate image" : "Generate image"}</>}
                  </button>
                  {cur.imageRef && imageAssets[cur.imageRef] && <small>Edit the prompt above, then regenerate — the image updates to match.</small>}
                </>
              )}

              {/* Universal image control: add a photo BESIDE any content slide, per-slide */}
              {cur.type !== "image" && cur.type !== "section" && (
                cur.image != null ? (
                  <>
                    <div className="field-label">Image · shown beside this slide</div>
                    <input value={cur.image} onChange={(e) => editField({ image: e.target.value })} placeholder="describe the image" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn primary" style={{ flex: 1, justifyContent: "center" }} disabled={imgBusy} onClick={() => generateImage(cur._index, true)}>
                        {imgBusy ? <><RefreshCw size={14} className="spin" /> Generating…</> : <><Sparkles size={14} /> {cur.imageRef && imageAssets[cur.imageRef] ? "Regenerate" : "Generate image"}</>}
                      </button>
                      <button className="btn" onClick={() => editField({ image: null, imageRef: null })}>Remove</button>
                    </div>
                  </>
                ) : (
                  <button className="rowadd" onClick={() => editField({ image: "a relevant editorial photograph, natural light" })}>＋ add an image to this slide</button>
                )
              )}

              <div className="field-label">Speaker notes</div>
              <textarea rows={2} value={cur.notes || ""} onChange={(e) => editField({ notes: e.target.value })} placeholder="Notes shown in Present mode…" />
              <small>Edits click straight into the slide and survive regeneration — round-trip, no clobber.</small>
            </div>
          )}
        </section>

        {/* panels */}
        {showDetails && (
          <section className="col panels">
            <div className="tabs">
              {[["diagnostics", "Diagnostics", ScanLine], ["review", "Reviewer", Star], ["kpi", "KPIs", Activity], ["agent", "Agent log", Terminal], ["repairs", "Repairs", Wrench]].map(([id, label, Ic]) => (
                <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}><Ic size={13} /> {label}</button>
              ))}
            </div>
            <div className="panelbody">
              {tab === "diagnostics" && (isEmpty
                ? <div className="faint">No deck yet. Type a prompt above, or start writing a spec on the left.</div>
                : diagnostics.length === 0
                  ? <div className="clean"><CheckCircle2 size={15} /> Spec compiles clean. No diagnostics.</div>
                  : diagnostics.map((d, i) => {
                    const M = sevMeta[d.sev]; const Ic = M.icon; return (
                      <div key={i} className="diag" onClick={() => d.fix && applyRepairs()} style={{ cursor: d.fix ? "pointer" : "default" }}>
                        <Ic size={14} color={M.color} />
                        <div><div><span style={{ color: M.color }}>{d.code}</span> · line {d.line} {d.fix && <span style={{ color: C.violet }}>· fixable</span>}</div><div className="msg">{d.msg}</div></div>
                      </div>);
                  })
              )}
              {tab === "review" && (
                <div>
                  <div className="scorecard">
                    <div className="score" style={{ color: review.score >= 80 ? C.teal : review.score >= 60 ? C.amber : C.coral }}>{review.score}</div>
                    <div><b>Reviewer agent</b><div className="msg">Independent critique of the compiled deck.</div></div>
                  </div>
                  {review.notes.length === 0 ? <div className="clean"><CheckCircle2 size={15} /> No notes — the deck reads well.</div>
                    : review.notes.map((n, i) => (
                      <div key={i} className="diag"><ClipboardCheck size={14} color={C.violet} /><div><div style={{ color: C.violet }}>{n.kind}</div><div className="msg">{n.msg}</div></div></div>
                    ))}
                </div>
              )}
              {tab === "kpi" && (
                metrics === null
                  ? <div className="faint">Start the API (<span className="mono">npm run api</span>) and generate a deck — live metrics appear here.</div>
                  : (
                    <div className="kpis">
                      {[
                        ["Decks generated", metrics.decks_generated],
                        ["First-pass spec validity", metrics.first_pass_spec_validity_pct + "%"],
                        ["Slides accepted unedited", metrics.slides_accepted_unedited_pct + "%"],
                        ["Edit-to-ship (s)", metrics.edit_to_ship_seconds],
                        ["Edits preserved on regen", metrics.edits_preserved_on_regen],
                        ["Regenerate-clobber rate", metrics.regenerate_clobber_rate_pct + "%"],
                        ["Number-drift incidents", metrics.number_drift_incidents],
                        ["Avg gen latency (ms)", metrics.avg_gen_latency_ms],
                      ].map(([k, v]) => (
                        <div key={k} className="kpi"><div className="kv">{v}</div><div className="kk">{k}</div></div>
                      ))}
                    </div>
                  )
              )}
              {tab === "agent" && (log.length === 0
                ? <div className="faint">Run “Agent authors” to see the author → verify → repair loop.</div>
                : log.map((l, i) => <div key={i} className={"logline " + l.kind}><span>{l.kind === "head" ? "▸" : l.kind === "fix" ? "⟳" : "·"}</span> {l.m}</div>)
              )}
              {tab === "repairs" && (repairs.length === 0
                ? <div className="faint">No repairs applied. The spec compiled clean.</div>
                : repairs.map((r, i) => <div key={i} className="diag"><Wrench size={13} color={C.violet} /><div><span style={{ color: C.violet }}>{r.code}</span> <span className="msg">{r.msg}</span></div></div>)
              )}
            </div>
          </section>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {agentDemo && <AgentApiDemo onClose={() => setAgentDemo(false)} onLoad={loadAgentSpec} />}

      {diffModal && (
        <div className="modalwrap" onClick={(e) => { if (e.target.className === "modalwrap") setDiffModal(null); }}>
          <div className="modal">
            <div className="modalhead">
              <div><b>Regeneration diff</b><div className="msg">Agent regenerated the deck. Review what changed before it lands — your edits are preserved by default.</div></div>
              <div className="spacer" />
              <button className="btn" onClick={() => setDiffModal(null)}>Cancel</button>
              <button className="btn primary" onClick={applyMerge}>Apply merge</button>
            </div>
            <div className="chips">
              <span className="chip added">{diffModal.summary.added} added</span>
              <span className="chip changed">{diffModal.summary.changed} updated</span>
              <span className="chip preserved">{diffModal.summary.preserved} preserved</span>
              <span className="chip conflict">{diffModal.summary.conflicts} conflicts</span>
              <span className="chip removed">{diffModal.summary.removed} removed</span>
            </div>
            <div className="difflist">
              {diffModal.diff.length === 0 && <div className="faint">No differences.</div>}
              {diffModal.diff.map((d, i) => (
                <div key={i} className={"diffrow " + d.kind}>
                  <span className={"kind " + d.kind}>{d.kind === "conflict-removed" ? "conflict" : d.kind}</span>
                  <div className="diffbody">
                    <div className="difftitle">{d.heading || d.slideId} <small>· {d.field}</small></div>
                    {d.kind === "preserved" && <div className="msg">Kept your edit: <em>{JSON.stringify(d.mine)}</em></div>}
                    {d.kind === "changed" && <div className="msg">Agent updated → <em>{short(d.theirs)}</em></div>}
                    {d.kind === "added" && <div className="msg">New slide from the agent.</div>}
                    {d.kind === "removed" && <div className="msg">Agent dropped this slide (you hadn't edited it).</div>}
                    {(d.kind === "conflict" || d.kind === "conflict-removed") && (
                      <div>
                        <div className="msg">Both changed this. <b>{d.kind === "conflict-removed" ? "Agent would remove your edited slide." : ""}</b></div>
                        <div className="conflictopts">
                          <button className={(diffModal.resolutions[i] || "mine") === "mine" ? "on" : ""} onClick={() => setResolution(i, "mine")}>Keep mine: {short(d.mine)}</button>
                          {d.field !== "slide" && <button className={diffModal.resolutions[i] === "theirs" ? "on" : ""} onClick={() => setResolution(i, "theirs")}>Take new: {short(d.theirs)}</button>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {present && cur && (
        <div className="present">
          <div className="stage-present"><div className="bigcanvas"><SlideView s={cur} theme={ast.theme} scale={1} assets={imageAssets} deckTitle={ast.title} total={slides.length} /></div></div>
          {cur.notes && <div className="notes">{cur.notes}</div>}
          <div className="controls">
            <button className="btn" onClick={() => setSel((i) => Math.max(0, i - 1))}><ChevronLeft size={15} /></button>
            <span className="mono">{sel + 1} / {slides.length}</span>
            <button className="btn" onClick={() => setSel((i) => Math.min(slides.length - 1, i + 1))}><ChevronRight size={15} /></button>
            <button className="btn" onClick={() => setPresent(false)}>Esc</button>
          </div>
        </div>
      )}
    </div>
  );
}
