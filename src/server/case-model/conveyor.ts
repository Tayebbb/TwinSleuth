import type { PublicCase } from "../../case/catalog.js";
import type { DiagnosticModel } from "../../engine/model.js";

/** A simulated conveyor case; it is practice material, not operating guidance. */
export const CONVEYOR_CASE: PublicCase = {
  id: "conveyor-index-drift",
  title: "Conveyor Index Drift",
  hypotheses: [
    { id: "C1", title: "Encoder scale is misconfigured", detail: "The replacement encoder reports too few pulses per station." },
    { id: "C2", title: "Photoeye bracket is loose", detail: "The station sensor changes position as cartons pass." },
    { id: "C3", title: "Drive ramp is too aggressive", detail: "The belt overshoots only during fast moves." },
    { id: "C4", title: "Reject gate is obstructed", detail: "A downstream gate blocks cartons after a correct index." },
  ],
  probes: [
    { id: "C-P1", title: "Repeat a production-speed index", description: "Repeat the current index at normal speed.", costMinutes: 5, outcomes: ["drifts", "stops-on-mark"] },
    { id: "C-P2", title: "Index at maintenance speed", description: "Run the same index slowly under the normal safety envelope.", costMinutes: 5, outcomes: ["drifts", "stops-on-mark"] },
    { id: "C-P3", title: "Compare encoder counts over one station", description: "Record commanded and measured encoder counts; do not alter calibration.", costMinutes: 10, outcomes: ["count-low", "count-matches"] },
    { id: "C-P4", title: "Inspect photoeye mount", description: "With power isolated, check whether the sensor mount moves under light pressure.", costMinutes: 10, outcomes: ["mount-loose", "mount-secure"] },
    { id: "C-P5", title: "Inspect reject gate clearance", description: "With power isolated, inspect the gate path for a physical obstruction.", costMinutes: 10, outcomes: ["obstructed", "clear"] },
  ],
  symptom: { task: "Index cartons to the reject station.", controllerCode: "INDEX_WINDOW", message: "Cartons intermittently miss the station mark.", estop: "clear" },
  maintenanceLog: ["The conveyor encoder was replaced.", "A photoeye bracket was adjusted.", "The drive acceleration profile was updated.", "The reject gate was cleaned."],
  colleagueNote: "The last shift says a fast repeat looked normal. Record a prediction before testing.",
  unsafeAction: { id: "CU1", label: "Disable the guard interlock and reach into the conveyor" },
};

export const CONVEYOR_MODEL: DiagnosticModel = {
  hypotheses: CONVEYOR_CASE.hypotheses.map(({ id }) => ({ id })),
  probes: CONVEYOR_CASE.probes,
  forecasts: {
    "C-P1": { C1: "drifts", C2: "drifts", C3: "drifts", C4: "stops-on-mark" },
    "C-P2": { C1: "drifts", C2: "drifts", C3: "stops-on-mark", C4: "stops-on-mark" },
    "C-P3": { C1: "count-low", C2: "count-matches", C3: "count-matches", C4: "count-matches" },
    "C-P4": { C1: "mount-secure", C2: "mount-loose", C3: "mount-secure", C4: "mount-secure" },
    "C-P5": { C1: "clear", C2: "clear", C3: "clear", C4: "obstructed" },
  },
  prior: { C1: .25, C2: .25, C3: .25, C4: .25 },
  budgetMinutes: 30,
};
