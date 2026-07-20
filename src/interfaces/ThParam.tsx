// Raw row shape returned by GET api/th/thParamOfYear (ThParamController::thParamOfYear) - a plain
// DB::select of the thparam table, scoped to one row per school year (sy_id). See the backend
// CLAUDE.md-style docs in ThParamManager.tsx for what these fields drive (Tableau d'honneur /
// Honors Roll eligibility).
export interface ThParam {
  th_id: number;
  lb: number;
  ub: number;
  lb_default: number;
  ub_default: number;
  seuil_abs: number;
  seuil_abs_default: number;
  sy_id: number;
  val1: number;
}
