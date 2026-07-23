// Shape of StudentController::allStudClassOfAClasse's rows - the student_classe pivot fields for
// one (classe, school year), keyed by stud_id. This is where the real repeating/cas_social values
// live (see Student.tsx's comment) - merge onto the Student row by stud_id, not the reverse.
export interface StudentClasseInfo {
  student_classe_id: number;
  stud_id: number;
  basculated: number | null;
  position_classe: number | null;
  repeating: number | null;
  solvable1: number | null;
  solvable2: number | null;
  cas_social: number | null;
  abandon: number | null;
  // End-of-year conseil de classe decision fields - 2 means "not manually set, auto-compute" for
  // the tinyint flags (see annualReportCardCompute.ts's computeAnnualClassified/computeMustDismiss/
  // computeMustRepeat). promuEn is a classe_id (the classe the student will join if promoted),
  // null when not manually set. codeExclusion: 0=none, 2=Conduite, 3=Travail, 4=Ne peut trippler,
  // 6=Insolvable (1=Âge, 5=Abandon exist but aren't auto-computed here).
  isMannullalyClassified: number;
  isMannullalyDismissed: number;
  mustRepeat: number;
  promuEn: number | null;
  codeExclusion: number;
}
