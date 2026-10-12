import { PIN9_CASE } from "../../case/catalog.js";
import type { PublicCase } from "../../case/catalog.js";
import type { DiagnosticModel } from "../../engine/model.js";
import { CONVEYOR_CASE, CONVEYOR_MODEL } from "./conveyor.js";
import { PIN9_MODEL } from "./pin9.js";

export interface CaseDefinition { readonly public: PublicCase; readonly model: DiagnosticModel; }
export const CASES: readonly CaseDefinition[] = [
  { public: PIN9_CASE, model: PIN9_MODEL },
  { public: CONVEYOR_CASE, model: CONVEYOR_MODEL },
];
export function getCase(caseId: string): CaseDefinition | undefined { return CASES.find((entry) => entry.public.id === caseId); }
