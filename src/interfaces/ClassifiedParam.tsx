// Raw row shape returned by GET api/settings/classifiedParamOfYear (ClassifiedparamController::
// classifiedParamOfYear) - a plain DB::select, not cast through the Eloquent model, so classified/
// class_specific/term_specific come back as 0/1 rather than real booleans. See the backend CLAUDE.md
// ("Classified / Not Classified (NC) parameter") for what `classified`/`nb_matieres_rate` mean and how
// they drive report-card classification.
export interface ClassifiedParam {
  id: number;
  sy_id: number;
  nb_matieres_rate: number;
  total_coef_rate: number;
  classified: number;
  class_specific: number;
  term_specific: number;
}
