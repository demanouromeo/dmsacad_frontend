export interface TtConfig {
  tt_config_id: number;
  start_time: string;
  duration_break1: number;
  duration_break2: number;
  period_duration: number;
  number_of_period_before_break1_start: number;
  number_of_period_before_break2_start: number;
  sy_id: number;
}

export interface Jour {
  jour_id: number;
  label: string;
  num: number;
  number_of_periods: number;
  sy_id: number;
}

export interface StaffMaxPeriods {
  staff_id: number;
  name: string;
  surname: string | null;
  max_periods_per_week: number;
}

export interface ClasseSubjectSetting {
  subject_classe_id: number;
  subject_id: number;
  subject_title: string;
  weight: number;
  numnber_of_period_per_week: number;
  commoncourse: number;
  staff_id: number | null;
  staff_name: string | null;
  staff_surname: string | null;
}

export interface ClasseCell {
  jour_id: number;
  period_number: number;
  subject_id: number;
  subject_title: string;
  staff_id: number | null;
  staff_name: string | null;
  staff_surname: string | null;
}

export interface StaffCell {
  jour_id: number;
  period_number: number;
  subject_id: number;
  subject_title: string;
  classe_id: number;
  classe_name: string;
}

// Same shape as StaffCell, plus the staff_id it belongs to - backs TimetableController::getAllStaffCells
// (the ADMIN-only bulk equivalent of getMyCells, returning every staff member's cells in one call so
// the frontend can group them by staff_id instead of looping the single-staff endpoint N times).
export interface AllStaffCell extends StaffCell {
  staff_id: number;
}

// Backs the official "individual time table" PDF/Excel export (My Timetable) - the auth-scoped
// staff member's own HR record (used as-is, blank/unmapped fields included - see
// TimetableController::getMyStaffInfo) plus their weekly load cap.
export interface StaffTimetableInfo {
  staff_id: number;
  name: string;
  surname: string | null;
  function: number;
  status: number | null;
  grade: string | null;
  diplome: string | null;
  specilitee: string | null;
  matiereEnseignee: string | null;
  longivity: number | null;
  max_periods_per_week: number;
}

// Backs TimetableGridView's "Change or Assign teacher" flow - one entry per already-placed period of
// the (classe, subject) pair whose day/period slot the selected teacher can't take without either a
// commoncourse-exempt combined session (not surfaced here - only genuine conflicts are) or the admin
// explicitly agreeing to free them from the other classe's conflicting period.
export interface TeacherAssignmentCollision {
  jour_id: number;
  jour_label: string;
  period_number: number;
  other_classe_id: number;
  other_classe_name: string;
  other_subject_id: number;
  other_subject_title: string;
}

export interface TeacherAssignmentPreview {
  status: boolean;
  message?: string;
  current_staff_id: number | null;
  current_staff_name: string | null;
  total_periods: number;
  free_periods: number;
  collisions: TeacherAssignmentCollision[];
}

export interface TeacherAssignmentResult {
  status: boolean;
  message: string;
  assigned_count?: number;
  freed_count?: number;
  skipped_count?: number;
}

export interface GenerateWarningEntry {
  classe_name: string;
  subject_title: string;
  count: number;
}

export interface GenerateResult {
  status: boolean;
  message: string;
  warnings?: {
    unassignedTeacher: GenerateWarningEntry[];
    noCapacity: GenerateWarningEntry[];
  };
}

export interface SendEmailsWarningEntry {
  staff_name: string;
}

export interface SendEmailsResult {
  status: boolean;
  message: string;
  sentCount?: number;
  warnings?: {
    noEmail: SendEmailsWarningEntry[];
    sendFailed: SendEmailsWarningEntry[];
  };
}
