// Shape of StudentController::fillRateNonApc's rows - one row per (classe, subject, dbsequence
// 1-6) for a whole section+year, roster_count/filled_count already aggregated server-side (see that
// method's comment for the query shape). dbsequence maps to (term, sequence) via
// termAndSequenceFromDbsequence in utils/markSequence.ts.
export interface FillRateNonApcRow {
  classe_id: number;
  classe_name: string;
  level: number;
  subject_id: number;
  subject_title: string;
  dbsequence: number;
  roster_count: number;
  filled_count: number;
}
