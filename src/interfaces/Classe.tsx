export interface Classe {
  classe_id: number;
  classe_name: string;
  level: number;
  speciality_id: number | null;
  speciality_name: string | null;
  classe_master_id: number | null;
  classe_master_name: string | null;
  sg_id: number | null;
  vp_id: number | null;
  // End-of-year decision thresholds (classe_year) - used by the annual report card's
  // computeMustDismiss/computeMustRepeat algorithm, see annualReportCardCompute.ts.
  avgDismissalTh: number;
  repeatUB: number;
  passMark: number;
  totalAbsTh: number;
  totalExclusionTh: number;
}
