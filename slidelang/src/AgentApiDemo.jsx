import React, { useState } from "react";
import { X, Play, Check, AlertTriangle, Bot, Terminal, Wrench, Flag, MessageSquare } from "lucide-react";

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

const STEP_ICON = { goal: Flag, think: MessageSquare, tool: Wrench, final: Check };

export default function AgentApiDemo({ onClose, onLoad }) {
  const [mode, setMode] = useState("agent"); // "agent" (live loop) | "spec" (paste)

  // --- shared ---
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // --- paste-spec mode ---
  const [spec, setSpec] = useState(SAMPLE);
  const [res, setRes] = useState(null);
  const runCompile = async () => {
    setBusy(true); setRes(null); setErr(null);
    try {
      const r = await fetch("/api/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }) });
      const data = await r.json();
      setRes({ status: r.status, slides: (data.slides || []).length, errors: (data.errors || []).length, repairs: (data.repairs || []).length, title: data.ast?.title || "(untitled)" });
    } catch (e) { setErr(e.message || "request failed"); }
    setBusy(false);
  };

  // --- live-agent mode ---
  const [goal, setGoal] = useState("Build a deck on our engineering incident-reduction results");
  const [agentRes, setAgentRes] = useState(null);
  const runAgent = async () => {
    setBusy(true); setAgentRes(null); setErr(null);
    try {
      const r = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal }) });
      const data = await r.json();
      if (!data.ok) { setErr(data.error === "no_api_key" ? "Model not configured (no API key)." : `agent failed: ${data.error}`); }
      setAgentRes(data);
    } catch (e) { setErr(e.message || "request timed out (the agent loop can exceed serverless limits — run locally or on Vercel Pro)"); }
    setBusy(false);
  };

  return (
    <div className="modalwrap" onClick={(e) => { if (e.target.className === "modalwrap") onClose(); }}>
      <div className="modal agentapi">
        <div className="modalhead">
          <div>
            <b><Bot size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Agent · SlideLang</b>
            <div className="msg">An AI agent creates the deck spec. Watch it operate the compiler as a tool, or hand it a spec directly.</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={onClose}><X size={14} /> Close</button>
        </div>

        <div className="agenttabs">
          <button className={mode === "agent" ? "on" : ""} onClick={() => setMode("agent")}><Bot size={13} /> Live agent</button>
          <button className={mode === "spec" ? "on" : ""} onClick={() => setMode("spec")}><Terminal size={13} /> Paste a spec</button>
        </div>

        {mode === "agent" ? (
          <div className="agentbody">
            <div className="field-label">Goal for the agent</div>
            <input className="agentgoal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Build a Series A deck for a dev-tools startup" />
            <div className="reqline"><span className="mono">POST /api/agent</span> <span className="agentdim">the LLM writes a spec, calls compile, fixes errors, loops until clean</span></div>
            <div className="agentbtns">
              <button className="btn primary" disabled={busy || !goal.trim()} onClick={runAgent}>{busy ? "Agent working… (10–30s)" : <><Play size={14} /> Run agent</>}</button>
              {agentRes?.spec && <button className="btn" onClick={() => { onLoad(agentRes.spec); onClose(); }}><Check size={14} /> Load the agent's deck</button>}
            </div>

            {agentRes?.trace?.length > 0 && (
              <div className="agenttrace">
                {agentRes.trace.map((s, i) => {
                  const Ic = STEP_ICON[s.kind] || MessageSquare;
                  return (
                    <div key={i} className={"tracestep " + s.kind}>
                      <Ic size={13} className="tsi" />
                      <div><span className="tk">{s.kind}</span> {s.detail}</div>
                    </div>
                  );
                })}
                {agentRes.ok && <div className="agentres ok"><div>Agent produced <b>{agentRes.slides}</b> slides · {agentRes.errors} errors, using the compiler as a tool.</div></div>}
              </div>
            )}
            {err && <div className="agentres err"><AlertTriangle size={14} /> {err}</div>}
          </div>
        ) : (
          <div className="agentbody">
            <div className="field-label">Agent-authored spec (the request body)</div>
            <textarea className="agentspec" value={spec} onChange={(e) => setSpec(e.target.value)} spellCheck={false} />
            <div className="reqline"><span className="mono">POST /api/compile</span> <span className="agentdim">Content-Type: application/json</span></div>
            <div className="agentbtns">
              <button className="btn primary" disabled={busy} onClick={runCompile}>{busy ? "Sending…" : <><Play size={14} /> Run as agent</>}</button>
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
        )}
      </div>
    </div>
  );
}
