// Shape of StudentController::fillRateApc's rows - one row per (classe, subject, term,
// subject_competence) for a whole section+year, roster_count/filled_count already aggregated
// server-side. Deliberately competence-level, not pre-averaged into a per-subject rate - callers
// average these the same way MarkEntryManager.loadFillRates already does (see
// utils/fillRateAggregation.ts's averageApcRatesBySubjectTerm).
export interface FillRateApcRow {
  classe_id: number;
  classe_name: string;
  level: number;
  subject_id: number;
  subject_title: string;
  term_id: number;
  subject_competence_id: number;
  roster_count: number;
  filled_count: number;
}
