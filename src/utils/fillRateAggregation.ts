import type { FillRateNonApcRow } from "../interfaces/FillRateNonApcRow";
import type { FillRateApcRow } from "../interfaces/FillRateApcRow";
import type { CourseAssignment } from "../interfaces/CourseAssignment";
import { termAndSequenceFromDbsequence } from "./markSequence";

// A per-classe/subject/period fill-rate cell, already resolved to whichever source (non-APC
// dbsequence or APC competence-average) applies to that classe's level - see mergeToUnifiedCells.
// `sequence` is null for APC cells since APC marks have no sequence axis (a term-level rate, not a
// sequence-level one).
export interface FillRateCell {
  section: string;
  classe_id: number;
  classe_name: string;
  level: number;
  subject_id: number;
  subject_title: string;
  term: number;
  sequence: number | null;
  rate: number | null;
}

// One row of a pivoted view (per classe/subject/term/teacher) - same flat shape for every axis so
// the tabular and graphical (FillRateChartDialog) renderers don't need to branch per axis.
export interface FillRatePivotRow {
  key: string;
  label: string;
  rate: number | null;
}

// roster_count is 0 for a classe with no enrolled students yet - null (not 0%) signals "no data",
// same convention MarkEntryManager's subjectFillRates already uses for a subject with zero APC
// competences this term.
export const buildCellRate = (row: { roster_count: number; filled_count: number }): number | null =>
  row.roster_count === 0 ? null : (row.filled_count / row.roster_count) * 100;

const average = (rates: (number | null)[]): number | null => {
  const usable = rates.filter((r): r is number => r !== null);
  return usable.length === 0 ? null : usable.reduce((sum, r) => sum + r, 0) / usable.length;
};

interface ApcSubjectTermRate {
  classe_id: number;
  classe_name: string;
  level: number;
  subject_id: number;
  subject_title: string;
  term_id: number;
  rate: number | null;
}

// Averages FillRateApcRow's per-competence rows into one rate per (classe, subject, term) - the
// same competence-averaging MarkEntryManager.loadFillRates already does for a single classe, applied
// here across every APC classe of a section at once. A subject with zero competences defined for a
// given term simply has no rows in apcRows for that combo, so no entry is produced here either - the
// pivot views below only ever aggregate over data that actually exists, rather than materializing an
// explicit null row for "not configured yet".
export const averageApcRatesBySubjectTerm = (apcRows: FillRateApcRow[]): ApcSubjectTermRate[] => {
  const groups = new Map<string, FillRateApcRow[]>();
  apcRows.forEach((row) => {
    const key = `${row.classe_id}|${row.subject_id}|${row.term_id}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  });
  return Array.from(groups.values()).map((rows) => {
    const first = rows[0];
    return {
      classe_id: first.classe_id,
      classe_name: first.classe_name,
      level: first.level,
      subject_id: first.subject_id,
      subject_title: first.subject_title,
      term_id: first.term_id,
      rate: average(rows.map((r) => buildCellRate(r))),
    };
  });
};

// Picks non-APC or APC-averaged data per classe depending on isLevelApc(level) - both backend
// endpoints return every classe of the section regardless of its APC status, so this is what avoids
// double-counting (or picking the wrong source) for a given classe.
export const mergeToUnifiedCells = (
  section: string,
  nonApcRows: FillRateNonApcRow[],
  apcRows: FillRateApcRow[],
  isLevelApc: (level: number) => boolean,
): FillRateCell[] => {
  const nonApcCells: FillRateCell[] = nonApcRows
    .filter((row) => !isLevelApc(row.level))
    .map((row) => {
      const { term, sequence } = termAndSequenceFromDbsequence(row.dbsequence);
      return {
        section,
        classe_id: row.classe_id,
        classe_name: row.classe_name,
        level: row.level,
        subject_id: row.subject_id,
        subject_title: row.subject_title,
        term,
        sequence,
        rate: buildCellRate(row),
      };
    });
  const apcCells: FillRateCell[] = averageApcRatesBySubjectTerm(apcRows)
    .filter((entry) => isLevelApc(entry.level))
    .map((entry) => ({
      section,
      classe_id: entry.classe_id,
      classe_name: entry.classe_name,
      level: entry.level,
      subject_id: entry.subject_id,
      subject_title: entry.subject_title,
      term: entry.term_id,
      sequence: null,
      rate: entry.rate,
    }));
  return [...nonApcCells, ...apcCells];
};

const groupAverage = (
  cells: FillRateCell[],
  keyOf: (cell: FillRateCell) => string,
  labelOf: (cell: FillRateCell) => string,
): FillRatePivotRow[] => {
  const groups = new Map<string, { label: string; rates: (number | null)[] }>();
  cells.forEach((cell) => {
    const key = keyOf(cell);
    const group = groups.get(key);
    if (group) {
      group.rates.push(cell.rate);
    } else {
      groups.set(key, { label: labelOf(cell), rates: [cell.rate] });
    }
  });
  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    rate: average(group.rates),
  }));
};

// True once `cells` spans more than one section - used to decide whether a classe/subject label
// needs a section suffix to stay unambiguous (a classe/subject name isn't guaranteed unique across
// francophone/anglophone, even though classe_id/subject_id already keep their rates correctly
// separate either way).
const spansMultipleSections = (cells: FillRateCell[]): boolean =>
  new Set(cells.map((c) => c.section)).size > 1;

// One row per classe (averaged across every subject/term present in `cells` - callers pre-filter
// `cells` to a single term for a "per term" view, or pass every term for "annual").
export const pivotByClasse = (
  cells: FillRateCell[],
  sectionLabel: (section: string) => string,
): FillRatePivotRow[] => {
  const mixedSections = spansMultipleSections(cells);
  return groupAverage(
    cells,
    (c) => `${c.section}|${c.classe_id}`,
    (c) => (mixedSections ? `${c.classe_name} (${sectionLabel(c.section)})` : c.classe_name),
  );
};

// One row per subject (averaged across every classe/term present in `cells`).
export const pivotBySubject = (
  cells: FillRateCell[],
  sectionLabel: (section: string) => string,
): FillRatePivotRow[] => {
  const mixedSections = spansMultipleSections(cells);
  return groupAverage(
    cells,
    (c) => `${c.section}|${c.subject_id}`,
    (c) => (mixedSections ? `${c.subject_title} (${sectionLabel(c.section)})` : c.subject_title),
  );
};

// One row per term (1-3), averaged across every classe/subject - always spans the whole year
// regardless of any term filter, since "per term" is the point of this axis.
export const pivotByTerm = (
  cells: FillRateCell[],
  termLabel: (term: number) => string,
): FillRatePivotRow[] => groupAverage(cells, (c) => String(c.term), (c) => termLabel(c.term));

// Single-row whole-school annual average - the "Annuel" axis's headline number, spanning every
// classe/subject/term at once.
export const pivotAnnual = (cells: FillRateCell[], annualLabel: string): FillRatePivotRow[] => [
  { key: "annual", label: annualLabel, rate: average(cells.map((c) => c.rate)) },
];

// One row per teacher, attributing a cell's rate to every staff member assigned to that
// (section, classe_id, subject_id) via CourseAssignment - a subject co-taught by two teachers
// credits the same rate to both, since fill rate is a subject-level fact, not a per-teacher one.
export const pivotByTeacher = (
  cells: FillRateCell[],
  attributionsBySection: Map<string, CourseAssignment[]>,
  formatStaffLabel: (staffId: number) => string,
): FillRatePivotRow[] => {
  const groups = new Map<string, { label: string; rates: (number | null)[] }>();
  cells.forEach((cell) => {
    const attributions = attributionsBySection.get(cell.section) ?? [];
    attributions
      .filter((a) => a.classe_id === cell.classe_id && a.subject_id === cell.subject_id)
      .forEach((a) => {
        const key = String(a.staff_id);
        const group = groups.get(key);
        if (group) {
          group.rates.push(cell.rate);
        } else {
          groups.set(key, { label: formatStaffLabel(a.staff_id), rates: [cell.rate] });
        }
      });
  });
  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    rate: average(group.rates),
  }));
};
