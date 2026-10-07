import {
  DIAGNOSTIC_BUDGET_MINUTES,
  HYPOTHESES,
  PROBES,
} from "../../case/catalog.js";
import type { DiagnosticModel } from "../../engine/model.js";

export const PIN9_MODEL: DiagnosticModel = {
  hypotheses: HYPOTHESES.map(({ id }) => ({ id })),
  probes: PROBES,
  forecasts: {
    P1: { H1: "refused", H2: "refused", H3: "refused", H4: "refused" },
    P2: { H1: "refused", H2: "refused", H3: "completed", H4: "refused" },
    P3: { H1: "completed", H2: "refused", H3: "refused", H4: "completed" },
    P4: { H1: "stopped-at-95", H2: "full-range", H3: "full-range", H4: "full-range" },
    P5: { H1: "reachable", H2: "out-of-reach", H3: "reachable", H4: "reachable" },
    P6: { H1: "clear", H2: "clear", H3: "clear", H4: "overlap" },
  },
  prior: { H1: 0.25, H2: 0.25, H3: 0.25, H4: 0.25 },
  budgetMinutes: DIAGNOSTIC_BUDGET_MINUTES,
};
