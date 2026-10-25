import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import { z } from "zod";
import "@fontsource/saira-semi-condensed/latin-600.css";
import "@fontsource/saira-semi-condensed/latin-700.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./styles/tokens.css";
import "./styles/app.css";

type Claim = { hypothesisId: string; stance: "supports" | "rules_out"; evidenceIds: string[] };
type View = {
  id: string; caseId: string; title: string; revision: number; status: "active" | "evaluated"; beliefs: string[];
  proposals: Record<string, Record<string, string>>; revisedPredictions: Record<string, Record<string, string>>;
  observations: { evidenceId: string; probeId: string; outcomeId: string }[]; remainingMinutes: number; budgetMinutes: number;
  pendingProbe?: string; skeptic?: { question: string; probeId: string; triggers: { kind: string; hypothesisIds: string[] }[] };
  diagnosis?: { diagnosis: string; confidence: number; justification: string; claims: Claim[] };
  score?: { total: number; diagnosis: number; evidenceSufficiency: number; predictionAccuracy: number; probeQuality: number; reasoning: number; claimChecks: { hypothesisId: string; stance: string; valid: boolean; reason: string }[]; actualCostMinutes: number; bestPolicyBranchCostMinutes: number; evidenceSupportedHypotheses: string[] };
  truthHypothesis?: string;
  beliefTimeline: { revision: number; beliefs: string[] }[];
  evidenceTimeline: { evidenceId: string; supported: string[] }[];
  revealedForecasts: Partial<Record<string, Record<string, string>>>;
  forecastTable?: Record<string, Record<string, string>>;
  traces: { graph: string; status: string; inputSummary: string; output: string; skill?: string; revision?: number; lesson?: string; reflection?: string }[];
  pendingAgents?: ("skeptic" | "examiner" | "tutor")[];
  tutor?: { skill: "design_discriminating_tests" | "separate_evidence_from_belief" | "plan_under_a_budget"; trace?: { graph: "tutor"; status: "model" | "fallback"; inputSummary: string; output: string; skill: string; revision: number; lesson: string; reflection: string } };
  debrief?: { probeLessons: { probeId: string; informative: boolean; remaining: string[]; lesson: string }[]; betterNextProbe?: string; pathLesson: string };
  public: { hypotheses: { id: string; title: string; detail: string }[]; probes: { id: string; title: string; description: string; costMinutes: number; outcomes: readonly string[] }[]; symptom: { task: string; controllerCode: string; message: string; estop: string }; maintenanceLog: readonly string[]; colleagueNote: string; unsafeAction: { id: string; label: string } };
};
type Action = { type: string; [key: string]: unknown };

const outcomeLabels: Record<string, string> = { refused: "Refused", completed: "Completed", "stopped-at-95": "Stopped at 95°", "full-range": "Full range", reachable: "Reachable", "out-of-reach": "Out of reach", overlap: "Overlap", clear: "Clear", drifts: "Drifts", "stops-on-mark": "Stops on mark", "count-low": "Count low", "count-matches": "Count matches", "mount-loose": "Mount loose", "mount-secure": "Mount secure", obstructed: "Obstructed" };
const requestTimeoutMs = 10_000;
const hypothesisIdSchema = z.string().min(1);
const probeIdSchema = z.string().min(1);
const outcomeIdSchema = z.string().min(1);
const predictionSchema = z.record(z.string(), z.string());
const viewSchema = z.object({
  id: z.string().min(1), caseId: z.string().min(1), title: z.string().min(1), revision: z.number().int().nonnegative(), status: z.enum(["active", "evaluated"]), beliefs: z.array(hypothesisIdSchema),
  proposals: z.record(z.string(), predictionSchema), revisedPredictions: z.record(z.string(), predictionSchema),
  observations: z.array(z.object({ evidenceId: z.string().min(1), probeId: probeIdSchema, outcomeId: outcomeIdSchema })), remainingMinutes: z.number().finite(), budgetMinutes: z.number().positive(),
  pendingProbe: probeIdSchema.optional(), skeptic: z.object({ question: z.string().min(1).max(280), probeId: probeIdSchema, triggers: z.array(z.object({ kind: z.string(), hypothesisIds: z.array(hypothesisIdSchema) })) }).optional(),
  diagnosis: z.object({ diagnosis: hypothesisIdSchema, confidence: z.number(), justification: z.string(), claims: z.array(z.object({ hypothesisId: hypothesisIdSchema, stance: z.enum(["supports", "rules_out"]), evidenceIds: z.array(z.string()) })) }).optional(),
  score: z.object({ total: z.number(), diagnosis: z.number(), evidenceSufficiency: z.number(), predictionAccuracy: z.number(), probeQuality: z.number(), reasoning: z.number(), claimChecks: z.array(z.object({ hypothesisId: hypothesisIdSchema, stance: z.string(), valid: z.boolean(), reason: z.string() })), actualCostMinutes: z.number(), bestPolicyBranchCostMinutes: z.number(), evidenceSupportedHypotheses: z.array(hypothesisIdSchema) }).optional(),
  truthHypothesis: hypothesisIdSchema.optional(), beliefTimeline: z.array(z.object({ revision: z.number(), beliefs: z.array(hypothesisIdSchema) })), evidenceTimeline: z.array(z.object({ evidenceId: z.string(), supported: z.array(hypothesisIdSchema) })),
  revealedForecasts: z.partialRecord(probeIdSchema, predictionSchema), forecastTable: z.record(probeIdSchema, predictionSchema).optional(), traces: z.array(z.object({ graph: z.enum(["skeptic", "examiner", "tutor"]), status: z.enum(["template", "model", "fallback"]), inputSummary: z.string(), output: z.string(), skill: z.string().optional(), revision: z.number().int().nonnegative().optional(), lesson: z.string().optional(), reflection: z.string().optional() })), pendingAgents: z.array(z.enum(["skeptic", "examiner", "tutor"])).optional(), tutor: z.object({ skill: z.enum(["design_discriminating_tests", "separate_evidence_from_belief", "plan_under_a_budget"]), trace: z.object({ graph: z.literal("tutor"), status: z.enum(["model", "fallback"]), inputSummary: z.string(), output: z.string(), skill: z.string(), revision: z.number().int().nonnegative(), lesson: z.string(), reflection: z.string() }).optional() }).optional(), debrief: z.object({ probeLessons: z.array(z.object({ probeId: z.string(), informative: z.boolean(), remaining: z.array(z.string()), lesson: z.string() })), betterNextProbe: z.string().optional(), pathLesson: z.string() }).optional(),
  public: z.object({ hypotheses: z.array(z.object({ id: hypothesisIdSchema, title: z.string(), detail: z.string() })), probes: z.array(z.object({ id: probeIdSchema, title: z.string(), description: z.string(), costMinutes: z.number(), outcomes: z.array(outcomeIdSchema) })), symptom: z.object({ task: z.string(), controllerCode: z.string(), message: z.string(), estop: z.string() }), maintenanceLog: z.array(z.string()), colleagueNote: z.string(), unsafeAction: z.object({ id: z.string(), label: z.string() }) }),
});

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => undefined);
  const parsed = z.object({ error: z.string().min(1) }).safeParse(body);
  return parsed.success ? parsed.data.error : fallback;
}

async function readView(response: Response): Promise<View> {
  const body = await response.json().catch(() => undefined);
  const parsed = viewSchema.safeParse(body);
  if (!parsed.success) throw new Error("TwinSleuth received an invalid practice-case response. Your work was not changed; try again.");
  return parsed.data as View;
}

const post = async (id: string, view: View, action: Action) => {
  const response = await fetch(`/api/episodes/${id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionId: crypto.randomUUID(), expectedRevision: view.revision, action }), signal: AbortSignal.timeout(requestTimeoutMs) });
  if (!response.ok) throw new Error(await responseMessage(response, "The action could not be saved. Your existing case is still available; try again."));
  return readView(response);
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

function ConveyorSketch() {
  return <svg className="arm-sketch" viewBox="0 0 500 280" role="img" aria-label="Conveyor visualization: indexing station">
    <rect x="46" y="148" width="408" height="42" rx="8" className="arm-base" />
    {[78, 150, 222, 294, 366].map((x) => <circle key={x} cx={x} cy="208" r="14" className="joint" />)}
    {[102, 198, 294, 390].map((x) => <rect key={x} x={x} y="120" width="48" height="26" rx="3" className="key" />)}
    <path d="M112 88H366" className="tool-link" /><path d="M352 76L370 88L352 100" className="tool-link" />
    <text x="48" y="58" className="svg-label">ENCODER / INDEX STATION</text><text x="48" y="246" className="svg-small">BELT DRIVE</text><text x="352" y="114" className="svg-small">PHOTOEYE</text>
  </svg>;
}

function App() {
  const startRequest = useRef<Promise<void> | null>(null);
  const initialStartRequested = useRef(false);
  const stageRailRef = useRef<HTMLElement>(null);
  const previousStageIndex = useRef(0);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [tutorPending, setTutorPending] = useState(false);
  const [tutorDismissed, setTutorDismissed] = useState(false);
  const [selectedProbe, setSelectedProbe] = useState<string>("P1");
  const [predictions, setPredictions] = useState<Record<string, string>>({ H1: "", H2: "", H3: "", H4: "" });
  const [justification, setJustification] = useState("");
  const [diagnosis, setDiagnosis] = useState<string>("H1");
  const [confidence, setConfidence] = useState(3);
  const [claims, setClaims] = useState<Record<string, Claim>>({ H1: { hypothesisId: "H1", stance: "supports", evidenceIds: [] }, H2: { hypothesisId: "H2", stance: "rules_out", evidenceIds: [] }, H3: { hypothesisId: "H3", stance: "rules_out", evidenceIds: [] }, H4: { hypothesisId: "H4", stance: "rules_out", evidenceIds: [] } });
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [caseChoices, setCaseChoices] = useState<{ id: string; title: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("pin-9-refusal");
  const [history, setHistory] = useState<{ id: string; title: string; status: string; createdAt: string }[]>([]);
  const resetCaseInputs = () => {
    setSelectedProbe("");
    setPredictions({});
    setJustification("");
    setDiagnosis("");
    setConfidence(3);
    setClaims({ H1: { hypothesisId: "H1", stance: "supports", evidenceIds: [] }, H2: { hypothesisId: "H2", stance: "rules_out", evidenceIds: [] }, H3: { hypothesisId: "H3", stance: "rules_out", evidenceIds: [] }, H4: { hypothesisId: "H4", stance: "rules_out", evidenceIds: [] } });
    setSelectedEvidenceId(null);
    setError("");
  };
  const start = (caseId = selectedCaseId) => {
    if (startRequest.current) return startRequest.current;
    resetCaseInputs();
    const request = (async () => { try { const response = await fetch("/api/episodes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId }), signal: AbortSignal.timeout(requestTimeoutMs) }); if (!response.ok) throw new Error(await responseMessage(response, "The practice case could not start. Check that the TwinSleuth practice service is running, then try again.")); const started = await readView(response); setSelectedCaseId(started.caseId); setSelectedProbe(started.public.probes[0]!.id); setPredictions(Object.fromEntries(started.public.hypotheses.map(({ id }) => [id, ""]))); setDiagnosis(started.public.hypotheses[0]!.id); setClaims(Object.fromEntries(started.public.hypotheses.map((item, index) => [item.id, { hypothesisId: item.id, stance: index === 0 ? "supports" : "rules_out", evidenceIds: [] }]))); setView(started); } catch (e) { const message = (e as Error).message; setError(message === "Failed to fetch" || (e as Error).name === "TimeoutError" ? "TwinSleuth could not reach the practice service in time. No case was created; try again." : message); } finally { startRequest.current = null; } })();
    startRequest.current = request;
    return request;
  };
  useEffect(() => {
    void fetch("/api/cases").then((response) => response.json()).then((entries: unknown) => {
      const parsed = z.array(z.object({ id: z.string(), title: z.string() })).safeParse(entries);
      if (parsed.success) setCaseChoices(parsed.data);
    }).catch(() => undefined);
    if (initialStartRequested.current) return;
    initialStartRequested.current = true;
    void start();
  }, []);
  const refreshHistory = () => void fetch("/api/episodes").then((response) => response.json()).then((entries: unknown) => {
    const parsed = z.array(z.object({ id: z.string(), title: z.string(), status: z.string(), createdAt: z.string() })).safeParse(entries);
    if (parsed.success) setHistory(parsed.data);
  }).catch(() => undefined);
  useEffect(() => { refreshHistory(); }, [view?.id, view?.revision]);
  useEffect(() => { setTutorDismissed(false); }, [view?.id, view?.revision]);
  useEffect(() => {
    if (!view || !view.pendingAgents?.length) return;
    let stopped = false;
    let timer: number | undefined;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/episodes/${view.id}`);
        if (response.ok) {
          const latest = await readView(response);
          if (!stopped) setView((current) => {
            if (!current || current.id !== latest.id || latest.revision > current.revision) return latest;
            if (latest.revision === current.revision && (latest.traces.length > current.traces.length || JSON.stringify(latest.pendingAgents) !== JSON.stringify(current.pendingAgents))) return { ...current, traces: latest.traces, pendingAgents: latest.pendingAgents ?? [] };
            return current;
          });
        }
      } catch {
        if (!stopped) setError("Examiner feedback could not be refreshed. Your scored case is saved; try refreshing the page.");
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
  const possible = Object.fromEntries(view.public.hypotheses.map(({ id }) => [id, view.beliefs.includes(id)]));
  const act = async (action: Action) => {
    if (actionPending) return;
    try { setActionPending(true); setError(""); setView(await post(view.id, view, action)); }
    catch (e) {
      const message = (e as Error).message;
      if (message === "Episode revision is stale.") {
        try {
          const response = await fetch(`/api/episodes/${view.id}`, { signal: AbortSignal.timeout(requestTimeoutMs) });
          if (!response.ok) throw new Error("refresh failed");
          setView(await readView(response));
          setError("This case changed in another tab. The latest state is loaded; retry your action.");
        } catch {
          setError("This case changed in another tab. Refresh the page before retrying.");
        }
      } else setError((e as Error).name === "TimeoutError" ? "The action timed out. Your existing case may still be valid; refresh before retrying." : message);
    }
    finally { setActionPending(false); }
  };
  const submitProposal = () => void act({ type: "propose", probeId: selectedProbe, predictions });
  const learnSkill = async () => {
    if (tutorPending) return;
    try {
      setTutorPending(true);
      setError("");
      const response = await fetch(`/api/episodes/${view.id}/tutor`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(requestTimeoutMs) });
      if (!response.ok) throw new Error(await responseMessage(response, "The AI tutor could not prepare a lesson. Your case is unchanged."));
      setView(await readView(response));
    } catch (e) {
      setError((e as Error).name === "TimeoutError" ? "The AI tutor took too long. Your case is unchanged; try again." : (e as Error).message);
    } finally { setTutorPending(false); }
  };
  const reviseForecast = () => {
    if (selectedProbe === "P1") {
      setSelectedProbe("P3");
      setPredictions({ H1: "", H2: "", H3: "", H4: "" });
    }
    void act({ type: "skeptic-decision", decision: "revise" });
  };
  const replay = () => {
    setView(null);
    void start(view.caseId);
    window.history.replaceState(null, "", "#top");
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const lock = () => void act({ type: "lock", diagnosis, confidence, justification, claims: Object.values(claims) });
  const updateClaim = (id: string, patch: Partial<Claim>) => setClaims((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));
  const armState = view.observations.length ? (view.observations.at(-1)?.probeId === "P4" ? (view.observations.at(-1)?.outcomeId === "stopped-at-95" ? "j2-stopped-95" : "j2-full-range") : view.observations.at(-1)?.probeId === "P3" ? (view.observations.at(-1)?.outcomeId === "completed" ? "p3-key-3-completed" : "p3-key-3-refused") : "initial-refusal") : "initial-refusal";
  const stageGuidance = view.status === "evaluated"
    ? "Your diagnosis has been scored. Review the evidence and debrief."
    : view.pendingAgents?.length
      ? "Reviewing whether this test can separate the remaining causes."
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
        <h1>{view.title}</h1>
        <p className="deck">A simulated practice case. Build a testable explanation from the evidence.</p>
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
        <div className="panel-heading"><h2 id="scene-title">{view.caseId === "pin-9-refusal" ? "Stationary arm" : "Conveyor station"}</h2><span className="signal-status">Controller response</span></div>
        <div className="machine-figure">{view.caseId === "pin-9-refusal" ? <ArmSketch state={armState}/> : <ConveyorSketch/>}<span className="figure-caption">{view.caseId === "pin-9-refusal" ? "PIN-9 · three-axis service cell" : "Indexing conveyor · training cell"}</span></div>
        <div className="alarm-line"><span className="alarm-beacon" aria-hidden="true"/><div><b>{view.public.symptom.controllerCode}</b><span>{view.public.symptom.message}</span></div></div>
        <dl className="scene-facts"><div><dt>Command</dt><dd>{view.public.symptom.task}</dd></div><div><dt>Emergency stop</dt><dd><span className="state-live">●</span> {view.public.symptom.estop || "Clear"}</dd></div></dl>
        <details className="maintenance"><summary>Maintenance notes <span aria-hidden="true">+</span></summary><ul>{view.public.maintenanceLog.map((note) => <li key={note}>{note}</li>)}</ul></details>
        <blockquote><span>Operator handoff</span>“{view.public.colleagueNote}”</blockquote>
        <button className="unsafe" disabled={actionPending} onClick={() => void act({ type: "unsafe" })}><span>Log unsafe suggestion<small>{view.public.unsafeAction.label}</small></span></button>
      </section>

      <section className="panel worklist" id="test-bench" data-testid="beliefs-probes-panel" aria-labelledby="hypothesis-title">
        <div className="panel-heading"><h2 id="hypothesis-title">Possible causes</h2><span className="count-mark">{Object.values(possible).filter(Boolean).length} of {view.public.hypotheses.length}</span></div>
        <div className="hypotheses">{view.public.hypotheses.map((hypothesis) => <label className={`hypothesis ${possible[hypothesis.id] ? "selected" : ""}`} key={hypothesis.id}>
          <input type="checkbox" disabled={actionPending} aria-label={`Keep ${hypothesis.id} possible: ${hypothesis.title}`} checked={possible[hypothesis.id]} onChange={(event) => { const next = { ...possible, [hypothesis.id]: event.target.checked }; void act({ type: "beliefs", possibleHypotheses: Object.entries(next).filter(([, value]) => value).map(([id]) => id) }); }}/>
          <span className="hypothesis-id">{hypothesis.id}</span><span className="hypothesis-copy"><b>{hypothesis.title}</b><small>{hypothesis.detail}</small></span>
        </label>)}</div>
        <div className="probe-heading"><h3>Choose a diagnostic test</h3><span>{view.public.probes.length} tests · select one</span></div>
        <div className="probe-list">{view.public.probes.map((candidate) => <button aria-pressed={selectedProbe === candidate.id} disabled={Boolean(view.skeptic)} className={`probe ${selectedProbe === candidate.id ? "active" : ""}`} key={candidate.id} onClick={() => { setSelectedProbe(candidate.id); setPredictions(view.proposals[candidate.id] ?? Object.fromEntries(view.public.hypotheses.map(({ id }) => [id, ""]))); }}>
          <span className="probe-id">{candidate.id}</span><span className="probe-name">{candidate.title}</span><span className="probe-cost">{candidate.costMinutes}<small>min</small></span>
        </button>)}</div>
      </section>

      <section className="panel prediction" data-testid="prediction-panel" aria-labelledby="forecast-title">
        <div className="panel-heading forecast-heading"><div><h2 id="forecast-title">Predict {probe?.id}'s result</h2></div><span className="forecast-cost">{probe?.costMinutes} min</span></div>
        <p className="probe-description">{probe?.description}</p>
        <div className="forecast-matrix"><div className="matrix-head"><span>Cause</span><span>Expected result before the test</span></div>{view.public.hypotheses.map((hypothesis) => <label className="prediction-row" key={hypothesis.id}><b>{hypothesis.id}</b><select aria-label={`Prediction for ${hypothesis.id}`} value={predictions[hypothesis.id]} disabled={Boolean(view.proposals[selectedProbe])} onChange={(event) => setPredictions((current) => ({ ...current, [hypothesis.id]: event.target.value }))}><option value="">Choose an outcome</option>{probe?.outcomes.map((outcome) => <option key={outcome} value={outcome}>{outcomeLabels[outcome] ?? outcome}</option>)}</select></label>)}</div>
        <div className="prediction-actions"><button className="commit" disabled={actionPending || view.public.hypotheses.some(({ id }) => !predictions[id])} onClick={submitProposal}>Commit prediction table</button></div>
        {view.skeptic && <div className="skeptic" role="status"><div className="skeptic-heading"><div><b>Skeptic check · {view.skeptic.probeId}</b><small>Review what this test can distinguish</small></div></div><p>{skepticRationale}</p><p className="forecast-lock-note">Your prediction is saved. Choose whether to switch tests or run this one.</p><details><summary>How to read this check</summary><p>Compare the predictions for the causes named above. If they match, this test will not tell those causes apart.</p></details><div className="skeptic-actions"><button className="revise" onClick={reviseForecast}>{selectedProbe === "P1" ? "Try P3 instead" : "Choose another test"}</button><button className="run-anyway" onClick={() => void act({ type: "skeptic-decision", decision: "run-anyway" })}>Run {selectedProbe} anyway</button></div></div>}
        {view.tutor && !tutorDismissed && <aside className="ai-tutor" aria-label="AI tutor"><header className="ai-tutor-heading"><div><span className="tutor-eyebrow">Targeted coaching</span><b>AI Tutor</b><small>{view.tutor.skill.replaceAll("_", " ")}</small></div><button className="tutor-close" aria-label="Dismiss AI tutor" onClick={() => setTutorDismissed(true)}>×</button></header>{view.tutor.trace ? <div className="tutor-content" aria-live="polite"><span className={`tutor-source ${view.tutor.trace.status}`}>{view.tutor.trace.status === "model" ? "AI-selected lesson" : "Guided fallback"}</span><section className="tutor-lesson" aria-label="Tutor lesson"><span>One idea for this decision</span><p>{view.tutor.trace.lesson}</p></section><section className="tutor-reflection" aria-label="Reflection prompt"><span>Reflection prompt</span><p>{view.tutor.trace.reflection}</p></section><p className="tutor-boundary">This coaching does not alter your evidence, case, or score.</p></div> : <div className="tutor-invite"><p>Get a short lesson about choosing tests that can separate the remaining causes.</p><button className="learn" disabled={tutorPending} onClick={() => void learnSkill()}>{tutorPending ? "Preparing lesson…" : "Open tutoring note"}</button><small>Optional coaching. Your investigation stays unchanged.</small></div>}</aside>}
        {view.proposals[selectedProbe] && !view.skeptic && (selectedProbeObservation
          ? <div className="run-ready"><span><i aria-hidden="true"/> This probe has already run</span><a className="review-observation" href="#evidence" onClick={() => setSelectedEvidenceId(selectedProbeObservation.evidenceId)}>Review its observation in the evidence ledger</a></div>
          : <div className="run-ready"><span><i aria-hidden="true"/> Prediction saved</span><button className="run" disabled={actionPending} onClick={() => void act({ type: "run", probeId: selectedProbe })}>Run {selectedProbe}<span>Reveal the result</span></button></div>)}
        <aside className="forecast-method"><b>Choose a result that can separate causes.</b><p>If every cause predicts the same outcome, this probe cannot narrow the list. Compare your rows before committing.</p></aside>
      </section>

      <section className="panel evidence" id="evidence" aria-labelledby="evidence-title">
        <div className="panel-heading"><h2 id="evidence-title">Evidence ledger</h2><span className="count-mark">{view.observations.length} {view.observations.length === 1 ? "result" : "results"}</span></div>
        {view.observations.length === 0 ? <div className="empty-ledger"><div><b>Waiting for the first test</b><p>Model predictions stay hidden until a test runs. Results will appear here.</p></div></div> : <>
          <div className="evidence-rail" role="list" aria-label="Probe observation selector">{view.observations.map((observation, index) => <button role="listitem" key={observation.evidenceId} className={`evidence-segment ${activeObservation?.evidenceId === observation.evidenceId ? "active" : ""}`} aria-pressed={activeObservation?.evidenceId === observation.evidenceId} onClick={() => setSelectedEvidenceId(observation.evidenceId)}>
            <span className="evidence-segment-mark" aria-hidden="true">{index + 1}</span><span><b>{observation.probeId}</b><small>{outcomeLabels[observation.outcomeId] ?? observation.outcomeId}</small></span>
          </button>)}</div>
          {activeObservation && <article className="evidence-detail" aria-live="polite"><header><span className="evidence-id">Evidence {activeObservation.evidenceId.slice(0, 8)}</span><strong>{activeObservation.probeId} · {outcomeLabels[activeObservation.outcomeId] ?? activeObservation.outcomeId}</strong></header>
            <div className="evidence-comparison"><div><span>Model's expected result</span><p><b>MODEL PREDICTED:</b> {Object.entries(view.revealedForecasts[activeObservation.probeId] ?? {}).map(([id, value]) => `${id} ${outcomeLabels[value] ?? value}`).join(" · ")}</p></div><div><span>Your prediction</span><p><b>YOUR PREDICTION:</b> {Object.entries(view.proposals[activeObservation.probeId] ?? {}).map(([id, value]) => `${id} ${outcomeLabels[value] ?? value}`).join(" · ")}</p></div></div>
          </article>}
        </>}
      </section>

      {view.status === "active" && <details className="panel diagnosis" id="diagnosis" aria-labelledby="diagnosis-title" open={view.observations.length > 0}>
        <summary className="diagnosis-summary"><h2 id="diagnosis-title">Defend your diagnosis</h2><span className="diagnosis-summary-note">{view.observations.length ? "Use the observations to support each claim" : "Open when you are ready to commit"}</span></summary>
        <div className="diagnosis-body"><div className="diagnosis-form"><label>Most likely cause<select value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)}>{view.public.hypotheses.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></label><label>Confidence<input type="number" min="1" max="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}/><small>1 = tentative · 5 = certain</small></label><label className="justification">Justification<textarea value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Which observations support this cause? What rules out the alternatives?"/></label></div>
          <div className="claims"><h3>Evidence claims</h3>{view.public.hypotheses.map((item) => <fieldset key={item.id}><legend><b>{item.id}</b> · {item.title}</legend><select aria-label={`Stance for ${item.id} claim`} value={claims[item.id]!.stance} onChange={(event) => updateClaim(item.id, { stance: event.target.value as Claim["stance"] })}><option value="supports">Supports</option><option value="rules_out">Rules out</option></select><select aria-label={`Evidence for ${item.id}`} value={claims[item.id]!.evidenceIds[0] ?? ""} onChange={(event) => updateClaim(item.id, { evidenceIds: event.target.value ? [event.target.value] : [] })}><option value="">Cite an observation</option>{view.observations.map((entry) => <option key={entry.evidenceId} value={entry.evidenceId}>{entry.probeId} · {outcomeLabels[entry.outcomeId] ?? entry.outcomeId}</option>)}</select></fieldset>)}</div>
          <button className="lock" disabled={actionPending || !justification} onClick={lock}>Lock diagnosis and score</button>
        </div>
      </details>}

      {view.status === "evaluated" && view.score && <section className="panel debrief" id="diagnosis" aria-labelledby="debrief-title">
        <div className="debrief-header"><div><h2 id="debrief-title">Case evaluated</h2><p>{view.diagnosis?.diagnosis} was {view.score.evidenceSupportedHypotheses.includes(view.diagnosis?.diagnosis ?? "H1") ? "supported by the evidence" : "not supported"}</p></div><div className="score-hero"><strong>{view.score.total}</strong><span>/ 100 points</span></div></div>
        <div className="rubric">{[["Diagnosis", view.score.diagnosis], ["Evidence sufficiency", view.score.evidenceSufficiency], ["Prediction accuracy", view.score.predictionAccuracy], ["Probe quality", view.score.probeQuality], ["Evidence claims", view.score.reasoning]].map(([label, points]) => <div key={label as string}><span>{label}</span><b>{points}</b></div>)}</div>
        <p className="assessment-note">Evidence claims points reflect structured citation checks. Written justification and confidence are recorded, not scored. This practice score does not establish independent competence.</p>
        <p className="path-cost">Path cost <b>{view.score.actualCostMinutes} min</b><span>Best policy branch {view.score.bestPolicyBranchCostMinutes} min</span></p>
        {view.debrief && <section className="deterministic-lessons" aria-label="Deterministic investigation lessons"><h3>What the evidence changed</h3>{view.debrief.probeLessons.map((lesson) => <p key={lesson.probeId}><b>{lesson.probeId}</b> · {lesson.lesson} Remaining: {lesson.remaining.join(", ") || "none"}.</p>)}{view.debrief.betterNextProbe && <p><b>Better first test:</b> {view.debrief.betterNextProbe} was the solver's first separating test for this case.</p>}<p><b>Transferable lesson:</b> {view.debrief.pathLesson}</p></section>}
        <div className="timelines"><div><h3>Learner beliefs</h3>{view.beliefTimeline.map((entry) => <p key={entry.revision}>Step {entry.revision}: {entry.beliefs.join(", ")}</p>)}</div><div><h3>Evidence-supported causes</h3>{view.evidenceTimeline.map((entry) => <p key={entry.evidenceId}>{entry.evidenceId.slice(0, 8)}: {entry.supported.join(", ") || "none"}</p>)}</div></div>
        <h3>Checked evidence claims</h3><div className="claim-checks">{view.score.claimChecks.map((check) => <p key={check.hypothesisId}><b>{check.hypothesisId}</b><span>{check.stance}</span><em className={check.valid ? "claim-valid" : "claim-invalid"}>{check.valid ? "Supported" : "Needs revision"}</em><span>{check.reason}</span></p>)}</div>
        <details className="forecast-archive"><summary>Observed probe forecast archive</summary>{view.forecastTable && Object.entries(view.forecastTable).map(([probeId, row]) => <p key={probeId}><b>{probeId}</b> · {Object.entries(row).map(([id, outcome]) => `${id}: ${outcomeLabels[outcome] ?? outcome}`).join(" · ")}</p>)}</details>
        <div className="examiner-note"><h3>Examiner notes</h3>{view.traces.filter((trace) => trace.graph === "examiner").slice(-1).map((trace) => <p key={trace.inputSummary}>{trace.output}</p>)}{view.pendingAgents?.includes("examiner") && <p role="status">Examiner feedback is still being prepared.</p>}</div>
        <details className="agent-trace"><summary>Agent trace</summary>{view.traces.map((trace, index) => <pre key={`${trace.graph}-${trace.inputSummary}-${index}`}>{trace.graph} · {trace.status} · {trace.output}</pre>)}</details>
        <div className="truth-reveal"><h3>Truth revealed</h3><span>Server-selected fault</span><strong>{view.truthHypothesis ?? "Revealed after evaluation"}</strong><p>The evidence ledger and checked claims determine the score.</p></div>
        <button className="replay" onClick={replay}>Start a fresh episode</button>
      </section>}
    </div>
    <section className="local-tools" aria-label="Practice controls"><label className="case-switch">Practice case<select value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}>{caseChoices.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button onClick={() => void start()} disabled={actionPending}>Start selected case</button></label><details className="history-panel"><summary>Your episode history ({history.length})</summary><p>Episodes are stored by the practice service and linked to this browser’s private session cookie. Clearing that cookie removes access to this history. Exports contain your learner-visible episode and event timeline.</p><button onClick={refreshHistory}>Refresh history</button>{history.map((episode) => <div className="history-row" key={episode.id}><span><b>{episode.title}</b> · {episode.status}</span><a href={`/api/episodes/${episode.id}/export`} download={`twinsleuth-${episode.id}.json`}>Export JSON</a><button onClick={() => void fetch(`/api/episodes/${episode.id}`, { method: "DELETE" }).then(() => refreshHistory())}>Delete</button></div>)}</details></section>
    <footer className="workspace-footer"><span>Training simulation · No physical equipment is connected</span><span>Model predictions stay hidden until a test runs</span></footer>
    {error && <div className="toast error" role="alert">{error}</div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);
