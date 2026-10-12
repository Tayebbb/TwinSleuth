import { z } from "zod";
const hypothesisId = z.string().min(1).max(40);
const probeId = z.string().min(1).max(40);

export const episodeStartRequestSchema = z.object({ caseId: z.string().min(1).max(80).optional() }).strict();

export const predictionSetSchema = z.record(hypothesisId, z.string());

export const claimSchema = z.object({
  hypothesisId,
  stance: z.enum(["supports", "rules_out"]),
  evidenceIds: z.array(z.string().min(1).max(100)).max(6),
}).strict();

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("beliefs"),
    possibleHypotheses: z.array(hypothesisId).min(1).max(12),
  }).strict(),
  z.object({
    type: z.literal("propose"),
    probeId,
    predictions: predictionSetSchema,
  }).strict(),
  z.object({
    type: z.literal("skeptic-decision"),
    decision: z.enum(["revise", "run-anyway"]),
    predictions: predictionSetSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal("run"),
    probeId,
  }).strict(),
  z.object({ type: z.literal("unsafe") }).strict(),
  z.object({
    type: z.literal("lock"),
    diagnosis: hypothesisId,
    confidence: z.number().int().min(1).max(5),
    justification: z.string().trim().min(1).max(1200),
    claims: z.array(claimSchema).max(12),
  }).strict(),
]);

export const actionRequestSchema = z.object({
  actionId: z.string().min(1).max(100),
  expectedRevision: z.number().int().nonnegative(),
  action: actionSchema,
}).strict();

export type ActionRequest = z.infer<typeof actionRequestSchema>;
export type Action = ActionRequest["action"];
