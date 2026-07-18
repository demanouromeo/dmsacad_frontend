// Shape of SubjectController::allCompetences1's rows - one competence_text for a specific
// (classe_id, sy_id, term_id, subject_id, section_id) combination.
export interface SubjectCompetence {
  subject_competence_id: number;
  classe_id: number;
  sy_id: number;
  term_id: number;
  subject_id: number;
  section_id: number;
  competence_text: string;
}
