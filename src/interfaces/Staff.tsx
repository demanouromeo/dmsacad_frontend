export interface Staff {
  staff_id: number;
  name: string;
  surname: string | null;
  phone1: string | null;
  function: number;
  sexe: string;
  civility: string | null;
  acc_id: number;
  login: string;
  // Present in the backend's list response (accounts still store plaintext passwords) - never
  // render/export this. It only exists here because updateManyStaffs is per-item full-replace and
  // this is where a caller would read the current value from if it ever needed to round-trip it.
  pwd: string;
  type: number;
  email: string | null;
  dob: string | null;
  pob: string | null;
  matricule: string | null;
  posting_decision: string | null;
  grade: string | null;
  region: string | null;
  department: string | null;
  arrodissement: string | null;
  numeroRecrutement: string | null;
  provenantDe: string | null;
  dateReprise: string | null;
  diplome: string | null;
  specilitee: string | null;
  matiereEnseignee: string | null;
  dateEntree: string | null;
  date1erePrise: string | null;
}
