// One row of StudentController::searchStudents - one per (student, enrollment); year/section/classe
// are null for a student with no enrollment at all.
export interface StudentSearchResult {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  sexe: string | null;
  bday: string | null;
  bplace: string | null;
  // That enrollment's own flag (0/1), so it can differ from one school year to the next.
  repeating: number | null;
  year: string | null;
  section: string | null;
  classe_name: string | null;
}
