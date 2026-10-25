> Implementation update (2026-10-25): the exploration below is historical. Current Tutor and Examiner models select server-authored text; arbitrary generated prose is rejected. See [reliability fixes](E:/TwinSleuth/audit/RELIABILITY-FIXES.md) for the shipped contract, budgets, and verification.

# LLM opportunity research

**Date:** 2026-10-15  
**Scope:** TwinSleuth and Next Byte Hacks V5

## Recommendation

The better direction is an **AI Tutor with adaptive practice**. Let deterministic learner-progress signals select a skill to practice (for example, separating observation from inference, comparing alternatives, or planning tests under a budget). The configured model provider can then teach that general skill with a short explanation, analogy, or fresh mini-question that does not use the active case's evidence or answer.

For full new diagnostic episodes, let the deterministic engine select an already validated case model and keep its hypotheses, probe outcomes, costs, forecasts, and scoring rules fixed. A model may create neutral narrative wording around that model, but must not author or change its causal matrix. Treat generated wording as untrusted: reject content that adds unsupported clues or changes facts, and provide deterministic copy as fallback. This gives learners variety without making the model the authority for truth.

An AI Prediction Translator remains a smaller alternative: it can map only choices explicitly stated by the learner into the existing structured form, leave omissions blank, and ask about ambiguity. The learner must review and confirm it; the model must not suggest outcomes, infer unstated predictions, select a probe, or auto-submit.

I do **not** recommend a case-aware generative Evidence Coach as the next step. Even if it sees only public observations, a model can infer and reveal the hidden cause from that evidence. The Skeptic's current source comment correctly identifies that generated answers cannot be reliably proven not to disclose a diagnosis. Keep case-specific coaching deterministic unless a design can satisfy the project's strict no-leak invariant.

## What the code does today

- The only generative role is the post-diagnosis Examiner. `runExaminer` sends the learner's chosen diagnosis, justification, and deterministic claim-check results to OpenAI in demo mode, then accepts short schema-checked feedback. The prompt explicitly forbids changing the diagnosis, scoring, inferring unrevealed causes, and citing unsupplied IDs. If no key is configured or the model fails validation, the system returns template/fallback feedback.
- The Skeptic is intentionally deterministic. It reacts to a deterministic trigger and public learner state. Its source comment explains that a generative answer cannot reliably be proven not to disclose a diagnosis.
- The LLM is not the source of truth for evidence, candidate sets, probe outcomes, budget, or score. Keep that split.
- OpenAI is called only when `TWINSLEUTH_TESTING_MODE=0` and `OPENAI_API_KEY` is set. `TWINSLEUTH_TESTING_MODE=1` routes only to the local FreeLLMPool OpenAI-compatible proxy. Both adapters request JSON Schema output, cap output length, and time out after 20 seconds. Deployment configuration and live model availability were not rechecked for this research, so do not assume the hosted page is currently making model calls.

Code reviewed: `src/server/agents/examiner.ts`, `src/server/agents/skeptic.ts`, `src/server/agents/gemini.ts`, `src/server/agents/types.ts`, and the episode event flow in `src/server/episode-service.ts`.

## Why the feature fits the event

The official rules page gives equal weight (25% each) to Innovation & Creativity, Technical Complexity, Functionality & Execution, and Presentation & Clarity. It requires a working project, a 2–5 minute demo, and accessible source code. It does not list an AI-specific scoring category. A real coach can support innovation, technical depth, and presentation, but merely labeling the app AI-powered is not a scoring advantage. The description and video should demonstrate exactly what the model contributes and what remains deterministic. [Official rules](https://next-byte-hacks-v5.devpost.com/rules)

## Ranked opportunities

| Priority | Feature | User-visible value | Safety boundary |
| --- | --- | --- | --- |
| 1 | AI Tutor with adaptive practice | Teaches the reasoning skill the learner needs next and gives a fresh, low-stakes practice question | Select skill/difficulty deterministically. Give the model only the skill tag and generic curriculum material, not the active case, evidence, diagnosis, or truth. Tutor text never scores or changes game state. |
| 2 | New problem variants | Fresh narrative and questions keep practice from feeling repetitive | Reuse a validated deterministic case matrix. A model may write neutral setting/context only; never create or alter hypotheses, forecasts, probe outcomes, costs, budget, or scoring. `validateCase` checks model structure and solvability, but does not prove that generated prose is causally accurate. |
| 3 | Stronger final Examiner | Gives one specific strength and one evidence-linked improvement after the learner submits a diagnosis and claims | Keep it advisory. Never changes the diagnosis or score. Mark model output separately from template/fallback output. |
| 4 | AI Prediction Translator | Turns the learner's own free-text forecast into the existing structured form | Only map explicit learner choices; leave omissions blank; ask about ambiguity; show a preview for confirmation; never recommend outcomes or auto-submit. Deterministic validation stays authoritative. |
| Avoid for now | Case-aware generative coach | Could explain revealed evidence or ask personalized questions | Revealed evidence can be enough to infer the hidden cause. A prompt instruction alone cannot guarantee non-disclosure; this conflicts with the project's strict invariant. |

The Tutor is the best next step, followed by narrative variants over fixed case models. A model-authored diagnostic matrix would make the LLM decide the simulation's forecasts and underlying truth, while the current validator only establishes structural completeness and solvability. Keep the current Skeptic deterministic.

## Recommended interaction

1. The deterministic engine observes a public process signal, such as repeated predictions that fail to distinguish alternatives.
2. A fixed mapping turns that signal into a curriculum skill tag such as “designing a discriminating test.” The selection rule does not consult hidden truth.
3. The server sends only the tag and approved general teaching material to the configured model provider. It does not send case descriptions, predictions, observations, diagnosis, forecasts, or episode state.
4. The provider returns a short lesson plus an unscored generic reflection prompt. Validate shape and length, render as text, and mark it clearly as AI-generated.
5. Learner can consider the reflection and continue the episode. The LLM does not change the episode or score.
6. If the provider is unavailable or returns invalid output, show a curated lesson and deterministic practice prompt. Do not present fallback text as AI output.

Offer an explicit **Learn this skill** action after a relevant moment, so the AI teaching is visible without interrupting diagnosis. Show loading, error, and retry states. For generated full-case variants, retain manual review and the existing deterministic model. For the video, use a configured provider and show one real teaching call; don't stage or fabricate an AI response.

## Guardrails for implementation

- Construct a separate tutor input type containing only a curriculum skill tag and general teaching content. Do not pass `State`, `CaseDefinition`, the event store, forecasts, observations, candidate filtering, or secret tables.
- Use a deterministic allow-list for skill tags and a bounded response schema (lesson, analogy, practice prompt). Reject output with case-specific IDs or fields; render as text.
- Treat all learner text as untrusted prompt data. Keep the tutor non-authoritative; it must not run tools, suggest case probes, expose diagnoses, or direct episode events. The server may append a privacy-safe trace after validating the response.
- For new full-case variants, freeze the deterministic diagnostic model before generating prose. Validate the prose for schema and approved facts, and retain curated fallback text. Structural `validateCase` success alone does not establish factual or pedagogical correctness.
- Keep model output out of state transitions, probe choice, candidate filtering, score, diagnosis, and event truth.
- Add regression tests for prompt injection, case-specific content rejection, provider failure, no-key behavior, no-event-write behavior, and fixed-model preservation during narrative generation. Test with a local stub, never a real key.
- Configure `OPENAI_API_KEY` only in the hosting provider's server-side environment. Never put it in the browser bundle, repo, README, screenshots, or chat. Verify the model path in deployment with a safe probe and check logs for accidental payload leakage.

Google's documentation says structured output constrains response format but does not establish semantic correctness, so application validation is still required. Its safety guidance warns that outputs may be inaccurate or unexpected and calls for post-processing and evaluation. Function-calling guidance describes model-proposed calls that the host application executes; this is why any future tools should be allow-listed and validated server-side. [Structured output](https://ai.google.dev/gemini-api/docs/structured-output?lang=web) · [Safety and factuality](https://ai.google.dev/gemini-api/docs/safety-guidance?hl=en) · [Function calling](https://ai.google.dev/gemini-api/docs/function-calling?authuser=108)

## Demo and submission framing

Show the learner receive a lesson after a reasoning challenge, consider its unscored reflection, then return to the episode. Narrate the boundary plainly: “The AI model teaches diagnostic reasoning; TwinSleuth's deterministic engine controls every case outcome and score.” If showing a generated case variant, prove the story changes while the underlying validated model stays fixed.

Avoid saying “the whole system is AI.” That would misdescribe the implementation and weaken the technical story. If implemented, the defensible claim is: **An AI tutor that adapts practice around a deterministic, replayable diagnostic simulation.**

## Sources

- [Next Byte Hacks V5 — official rules and judging rubric](https://next-byte-hacks-v5.devpost.com/rules)
- [OpenAI Responses API](https://developers.openai.com/api/docs/quickstart)
