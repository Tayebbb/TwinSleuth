# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Technical learners practicing fault diagnosis.

## Product Purpose

TwinSleuth helps technical learners practice evidence-based diagnosis of simulated industrial faults through prediction, testing, and a scored debrief.

## Positioning

Learners commit to predictions before running a probe, compare those predictions with revealed evidence, and defend a diagnosis. The fault is selected by the server and remains unrevealed until the episode is evaluated.

## Operating Context

The current practice surface is a single PIN-9 robot-arm episode. A learner tracks plausible causes, selects probes under a time budget, predicts each cause's result, reviews observations, and submits a diagnosis with cited evidence for scoring and debrief.

## Capabilities and Constraints

- The shipped case has four candidate causes and six diagnostic probes.
- A deterministic server owns the selected fault, private forecast matrix, and evaluation.
- A probe's forecast rows stay private until that probe has run; the selected fault is revealed after evaluation.
- The interface supports laptop and phone viewports, keyboard use, and visible focus.
- The current product is a practice simulator; it does not operate or control physical equipment.
- Audience expansion beyond technical learners and additional cases remain undecided.

## Evidence on Hand

- The PIN-9 scenario and executable forecast model are in `src/case/`.
- The playable interface is in `src/web/` and its functional end-to-end path is in `e2e/`.
- Submission screenshots and a deterministic demo recording are in `submission/`.
- Scenario outcomes are synthetic; there are no customer, outcome, or deployment claims to present as real-world evidence.

## Product Principles

- Make learners predict before revealing a probe result.
- Keep private forecasts and selected fault on the server.
- Tie scoring and feedback to observed evidence.
- Keep the path from hypothesis to test to diagnosis understandable on laptop and phone.

## Accessibility & Inclusion

The practice flow must remain operable by keyboard, expose visible focus, and work at laptop and phone sizes.
