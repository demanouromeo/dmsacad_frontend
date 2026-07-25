import { round2 } from "../reportCard/reportCardCompute";

// Pure row-building for the "Statistiques Groupées" module - one row per classe, plus a "BILAN"
// summary row, reverse-engineered from the 4 sample PDFs (Trim1/Trim2/Trim3/Annuelles) against a
// real 24-classe/633-student roster. No fetching here, same "pure computation layer" convention as
// pvCompute.ts/effectifs.ts.

export interface StatGroupeesClasseStats {
  effectif: number;
  moyenneGenerale: number;
  minMax: [number, number];
  nombreMoyennes: number;
  tauxReussite: number;
}

export interface StatGroupeesRow {
  classeName: string;
  moyGene: number;
  effectifG: number;
  effectifF: number;
  effectifT: number;
  presentsG: number;
  presentsF: number;
  presentsT: number;
  participationG: number;
  participationF: number;
  participationT: number;
  sup10G: number;
  sup10F: number;
  sup10T: number;
  reussiteG: number;
  reussiteF: number;
  reussiteT: number;
  moyMax: number;
  moyMin: number;
  appreciation: string;
}

const isFemale = (sexe: string): boolean => sexe.toLowerCase() === "f";

const pct = (numerator: number, denominator: number): number =>
  denominator > 0 ? round2((numerator / denominator) * 100) : 0;

// getAppreciation() - ported verbatim from the user's reference getCommentOnSuccessRate(), keyed on
// the TOTAL %RÉUSSITE value. A distinct threshold/label table from getNonApcComment/getCote in
// reportCardCompute.ts - confirmed against every classe row of every sample PDF for the bands up to
// 50% (the samples never show a classe above ~55%); 60-89% bands are per the user's own algorithm.
export const getAppreciation = (successRate: number): string => {
  if (successRate < 0 || successRate > 100) {
    return "";
  }
  if (successRate < 20) return "Travail null";
  if (successRate < 30) return "Travail très faible";
  if (successRate < 40) return "Travail faible";
  if (successRate < 50) return "Travail médiocre";
  if (successRate < 60) return "Travail passable";
  if (successRate < 70) return "Assez-bien";
  if (successRate < 80) return "Bon travail";
  if (successRate < 90) return "Très Bon travail";
  return "Travail excellent";
};

// buildStatGroupeesRow() - one classe's row. The TOTAL columns (moyGene/sup10T/reussiteT/moyMax/
// moyMin) come straight from the classe's own already-computed classeStats (the exact same figures
// its report cards already show, see reportCardCompute.ts's buildReportCardData) rather than being
// recomputed here - only the GARÇONS/FILLES breakdowns are fresh. PRESENTS mirrors EFFECTIF exactly
// - there is no separate "student was present" concept anywhere in this app (a student is either on
// the roster or not), and every sample PDF confirms PRESENTS === EFFECTIF on every single row.
// %PARTICIPATIONS therefore reduces to a plain presents/effectif ratio that is always 100% (or 0%
// when that gender has zero students in the classe) - unusual-looking but confirmed by the samples,
// including how the BILAN row averages it (see buildStatGroupeesBilanRow below).
export const buildStatGroupeesRow = (
  classeName: string,
  students: { sexe: string; moy: number }[],
  classeStats: StatGroupeesClasseStats,
): StatGroupeesRow => {
  const garcons = students.filter((s) => !isFemale(s.sexe));
  const filles = students.filter((s) => isFemale(s.sexe));
  const effectifG = garcons.length;
  const effectifF = filles.length;
  const effectifT = classeStats.effectif;
  const presentsG = effectifG;
  const presentsF = effectifF;
  const presentsT = effectifT;
  const sup10G = garcons.filter((s) => s.moy >= 10).length;
  const sup10F = filles.filter((s) => s.moy >= 10).length;

  return {
    classeName,
    moyGene: classeStats.moyenneGenerale,
    effectifG,
    effectifF,
    effectifT,
    presentsG,
    presentsF,
    presentsT,
    participationG: pct(presentsG, effectifG),
    participationF: pct(presentsF, effectifF),
    participationT: pct(presentsT, effectifT),
    sup10G,
    sup10F,
    sup10T: classeStats.nombreMoyennes,
    reussiteG: pct(sup10G, effectifG),
    reussiteF: pct(sup10F, effectifF),
    reussiteT: classeStats.tauxReussite,
    moyMax: classeStats.minMax[1],
    moyMin: classeStats.minMax[0],
    appreciation: getAppreciation(classeStats.tauxReussite),
  };
};

// buildStatGroupeesBilanRow() - the "BILAN" summary row. Confirmed against all 4 sample PDFs:
// EFFECTIF/PRESENTS/MOY.>=10 are literal SUMS across every classe, while MOY.GENE/%PARTICIPATIONS/
// %RÉUSSITE are a plain UNWEIGHTED AVERAGE of the per-classe values, not recomputed from the summed
// counts (e.g. every sample's BILAN %participation FILLES is 70.83% - the average of the 24 classes'
// own 100%/0% values - not 173/173 = 100%, which the summed counts would give). MOY.MAX/MOY.MIN are
// the max/min across the classes' own max/min (mathematically identical to the whole-section max/min
// either way).
export const buildStatGroupeesBilanRow = (rows: StatGroupeesRow[]): StatGroupeesRow => {
  const n = rows.length;
  const sum = (select: (r: StatGroupeesRow) => number): number =>
    rows.reduce((total, r) => total + select(r), 0);
  const avg = (select: (r: StatGroupeesRow) => number): number => (n > 0 ? round2(sum(select) / n) : 0);

  const reussiteT = avg((r) => r.reussiteT);

  return {
    classeName: "BILAN",
    moyGene: avg((r) => r.moyGene),
    effectifG: sum((r) => r.effectifG),
    effectifF: sum((r) => r.effectifF),
    effectifT: sum((r) => r.effectifT),
    presentsG: sum((r) => r.presentsG),
    presentsF: sum((r) => r.presentsF),
    presentsT: sum((r) => r.presentsT),
    participationG: avg((r) => r.participationG),
    participationF: avg((r) => r.participationF),
    participationT: avg((r) => r.participationT),
    sup10G: sum((r) => r.sup10G),
    sup10F: sum((r) => r.sup10F),
    sup10T: sum((r) => r.sup10T),
    reussiteG: avg((r) => r.reussiteG),
    reussiteF: avg((r) => r.reussiteF),
    reussiteT,
    moyMax: n > 0 ? Math.max(...rows.map((r) => r.moyMax)) : 0,
    moyMin: n > 0 ? Math.min(...rows.map((r) => r.moyMin)) : 0,
    appreciation: getAppreciation(reussiteT),
  };
};
