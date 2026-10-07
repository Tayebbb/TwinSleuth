export const HYPOTHESES = [
  {
    id: "H1",
    title: "J2 soft limit was tightened",
    detail: "After gearbox service, the shoulder-axis soft limit may have been set to 95° instead of its rated 120°.",
  },
  {
    id: "H2",
    title: "Keypad frame offset is wrong",
    detail: "The keypad was re-taught with an offset that puts every key beyond the arm's geometric reach.",
  },
  {
    id: "H3",
    title: "Stylus velocity cap is too low",
    detail: "The heavier stylus may have lowered J3's speed limit, making the 100% speed move invalid.",
  },
  {
    id: "H4",
    title: "Safety zone overlaps keypad row 3",
    detail: "A recent cell-layout update may have placed a keep-out zone over keys 7–9.",
  },
] as const;

export type HypothesisId = (typeof HYPOTHESES)[number]["id"];

export const PROBE_OUTCOMES = {
  P1: ["refused"],
  P2: ["refused", "completed"],
  P3: ["refused", "completed"],
  P4: ["stopped-at-95", "full-range"],
  P5: ["reachable", "out-of-reach"],
  P6: ["overlap", "clear"],
} as const;

export type ProbeId = keyof typeof PROBE_OUTCOMES;
export type OutcomeId = (typeof PROBE_OUTCOMES)[ProbeId][number];

export const PROBES = [
  {
    id: "P1",
    title: "Repeat the same PIN motion at 100% speed",
    description: "The previous crew says a quick retry cleared a similar refusal.",
    costMinutes: 5,
    outcomes: PROBE_OUTCOMES.P1,
  },
  {
    id: "P2",
    title: "Retry key 9 at 25% speed",
    description: "Repeat the far key slowly to check whether speed is the limiting factor.",
    costMinutes: 5,
    outcomes: PROBE_OUTCOMES.P2,
  },
  {
    id: "P3",
    title: "Press key 3 at 100% speed",
    description: "Try a nearby key outside the keypad's far row.",
    costMinutes: 5,
    outcomes: PROBE_OUTCOMES.P3,
  },
  {
    id: "P4",
    title: "Slow-jog J2 through its rated range",
    description: "Check whether J2 stops before its rated 120° range.",
    costMinutes: 10,
    outcomes: PROBE_OUTCOMES.P4,
  },
  {
    id: "P5",
    title: "Run an offline reach check for key 9",
    description: "Check geometry only; this does not test configured soft limits.",
    costMinutes: 10,
    outcomes: PROBE_OUTCOMES.P5,
  },
  {
    id: "P6",
    title: "Audit the safety zone",
    description: "Ask the safety officer whether the keep-out zone overlaps keypad row 3.",
    costMinutes: 15,
    outcomes: PROBE_OUTCOMES.P6,
  },
] as const;

export type Probe = (typeof PROBES)[number];

export const CASE_ID = "pin-9-refusal" as const;
export const CASE_TITLE = "PIN-9 Refusal" as const;
export const DIAGNOSTIC_BUDGET_MINUTES = 30;

export const MAINTENANCE_LOG = [
  "Yesterday, the J2 gearbox was serviced.",
  "The keypad fixture was re-taught.",
  "The stylus was replaced with a heavier model.",
  "The safety officer updated the cell layout.",
] as const;

export const COLLEAGUE_NOTE =
  "The last crew cleared a similar refusal with a quick retry. Try the same sequence once before shutting down.";

export const INITIAL_SYMPTOM = {
  task: "Press PIN 9-1-3 on the keypad.",
  controllerCode: "SAFETY_REJECT",
  message: "Motion refused before start. The arm did not move.",
  estop: "clear",
} as const;

export const UNSAFE_ACTION = {
  id: "U1",
  label: "Bypass the safety controller and force the move",
} as const;
