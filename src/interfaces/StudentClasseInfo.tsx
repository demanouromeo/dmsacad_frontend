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
}
