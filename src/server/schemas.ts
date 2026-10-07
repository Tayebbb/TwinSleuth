import { z } from "zod";
import { HYPOTHESES, PROBES, PROBE_OUTCOMES } from "../case/catalog.js";

const hypothesisId = z.enum(["H1", "H2", "H3", "H4"]);
const probeId = z.enum(["P1", "P2", "P3", "P4", "P5", "P6"]);

export const predictionSetSchema = z.record(hypothesisId, z.string());

export const claimSchema = z.object({
  hypothesisId,
  stance: z.enum(["supports", "rules_out"]),
  evidenceIds: z.array(z.string().min(1)),
});

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("beliefs"),
    possibleHypotheses: z.array(hypothesisId).min(1),
  }),
  z.object({
    type: z.literal("propose"),
    probeId,
    predictions: predictionSetSchema,
  }),
  z.object({
    type: z.literal("skeptic-decision"),
    decision: z.enum(["revise", "run-anyway"]),
    predictions: predictionSetSchema.optional(),
  }),
  z.object({
    type: z.literal("run"),
    probeId,
  }),
  z.object({ type: z.literal("unsafe") }),
  z.object({
    type: z.literal("lock"),
    diagnosis: hypothesisId,
    confidence: z.number().int().min(1).max(5),
    justification: z.string().trim().min(1).max(1200),
    claims: z.array(claimSchema),
  }),
]);

export const actionRequestSchema = z.object({
  actionId: z.string().min(1).max(100),
  expectedRevision: z.number().int().nonnegative(),
  action: actionSchema,
});

export type ActionRequest = z.infer<typeof actionRequestSchema>;
export type Action = ActionRequest["action"];

export function isOutcome(probe: string, outcome: string): boolean {
  const values = PROBE_OUTCOMES[probe as keyof typeof PROBE_OUTCOMES];
  return values !== undefined && (values as readonly string[]).includes(outcome);
}
