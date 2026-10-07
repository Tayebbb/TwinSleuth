import { CASE_TITLE, HYPOTHESES, PROBES } from "../case/catalog.js";
import { validateCase } from "../engine/validate-case.js";
import { PIN9_MODEL } from "../server/case-model/pin9.js";

const result = validateCase(PIN9_MODEL);
if (!result.ok) {
  console.error(`${CASE_TITLE}: case validation failed`);
  for (const issue of result.issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`${CASE_TITLE}: ${HYPOTHESES.length} causes, ${PROBES.length} probes`);
  console.log(`All cause pairs are distinguishable; best expected cost ${result.expectedCostMinutes} min, worst case ${result.worstCaseCostMinutes} min, budget ${PIN9_MODEL.budgetMinutes} min.`);
  for (const [pair, probes] of Object.entries(result.pairSeparators)) {
    console.log(`  ${pair}: ${probes.join(", ")}`);
  }
}
