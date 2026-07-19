// Shape shared by StudentController::getSeqMarks (student_subject) and getCompMarks
// (stud_comp_mark) - both raw DB::select rows narrowed to just what mark entry needs.
export interface Mark {
  stud_id: number;
  mark: number | string;
  isEmpty: number;
}
