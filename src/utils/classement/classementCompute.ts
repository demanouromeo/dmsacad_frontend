import { formatRangText } from "../reportCard/reportCardCompute";

// Pure row/group/rank building for the "Classement" module (Liste des premiers / Liste des 3
// premiers / Classement général) - no fetching here, mirroring statMatiereCompute.ts/pvCompute.ts's
// own "pure computation layer" convention. Reuses the report card module's own already-computed
// per-classe moyenneTrim/rang (term) or avgAnnual/rangAnnuel (annual) wholesale (see
// loadClassementData.ts) rather than re-deriving any average/rank - this file only aggregates those
// per-classe results across the whole section and re-ranks where the report type needs it.

// One student's already-computed report-card result, flattened across every classe of the section -
// classeRang is that student's own per-classe rank (report card's s.rang/s.rangAnnuel), null for a
// Not Classified student (see backend CLAUDE.md's "Classified / Not Classified (NC)" section) -
// never re-derived here, just carried through.
export interface ClassementRow {
  studId: number;
  name: string;
  surname: string;
  sexe: string;
  classeName: string;
  moy: number;
  classeRang: number | null;
}

export interface RankedClassementRow extends ClassementRow {
  no: number;
  rangText: string;
}

const fullName = (row: { name: string; surname: string }): string =>
  `${row.name} ${row.surname}`.trim();

// sortDescAndRank() - the report card's own "classified sorted by moy desc, sequential position, no
// tie-sharing" rule (buildReportCardData in reportCardCompute.ts), reapplied here at the whole-
// section level rather than per-classe - shared by both buildPremiersList and
// buildClassementGeneral below since both need a fresh section-wide rank, just over a different
// input subset.
const sortDescAndRank = (rows: ClassementRow[]): RankedClassementRow[] =>
  [...rows]
    .sort((a, b) => b.moy - a.moy)
    .map((row, index) => ({
      ...row,
      no: index + 1,
      rangText: formatRangText(index + 1, row.sexe, "fr"),
    }));

// "Liste des premiers" - each classe's #1 student (classeRang === 1, i.e. that classe's own
// report-card champion; a classe with zero classified students simply contributes no row), then
// re-ranked among themselves section-wide by moy descending - confirmed against the sample PDFs
// (the printed "Rang" column is NOT each student's per-classe rang, which would always read "1er").
export const buildPremiersList = (rows: ClassementRow[]): RankedClassementRow[] =>
  sortDescAndRank(rows.filter((r) => r.classeRang === 1));

// "Classement général" - every classified student (classeRang !== null) of the whole section,
// re-ranked section-wide by moy descending. NC students (classeRang === null) are excluded from the
// ranking entirely, matching the report card's own convention (formatRangText renders "NC" rather
// than a number for them) - not shown as a bare "NC" row here since no sample document shows one.
export const buildClassementGeneral = (rows: ClassementRow[]): RankedClassementRow[] =>
  sortDescAndRank(rows.filter((r) => r.classeRang !== null));

// One classe's group in the "Trois premiers" table - "no" is the classe's own position in the
// printed list (1..N, matching the sample's merged "No." column, one value per group not per
// student), not a per-student number.
export interface ClassementTroisPremiersGroup {
  no: number;
  classeName: string;
  rows: RankedClassementRow[];
}

// "Liste des 3 premiers" - each classe's top 3 (classeRang 1..3, sorted by that same classeRang -
// NOT re-ranked section-wide, unlike Liste des premiers/Classement général above: the printed Rang
// column here is each student's own per-classe rang, e.g. two different classes each show a "1er").
// classesInOrder is the caller-supplied level-then-name group order (matching every other whole-
// section module's classe sort convention); a classe with zero qualifying rows (empty roster, or
// every student NC) is dropped entirely rather than printed as an empty group.
export const buildTroisPremiersGroups = (
  classesInOrder: { classeName: string; rows: ClassementRow[] }[],
): ClassementTroisPremiersGroup[] => {
  const groups: ClassementTroisPremiersGroup[] = [];
  classesInOrder.forEach(({ classeName, rows }) => {
    const top3 = rows
      .filter((r) => r.classeRang !== null && r.classeRang <= 3)
      .sort((a, b) => (a.classeRang as number) - (b.classeRang as number))
      .map((r) => ({
        ...r,
        no: 0,
        rangText: formatRangText(r.classeRang, r.sexe, "fr"),
      }));
    if (top3.length > 0) {
      groups.push({ no: groups.length + 1, classeName, rows: top3 });
    }
  });
  return groups;
};

export { fullName };
