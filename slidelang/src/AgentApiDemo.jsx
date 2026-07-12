import React, { useState } from "react";
import { X, Play, Check, AlertTriangle, Bot } from "lucide-react";

// A spec an *agent* would emit — this is the request body, no human authoring.
const SAMPLE = `deck "Built by an agent via the API"
theme midnight

slide title
  heading "This deck was authored by an agent"
  subtitle "POSTed as SlideLang source to /api/compile"

slide bullets
  heading "No human touched the editor"
  point "An agent emitted this SlideLang spec"
  point "The compiler validated and repaired it server-side"
  point "Deck-as-code: the spec is the agent interface"

slide metrics
  heading "One round trip"
  metric "API call" "1" "POST"
  metric "Human edits" "0" "agent-only"
  metric "Result" "deck" "compiled"`;

// Demonstrates the brief's "AI agents create structured deck specs": an external
// agent hits /api/compile with SlideLang source and gets a validated deck back,
// with zero UI authoring. The request + response are shown so it's provable.
export default function AgentApiDemo({ onClose, onLoad }) {
  const [spec, setSpec] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    setBusy(true); setRes(null); setErr(null);
    try {
      const r = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const data = await r.json();
      setRes({
        status: r.status,
        slides: (data.slides || []).length,
        errors: (data.errors || []).length,
        repairs: (data.repairs || []).length,
        title: data.ast?.title || "(untitled)",
      });
    } catch (e) {
      setErr(e.message || "request failed");
    }
    setBusy(false);
  };

  return (
    <div className="modalwrap" onClick={(e) => { if (e.target.className === "modalwrap") onClose(); }}>
      <div className="modal agentapi">
        <div className="modalhead">
          <div>
            <b><Bot size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Agent API · spec → deck</b>
            <div className="msg">An external agent POSTs SlideLang source to <span className="mono">/api/compile</span> and gets a validated, repaired deck back. No UI authoring — the spec is the interface.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={onClose}><X size={14} /> Close</button>
        </div>

        <div className="agentbody">
          <div className="field-label">Agent-authored spec (the request body)</div>
          <textarea className="agentspec" value={spec} onChange={(e) => setSpec(e.target.value)} spellCheck={false} />

          <div className="reqline">
            <span className="mono">POST /api/compile</span>
            <span className="mono agentdim">Content-Type: application/json</span>
          </div>

          <div className="agentbtns">
            <button className="btn primary" disabled={busy} onClick={run}>
              {busy ? "Sending…" : <><Play size={14} /> Run as agent</>}
            </button>
            {res && <button className="btn" onClick={() => { onLoad(spec); onClose(); }}><Check size={14} /> Load this deck in the UI</button>}
          </div>

          {res && (
            <div className="agentres ok">
              <div className="mono">&larr; {res.status} OK</div>
              <div>Compiled <b>{res.slides}</b> slides · {res.errors} errors · {res.repairs} auto-repairs · title <em>"{res.title}"</em></div>
              <div className="agentdim">The compiler validated and repaired the agent's spec server-side. Same path a human's spec takes.</div>
            </div>
          )}
          {err && <div className="agentres err"><AlertTriangle size={14} /> {err}</div>}
        </div>
      </div>
    </div>
  );
}
