import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { PublicCase } from "../case/catalog.js";
import { consistentHypotheses, detectSkepticTriggers, validatePredictions, separates } from "../engine/diagnostics.js";
import { gradeEpisode } from "../engine/score.js";
import { optimalPolicy } from "../engine/optimal-policy.js";
import type { ArgumentClaim, Observation, PredictionSet, DiagnosticModel } from "../engine/model.js";
import { CASES, getCase } from "./case-model/registry.js";
import type { CaseDefinition } from "./case-model/registry.js";
import { runExaminer } from "./agents/examiner.js";
import { runSkeptic } from "./agents/skeptic.js";
import type { AgentTrace } from "./agents/types.js";
import { SqliteStore, type EpisodeStore, type SqlExecutor } from "./store.js";
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

type Trigger = ReturnType<typeof detectSkepticTriggers>[number];

/** Evidence-consistent cause IDs are derived state; keep them out of every learner-visible surface. */
function redactTrigger(trigger: Trigger): Trigger {
  return trigger.kind === "premature-elimination" ? { ...trigger, hypothesisIds: [] } : trigger;
}

interface State {
  revision: number;
  beliefs: string[];
  proposals: Record<string, PredictionSet>;
  firstPredictions: Record<string, PredictionSet>;
  revisions: Record<string, PredictionSet>;
  observations: Observation[];
  unsafeAttempts: number;
  pendingProbe?: string;
  pendingChallenge?: { triggers: ReturnType<typeof detectSkepticTriggers>; probeId: string };
  diagnosis?: { diagnosis: string; confidence: number; justification: string; claims: ArgumentClaim[] };
  score?: ReturnType<typeof gradeEpisode>;
  revealedTruth?: string;
  traces: AgentTrace[];
  status: "active" | "evaluated";
  beliefTimeline: { revision: number; beliefs: string[] }[];
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
  pendingProbe?: string;
  skeptic?: { triggers: ReturnType<typeof detectSkepticTriggers>; question: string; probeId: string };
  diagnosis?: State["diagnosis"];
  score?: ReturnType<typeof gradeEpisode>;
  truthHypothesis?: string;
  beliefTimeline: readonly { revision: number; beliefs: readonly string[] }[];
  evidenceTimeline: readonly { evidenceId: string; supported: readonly string[] }[];
  revealedForecasts: Record<string, Record<string, string>>;
  forecastTable?: Record<string, Record<string, string>>;
  traces: AgentTrace[];
  pendingAgents: AgentTrace["graph"][];
  debrief?: { probeLessons: readonly { probeId: string; informative: boolean; remaining: readonly string[]; lesson: string }[]; betterNextProbe?: string; pathLesson: string };
  public: {
    hypotheses: PublicCase["hypotheses"];
    probes: PublicCase["probes"];
    symptom: PublicCase["symptom"];
    maintenanceLog: PublicCase["maintenanceLog"];
    colleagueNote: string;
    unsafeAction: PublicCase["unsafeAction"];
  };
}

function initialState(model: DiagnosticModel): State {
  return { revision: 0, beliefs: model.hypotheses.map(({ id }) => id), beliefTimeline: [], proposals: {}, firstPredictions: {}, revisions: {}, observations: [], unsafeAttempts: 0, traces: [], status: "active" };
}

export class EpisodeService {
  private readonly db: EpisodeStore;
  private readonly pendingAgents = new Map<string, Set<AgentTrace["graph"]>>();
  private static readonly MAX_ACTIONS_PER_EPISODE = 64;

  constructor(store: EpisodeStore | string = ":memory:") {
    this.db = typeof store === "string" ? new SqliteStore(store) : store;
  }

  close(): void { this.db.close(); }

  async list(): Promise<readonly { id: string; caseId: string; title: string; status: State["status"]; revision: number; createdAt: string }[]> {
    return (await this.db.all<{ id: string; case_id: string; status: State["status"]; revision: number; created_at: string }>("SELECT id, case_id, status, revision, created_at FROM episodes ORDER BY created_at DESC"))
      .flatMap((row) => {
        const definition = getCase(row.case_id);
        return definition ? [{ id: row.id, caseId: row.case_id, title: definition.public.title, status: row.status, revision: row.revision, createdAt: row.created_at }] : [];
      });
  }

  async export(id: string): Promise<{ format: "twinsleuth-local-episode-v1"; episode: PublicView; events: unknown[] }> {
    return { format: "twinsleuth-local-episode-v1", episode: await this.get(id), events: await this.replay(id) };
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const found = await tx.get("SELECT 1 FROM episodes WHERE id = ? FOR UPDATE", id);
      if (!found) throw new NotFoundError("Episode not found.");
      await tx.run("DELETE FROM actions WHERE episode_id = ?", id);
      await tx.run("DELETE FROM events WHERE episode_id = ?", id);
      await tx.run("DELETE FROM episode_secrets WHERE episode_id = ?", id);
      await tx.run("DELETE FROM episodes WHERE id = ?", id);
    });
  }

  async start(caseIdOrTruth = CASES[0]!.public.id, truth?: string): Promise<PublicView> {
    // Preserve the original test/demo convenience: start("H1") selects PIN-9 truth.
    const legacyTruth = !getCase(caseIdOrTruth) && CASES[0]!.model.hypotheses.some(({ id }) => id === caseIdOrTruth);
    const caseId = legacyTruth ? CASES[0]!.public.id : caseIdOrTruth;
    truth = truth ?? (legacyTruth ? caseIdOrTruth : undefined);
    const definition = getCase(caseId);
    if (!definition) throw new ConflictError("Unknown practice case.");
    const id = randomUUID();
    if (truth && !definition.model.hypotheses.some(({ id }) => id === truth)) throw new ConflictError("Invalid demo truth.");
    const selected = truth ?? definition.model.hypotheses[Math.floor(Math.random() * definition.model.hypotheses.length)]!.id;
    const now = new Date().toISOString();
    await this.db.transaction(async (tx) => {
      await tx.run("INSERT INTO episodes VALUES (?, ?, ?, ?, ?)", id, definition.public.id, "active", 0, now);
      await tx.run("INSERT INTO episode_secrets VALUES (?, ?)", id, selected);
      await this.append(id, "EPISODE_STARTED", {}, tx);
    });
    return this.get(id);
  }

  async get(id: string): Promise<PublicView> {
    return this.getWith(id, this.db);
  }

  private async getWith(id: string, executor: SqlExecutor): Promise<PublicView> {
    const episode = await executor.get<{ id: string; case_id: string; status: State["status"]; revision: number }>("SELECT id, case_id, status, revision FROM episodes WHERE id = ?", id);
    if (!episode) throw new NotFoundError("Episode not found.");
    const definition = getCase(episode.case_id);
    if (!definition) throw new Error("Episode data is corrupted.");
    const state = await this.fold(id, definition.model, executor);
    return this.publicView(id, state, definition);
  }

  async replay(id: string): Promise<unknown[]> {
    const exists = await this.db.get("SELECT 1 FROM episodes WHERE id = ?", id);
    if (!exists) throw new NotFoundError("Episode not found.");
    const episode = await this.db.get<{ case_id: string }>("SELECT case_id FROM episodes WHERE id = ?", id);
    if (!episode) throw new Error("Episode data is corrupted.");
    const definition = getCase(episode.case_id);
    if (!definition) throw new Error("Episode data is corrupted.");
    const state = await this.fold(id, definition.model, this.db);
    return (await this.db.all<{ seq: number; type: string; payload: string }>("SELECT seq, type, payload_json AS payload FROM events WHERE episode_id = ? ORDER BY seq", id)).map((event) => {
      const stored = parseStoredEvent(event.type, event.payload);
      const payload = stored.payload;
      if (stored.type === "SKEPTIC_CHALLENGED" && state.status !== "evaluated") {
        const challenge = payload.challenge as { triggers?: { kind: string; hypothesisIds?: string[] }[]; probeId?: string } | undefined;
        if (challenge?.triggers) {
          payload.challenge = {
            ...challenge,
            triggers: (challenge.triggers as Trigger[]).map(redactTrigger),
          };
        }
      }
      if (stored.type === "TRUTH_REVEALED" && state.status !== "evaluated") return { seq: event.seq, type: stored.type, payload: {} };
      return { seq: event.seq, type: stored.type, payload };
    });
  }

  async act(id: string, request: unknown): Promise<PublicView> {
    const parsed = actionRequestSchema.parse(request);
    const actionHash = createHash("sha256").update(stableJson(parsed)).digest("hex");
    return this.db.transaction(async (tx) => {
      const episode = await tx.get("SELECT 1 FROM episodes WHERE id = ? FOR UPDATE", id);
      if (!episode) throw new NotFoundError("Episode not found.");
      const duplicate = await tx.get<{ request_hash: string; response_json: string }>("SELECT request_hash, response_json FROM actions WHERE episode_id = ? AND action_id = ?", id, parsed.actionId);
      if (duplicate) {
        if (duplicate.request_hash !== actionHash) throw new ConflictError("Action ID was already used with different input.");
        const cached = persistedPublicViewSchema.safeParse(parseStoredObject(duplicate.response_json));
        if (!cached.success) throw new Error("Episode data is corrupted.");
        return cached.data as unknown as PublicView;
      }
      const current = await this.getWith(id, tx);
      if (parsed.expectedRevision !== current.revision) throw new ConflictError("Episode revision is stale.");
      const count = await tx.get<{ count: number | string }>("SELECT COUNT(*) AS count FROM actions WHERE episode_id = ?", id);
      if (!count || Number(count.count) >= EpisodeService.MAX_ACTIONS_PER_EPISODE) throw new ConflictError("Episode action limit reached.");
      const row = await tx.get<{ case_id: string }>("SELECT case_id FROM episodes WHERE id = ?", id);
      const definition = row && getCase(row.case_id);
      if (!definition) throw new Error("Episode data is corrupted.");
      const state = await this.fold(id, definition.model, tx);
      await this.apply(id, state, parsed.action, definition, tx);
      const response = this.publicView(id, await this.fold(id, definition.model, tx), definition);
      await tx.run("INSERT INTO actions VALUES (?, ?, ?, ?, ?)", id, parsed.actionId, actionHash, "complete", JSON.stringify(response));
      return response;
    });
  }

  private async fold(id: string, model: DiagnosticModel, executor: SqlExecutor): Promise<State> {
    const state = initialState(model);
    const rows = await executor.all<{ type: string; payload_json: string }>("SELECT type, payload_json FROM events WHERE episode_id = ? ORDER BY seq", id);
    for (const row of rows) {
      const stored = parseStoredEvent(row.type, row.payload_json);
      const payload = stored.payload as Partial<State> & { trace?: AgentTrace; proposal?: { probeId: string; predictions: PredictionSet }; revision?: PredictionSet; observation?: Observation; challenge?: State["pendingChallenge"]; diagnosis?: State["diagnosis"]; score?: State["score"]; truth?: string };
      if (stored.type === "BELIEFS_UPDATED" && payload.beliefs) {
        const beliefs = payload.beliefs as string[];
        state.beliefs = beliefs;
        state.beliefTimeline.push({ revision: state.revision + 1, beliefs: [...beliefs] });
      }
      if (stored.type === "PROBE_PROPOSED" && payload.proposal) {
        state.proposals[payload.proposal.probeId] = payload.proposal.predictions;
        state.firstPredictions[payload.proposal.probeId] = payload.proposal.predictions;
      }
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

  private async apply(id: string, state: State, action: Action, definition: CaseDefinition, tx: SqlExecutor): Promise<void> {
    const { model, public: publicCase } = definition;
    if (state.status === "evaluated") throw new ConflictError("Episode is already evaluated.");
    switch (action.type) {
      case "beliefs":
        if (action.possibleHypotheses.some((id) => !model.hypotheses.some((hypothesis) => hypothesis.id === id))) throw new ConflictError("Unknown cause.");
        await this.append(id, "BELIEFS_UPDATED", { beliefs: [...new Set(action.possibleHypotheses)] }, tx);
        return;
      case "propose": {
        if (state.pendingChallenge) throw new ConflictError("Resolve the pending Skeptic challenge first.");
        const probeId = action.probeId;
        if (!model.probes.some((probe) => probe.id === probeId)) throw new ValidationError("Unknown probe.");
        const predictions = action.predictions as PredictionSet;
        if (state.proposals[probeId]) throw new ConflictError(`Probe ${probeId} was already proposed.`);
        if (state.observations.some((observation) => observation.probeId === probeId)) throw new ConflictError(`Probe ${probeId} already ran.`);
        const issues = validatePredictions(model, probeId, predictions);
        if (issues.length) throw new ValidationError(issues.join(" "));
        await this.append(id, "PROBE_PROPOSED", { proposal: { probeId, predictions } }, tx);
        const evidenceSupported = consistentHypotheses(model, state.observations);
        const triggers = detectSkepticTriggers({ hypothesisIds: model.hypotheses.map(({ id }) => id), possibleHypotheses: state.beliefs, evidenceSupportedHypotheses: evidenceSupported, predictions });
        if (triggers.length) {
          const challenge = { triggers, probeId };
          await this.append(id, "SKEPTIC_CHALLENGED", { challenge }, tx);
          await this.append(id, "AGENT_RUN", { trace: runSkeptic({ possibleHypotheses: state.beliefs, predictions, observations: state.observations, triggers: triggers.map(redactTrigger) }) }, tx);
        }
        return;
      }
      case "skeptic-decision":
        if (!state.pendingChallenge) throw new ConflictError("There is no pending Skeptic challenge.");
        if (action.predictions && stableJson(action.predictions) !== stableJson(state.proposals[state.pendingChallenge.probeId])) {
          const issues = validatePredictions(model, state.pendingChallenge.probeId, action.predictions);
          if (issues.length) throw new ValidationError(issues.join(" "));
          const predictions = action.predictions as PredictionSet;
          await this.append(id, "PROBE_REVISED", { proposal: { probeId: state.pendingChallenge.probeId, predictions } }, tx);
          state.proposals[state.pendingChallenge.probeId] = predictions;
        }
        await this.append(id, "SKEPTIC_RESOLVED", { decision: action.decision }, tx);
        return;
      case "run": {
        if (!model.probes.some((probe) => probe.id === action.probeId)) throw new ValidationError("Unknown probe.");
        if (state.pendingChallenge) throw new ConflictError("Answer the Skeptic before running this probe.");
        if (!state.proposals[action.probeId]) throw new ConflictError("Commit predictions before running a probe.");
        if (state.observations.some((observation) => observation.probeId === action.probeId)) throw new ConflictError("A probe can run only once.");
        const selectedProbe = model.probes.find((probe) => probe.id === action.probeId);
        if (!selectedProbe) throw new ValidationError("Unknown probe.");
        const spent = state.observations.reduce((sum, observation) => sum + (model.probes.find((probe) => probe.id === observation.probeId)?.costMinutes ?? 0), 0);
        if (spent + selectedProbe.costMinutes > model.budgetMinutes) throw new ConflictError("This probe exceeds the maintenance-time budget.");
        const secret = await tx.get<{ truth_hypothesis_id: string }>("SELECT truth_hypothesis_id FROM episode_secrets WHERE episode_id = ?", id);
        if (!secret) throw new Error("Episode data is corrupted.");
        const outcomeId = model.forecasts[action.probeId]?.[secret.truth_hypothesis_id];
        if (!outcomeId) throw new Error("Episode data is corrupted.");
        const observation = { evidenceId: randomUUID(), probeId: action.probeId, outcomeId };
        await this.append(id, "PROBE_OBSERVED", { observation }, tx);
        await this.append(id, "FORECAST_REVEALED", { probeId: action.probeId }, tx);
        return;
      }
      case "unsafe":
        await this.append(id, "UNSAFE_REFUSED", { actionId: publicCase.unsafeAction.id }, tx);
        return;
      case "lock": {
        if (action.claims.length !== model.hypotheses.length || new Set(action.claims.map((claim) => claim.hypothesisId)).size !== model.hypotheses.length || action.claims.some((claim) => !model.hypotheses.some(({ id }) => id === claim.hypothesisId))) {
          throw new ConflictError("Submit exactly one structured claim for each cause.");
        }
        if (!model.hypotheses.some(({ id }) => id === action.diagnosis)) throw new ConflictError("Unknown diagnosis.");
        const diagnosis = { diagnosis: action.diagnosis, confidence: action.confidence, justification: action.justification, claims: action.claims as ArgumentClaim[] };
        await this.append(id, "DIAGNOSIS_LOCKED", { diagnosis }, tx);
        const secret = await tx.get<{ truth_hypothesis_id: string }>("SELECT truth_hypothesis_id FROM episode_secrets WHERE episode_id = ?", id);
        if (!secret) throw new Error("Episode data is corrupted.");
        const next = await this.fold(id, model, tx);
        const score = gradeEpisode(model, { truth: secret.truth_hypothesis_id, diagnosis: action.diagnosis, probes: next.observations, predictionAttempts: Object.entries(next.firstPredictions).map(([probeId, predictions]) => ({ probeId, predictions })), claims: action.claims as ArgumentClaim[], unsafeAttempts: next.unsafeAttempts });
        await this.append(id, "EVALUATED", { score }, tx);
        this.trackAgent(id, "examiner", () => this.recordExaminer(id, diagnosis, score.claimChecks));
        await this.append(id, "TRUTH_REVEALED", { truth: secret.truth_hypothesis_id }, tx);
        return;
      }
    }
  }

  private async append(id: string, type: string, payload: unknown, executor?: SqlExecutor): Promise<void> {
    const write = async (tx: SqlExecutor) => {
      await tx.get("SELECT id FROM episodes WHERE id = ? FOR UPDATE", id);
      const row = await tx.get<{ seq: number }>("SELECT COALESCE(MAX(seq), -1) AS seq FROM events WHERE episode_id = ?", id);
      if (!row) throw new Error("Episode data is corrupted.");
      await tx.run("INSERT INTO events VALUES (?, ?, ?, ?, ?)", id, Number(row.seq) + 1, type, JSON.stringify(payload), new Date().toISOString());
      if (type !== "AGENT_RUN") await tx.run("UPDATE episodes SET revision = (SELECT COUNT(*) FROM events WHERE episode_id = ? AND type != 'AGENT_RUN'), status = CASE WHEN ? = 'EVALUATED' THEN 'evaluated' ELSE status END WHERE id = ?", id, type, id);
    };
    if (executor) await write(executor);
    else await this.db.transaction(write);
  }

  private publicView(id: string, state: State, definition: CaseDefinition): PublicView {
    const { model, public: publicCase } = definition;
    const skeptic = state.pendingChallenge ? {
      triggers: state.pendingChallenge.triggers.map(redactTrigger),
      question: [...state.traces].reverse().find((trace) => trace.graph === "skeptic")?.output ?? "What would this test eliminate?",
      probeId: state.pendingChallenge.probeId,
    } : undefined;
    const view: PublicView = {
      id, caseId: publicCase.id, title: publicCase.title, revision: state.revision, status: state.status,
      beliefs: state.beliefs, proposals: state.proposals, revisedPredictions: state.revisions, observations: state.observations,
      remainingMinutes: model.budgetMinutes - state.observations.reduce((sum, observation) => sum + (model.probes.find((probe) => probe.id === observation.probeId)?.costMinutes ?? 0), 0),
      budgetMinutes: model.budgetMinutes, traces: state.traces,
      pendingAgents: [...(this.pendingAgents.get(id) ?? [])],
      public: publicCase,
      beliefTimeline: state.beliefTimeline,
      evidenceTimeline: state.observations.map((_, index) => ({
        evidenceId: state.observations[index]!.evidenceId,
        supported: state.status === "evaluated"
          ? consistentHypotheses(model, state.observations.slice(0, index + 1))
          : [],
      })),
      revealedForecasts: Object.fromEntries(state.observations.map((observation) => [observation.probeId, model.forecasts[observation.probeId]!])),
    };
    if (state.pendingChallenge) {
      view.pendingProbe = state.pendingChallenge.probeId;
      if (skeptic) view.skeptic = skeptic;
    }
    if (state.diagnosis) view.diagnosis = state.diagnosis;
    if (state.score) view.score = state.score;
    if (state.revealedTruth) view.truthHypothesis = state.revealedTruth;
    if (state.status === "evaluated") {
      view.forecastTable = model.forecasts;
      const policy = optimalPolicy(model);
      const lessons = state.observations.map((observation, index) => {
        const before = consistentHypotheses(model, state.observations.slice(0, index));
        const remaining = consistentHypotheses(model, state.observations.slice(0, index + 1));
        const informative = separates(model, observation.probeId, before);
        return { probeId: observation.probeId, informative, remaining, lesson: informative ? `This result separated the causes plausible before the test; ${remaining.length} remain model-consistent.` : "This result did not separate the causes plausible before the test." };
      });
      const best = policy.root.kind === "test" ? policy.root.probeId : undefined;
      view.debrief = {
        probeLessons: lessons,
        pathLesson: state.score && state.score.actualCostMinutes > state.score.bestPolicyBranchCostMinutes
          ? "A shorter feasible policy branch existed for this simulated fault; compare the separating power of a probe before spending more time."
          : "Your completed path matched the best feasible branch cost for this simulated fault, or no extra probe time was spent.",
      };
      if (best && state.observations[0]?.probeId !== best) view.debrief.betterNextProbe = best;
    }
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
    await this.append(id, "AGENT_RUN", { trace });
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

export class ValidationError extends Error {
  readonly statusCode = 400;
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
}
