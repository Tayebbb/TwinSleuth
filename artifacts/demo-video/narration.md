# TwinSleuth — demo narration

Voice track is synthesized locally with the Kokoro-82M neural voice (af_heart) at a brisk conversational pace; delivery is segmented at the storyboard boundaries. Captions use the synthesizer's word timings and retain the script's written names and labels.

## 00:00–00:12 — Hook

TwinSleuth is a browser-based troubleshooting simulator for maintenance learners. It teaches you to predict, test within a budget, compare evidence, and defend a diagnosis instead of guessing.

## 00:12–00:35 — Problem and user

This case begins with a simulated robot arm that refuses a PIN command before motion. The learner sees four possible causes and thirty maintenance minutes. Each possible cause points to a different subsystem and a testable failure mode. The exercise rewards a testable explanation, not a fast guess.

## 00:35–02:10 — Main workflow

I begin with P1, repeating the same PIN motion, and commit a forecast for each cause before observing anything. Here every row predicts refusal. Because that result would not distinguish the causes, the deterministic Skeptic asks me to reconsider the test. It uses my submitted forecast and current public state; it does not need the hidden fault to raise that question.

I switch to P3 and predict that key three completes under H1 and H4, but is refused under H2 and H3. This splits the four explanations into two groups. Only after I commit those predictions do I run the five-minute test. The observed completion leaves two model-consistent causes, H1 and H4.

Now I test the remaining ambiguity with P4, the slow J2 range check. I forecast a stop at 95 degrees for H1 and full range for the alternatives, then run it for ten simulated minutes. The observation is a J2 stop at 95 degrees. The cause list narrows to H1. The ledger pairs each forecast with its observation, so I can check what changed. A test is useful when possible causes predict different outcomes. P1 spent five minutes without separating causes. P3 split the four causes into two pairs; P4 distinguished the two survivors. This is the skill TwinSleuth practices: choose informative tests, update from evidence, and explain why one diagnosis remains.

## 02:10–03:05 — Debrief and evidence

I lock H1 and cite observations for each of the four causes. Getting the diagnosis right is not enough; I have to show evidence for each claim. The debrief checks those claims instead of accepting the explanation as fact. It shows the five score categories separately, the remaining cause after each test, and the path cost. Each claim points to an event and says whether it supports or contradicts a cause. The detail rows show each observation ID, learner belief, and evaluator status, making every claim traceable. P4's stop supports H1 and contradicts H2, H3, and H4; P3 left H1 and H4 in play. Optional Examiner notes cannot change the rubric score. Here, the two tests cost fifteen minutes, matching the best feasible policy branch for this simulated fault. That comparison is specific to this authored case, not a real-world maintenance recommendation.

## 03:05–04:10 — Technical mechanism

Behind the screen, deterministic rules keep the exercise fair. The browser sends a forecast or test choice to the service. The service enforces the run rules and time budget; the deterministic engine uses the private case model to calculate the outcome and remaining causes. You see evidence only after running a test. The event ledger records forecasts and outcomes in order, so the session can be replayed and checked. Think of the rules as a referee and the ledger as an instant replay: they show what you predicted, which test you chose, and what evidence changed your mind.

The Skeptic sees your predictions and public information. It can challenge a weak test but cannot reveal the answer. After diagnosis, optional Examiner feedback acts like a coach: it explains your evidence claims but never changes your score. This keeps the learner's reasoning—not AI guesswork—at the center. The local practice still works without an AI provider. Reviewing the replay shows whether your tests separated causes and how new evidence changed your diagnosis. The experience is a simulator; it is not connected to real equipment.

## 04:10–04:40 — Engineering evidence

Why does the budget matter? It trains you to trade time for information: choose tests that separate causes and avoid spending minutes on uninformative probes. In this local build, case validation, sixty-four unit tests, and fourteen browser tests passed. Accessibility checks include keyboard and responsive use. That gives confidence in the simulator, not real equipment.

## 04:40–05:00 — Close

TwinSleuth is a local troubleshooting practice website for maintenance learners. It teaches you to predict first, spend tests deliberately, compare evidence, and defend a diagnosis. The goal is to improve how you investigate a fault, not memorize an answer. This is a simulator; no real equipment is connected.
