## TwinSleuth hardening rules

Product loop (preserve it; this is not a chatbot): learners predict before observing, test under a budget, compare prediction against evidence, and defend a diagnosis.

Verification commands (all must pass before work is called done):
npm ci · npm run validate:case · npm run typecheck · npm test · npm run build · npm run test:e2e · npm run capture:demo

Invariants. ALWAYS hold, and verify them against the code rather than the docs:
1. Server owns truth; the browser is untrusted. The hidden hypothesis and any unrun forecast row are not derivable from any response, error text, status code, timing, event, log, trace, agent input/output, source map, built chunk, or browser global.
2. The deterministic engine is the sole authority for truth, score, diagnosis, evidence validity, candidate set, probe outcome, budget, timing and safety state. LLM output never decides these and is never rendered unsafely.
3. Skeptic never sees the truth or unrun forecasts, never reveals a diagnosis, never steers probe choice from hidden knowledge, never alters state or score. Examiner never determines score, truth or evidence validity and receives no hidden truth it doesn't need.
4. The demo path works with no LLM provider: P1 challenge → learner prediction → Skeptic → revise to P3 → P3 observation → P4 observation → diagnosis → evidence claims → deterministic debrief → truth reveal. Deterministic, no console errors, no unexplained delays.
5. The event ledger is the single source of truth: replaying an episode from zero reproduces live state exactly, and UI state never competes with it.

Working rules:
- Source code is truth; handoff docs are leads, not evidence.
- Fix defects with the smallest robust change plus a regression test. No drive-by refactors and no rewrites unless the architecture demonstrably blocks correctness.
- These count as cheating, not fixes: deleting or weakening tests or validation, loosening security tests, hiding errors or private data instead of closing the leak, hardcoding results, suppressing console errors, disabling axe, raising timeouts without a root cause, removing features to avoid testing them, adding dependencies to avoid understanding existing code.
- Prove a file or code path is unreferenced before deleting it.
- Never print or log secrets or .env values. Test LLM paths with a local stub provider, never a real key.
- Docs never claim capabilities the code lacks or cite invented statistics.
- Ask before: adding a runtime dependency, changing rubric weights or categories beyond closing a demonstrated loophole, deleting files not proven unreferenced, touching real secrets, destructive git actions. When running non-interactively, skip the action and log it in audit/DECISIONS.md instead.
- Be Extremely Concise, Sacrifice Grammar for the sake of concision.