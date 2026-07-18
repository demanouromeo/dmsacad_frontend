// Shape of ClasseController::allClassesOfSubject's rows - a classe where the given subject is
// taught in the current section+year.
export interface ClasseOfSubject {
  classe_id: number;
  classe_name: string;
  level: number;
  subject_id: number;
}
