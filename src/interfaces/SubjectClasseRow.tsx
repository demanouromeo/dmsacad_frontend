// Shape of SubjectController::subjectOfClasse's rows - a subject already assigned to a specific
// classe, joined with its groupe. coef/groupe_id are the two fields editable inline on this screen.
export interface SubjectClasseRow {
  subject_id: number;
  subject_title: string;
  coef: number;
  groupe_id: number;
  groupe_name: string;
  classe_id: number;
}
