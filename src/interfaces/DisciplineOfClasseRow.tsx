// Shape of StudentController::getDisciplineOfClasse's rows - real per-(classe, term) discipline
// values, using the `discipline` table's own DB column names (unlike DisciplineRosterRow's seed,
// which uses saveOrUpdateABS's payload key names). Only students with an existing `discipline` row
// for that term appear here - a student absent from this list simply has nothing entered yet.
export interface DisciplineOfClasseRow {
  stud_id: number;
  absunjust: number;
  absjust: number | null;
  lateness: number;
  blame: number | null;
  avertissement: number;
  nb_jour_exclusion: number;
  exclusion_definitive: number;
  consigne: number;
  commentOnDiscipline: string | null;
}
