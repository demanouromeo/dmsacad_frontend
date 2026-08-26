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
