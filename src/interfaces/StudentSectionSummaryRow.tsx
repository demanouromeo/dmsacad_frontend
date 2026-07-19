// One row per enrolled student, as returned by
// StudentController::allStudentsSummaryOfSection - just enough to tally Garçon/Fille/Redoublants
// per classe for the "Effectifs par classe" report; no need for the full Student shape here.
export interface StudentSectionSummaryRow {
  sexe: "M" | "F";
  repeating: number;
  classe_id: number;
  classe_name: string;
  level: number;
}
