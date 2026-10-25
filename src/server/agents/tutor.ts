import { z } from "zod";
import { defaultModelClient } from "./model-client.js";
import { diagnosedTrace, failureReason, invokeBefore } from "./agent-runtime.js";
import type { AgentTrace, StructuredModelClient, TutorSkill } from "./types.js";

export const TUTOR_CURRICULUM_VERSION = "2026-10-25.1";
export interface TutorLesson { readonly lesson: string; readonly reflection: string; }
const responseSchema = z.object({ lesson: z.string().trim().min(1).max(420), reflection: z.string().trim().min(1).max(220) }).strict();

const curriculum: Record<TutorSkill, TutorLesson> = {
  design_discriminating_tests: {
    lesson: "A discriminating test earns its value before it runs: competing explanations predict different results. If the predictions match, the result may confirm a fact but cannot narrow the explanation.",
    reflection: "Before your next test, which two explanations must produce different results for the test to teach you something?",
  },
  separate_evidence_from_belief: {
    lesson: "A belief is a working explanation; evidence is a result you observed. Keep an explanation open until a result actually contradicts it, rather than removing it because it feels less likely.",
    reflection: "What observed result would you need before you could fairly rule out one of your current explanations?",
  },
  plan_under_a_budget: {
    lesson: "With a limited budget, prefer a test that can separate the explanations still open. A low-cost test that cannot change your decision may spend time without reducing uncertainty.",
    reflection: "Which next test could rule out the most still-plausible explanations for the time it costs?",
  },
};

const alternatives: Record<TutorSkill, TutorLesson> = {
  design_discriminating_tests: {
    lesson: "Compare the results predicted by competing explanations before choosing a test.",
    reflection: "Which result would distinguish them?",
  },
  separate_evidence_from_belief: {
    lesson: "Keep a working explanation open until a revealed result contradicts it.",
    reflection: "Which result could rule out your preferred explanation?",
  },
  plan_under_a_budget: {
    lesson: "Choose tests for how much uncertainty they remove relative to the time they take.",
    reflection: "What could you learn from the next test for the time it costs?",
  },
};

/** Models select a complete approved pair, never author learner-visible prose. */
export function tutorLessonOptions(skill: TutorSkill): readonly TutorLesson[] {
  return [{ ...curriculum[skill] }, { ...alternatives[skill] }];
}

function promptFor(skill: TutorSkill): string {
  return [
    "Select one approved general teaching lesson and its paired reflection. Do not rewrite, mix pairs, or add assertions.",
    "No case, evidence, diagnosis, selected fault, or learner text is supplied. Never invent any of these.",
    "Return only lesson and reflection fields, copied from exactly one option.",
    JSON.stringify(tutorLessonOptions(skill)),
  ].join("\n");
}

function fallback(skill: TutorSkill, revision: number): AgentTrace {
  const item = curriculum[skill];
  return { graph: "tutor", status: "fallback", inputSummary: `${revision}|${skill}`, output: `${item.lesson}\n\nReflection: ${item.reflection}`, skill, revision, lesson: item.lesson, reflection: item.reflection };
}

export async function runTutor(skill: TutorSkill, revision: number, client = defaultModelClient()): Promise<AgentTrace> {
  const started = performance.now();
  const finish = (trace: AgentTrace, reason: Parameters<typeof diagnosedTrace>[2]) => diagnosedTrace(trace, started, reason, TUTOR_CURRICULUM_VERSION);
  if (!client) return finish(fallback(skill, revision), "provider_disabled");
  try {
    const result = responseSchema.safeParse(await invokeBefore(client, promptFor(skill), "tutor", started + 6_000));
    if (!result.success) return finish(fallback(skill, revision), "rejected_output");
    const lessonText = result.data.lesson.normalize("NFKC");
    const reflectionText = result.data.reflection.normalize("NFKC");
    const approved = tutorLessonOptions(skill).find((option) => option.lesson === lessonText && option.reflection === reflectionText);
    if (!approved) return finish(fallback(skill, revision), "rejected_output");
    const { lesson, reflection } = approved;
    return finish({ graph: "tutor", status: "model", inputSummary: revision + "|" + skill, output: lesson + "\n\nReflection: " + reflection, skill, revision, lesson, reflection }, "accepted");
  } catch (error) {
    return finish(fallback(skill, revision), failureReason(error));
  }
}
