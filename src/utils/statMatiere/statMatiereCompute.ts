import { round2 } from "../reportCard/reportCardCompute";
import {
  buildStatGroupeesBilanRow,
  getAppreciation,
  type StatGroupeesRow,
} from "../statGroupees/statGroupeesCompute";

// Pure row-building for the "Statistiques par matière" module - one page-block per subject, each
// listing every classe that teaches it (grouped by level, with a "Bilan du niv. N" subtotal row per
// level) ending in a "Bilan {matière}" row for the whole subject. No fetching here, same "pure
// computation layer" convention as pvCompute.ts/statGroupeesCompute.ts. Reuses statGroupeesCompute's
// `StatGroupeesRow` shape, `getAppreciation` (the shared success-rate-to-label ladder, confirmed
// identical against this report's own samples) and `buildStatGroupeesBilanRow` (the sum-vs-average
// aggregation rules, also confirmed identical) unchanged.

const isFemale = (sexe: string): boolean => sexe.toLowerCase() === "f";

const pct = (numerator: number, denominator: number): number =>
  denominator > 0 ? round2((numerator / denominator) * 100) : 0;

export interface StatMatiereParticipant {
  sexe: string;
  moy: number;
}

// buildStatMatiereClasseRow() - one (classe, subject) row. Unlike Stat Groupées (whole-classe
// average, where PRESENTS===EFFECTIF always since every roster student already has an overall
// average), participation here is subject-specific: EFFECTIF is the classe's full roster,
// `participants` is only the students who have at least one non-empty mark for THIS subject this
// period (see loadStatMatiereData.ts) - MOY.GENE/MOY.MAX/MOY.MIN/MOY.>=10/%RÉUSSITE are all computed
// over that participants subset only, confirmed against the sample PDFs (a classe with zero
// participants shows MOY.GENE/MAX/MIN = 0.0 and %RÉUSSITE = 0%, not NaN).
export const buildStatMatiereClasseRow = (
  classeName: string,
  rosterSexe: string[],
  participants: StatMatiereParticipant[],
): StatGroupeesRow => {
  const effectifG = rosterSexe.filter((s) => !isFemale(s)).length;
  const effectifF = rosterSexe.filter(isFemale).length;
  const effectifT = rosterSexe.length;

  const presG = participants.filter((p) => !isFemale(p.sexe));
  const presF = participants.filter((p) => isFemale(p.sexe));
  const presentsG = presG.length;
  const presentsF = presF.length;
  const presentsT = participants.length;

  const sup10G = presG.filter((p) => p.moy >= 10).length;
  const sup10F = presF.filter((p) => p.moy >= 10).length;
  const sup10T = participants.filter((p) => p.moy >= 10).length;

  const moys = participants.map((p) => p.moy);
  const moyGene = presentsT > 0 ? round2(moys.reduce((a, b) => a + b, 0) / presentsT) : 0;
  const moyMax = presentsT > 0 ? Math.max(...moys) : 0;
  const moyMin = presentsT > 0 ? Math.min(...moys) : 0;
  const reussiteT = pct(sup10T, presentsT);

  return {
    classeName,
    moyGene,
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
    sup10T,
    reussiteG: pct(sup10G, presentsG),
    reussiteF: pct(sup10F, presentsF),
    reussiteT,
    moyMax,
    moyMin,
    appreciation: getAppreciation(reussiteT),
  };
};

// buildLevelBilanRow()/buildSubjectBilanRow() - thin wrappers over buildStatGroupeesBilanRow (fully
// generic reduction over a list of already-built rows, confirmed to already implement exactly the
// sum-vs-unweighted-average rules this report needs) with the classeName overridden. Called twice
// per subject: once per level (over that level's classe rows) and once more over the resulting
// level-bilan rows to get the subject-wide bilan - the same "average of averages" the samples show
// (e.g. "Bilan Anglais"'s own %RÉUSSITE is the unweighted mean of its 7 "Bilan du niv." rows, not a
// flat mean of every individual classe row).
export const buildLevelBilanRow = (level: number, classeRows: StatGroupeesRow[]): StatGroupeesRow => ({
  ...buildStatGroupeesBilanRow(classeRows),
  classeName: `Bilan du niv. ${level}`,
});

export const buildSubjectBilanRow = (
  subjectTitle: string,
  levelBilanRows: StatGroupeesRow[],
): StatGroupeesRow => ({
  ...buildStatGroupeesBilanRow(levelBilanRows),
  classeName: `Bilan ${subjectTitle}`,
});

export interface StatMatiereLevelBlock {
  level: number;
  classeRows: StatGroupeesRow[];
  bilanRow: StatGroupeesRow;
}

// subjectBilanRow is null when the subject has zero classes assigned - matching the samples' own
// empty-table pages (e.g. "Dictée/Correct. Orth.") which show only the header, no rows, no Bilan row.
export interface StatMatiereSubjectBlock {
  subjectTitle: string;
  levels: StatMatiereLevelBlock[];
  subjectBilanRow: StatGroupeesRow | null;
}
