import { cycleOfLevel } from "../effectifs";
import { computeThEligibility } from "../reportCard/reportCardCompute";
import type { ThParam } from "../../interfaces/ThParam";
import {
  buildStatGroupeesBilanRow,
  buildStatGroupeesRow,
  type StatGroupeesRow,
} from "../statGroupees/statGroupeesCompute";

// "Synthèse des résultats" - reverse-engineered from 4 sample PDFs (Trim1/Trim2/Trim3/Annuelle), a
// 4-page document: the exact same per-classe StatGroupeesRow shape as "Statistiques Groupées"
// (identical 20 columns, confirmed column-for-column against the samples), rolled up 3 ways - by
// Cycle, by Niveau (level), and by Classe (the plain unrolled list) - each its own table with its
// own BILAN row, plus a 4th page ("TABLEAU D'HONNEUR") with a distinct gender-split honor-roll
// table. No fetching here, same "pure computation layer" convention as statGroupeesCompute.ts.

export interface LeveledClasseRow {
  level: number;
  row: StatGroupeesRow;
}

export interface SyntheseResultatsCycleRow {
  cycle: 1 | 2;
  row: StatGroupeesRow;
}

export interface SyntheseResultatsNiveauRow {
  level: number;
  row: StatGroupeesRow;
}

export interface HonorRollRow {
  classeName: string;
  effectifG: number;
  effectifF: number;
  effectifT: number;
  thG: number;
  thF: number;
  thT: number;
  encG: number;
  encF: number;
  encT: number;
  felG: number;
  felF: number;
  felT: number;
}

// buildAggregateRow() - a BILAN-shaped rollup row for an arbitrary group of classe rows (one cycle,
// one niveau, or the whole classe list), reusing buildStatGroupeesBilanRow's own sum/avg/true-max-
// min logic verbatim (only the label differs) rather than duplicating it. The 4 sample PDFs'
// "Par Cycle"/"Par Niveau" tables show their own BILAN row's MOY.MAX/MOY.MIN reusing the last
// cycle's/niveau's own value instead of a true aggregate (while the "Par Classe" table's BILAN row
// correctly shows the true max/min) - a legacy computation bug, not replicated here: every BILAN row
// in this module consistently shows the true max/min across its own subgroup.
export const buildAggregateRow = (rows: StatGroupeesRow[], label: string): StatGroupeesRow => ({
  ...buildStatGroupeesBilanRow(rows),
  classeName: label,
});

export const groupByCycle = (leveled: LeveledClasseRow[]): SyntheseResultatsCycleRow[] => {
  const cycles: Record<1 | 2, StatGroupeesRow[]> = { 1: [], 2: [] };
  leveled.forEach(({ level, row }) => cycles[cycleOfLevel(level)].push(row));
  return ([1, 2] as const)
    .filter((cycle) => cycles[cycle].length > 0)
    .map((cycle) => ({ cycle, row: buildAggregateRow(cycles[cycle], `Cycle ${cycle}`) }));
};

export const groupByNiveau = (leveled: LeveledClasseRow[]): SyntheseResultatsNiveauRow[] => {
  const byLevel = new Map<number, StatGroupeesRow[]>();
  leveled.forEach(({ level, row }) => {
    const existing = byLevel.get(level);
    if (existing) {
      existing.push(row);
    } else {
      byLevel.set(level, [row]);
    }
  });
  return Array.from(byLevel.keys())
    .sort((a, b) => a - b)
    .map((level) => ({ level, row: buildAggregateRow(byLevel.get(level) ?? [], `Niveau ${level}`) }));
};

export interface HonorRollStudentInput {
  sexe: string;
  moy: number;
  isClassified: boolean;
  absNonJust: number;
}

const isFemale = (sexe: string): boolean => sexe.toLowerCase() === "f";

// buildHonorRollRow() - counts are CUMULATIVE/nested (deserves ⊇ encouragement ⊇ felicitation), not
// mutually-exclusive bands - confirmed both by computeThEligibility's own documented semantics (a
// félicitations-level student necessarily also meets the lower encouragement/deserves thresholds)
// and empirically: every one of the ~96 sampled classe rows satisfies TH >= Encouragements >=
// Félicitations, never the reverse, which independent exclusive-band counts would not guarantee.
// Distinct from syntheseGlobaleCompute.ts's tri-tier columns, which use an else-if EXCLUSIVE cascade
// because that report's own headers spell out non-overlapping numeric brackets - this report's
// headers are plain category names with no bracket notation.
export const buildHonorRollRow = (
  classeName: string,
  students: HonorRollStudentInput[],
  thParam: ThParam | null,
): HonorRollRow => {
  const garcons = students.filter((s) => !isFemale(s.sexe));
  const filles = students.filter((s) => isFemale(s.sexe));

  const countBy = (list: HonorRollStudentInput[], flag: "deserves" | "encouragement" | "felicitation") =>
    list.filter((s) => computeThEligibility(thParam, s.absNonJust, s.moy, s.isClassified)[flag]).length;

  return {
    classeName,
    effectifG: garcons.length,
    effectifF: filles.length,
    effectifT: students.length,
    thG: countBy(garcons, "deserves"),
    thF: countBy(filles, "deserves"),
    thT: countBy(students, "deserves"),
    encG: countBy(garcons, "encouragement"),
    encF: countBy(filles, "encouragement"),
    encT: countBy(students, "encouragement"),
    felG: countBy(garcons, "felicitation"),
    felF: countBy(filles, "felicitation"),
    felT: countBy(students, "felicitation"),
  };
};

export { buildStatGroupeesRow, buildStatGroupeesBilanRow, type StatGroupeesRow };
