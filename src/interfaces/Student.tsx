// Shape of StudentController::allStudentsOfClasse/allStudents' rows. `repeating`/`cas_social` are
// hardcoded to 0 by those endpoints (placeholder columns, not real data) - StudentManager overlays
// the real values from StudentClasseInfo (allStudClassOfAClasse) on top of these by stud_id.
export interface Student {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  bday: string | null;
  bplace: string | null;
  sexe: string;
  handicape: number | null;
  position: number | null;
  repeating: number;
  cas_social: number;
}
