// Response shape of GET api/configs/getAnnualReportCardParams (SchoolInfoController::
// getAnnualReportCardParams) - val1/val2 columns of the current school year's basic_school_config
// row, null when nothing has been saved yet. computationMethod: 1 = Calcul simple, 0 = Calcul
// complexe. affichagePromotion: 1 = show the student's next-year classe when promoted, 0 = leave
// it blank. See AnnualRcAvgManager.tsx.
export interface AnnualReportCardParams {
  computationMethod: number | null;
  affichagePromotion: number | null;
}
