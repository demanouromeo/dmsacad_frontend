// Shape of StudentController::allStudentsOfClasseForAbs's rows - a classe's roster already shaped
// as a discipline-entry "seed", with every discipline field hardcoded to a zeroed placeholder
// (matching saveOrUpdateABS's payload key names, not the discipline table's own column names) and
// `repeating` hardcoded to 0 - DisciplineManager overlays the real repeating flag from
// StudentReader.fetchStudentClasseOfClasse and the real discipline values from
// DisciplineReader.fetchDisciplineOfClasse on top of these, same "seed + overlay" pattern
// StudentManager already uses for its own roster.
export interface DisciplineRosterRow {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  bday: string | null;
  bplace: string | null;
  sexe: string;
  repeating: number;
  comment: string;
  nbAbs: number;
  lateness: number;
  consigne: number;
  avertissement: number;
  blame: number;
  dismissed: number;
  exclusion: number;
}
