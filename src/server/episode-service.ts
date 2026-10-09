import Database from "better-sqlite3";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { CASE_ID, COLLEAGUE_NOTE, DIAGNOSTIC_BUDGET_MINUTES, HYPOTHESES, INITIAL_SYMPTOM, MAINTENANCE_LOG, PROBES, UNSAFE_ACTION } from "../case/catalog.js";
import type { HypothesisId, ProbeId, OutcomeId } from "../case/catalog.js";
import { consistentHypotheses, detectSkepticTriggers, validatePredictions } from "../engine/diagnostics.js";
import { gradeEpisode } from "../engine/score.js";
import type { ArgumentClaim, Observation, PredictionSet } from "../engine/model.js";
import { PIN9_MODEL } from "./case-model/pin9.js";
import { runExaminer } from "./agents/examiner.js";
import { runSkeptic } from "./agents/skeptic.js";
import type { AgentTrace } from "./agents/types.js";
import { type Action, actionRequestSchema } from "./schemas.js";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function parseStoredObject(payload: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payload);
    const result = z.record(z.string(), z.unknown()).safeParse(parsed);
    if (!result.success) throw new Error("not an object");
    return result.data;
  } catch {
    throw new Error("Episode data is corrupted.");
  }
}

const persistedEventTypeSchema = z.enum([
  "EPISODE_STARTED", "BELIEFS_UPDATED", "PROBE_PROPOSED", "PROBE_REVISED", "PROBE_OBSERVED", "UNSAFE_REFUSED",
  "SKEPTIC_CHALLENGED", "SKEPTIC_RESOLVED", "DIAGNOSIS_LOCKED", "EVALUATED", "AGENT_RUN", "TRUTH_REVEALED", "FORECAST_REVEALED",
]);
const persistedPublicViewSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  status: z.enum(["active", "evaluated"]),
}).passthrough();

function parseStoredEvent(type: string, payload: string): { type: z.infer<typeof persistedEventTypeSchema>; payload: Record<string, unknown> } {
  const eventType = persistedEventTypeSchema.safeParse(type);
  if (!eventType.success) throw new Error("Episode data is corrupted.");
  return { type: eventType.data, payload: parseStoredObject(payload) };
}

interface State {
  revision: number;
  beliefs: string[];
  proposals: Record<string, PredictionSet>;
  revisions: Record<string, PredictionSet>;
  observations: Observation[];
  unsafeAttempts: number;
  pendingProbe?: ProbeId;
  pendingChallenge?: { triggers: ReturnType<typeof detectSkepticTriggers>; probeId: ProbeId };
  diagnosis?: { diagnosis: HypothesisId; confidence: number; justification: string; claims: ArgumentClaim[] };
  score?: ReturnType<typeof gradeEpisode>;
  revealedTruth?: HypothesisId;
  traces: AgentTrace[];
  status: "active" | "evaluated";
  beliefTimeline: { revision: number; beliefs: HypothesisId[] }[];
}

export interface PublicView {
  id: string;
  caseId: string;
  title: string;
  revision: number;
  status: State["status"];
  beliefs: string[];
  proposals: Record<string, PredictionSet>;
  revisedPredictions: Record<string, PredictionSet>;
  observations: Observation[];
  remainingMinutes: number;
  budgetMinutes: number;
  pendingProbe?: ProbeId;
  skeptic?: { triggers: ReturnType<typeof detectSkepticTriggers>; question: string; probeId: ProbeId };
  diagnosis?: State["diagnosis"];
  score?: ReturnType<typeof gradeEpisode>;
  truthHypothesis?: HypothesisId;
  beliefTimeline: readonly { revision: number; beliefs: readonly HypothesisId[] }[];
  evidenceTimeline: readonly { evidenceId: string; supported: readonly HypothesisId[] }[];
  revealedForecasts: Partial<typeof PIN9_MODEL.forecasts>;
  forecastTable?: typeof PIN9_MODEL.forecasts;
  traces: AgentTrace[];
  pendingAgents: AgentTrace["graph"][];
  public: {
    hypotheses: typeof HYPOTHESES;
    probes: typeof PROBES;
    symptom: typeof INITIAL_SYMPTOM;
    maintenanceLog: typeof MAINTENANCE_LOG;
    colleagueNote: string;
    unsafeAction: typeof UNSAFE_ACTION;
  };
}

function initialState(): State {
  return { revision: 0, beliefs: HYPOTHESES.map(({ id }) => id), beliefTimeline: [], proposals: {}, revisions: {}, observations: [], unsafeAttempts: 0, traces: [], status: "active" };
}

export class EpisodeService {
  private readonly db: Database.Database;
  private readonly pendingAgents = new Map<string, Set<AgentTrace["graph"]>>();
  private static readonly MAX_ACTIONS_PER_EPISODE = 64;

  constructor(filename = ":memory:") {
    this.db = new Database(filename);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, status TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS episode_secrets (episode_id TEXT PRIMARY KEY, truth_hypothesis_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (episode_id TEXT NOT NULL, seq INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (episode_id, seq));
      CREATE TABLE IF NOT EXISTS actions (episode_id TEXT NOT NULL, action_id TEXT NOT NULL, request_hash TEXT NOT NULL, status TEXT NOT NULL, response_json TEXT NOT NULL, PRIMARY KEY (episode_id, action_id));
    `);
  }

  close(): void { this.db.close(); }

  start(truth?: "H1" | "H2" | "H3" | "H4"): PublicView {
    const id = randomUUID();
    const selected = truth ?? HYPOTHESES[Math.floor(Math.random() * HYPOTHESES.length)]!.id;
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO episodes VALUES (?, ?, ?, ?, ?)").run(id, CASE_ID, "active", 0, now);
      this.db.prepare("INSERT INTO episode_secrets VALUES (?, ?)").run(id, selected);
      this.append(id, "EPISODE_STARTED", {});
    });
    tx();
    return this.get(id);
  }

  get(id: string): PublicView {
    const episode = this.db.prepare("SELECT id, status, revision FROM episodes WHERE id = ?").get(id) as { id: string; status: State["status"]; revision: number } | undefined;
    if (!episode) throw new NotFoundError("Episode not found.");
    const state = this.fold(id);
    return this.publicView(id, state);
  }

  replay(id: string): unknown[] {
    const exists = this.db.prepare("SELECT 1 FROM episodes WHERE id = ?").get(id);
    if (!exists) throw new NotFoundError("Episode not found.");
    const state = this.fold(id);
    return this.db.prepare("SELECT seq, type, payload_json AS payload FROM events WHERE episode_id = ? ORDER BY seq").all(id).map((row) => {
      const event = row as { seq: number; type: string; payload: string };
      const stored = parseStoredEvent(event.type, event.payload);
      const payload = stored.payload;
      if (stored.type === "SKEPTIC_CHALLENGED" && state.status !== "evaluated") {
        const challenge = payload.challenge as { triggers?: { kind: string; hypothesisIds?: string[] }[]; probeId?: string } | undefined;
        if (challenge?.triggers) {
          payload.challenge = {
            ...challenge,
            triggers: challenge.triggers.map((trigger) => trigger.kind === "premature-elimination"
              ? { ...trigger, hypothesisIds: [] }
              : trigger),
          };
        }
      }
      if (stored.type === "TRUTH_REVEALED" && state.status !== "evaluated") return { seq: event.seq, type: stored.type, payload: {} };
      return { seq: event.seq, type: stored.type, payload };
    });
  }

  act(id: string, request: unknown): PublicView {
    const parsed = actionRequestSchema.parse(request);
    const actionHash = createHash("sha256").update(stableJson(parsed)).digest("hex");
    const tx = this.db.transaction(() => {
      const duplicate = this.db.prepare("SELECT request_hash, response_json FROM actions WHERE episode_id = ? AND action_id = ?").get(id, parsed.actionId) as { request_hash: string; response_json: string } | undefined;
      if (duplicate) {
        if (duplicate.request_hash !== actionHash) throw new ConflictError("Action ID was already used with different input.");
        const cached = persistedPublicViewSchema.safeParse(parseStoredObject(duplicate.response_json));
        if (!cached.success) throw new Error("Episode data is corrupted.");
        return cached.data as unknown as PublicView;
      }
      const current = this.get(id);
      if (parsed.expectedRevision !== current.revision) throw new ConflictError("Episode revision is stale.");
      const count = this.db.prepare("SELECT COUNT(*) AS count FROM actions WHERE episode_id = ?").get(id) as { count: number };
      if (count.count >= EpisodeService.MAX_ACTIONS_PER_EPISODE) throw new ConflictError("Episode action limit reached.");
      const state = this.fold(id);
      this.apply(id, state, parsed.action);
      const response = this.publicView(id, this.fold(id));
      this.db.prepare("INSERT INTO actions VALUES (?, ?, ?, ?, ?)").run(id, parsed.actionId, actionHash, "complete", JSON.stringify(response));
      return response;
    });
    return tx.immediate();
  }

  private fold(id: string): State {
    const state = initialState();
    const rows = this.db.prepare("SELECT type, payload_json FROM events WHERE episode_id = ? ORDER BY seq").all(id) as { type: string; payload_json: string }[];
    for (const row of rows) {
      const stored = parseStoredEvent(row.type, row.payload_json);
      const payload = stored.payload as Partial<State> & { trace?: AgentTrace; proposal?: { probeId: string; predictions: PredictionSet }; revision?: PredictionSet; observation?: Observation; challenge?: State["pendingChallenge"]; diagnosis?: State["diagnosis"]; score?: State["score"]; truth?: HypothesisId };
      if (stored.type === "BELIEFS_UPDATED" && payload.beliefs) {
        const beliefs = payload.beliefs as HypothesisId[];
        state.beliefs = beliefs;
        state.beliefTimeline.push({ revision: state.revision + 1, beliefs: [...beliefs] });
      }
      if (stored.type === "PROBE_PROPOSED" && payload.proposal) state.proposals[payload.proposal.probeId] = payload.proposal.predictions;
      if (stored.type === "PROBE_REVISED" && payload.proposal) {
        state.revisions[payload.proposal.probeId] = payload.proposal.predictions;
        state.proposals[payload.proposal.probeId] = payload.proposal.predictions;
      }
      if (stored.type === "PROBE_OBSERVED" && payload.observation) { state.observations.push(payload.observation); delete state.pendingProbe; delete state.pendingChallenge; }
      if (stored.type === "UNSAFE_REFUSED") state.unsafeAttempts += 1;
      if (stored.type === "SKEPTIC_CHALLENGED" && payload.challenge) state.pendingChallenge = payload.challenge;
      if (stored.type === "SKEPTIC_RESOLVED") delete state.pendingChallenge;
      if (stored.type === "DIAGNOSIS_LOCKED" && payload.diagnosis) state.diagnosis = payload.diagnosis;
      if (stored.type === "EVALUATED" && payload.score) { state.score = payload.score; state.status = "evaluated"; }
      if (stored.type === "AGENT_RUN" && payload.trace) state.traces.push(payload.trace);
      if (stored.type === "TRUTH_REVEALED" && payload.truth) state.revealedTruth = payload.truth;
      if (stored.type !== "AGENT_RUN") state.revision += 1;
    }
    return state;
  }

  private apply(id: string, state: State, action: Action): void {
    if (state.status === "evaluated") throw new ConflictError("Episode is already evaluated.");
    switch (action.type) {
      case "beliefs":
        this.append(id, "BELIEFS_UPDATED", { beliefs: [...new Set(action.possibleHypotheses)] });
        return;
      case "propose": {
        if (state.pendingChallenge) throw new ConflictError("Resolve the pending Skeptic challenge first.");
        const probeId = action.probeId as ProbeId;
        const predictions = action.predictions as PredictionSet;
        if (state.proposals[probeId]) throw new ConflictError(`Probe ${probeId} was already proposed.`);
        if (state.observations.some((observation) => observation.probeId === probeId)) throw new ConflictError(`Probe ${probeId} already ran.`);
        const issues = validatePredictions(probeId, predictions);
        if (issues.length) throw new ConflictError(issues.join(" "));
        this.append(id, "PROBE_PROPOSED", { proposal: { probeId, predictions } });
        const evidenceSupported = consistentHypotheses(PIN9_MODEL, state.observations);
        const triggers = detectSkepticTriggers({ possibleHypotheses: state.beliefs as HypothesisId[], evidenceSupportedHypotheses: evidenceSupported, predictions });
        if (triggers.length) {
          const challenge = { triggers, probeId };
          this.append(id, "SKEPTIC_CHALLENGED", { challenge });
          this.append(id, "AGENT_RUN", { trace: runSkeptic({ possibleHypotheses: state.beliefs as HypothesisId[], predictions, observations: state.observations, triggers }) });
        }
        return;
      }
      case "skeptic-decision":
        if (!state.pendingChallenge) throw new ConflictError("There is no pending Skeptic challenge.");
        if (action.predictions && stableJson(action.predictions) !== stableJson(state.proposals[state.pendingChallenge.probeId])) {
          const issues = validatePredictions(state.pendingChallenge.probeId, action.predictions);
          if (issues.length) throw new ConflictError(issues.join(" "));
          const predictions = action.predictions as PredictionSet;
          this.append(id, "PROBE_REVISED", { proposal: { probeId: state.pendingChallenge.probeId, predictions } });
          state.proposals[state.pendingChallenge.probeId] = predictions;
        }
        this.append(id, "SKEPTIC_RESOLVED", { decision: action.decision });
        return;
      case "run": {
        if (state.pendingChallenge) throw new ConflictError("Answer the Skeptic before running this probe.");
        if (!state.proposals[action.probeId]) throw new ConflictError("Commit predictions before running a probe.");
        if (state.observations.some((observation) => observation.probeId === action.probeId)) throw new ConflictError("A probe can run only once.");
        const spent = state.observations.reduce((sum, observation) => sum + PROBES.find((probe) => probe.id === observation.probeId)!.costMinutes, 0);
        const cost = PROBES.find((probe) => probe.id === action.probeId)!.costMinutes;
        if (spent + cost > DIAGNOSTIC_BUDGET_MINUTES) throw new ConflictError("This probe exceeds the maintenance-time budget.");
        const secret = this.db.prepare("SELECT truth_hypothesis_id FROM episode_secrets WHERE episode_id = ?").get(id) as { truth_hypothesis_id: "H1" | "H2" | "H3" | "H4" };
        const outcomeId = PIN9_MODEL.forecasts[action.probeId][secret.truth_hypothesis_id];
        const observation = { evidenceId: randomUUID(), probeId: action.probeId, outcomeId };
        this.append(id, "PROBE_OBSERVED", { observation });
        this.append(id, "FORECAST_REVEALED", { probeId: action.probeId });
        return;
      }
      case "unsafe":
        this.append(id, "UNSAFE_REFUSED", { actionId: UNSAFE_ACTION.id });
        return;
      case "lock": {
        if (action.claims.length !== HYPOTHESES.length || new Set(action.claims.map((claim) => claim.hypothesisId)).size !== HYPOTHESES.length) {
          throw new ConflictError("Submit exactly one structured claim for each cause.");
        }
        const diagnosis = { diagnosis: action.diagnosis as HypothesisId, confidence: action.confidence, justification: action.justification, claims: action.claims as ArgumentClaim[] };
        this.append(id, "DIAGNOSIS_LOCKED", { diagnosis });
        const secret = this.db.prepare("SELECT truth_hypothesis_id FROM episode_secrets WHERE episode_id = ?").get(id) as { truth_hypothesis_id: "H1" | "H2" | "H3" | "H4" };
        const next = this.fold(id);
        const score = gradeEpisode(PIN9_MODEL, { truth: secret.truth_hypothesis_id, diagnosis: action.diagnosis, probes: next.observations, predictionAttempts: Object.entries(next.proposals).map(([probeId, predictions]) => ({ probeId: probeId as ProbeId, predictions: predictions as PredictionSet })), claims: action.claims as ArgumentClaim[], unsafeAttempts: next.unsafeAttempts });
        this.append(id, "EVALUATED", { score });
        this.trackAgent(id, "examiner", () => this.recordExaminer(id, diagnosis, score.claimChecks));
        this.append(id, "TRUTH_REVEALED", { truth: secret.truth_hypothesis_id });
        return;
      }
    }
  }

  private append(id: string, type: string, payload: unknown): void {
    const write = () => {
      const row = this.db.prepare("SELECT COALESCE(MAX(seq), -1) AS seq FROM events WHERE episode_id = ?").get(id) as { seq: number };
      const seq = row.seq + 1;
      this.db.prepare("INSERT INTO events VALUES (?, ?, ?, ?, ?)").run(id, seq, type, JSON.stringify(payload), new Date().toISOString());
      if (type !== "AGENT_RUN") this.db.prepare("UPDATE episodes SET revision = ?, status = CASE WHEN ? = 'EVALUATED' THEN 'evaluated' ELSE status END WHERE id = ?").run(seq, type, id);
    };
    if (this.db.inTransaction) write();
    else this.db.transaction(write).immediate();
  }

  private publicView(id: string, state: State): PublicView {
    const skeptic = state.pendingChallenge ? {
      triggers: state.pendingChallenge.triggers.map((trigger) => trigger.kind === "premature-elimination"
        ? { ...trigger, hypothesisIds: [] }
        : trigger),
      question: [...state.traces].reverse().find((trace) => trace.graph === "skeptic")?.output ?? "What would this test eliminate?",
      probeId: state.pendingChallenge.probeId,
    } : undefined;
    const view: PublicView = {
      id, caseId: CASE_ID, title: "PIN-9 Refusal", revision: state.revision, status: state.status,
      beliefs: state.beliefs, proposals: state.proposals, revisedPredictions: state.revisions, observations: state.observations,
      remainingMinutes: DIAGNOSTIC_BUDGET_MINUTES - state.observations.reduce((sum, observation) => sum + PROBES.find((probe) => probe.id === observation.probeId)!.costMinutes, 0),
      budgetMinutes: DIAGNOSTIC_BUDGET_MINUTES, traces: state.traces,
      pendingAgents: [...(this.pendingAgents.get(id) ?? [])],
      public: { hypotheses: HYPOTHESES, probes: PROBES, symptom: INITIAL_SYMPTOM, maintenanceLog: MAINTENANCE_LOG, colleagueNote: COLLEAGUE_NOTE, unsafeAction: UNSAFE_ACTION },
      beliefTimeline: state.beliefTimeline,
      evidenceTimeline: state.observations.map((_, index) => ({
        evidenceId: state.observations[index]!.evidenceId,
        supported: state.status === "evaluated"
          ? consistentHypotheses(PIN9_MODEL, state.observations.slice(0, index + 1))
          : [],
      })),
      revealedForecasts: Object.fromEntries(state.observations.map((observation) => [observation.probeId, PIN9_MODEL.forecasts[observation.probeId]])),
    };
    if (state.pendingChallenge) {
      view.pendingProbe = state.pendingChallenge.probeId;
      if (skeptic) view.skeptic = skeptic;
    }
    if (state.diagnosis) view.diagnosis = state.diagnosis;
    if (state.score) view.score = state.score;
    if (state.revealedTruth) view.truthHypothesis = state.revealedTruth;
    if (state.status === "evaluated") view.forecastTable = PIN9_MODEL.forecasts;
    return view;
  }

  private async recordExaminer(id: string, diagnosis: State["diagnosis"], claimChecks: ReturnType<typeof gradeEpisode>["claimChecks"]): Promise<void> {
    if (!diagnosis) return;
    const valid = claimChecks.filter((claim) => claim.valid).length;
    const inputSummary = `${diagnosis.diagnosis}|${valid}/${claimChecks.length}`;
    let trace;
    try {
      trace = await runExaminer({ diagnosis: diagnosis.diagnosis, justification: diagnosis.justification, claims: diagnosis.claims, claimChecks });
    } catch {
      trace = {
        graph: "examiner" as const,
        status: "fallback" as const,
        inputSummary,
        output: `${valid} of ${claimChecks.length} evidence claims checked. Use the cited observations to explain why ${diagnosis.diagnosis} remains supported and alternatives are ruled out.`,
      };
    }
    this.append(id, "AGENT_RUN", { trace });
  }

  private trackAgent(id: string, graph: AgentTrace["graph"], run: () => Promise<void>): void {
    const pending = this.pendingAgents.get(id) ?? new Set<AgentTrace["graph"]>();
    pending.add(graph);
    this.pendingAgents.set(id, pending);
    void Promise.resolve().then(run).catch(() => undefined).finally(() => {
      pending.delete(graph);
      if (pending.size === 0) this.pendingAgents.delete(id);
    });
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
}
