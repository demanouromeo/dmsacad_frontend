// Shape of StaffController::AllAttributionsOfSection's rows - one row per (subject, classe, staff)
// assignment in the current section+year. `name` is staff.name only (no surname) - callers that
// need disambiguation look the staff_id up in the already-loaded staff list instead.
export interface CourseAssignment {
  level: number;
  classe_name: string;
  subject_title: string;
  name: string;
  subject_id: number;
  classe_id: number;
  staff_id: number;
  subject_classe_id: number;
  // subject_classe_staff.id - unique per assignment row, used as the React key / bulk-selection key
  // since the same classe+subject can repeat across rows (multiple teachers) and the same classe can
  // repeat across rows (multiple subjects for one teacher).
  id: number;
}
