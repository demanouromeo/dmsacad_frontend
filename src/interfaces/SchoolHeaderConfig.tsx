// Mirrors the raw column set SchoolInfoController::allSchoolConfigOfYear selects from
// `basic_school_config` - snake_case DB column names, not remapped to a local convention,
// since this is read-only data consumed as-is (school header for printed/exported documents).
export interface SchoolHeaderConfig {
  id: number;
  number_of_sequences: number | null;
  classe_max_size: number | null;
  name_fr: string | null;
  name_en: string | null;
  del_regionale_fr: string | null;
  del_regionale_en: string | null;
  del_dept_fr: string | null;
  del_dept_en: string | null;
  phone1: number | string | null;
  email: string | null;
  pobox: string | null;
  logo: string | null;
  logo_path: string | null;
  type: string | null;
  date_signature: string | null;
  lieu_signature: string | null;
  school_matricule: string | null;
  ref_transfert: string | null;
  ref_document: string | null;
}
