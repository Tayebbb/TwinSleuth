import { validateCase } from "../engine/validate-case.js";
import { CASES } from "../server/case-model/registry.js";

for (const entry of CASES) {
  const result = validateCase(entry.model);
  if (!result.ok) {
    console.error(`${entry.public.title}: case validation failed`);
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`${entry.public.title}: ${entry.public.hypotheses.length} causes, ${entry.public.probes.length} probes`);
    console.log(`All cause pairs are distinguishable; best expected cost ${result.expectedCostMinutes} min, worst case ${result.worstCaseCostMinutes} min, budget ${entry.model.budgetMinutes} min.`);
    for (const [pair, probes] of Object.entries(result.pairSeparators)) {
      console.log(`  ${pair}: ${probes.join(", ")}`);
    }
  }
}
