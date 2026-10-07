import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { HypothesisId, ProbeId, OutcomeId } from "../case/catalog.js";
import "./styles/tokens.css";
import "./styles/app.css";

type View = {
  id: string; revision: number; status: "active" | "evaluated"; beliefs: HypothesisId[];
  proposals: Record<string, Record<HypothesisId, OutcomeId>>; revisedPredictions: Record<string, Record<HypothesisId, OutcomeId>>;
  observations: { evidenceId: string; probeId: ProbeId; outcomeId: OutcomeId }[]; remainingMinutes: number; budgetMinutes: number;
  pendingProbe?: ProbeId; skeptic?: { question: string; probeId: ProbeId; triggers: { kind: string; hypothesisIds: HypothesisId[] }[] };
  diagnosis?: { diagnosis: HypothesisId; confidence: number; justification: string; claims: Claim[] };
  score?: { total: number; diagnosis: number; evidenceSufficiency: number; predictionAccuracy: number; probeQuality: number; reasoning: number; claimChecks: { hypothesisId: HypothesisId; stance: string; valid: boolean; reason: string }[]; actualCostMinutes: number; bestPolicyBranchCostMinutes: number; evidenceSupportedHypotheses: HypothesisId[] };
  truthHypothesis?: HypothesisId;
  beliefTimeline: { revision: number; beliefs: HypothesisId[] }[];
  evidenceTimeline: { evidenceId: string; supported: HypothesisId[] }[];
  revealedForecasts: Partial<Record<ProbeId, Record<HypothesisId, OutcomeId>>>;
  forecastTable?: Record<ProbeId, Record<HypothesisId, OutcomeId>>;
  traces: { graph: string; status: string; inputSummary: string; output: string }[];
  public: { hypotheses: { id: HypothesisId; title: string; detail: string }[]; probes: { id: ProbeId; title: string; description: string; costMinutes: number; outcomes: readonly string[] }[]; symptom: { task: string; controllerCode: string; message: string; estop: string }; maintenanceLog: readonly string[]; colleagueNote: string; unsafeAction: { id: string; label: string } };
};
type Claim = { hypothesisId: HypothesisId; stance: "supports" | "rules_out"; evidenceIds: string[] };
type Action = { type: string; [key: string]: unknown };

const outcomeLabels: Record<string, string> = { refused: "Refused", completed: "Completed", "stopped-at-95": "Stopped at 95°", "full-range": "Full range", reachable: "Reachable", "out-of-reach": "Out of reach", overlap: "Overlap", clear: "Clear" };
const post = async (id: string, view: View, action: Action) => {
  const response = await fetch(`/api/episodes/${id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionId: crypto.randomUUID(), expectedRevision: view.revision, action }) });
  if (!response.ok) throw new Error((await response.json()).error ?? "Action failed");
  return response.json() as Promise<View>;
};

function ArmSketch({ observed }: { observed: boolean }) {
  return <svg className="arm-sketch" viewBox="0 0 420 230" role="img" aria-label="Stationary three-joint arm beside a keypad">
    <path className="ghost-path" d="M80 180 Q180 35 320 95" />
    <line x1="80" y1="180" x2="175" y2={observed ? "110" : "135"} className="arm-link" />
    <line x1="175" y1={observed ? "110" : "135"} x2="290" y2={observed ? "115" : "85"} className="arm-link" />
    <circle cx="80" cy="180" r="20" className="joint" /><circle cx="175" cy={observed ? "110" : "135"} r="12" className="joint" />
    <circle cx="290" cy={observed ? "115" : "85"} r="10" className="joint" />
    <rect x="310" y="58" width="72" height="104" rx="5" className="keypad" />
    {[0,1,2,3,4,5,6,7,8].map((n) => <rect key={n} x={321 + (n % 3) * 19} y={70 + Math.floor(n / 3) * 26} width="12" height="17" className="key" />)}
  </svg>;
}

function App() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [selectedProbe, setSelectedProbe] = useState<ProbeId>("P1");
  const [predictions, setPredictions] = useState<Record<HypothesisId, string>>({ H1: "", H2: "", H3: "", H4: "" });
  const [justification, setJustification] = useState("");
  const [diagnosis, setDiagnosis] = useState<HypothesisId>("H1");
  const [confidence, setConfidence] = useState(3);
  const [claims, setClaims] = useState<Record<HypothesisId, Claim>>({ H1: { hypothesisId: "H1", stance: "supports", evidenceIds: [] }, H2: { hypothesisId: "H2", stance: "rules_out", evidenceIds: [] }, H3: { hypothesisId: "H3", stance: "rules_out", evidenceIds: [] }, H4: { hypothesisId: "H4", stance: "rules_out", evidenceIds: [] } });
  const [possible, setPossible] = useState<Record<HypothesisId, boolean>>({ H1: true, H2: true, H3: true, H4: true });

  const start = async () => { try { const response = await fetch("/api/episodes", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); if (!response.ok) throw new Error("Could not start episode"); setView(await response.json()); } catch (e) { setError((e as Error).message); } };
  useEffect(() => { void start(); }, []);
  useEffect(() => {
    if (!view || (view.status === "evaluated" && !view.traces.some((trace) => trace.graph === "examiner"))) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/episodes/${view.id}`);
      if (response.ok) setView(await response.json());
    }, 1200);
    return () => window.clearInterval(timer);
  }, [view?.id, view?.status, view?.traces]);
  const probe = useMemo(() => view?.public.probes.find((candidate) => candidate.id === selectedProbe), [view, selectedProbe]);
  if (!view) return <main className="shell"><p className="eyebrow">TWIN/SLEUTH</p><h1>Open a practice episode</h1><button onClick={() => void start()}>Start PIN-9 case</button>{error && <p className="error">{error}</p>}</main>;
  const act = async (action: Action) => { try { setError(""); setView(await post(view.id, view, action)); } catch (e) { setError((e as Error).message); } };
  const submitProposal = () => void act({ type: "propose", probeId: selectedProbe, predictions });
  const lock = () => void act({ type: "lock", diagnosis, confidence, justification, claims: Object.values(claims) });
  const updateClaim = (id: HypothesisId, patch: Partial<Claim>) => setClaims((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  return <main className="shell">
    <header className="masthead"><div><p className="eyebrow">TWIN/SLEUTH · PRACTICE LAB</p><h1>PIN-9 Refusal</h1><p>Diagnose a simulated robot arm by predicting what each test will show.</p></div><div className="budget"><span>TIME LEFT</span><strong>{view.remainingMinutes} min</strong><small>of {view.budgetMinutes} min</small></div></header>
    <div className="notebook-grid">
      <section className="panel scene"><div className="section-kicker">01 · SCENE NOTE</div><ArmSketch observed={view.observations.length > 0} /><div className="status-row"><strong>{view.public.symptom.controllerCode}</strong><span>{view.public.symptom.message}</span></div><p><b>Task:</b> {view.public.symptom.task}</p><p><b>E-stop:</b> <span className="tag success">CLEAR</span> · Arm remains stationary before start.</p><details><summary>Maintenance notes</summary><ul>{view.public.maintenanceLog.map((note) => <li key={note}>{note}</li>)}</ul></details><blockquote>“{view.public.colleagueNote}”</blockquote><button className="unsafe" onClick={() => void act({ type: "unsafe" })}>Record unsafe idea: {view.public.unsafeAction.label}</button></section>
      <section className="panel workspace"><div className="section-kicker">02 · HYPOTHESIS DESK</div><h2>What could still be wrong?</h2><div className="hypotheses">{view.public.hypotheses.map((hypothesis) => <label className={`hypothesis ${possible[hypothesis.id] ? "selected" : ""}`} key={hypothesis.id}><input type="checkbox" checked={possible[hypothesis.id]} onChange={(event) => { const next = { ...possible, [hypothesis.id]: event.target.checked }; setPossible(next); void act({ type: "beliefs", possibleHypotheses: Object.entries(next).filter(([, value]) => value).map(([id]) => id) }); }} /><span><b>{hypothesis.id} · {hypothesis.title}</b><small>{hypothesis.detail}</small></span></label>)}</div><h2>Choose a probe</h2><div className="probe-list">{view.public.probes.map((candidate) => <button className={`probe ${selectedProbe === candidate.id ? "active" : ""}`} key={candidate.id} onClick={() => { setSelectedProbe(candidate.id); setPredictions({ H1: "", H2: "", H3: "", H4: "" }); }}><span><b>{candidate.id}</b> {candidate.title}</span><small>{candidate.costMinutes} min</small></button>)}</div></section>
      <section className="panel prediction"><div className="section-kicker">03 · COMMIT A FORECAST</div><h2>{probe?.id} · {probe?.title}</h2><p>{probe?.description}</p><div className="prediction-card"><span className="card-label">YOUR PREDICTION</span>{view.public.hypotheses.map((hypothesis) => <label key={hypothesis.id}>{hypothesis.id}<select aria-label={`Prediction for ${hypothesis.id}`} value={predictions[hypothesis.id]} onChange={(event) => setPredictions({ ...predictions, [hypothesis.id]: event.target.value })}><option value="">Choose outcome</option>{probe?.outcomes.map((outcome) => <option key={outcome} value={outcome}>{outcomeLabels[outcome] ?? outcome}</option>)}</select></label>)}</div><button disabled={Object.values(predictions).some((value) => !value)} onClick={submitProposal}>Commit prediction table</button>{view.skeptic && <div className="skeptic"><span className="card-label">SKEPTIC · {view.skeptic.probeId}</span><p>{view.skeptic.question}</p><details><summary>Why?</summary><p>{view.skeptic.triggers.map((trigger) => trigger.kind === "same-prediction" ? `The committed table gives ${trigger.hypothesisIds.join(" and ")} the same predicted result.` : "A cause was ruled out even though the revealed evidence still supports it.").join(" ")}</p></details><button onClick={() => void act({ type: "skeptic-decision", decision: "revise" })}>Revise</button><button onClick={() => void act({ type: "skeptic-decision", decision: "run-anyway" })}>Run anyway</button></div>}{view.proposals[selectedProbe] && !view.skeptic && <button className="run" onClick={() => void act({ type: "run", probeId: selectedProbe })}>Run {selectedProbe} · reveal observation</button>}</section>
      <section className="panel evidence"><div className="section-kicker">04 · EVIDENCE LEDGER</div><h2>Observed rows</h2>{view.observations.length === 0 ? <p className="muted">No probe has run. Forecast rows stay private until observation.</p> : view.observations.map((observation) => <div className="observation" key={observation.evidenceId}><span className="card-label">OBSERVED · {observation.probeId}</span><strong>{outcomeLabels[observation.outcomeId]}</strong><small>{observation.evidenceId.slice(0, 8)}</small><p>MODEL PREDICTED: {Object.entries(view.revealedForecasts[observation.probeId] ?? {}).map(([id, value]) => `${id} ${outcomeLabels[value] ?? value}`).join(" · ")}</p><p>YOUR PREDICTION: {Object.entries(view.proposals[observation.probeId] ?? {}).map(([id, value]) => `${id} ${outcomeLabels[value] ?? value}`).join(" · ")}</p></div>)}</section>
      {view.status === "active" &&             <section className="panel diagnosis"><div className="section-kicker">05 · DEFEND A DIAGNOSIS</div><h2>Lock your argument</h2><label>Selected cause<select value={diagnosis} onChange={(event) => setDiagnosis(event.target.value as HypothesisId)}>{view.public.hypotheses.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label><label>Confidence (1–5)<input type="number" min="1" max="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label>Justification<textarea value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="What does the evidence show?" /></label><div className="claims">{view.public.hypotheses.map((item) => <fieldset key={item.id}><legend>{item.id} claim</legend><select aria-label={`Stance for ${item.id} claim`} value={claims[item.id].stance} onChange={(event) => updateClaim(item.id, { stance: event.target.value as Claim["stance"] })}><option value="supports">supports</option><option value="rules_out">rules out</option></select><select aria-label={`Evidence for ${item.id}`} value={claims[item.id].evidenceIds[0] ?? ""} onChange={(event) => updateClaim(item.id, { evidenceIds: event.target.value ? [event.target.value] : [] })}><option value="">Cite evidence</option>{view.observations.map((item) => <option key={item.evidenceId} value={item.evidenceId}>{item.probeId} · {outcomeLabels[item.outcomeId]}</option>)}</select></fieldset>)}</div><button disabled={!justification} onClick={lock}>Lock diagnosis and score</button></section>}
      {view.status === "evaluated" && view.score && <section className="panel debrief"><div className="section-kicker">06 · DEBRIEF</div><h2>Case evaluated · {view.diagnosis?.diagnosis} was {view.score.evidenceSupportedHypotheses.includes(view.diagnosis?.diagnosis ?? "H1") ? "supported by the evidence" : "not supported"}</h2><div className="score-hero"><strong>{view.score.total}</strong><span>/ 100 points</span></div><div className="rubric">{[["Diagnosis", view.score.diagnosis], ["Evidence sufficiency", view.score.evidenceSufficiency], ["Prediction accuracy", view.score.predictionAccuracy], ["Probe quality", view.score.probeQuality], ["Reasoning", view.score.reasoning]].map(([label, points]) => <div key={label as string}><span>{label}</span><b>{points}</b></div>)}</div><p>Path cost: {view.score.actualCostMinutes} minutes · exact policy branch: {view.score.bestPolicyBranchCostMinutes} minutes.</p><h3>Two timelines</h3><div className="timelines"><div><b>Learner beliefs</b>{view.beliefTimeline.map((entry) => <p key={entry.revision}>r{entry.revision}: {entry.beliefs.join(", ")}</p>)}</div><div><b>Evidence-supported</b>{view.evidenceTimeline.map((entry) => <p key={entry.evidenceId}>{entry.evidenceId.slice(0, 8)}: {entry.supported.join(", ") || "none"}</p>)}</div></div><h3>Checked evidence claims</h3><div className="claim-checks">{view.score.claimChecks.map((check) => <p key={check.hypothesisId}><b>{check.hypothesisId}</b> · {check.stance} · {check.valid ? "valid" : "needs revision"} · {check.reason}</p>)}</div><h3>Full model forecast table</h3><div className="forecast-table">{view.forecastTable && Object.entries(view.forecastTable).map(([probeId, row]) => <p key={probeId}><b>{probeId}</b> · {Object.entries(row).map(([id, outcome]) => `${id}: ${outcomeLabels[outcome] ?? outcome}`).join(" · ")}</p>)}</div><h3>Examiner notes</h3>{view.traces.filter((trace) => trace.graph === "examiner").map((trace) => <p key={trace.inputSummary}>{trace.output}</p>)}<details><summary>Agent trace</summary>{view.traces.map((trace, index) => <pre key={`${trace.graph}-${trace.inputSummary}-${index}`}>{trace.graph} · {trace.status} · {trace.output}</pre>)}</details><h3>Truth revealed</h3><p><b>Server-selected fault: {view.truthHypothesis ?? "revealed after evaluation"}</b>. The evidence ledger and checked claims are the source of the score. Start another episode to practice a fresh server-selected fault.</p><button onClick={() => { setView(null); void start(); }}>Replay with a fresh episode</button></section>}
    </div>{error && <div className="toast error" role="alert">{error}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
