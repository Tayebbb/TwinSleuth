import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import "@fontsource/saira-semi-condensed/latin-600.css";
import "@fontsource/saira-semi-condensed/latin-700.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import type { HypothesisId, ProbeId, OutcomeId } from "../case/catalog.js";
import "./styles/tokens.css";
import "./styles/app.css";

type Claim = { hypothesisId: HypothesisId; stance: "supports" | "rules_out"; evidenceIds: string[] };
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
  pendingAgents?: ("skeptic" | "examiner")[];
  public: { hypotheses: { id: HypothesisId; title: string; detail: string }[]; probes: { id: ProbeId; title: string; description: string; costMinutes: number; outcomes: readonly string[] }[]; symptom: { task: string; controllerCode: string; message: string; estop: string }; maintenanceLog: readonly string[]; colleagueNote: string; unsafeAction: { id: string; label: string } };
};
type Action = { type: string; [key: string]: unknown };

const outcomeLabels: Record<string, string> = { refused: "Refused", completed: "Completed", "stopped-at-95": "Stopped at 95°", "full-range": "Full range", reachable: "Reachable", "out-of-reach": "Out of reach", overlap: "Overlap", clear: "Clear" };
const post = async (id: string, view: View, action: Action) => {
  const response = await fetch(`/api/episodes/${id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionId: crypto.randomUUID(), expectedRevision: view.revision, action }) });
  if (!response.ok) throw new Error((await response.json()).error ?? "Action failed");
  return response.json() as Promise<View>;
};

function ArmSketch({ state }: { state: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lastState = useRef(state);
  const p3 = state.startsWith("p3-key-3");
  const p4 = state === "j2-stopped-95" || state === "j2-full-range";
  const j2Y = p4 ? (state === "j2-stopped-95" ? 122 : 82) : p3 ? 103 : 119;
  const j3X = p4 && state === "j2-stopped-95" ? 287 : p3 ? 300 : 274;
  const label = state === "j2-stopped-95" ? "Arm visualization: J2 stopped at 95 degrees" : state === "j2-full-range" ? "Arm visualization: J2 full range" : p3 ? "Arm visualization: PIN-9 key 3 completed" : "Arm visualization: stationary three-joint arm before start";
  useEffect(() => {
    if (lastState.current === state) return;
    lastState.current = state;
    if (!svgRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(".arm-link, .tool-link", { strokeDasharray: 320, strokeDashoffset: 320 }, { strokeDashoffset: 0, duration: .62, stagger: .08, ease: "power2.out", clearProps: "strokeDasharray,strokeDashoffset" });
      gsap.fromTo(".joint", { scale: .72, transformOrigin: "center" }, { scale: 1, duration: .35, stagger: .07, ease: "back.out(1.7)", clearProps: "transform" });
    }, svgRef);
    return () => context.revert();
  }, [state]);
  return <svg ref={svgRef} className="arm-sketch" data-testid="arm-visualization" data-arm-state={state} viewBox="0 0 520 275" role="img" aria-label={label}>
    <title>{label}</title><path className="sweep" d="M106 216 A160 160 0 0 1 366 70" />
    <path className="datum" d="M34 237H476M106 216V38" />
    <line x1="106" y1="216" x2="202" y2={j2Y} className="arm-link" />
    <line x1="202" y1={j2Y} x2={j3X} y2={p4 ? 98 : 82} className="arm-link arm-link-thin" />
    <line x1={j3X} y1={p4 ? 98 : 82} x2={p3 ? 392 : 365} y2={p3 ? 105 : 116} className="tool-link" />
    <circle cx="106" cy="216" r="20" className="joint joint-base"/><circle cx="202" cy={j2Y} r="13" className="joint"/><circle cx={j3X} cy={p4 ? 98 : 82} r="11" className="joint"/>
    <rect x="402" y="66" width="67" height="110" className="keypad"/><text x="435" y="57" textAnchor="middle" className="svg-label">PIN-9</text>
    {[0,1,2,3,4,5,6,7,8].map((n) => <g key={n}><rect x={411 + n % 3 * 16} y={77 + Math.floor(n / 3) * 25} width="11" height="15" className={p3 && n === 2 ? "key key-live" : "key"}/><text x={416.5 + n % 3 * 16} y={88 + Math.floor(n / 3) * 25} textAnchor="middle" className="key-number">{n + 1}</text></g>)}
    <path className="callout" d="M211 116L264 42H333"/><text x="270" y="35" className="svg-label">J2 · 0—180°</text><text x="28" y="257" className="svg-small">HOME / AXIS 01</text><text x="356" y="214" className="svg-small">TOOL CENTRE</text>
    {p4 && state === "j2-stopped-95" && <g><path className="limit-mark" d="M190 115l24 15M190 130l24-15"/><text x="229" y="145" className="limit-label">95° LIMIT</text></g>}
    {p3 && <text x="410" y="202" className="limit-label">KEY 3 · COMPLETE</text>}
  </svg>;
}

function App() {
  const startRequest = useRef<Promise<void> | null>(null);
  const stageRailRef = useRef<HTMLElement>(null);
  const previousStageIndex = useRef(0);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [selectedProbe, setSelectedProbe] = useState<ProbeId>("P1");
  const [predictions, setPredictions] = useState<Record<HypothesisId, string>>({ H1: "", H2: "", H3: "", H4: "" });
  const [justification, setJustification] = useState("");
  const [diagnosis, setDiagnosis] = useState<HypothesisId>("H1");
  const [confidence, setConfidence] = useState(3);
  const [claims, setClaims] = useState<Record<HypothesisId, Claim>>({ H1: { hypothesisId: "H1", stance: "supports", evidenceIds: [] }, H2: { hypothesisId: "H2", stance: "rules_out", evidenceIds: [] }, H3: { hypothesisId: "H3", stance: "rules_out", evidenceIds: [] }, H4: { hypothesisId: "H4", stance: "rules_out", evidenceIds: [] } });
  const [possible, setPossible] = useState<Record<HypothesisId, boolean>>({ H1: true, H2: true, H3: true, H4: true });
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const resetCaseInputs = () => {
    setSelectedProbe("P1");
    setPredictions({ H1: "", H2: "", H3: "", H4: "" });
    setJustification("");
    setDiagnosis("H1");
    setConfidence(3);
    setClaims({ H1: { hypothesisId: "H1", stance: "supports", evidenceIds: [] }, H2: { hypothesisId: "H2", stance: "rules_out", evidenceIds: [] }, H3: { hypothesisId: "H3", stance: "rules_out", evidenceIds: [] }, H4: { hypothesisId: "H4", stance: "rules_out", evidenceIds: [] } });
    setPossible({ H1: true, H2: true, H3: true, H4: true });
    setSelectedEvidenceId(null);
    setError("");
  };
  const start = () => {
    if (startRequest.current) return startRequest.current;
    resetCaseInputs();
    const request = (async () => { try { const response = await fetch("/api/episodes", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); if (!response.ok) throw new Error("The practice case could not start. Check that the TwinSleuth practice service is running, then try again."); setView(await response.json()); } catch (e) { setError((e as Error).message === "Failed to fetch" ? "TwinSleuth could not reach the practice service. Check that it is running, then try again." : (e as Error).message); } finally { startRequest.current = null; } })();
    startRequest.current = request;
    return request;
  };
  useEffect(() => { void start(); }, []);
  useEffect(() => {
    if (!view || !view.pendingAgents?.length) return;
    let stopped = false;
    let timer: number | undefined;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/episodes/${view.id}`);
        if (response.ok) {
          const latest = await response.json() as View;
          if (!stopped) setView((current) => {
            if (!current || current.id !== latest.id || latest.revision > current.revision) return latest;
            if (latest.revision === current.revision && (latest.traces.length > current.traces.length || JSON.stringify(latest.pendingAgents) !== JSON.stringify(current.pendingAgents))) return { ...current, traces: latest.traces, pendingAgents: latest.pendingAgents ?? [] };
            return current;
          });
        }
      } catch {
        // Keep polling after transient network failures while the Examiner is pending.
      } finally {
        if (!stopped) timer = window.setTimeout(() => void refresh(), 1200);
      }
    };
    timer = window.setTimeout(() => void refresh(), 1200);
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [view?.id, view?.pendingAgents]);
  const stageIndex = !view ? 0 : view.status === "evaluated" ? 3 : view.observations.length ? 2 : Object.keys(view.proposals).length || view.skeptic ? 1 : 0;
  useEffect(() => {
    if (previousStageIndex.current === stageIndex) return;
    previousStageIndex.current = stageIndex;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const marker = stageRailRef.current?.querySelector(".stage.current .stage-marker");
    if (marker) gsap.fromTo(marker, { scale: 0.78 }, { scale: 1, duration: 0.28, ease: "back.out(1.8)" });
  }, [stageIndex]);
  const probe = useMemo(() => view?.public.probes.find((candidate) => candidate.id === selectedProbe), [view, selectedProbe]);
  if (!view) return <main className="shell loading"><h1>{error ? "The practice case did not start" : "Starting the PIN-9 practice case"}</h1><p>{error ? "Check that the TwinSleuth practice service is running, then try again." : "Preparing a simulated case. This usually takes a moment."}</p><button onClick={() => void start()}>{error ? "Try again" : "Start case now"}</button>{error && <p className="error" role="alert">{error}</p>}</main>;
  const act = async (action: Action) => { try { setError(""); setView(await post(view.id, view, action)); } catch (e) { setError((e as Error).message); } };
  const submitProposal = () => void act({ type: "propose", probeId: selectedProbe, predictions });
  const reviseForecast = () => {
    if (selectedProbe === "P1") {
      setSelectedProbe("P3");
      setPredictions({ H1: "", H2: "", H3: "", H4: "" });
    }
    void act({ type: "skeptic-decision", decision: "revise" });
  };
  const replay = () => {
    setView(null);
    void start();
    window.history.replaceState(null, "", "#top");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const lock = () => void act({ type: "lock", diagnosis, confidence, justification, claims: Object.values(claims) });
  const updateClaim = (id: HypothesisId, patch: Partial<Claim>) => setClaims((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const armState = view.observations.length ? (view.observations.at(-1)?.probeId === "P4" ? (view.observations.at(-1)?.outcomeId === "stopped-at-95" ? "j2-stopped-95" : "j2-full-range") : view.observations.at(-1)?.probeId === "P3" ? (view.observations.at(-1)?.outcomeId === "completed" ? "p3-key-3-completed" : "p3-key-3-refused") : "initial-refusal") : "initial-refusal";
  const stageGuidance = view.status === "evaluated"
    ? "Your diagnosis has been scored. Review the evidence and debrief."
    : view.pendingAgents?.length
      ? "Your prediction is saved. Checking whether this test can separate the remaining causes."
      : stageIndex === 0
        ? "Keep the plausible causes open. Choose a test that could separate them."
      : stageIndex === 1
          ? view.proposals[selectedProbe]
            ? `Your ${selectedProbe} prediction is saved. Run it, or choose another test.`
            : "Predict an outcome for each cause before you run the test."
          : "Compare each result with your prediction. Choose another test or defend the cause best supported by the evidence.";
  const activeObservation = view.observations.find((observation) => observation.evidenceId === selectedEvidenceId) ?? view.observations.at(-1);
  const selectedProbeObservation = view.observations.find((observation) => observation.probeId === selectedProbe);
  const skepticRationale = view.skeptic?.triggers.map((trigger) => {
    if (trigger.kind === "same-prediction") {
      const firstHypothesisId = trigger.hypothesisIds[0];
      const outcome = firstHypothesisId ? view.proposals[view.skeptic!.probeId]?.[firstHypothesisId] : undefined;
      const label = outcomeLabels[outcome ?? ""] ?? "the same result";
      return `${trigger.hypothesisIds.join(" and ")} predict ${label}. This test cannot distinguish between these causes.`;
    }
    const causes = trigger.hypothesisIds.length ? trigger.hypothesisIds.join(" and ") : "a cause you ruled out";
    const nextStep = trigger.hypothesisIds.length > 1 ? "Keep them possible, or gather a result that rules them out." : "Keep it possible, or gather a result that rules it out.";
    return `The revealed evidence still supports ${causes}. ${nextStep}`;
  }).join(" ");
  const remainingPercent = Math.round((view.remainingMinutes / view.budgetMinutes) * 100);
  const stages = ["Machine", "Test bench", "Evidence", "Diagnosis"];
  return <main className="shell">
    <header className="global-nav">
      <a className="brand-lockup" href="#top" aria-label="TwinSleuth practice bench">
        <span>TwinSleuth</span>
      </a>
      <span className="session-state"><i aria-hidden="true"/> Practice session</span>
    </header>

    <header className="masthead" id="top">
      <div className="masthead-copy">
        <h1>PIN-9 Refusal</h1>
        <p className="deck">A robot arm refused its move. Build a testable explanation from the evidence.</p>
      </div>
      <aside className="budget" aria-label={`${view.remainingMinutes} minutes remaining of ${view.budgetMinutes}`}>
        <div className="budget-copy"><strong>{view.remainingMinutes} min</strong><span>remaining of {view.budgetMinutes} min</span></div>
        <div className="budget-track" role="img" aria-label={`${remainingPercent}% of the service window remains`}><span style={{ transform: `scaleX(${remainingPercent / 100})` }}/></div>
        <span className="simulation-label">Simulated training · no equipment connected</span>
      </aside>
    </header>

    <nav ref={stageRailRef} className="stage-rail" aria-label="Investigation progress">
      {stages.map((stage, index) => <a href={index === 0 ? "#machine" : index === 1 ? "#test-bench" : index === 2 ? "#evidence" : "#diagnosis"} key={stage} className={`stage ${index === stageIndex ? "current" : ""} ${index < stageIndex ? "complete" : ""}`} aria-current={index === stageIndex ? "step" : undefined}>
        <span className="stage-marker" aria-hidden="true"/><span>{stage}</span>
      </a>)}
      <p className="stage-caption" id="stage-guidance" aria-live="polite">{stageGuidance}</p>
    </nav>

    <div className="bench-grid">
      <section className="panel scene" id="machine" data-testid="scene-panel" aria-labelledby="scene-title">
        <div className="panel-heading"><h2 id="scene-title">Stationary arm</h2><span className="signal-status">Controller response</span></div>
        <div className="machine-figure"><ArmSketch state={armState}/><span className="figure-caption">PIN-9 · three-axis service cell</span></div>
        <div className="alarm-line"><span className="alarm-beacon" aria-hidden="true"/><div><b>{view.public.symptom.controllerCode}</b><span>{view.public.symptom.message}</span></div></div>
        <dl className="scene-facts"><div><dt>Command</dt><dd>{view.public.symptom.task}</dd></div><div><dt>Emergency stop</dt><dd><span className="state-live">●</span> {view.public.symptom.estop || "Clear"}</dd></div></dl>
        <details className="maintenance"><summary>Maintenance notes <span aria-hidden="true">+</span></summary><ul>{view.public.maintenanceLog.map((note) => <li key={note}>{note}</li>)}</ul></details>
        <blockquote><span>Operator handoff</span>“{view.public.colleagueNote}”</blockquote>
        <button className="unsafe" onClick={() => void act({ type: "unsafe" })}><span>Log unsafe suggestion<small>{view.public.unsafeAction.label}</small></span></button>
      </section>

      <section className="panel worklist" id="test-bench" data-testid="beliefs-probes-panel" aria-labelledby="hypothesis-title">
        <div className="panel-heading"><h2 id="hypothesis-title">Possible causes</h2><span className="count-mark">{Object.values(possible).filter(Boolean).length} of 4</span></div>
        <div className="hypotheses">{view.public.hypotheses.map((hypothesis) => <label className={`hypothesis ${possible[hypothesis.id] ? "selected" : ""}`} key={hypothesis.id}>
          <input type="checkbox" aria-label={`Keep ${hypothesis.id} possible: ${hypothesis.title}`} checked={possible[hypothesis.id]} onChange={(event) => { const next = { ...possible, [hypothesis.id]: event.target.checked }; setPossible(next); void act({ type: "beliefs", possibleHypotheses: Object.entries(next).filter(([, value]) => value).map(([id]) => id) }); }}/>
          <span className="hypothesis-id">{hypothesis.id}</span><span className="hypothesis-copy"><b>{hypothesis.title}</b><small>{hypothesis.detail}</small></span>
        </label>)}</div>
        <div className="probe-heading"><h3>Choose a diagnostic test</h3><span>6 tests · select one</span></div>
        <div className="probe-list">{view.public.probes.map((candidate) => <button aria-pressed={selectedProbe === candidate.id} disabled={Boolean(view.skeptic)} className={`probe ${selectedProbe === candidate.id ? "active" : ""}`} key={candidate.id} onClick={() => { setSelectedProbe(candidate.id); setPredictions(view.proposals[candidate.id] ?? { H1: "", H2: "", H3: "", H4: "" }); }}>
          <span className="probe-id">{candidate.id}</span><span className="probe-name">{candidate.title}</span><span className="probe-cost">{candidate.costMinutes}<small>min</small></span>
        </button>)}</div>
      </section>

      <section className="panel prediction" data-testid="prediction-panel" aria-labelledby="forecast-title">
        <div className="panel-heading forecast-heading"><div><h2 id="forecast-title">Predict {probe?.id}'s result</h2></div><span className="forecast-cost">{probe?.costMinutes} min</span></div>
        <p className="probe-description">{probe?.description}</p>
        <div className="forecast-matrix"><div className="matrix-head"><span>Cause</span><span>Expected result before the test</span></div>{view.public.hypotheses.map((hypothesis) => <label className="prediction-row" key={hypothesis.id}><b>{hypothesis.id}</b><select aria-label={`Prediction for ${hypothesis.id}`} value={predictions[hypothesis.id]} disabled={Boolean(view.proposals[selectedProbe])} onChange={(event) => setPredictions({ ...predictions, [hypothesis.id]: event.target.value })}><option value="">Choose an outcome</option>{probe?.outcomes.map((outcome) => <option key={outcome} value={outcome}>{outcomeLabels[outcome] ?? outcome}</option>)}</select></label>)}</div>
        <div className="prediction-actions"><button className="commit" disabled={Object.values(predictions).some((value) => !value)} onClick={submitProposal}>Commit prediction table</button></div>
        {view.skeptic && <div className="skeptic" role="status"><div className="skeptic-heading"><div><b>Skeptic check · {view.skeptic.probeId}</b><small>Review what this test can distinguish</small></div></div><p>{skepticRationale}</p><p className="forecast-lock-note">Your prediction is saved. Choose whether to switch tests or run this one.</p><details><summary>How to read this check</summary><p>Compare the predictions for the causes named above. If they match, this test will not tell those causes apart.</p></details><div className="skeptic-actions"><button className="revise" onClick={reviseForecast}>{selectedProbe === "P1" ? "Try P3 instead" : "Choose another test"}</button><button className="run-anyway" onClick={() => void act({ type: "skeptic-decision", decision: "run-anyway" })}>Run {selectedProbe} anyway</button></div></div>}
        {view.proposals[selectedProbe] && !view.skeptic && (selectedProbeObservation
          ? <div className="run-ready"><span><i aria-hidden="true"/> This probe has already run</span><a className="review-observation" href="#evidence" onClick={() => setSelectedEvidenceId(selectedProbeObservation.evidenceId)}>Review its observation in the evidence ledger</a></div>
          : <div className="run-ready"><span><i aria-hidden="true"/> Prediction saved</span><button className="run" onClick={() => void act({ type: "run", probeId: selectedProbe })}>Run {selectedProbe}<span>Reveal the result</span></button></div>)}
        <aside className="forecast-method"><b>Choose a result that can separate causes.</b><p>If every cause predicts the same outcome, this probe cannot narrow the list. Compare your rows before committing.</p></aside>
      </section>

      <section className="panel evidence" id="evidence" aria-labelledby="evidence-title">
        <div className="panel-heading"><h2 id="evidence-title">Evidence ledger</h2><span className="count-mark">{view.observations.length} {view.observations.length === 1 ? "result" : "results"}</span></div>
        {view.observations.length === 0 ? <div className="empty-ledger"><div><b>Waiting for the first test</b><p>Model predictions stay hidden until a test runs. Results will appear here.</p></div></div> : <>
          <div className="evidence-rail" role="list" aria-label="Probe observation selector">{view.observations.map((observation, index) => <button role="listitem" key={observation.evidenceId} className={`evidence-segment ${activeObservation?.evidenceId === observation.evidenceId ? "active" : ""}`} aria-pressed={activeObservation?.evidenceId === observation.evidenceId} onClick={() => setSelectedEvidenceId(observation.evidenceId)}>
            <span className="evidence-segment-mark" aria-hidden="true">{index + 1}</span><span><b>{observation.probeId}</b><small>{outcomeLabels[observation.outcomeId]}</small></span>
          </button>)}</div>
          {activeObservation && <article className="evidence-detail" aria-live="polite"><header><span className="evidence-id">Evidence {activeObservation.evidenceId.slice(0, 8)}</span><strong>{activeObservation.probeId} · {outcomeLabels[activeObservation.outcomeId]}</strong></header>
            <div className="evidence-comparison"><div><span>Model's expected result</span><p><b>MODEL PREDICTED:</b> {Object.entries(view.revealedForecasts[activeObservation.probeId] ?? {}).map(([id, value]) => `${id} ${outcomeLabels[value] ?? value}`).join(" · ")}</p></div><div><span>Your prediction</span><p><b>YOUR PREDICTION:</b> {Object.entries(view.proposals[activeObservation.probeId] ?? {}).map(([id, value]) => `${id} ${outcomeLabels[value] ?? value}`).join(" · ")}</p></div></div>
          </article>}
        </>}
      </section>

      {view.status === "active" && <details className="panel diagnosis" id="diagnosis" aria-labelledby="diagnosis-title" open={view.observations.length > 0}>
        <summary className="diagnosis-summary"><h2 id="diagnosis-title">Defend your diagnosis</h2><span className="diagnosis-summary-note">{view.observations.length ? "Use the observations to support each claim" : "Open when you are ready to commit"}</span></summary>
        <div className="diagnosis-body"><div className="diagnosis-form"><label>Most likely cause<select value={diagnosis} onChange={(event) => setDiagnosis(event.target.value as HypothesisId)}>{view.public.hypotheses.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label><label>Confidence<input type="number" min="1" max="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}/><small>1 = tentative · 5 = certain</small></label><label className="justification">Justification<textarea value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Which observations support this cause? What rules out the alternatives?"/></label></div>
          <div className="claims"><h3>Evidence claims</h3>{view.public.hypotheses.map((item) => <fieldset key={item.id}><legend><b>{item.id}</b> · {item.title}</legend><select aria-label={`Stance for ${item.id} claim`} value={claims[item.id].stance} onChange={(event) => updateClaim(item.id, { stance: event.target.value as Claim["stance"] })}><option value="supports">Supports</option><option value="rules_out">Rules out</option></select><select aria-label={`Evidence for ${item.id}`} value={claims[item.id].evidenceIds[0] ?? ""} onChange={(event) => updateClaim(item.id, { evidenceIds: event.target.value ? [event.target.value] : [] })}><option value="">Cite an observation</option>{view.observations.map((entry) => <option key={entry.evidenceId} value={entry.evidenceId}>{entry.probeId} · {outcomeLabels[entry.outcomeId]}</option>)}</select></fieldset>)}</div>
          <button className="lock" disabled={!justification} onClick={lock}>Lock diagnosis and score</button>
        </div>
      </details>}

      {view.status === "evaluated" && view.score && <section className="panel debrief" id="diagnosis" aria-labelledby="debrief-title">
        <div className="debrief-header"><div><h2 id="debrief-title">Case evaluated</h2><p>{view.diagnosis?.diagnosis} was {view.score.evidenceSupportedHypotheses.includes(view.diagnosis?.diagnosis ?? "H1") ? "supported by the evidence" : "not supported"}</p></div><div className="score-hero"><strong>{view.score.total}</strong><span>/ 100 points</span></div></div>
        <div className="rubric">{[["Diagnosis", view.score.diagnosis], ["Evidence sufficiency", view.score.evidenceSufficiency], ["Prediction accuracy", view.score.predictionAccuracy], ["Probe quality", view.score.probeQuality], ["Reasoning", view.score.reasoning]].map(([label, points]) => <div key={label as string}><span>{label}</span><b>{points}</b></div>)}</div>
        <p className="path-cost">Path cost <b>{view.score.actualCostMinutes} min</b><span>Best policy branch {view.score.bestPolicyBranchCostMinutes} min</span></p>
        <div className="timelines"><div><h3>Learner beliefs</h3>{view.beliefTimeline.map((entry) => <p key={entry.revision}>Step {entry.revision}: {entry.beliefs.join(", ")}</p>)}</div><div><h3>Evidence-supported causes</h3>{view.evidenceTimeline.map((entry) => <p key={entry.evidenceId}>{entry.evidenceId.slice(0, 8)}: {entry.supported.join(", ") || "none"}</p>)}</div></div>
        <h3>Checked evidence claims</h3><div className="claim-checks">{view.score.claimChecks.map((check) => <p key={check.hypothesisId}><b>{check.hypothesisId}</b><span>{check.stance}</span><em className={check.valid ? "claim-valid" : "claim-invalid"}>{check.valid ? "Supported" : "Needs revision"}</em><span>{check.reason}</span></p>)}</div>
        <details className="forecast-archive"><summary>Full model forecast table</summary>{view.forecastTable && Object.entries(view.forecastTable).map(([probeId, row]) => <p key={probeId}><b>{probeId}</b> · {Object.entries(row).map(([id, outcome]) => `${id}: ${outcomeLabels[outcome] ?? outcome}`).join(" · ")}</p>)}</details>
        <div className="examiner-note"><h3>Examiner notes</h3>{view.traces.filter((trace) => trace.graph === "examiner").map((trace) => <p key={trace.inputSummary}>{trace.output}</p>)}{view.pendingAgents?.includes("examiner") && <p role="status">Examiner feedback is still being prepared.</p>}</div>
        <details className="agent-trace"><summary>Agent trace</summary>{view.traces.map((trace, index) => <pre key={`${trace.graph}-${trace.inputSummary}-${index}`}>{trace.graph} · {trace.status} · {trace.output}</pre>)}</details>
        <div className="truth-reveal"><h3>Truth revealed</h3><span>Server-selected fault</span><strong>{view.truthHypothesis ?? "Revealed after evaluation"}</strong><p>The evidence ledger and checked claims determine the score.</p></div>
        <button className="replay" onClick={replay}>Start a fresh episode</button>
      </section>}
    </div>
    <footer className="workspace-footer"><span>Training simulation · No physical equipment is connected</span><span>Model predictions stay hidden until a test runs</span></footer>
    {error && <div className="toast error" role="alert">{error}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);
