// One row of StudentController::searchStudents - one per (student, enrollment); year/section/classe
// are null for a student with no enrollment at all.
export interface StudentSearchResult {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  year: string | null;
  section: string | null;
  classe_name: string | null;
}
