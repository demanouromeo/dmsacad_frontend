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
  // Present in the backend's list response (accounts still store plaintext passwords).
  // StaffManager's per-row eye toggle reveals this on demand - never include it in CSV/PDF export
  // columns or anywhere else it could leak beyond that explicit, one-row-at-a-time reveal.
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
