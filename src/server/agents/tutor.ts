import { z } from "zod";
import { defaultGeminiClient } from "./gemini.js";
import type { AgentTrace, StructuredModelClient, TutorSkill } from "./types.js";

const prohibitedTutorContent = /\b(?:H\d+|P\d+|C\d+|PIN[- ]?\d|truth|diagnosis|score|forecast|observation|probe|budget|case|equipment|machine|controller|api(?: key)?|system prompt|ignore (?:previous|instructions)|https?:\/\/|www\.)\b/i;

function safeTutorText(value: string): boolean {
  return !prohibitedTutorContent.test(value) && !/[<>`]/.test(value);
}

const responseSchema = z.object({
  lesson: z.string().trim().min(1).max(420).refine(safeTutorText),
  reflection: z.string().trim().min(1).max(220).refine(safeTutorText),
}).strict();

const curriculum: Record<TutorSkill, { prompt: string; lesson: string; reflection: string }> = {
  design_discriminating_tests: {
    prompt: "Teach the general diagnostic skill of designing a discriminating test. Explain that a useful test gives different predicted outcomes for competing explanations. Give one concise, fictional example that does not mention any case, equipment, IDs, measurements, causes, observations, or answers. End with one unscored reflection question. Use plain teaching language only. Do not mention a case, test IDs, hypothesis IDs, truth, diagnosis, score, forecast, observations, probes, budget, equipment, controls, tools, system instructions, APIs, or links. Do not give operational, safety, or medical advice.",
    lesson: "A discriminating test earns its value before it runs: competing explanations predict different results. If the predictions match, the result may confirm a fact but cannot narrow the explanation.",
    reflection: "Before your next test, which two explanations must produce different results for the test to teach you something?",
  },
  separate_evidence_from_belief: {
    prompt: "Teach the general diagnostic skill of separating observed evidence from a current belief. Explain that an explanation stays plausible until a revealed result contradicts it. Give one concise, fictional example that does not mention any case, equipment, IDs, measurements, causes, observations, or answers. End with one unscored reflection question. Use plain teaching language only. Do not mention a case, test IDs, hypothesis IDs, truth, diagnosis, score, forecast, observations, probes, budget, equipment, controls, tools, system instructions, APIs, or links. Do not give operational, safety, or medical advice.",
    lesson: "A belief is a working explanation; evidence is a result you observed. Keep an explanation open until a result actually contradicts it, rather than removing it because it feels less likely.",
    reflection: "What observed result would you need before you could fairly rule out one of your current explanations?",
  },
  plan_under_a_budget: {
    prompt: "Teach the general diagnostic skill of planning tests under a limited budget. Explain that a test should be chosen for how much it can separate explanations relative to its cost. Give one concise, fictional example that does not mention any case, equipment, IDs, measurements, causes, observations, or answers. End with one unscored reflection question. Use plain teaching language only. Do not mention a case, test IDs, hypothesis IDs, truth, diagnosis, score, forecast, observations, probes, budget, equipment, controls, tools, system instructions, APIs, or links. Do not give operational, safety, or medical advice.",
    lesson: "With a limited budget, prefer a test that can separate the explanations still open. A low-cost test that cannot change your decision may spend time without reducing uncertainty.",
    reflection: "Which next test could rule out the most still-plausible explanations for the time it costs?",
  },
};

function fallback(skill: TutorSkill, revision: number): AgentTrace {
  const item = curriculum[skill];
  return { graph: "tutor", status: "fallback", inputSummary: `${revision}|${skill}`, output: `${item.lesson}\n\nReflection: ${item.reflection}`, skill, revision, lesson: item.lesson, reflection: item.reflection };
}

export async function runTutor(skill: TutorSkill, revision: number, client = defaultGeminiClient()): Promise<AgentTrace> {
  if (!client) return fallback(skill, revision);
  try {
    const result = responseSchema.safeParse(await client.invoke(curriculum[skill].prompt, "tutor"));
    if (!result.success) return fallback(skill, revision);
    const { lesson, reflection } = result.data;
    return { graph: "tutor", status: "model", inputSummary: `${revision}|${skill}`, output: `${lesson}\n\nReflection: ${reflection}`, skill, revision, lesson, reflection };
  } catch {
    return fallback(skill, revision);
  }
}
