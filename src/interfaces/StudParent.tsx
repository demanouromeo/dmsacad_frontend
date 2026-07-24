// The list/edit shape returned by StudParentController::allParents - joined with the linked
// account's login/email. Unlike Staff.tsx, the plaintext pwd is deliberately not selected/exposed
// here - ParentManager only ever writes a new password (add form / optional edit field), it never
// reveals an existing saved one.
export interface StudParent {
  p_id: number;
  p_name: string;
  p_surname: string | null;
  p_phone1: number;
  acc_id: number;
  login: string;
  email: string | null;
}

// StudParentController::childrenOfParent's return shape - backs both ParentManager's "children of
// selected parent" panel and the parent portal's own "my children" list.
export interface ParentChild {
  stud_id: number;
  matricule: string;
  name: string;
  surname: string | null;
  sexe: string;
  classe_id: number;
  classe_name: string;
  level: number;
  section_name: string;
}

// StudParentController::studentsOfClasseForAssignment's return shape - the classe-browse roster
// for the "add a student to the selected parent" panel, with the student's current parent (if any)
// surfaced inline via a LEFT JOIN.
export interface AssignableStudent {
  stud_id: number;
  matricule: string;
  name: string;
  surname: string | null;
  p_id: number | null;
  p_name: string | null;
  p_surname: string | null;
}
