import type { ReportCardData } from "../../interfaces/ReportCard";
import type {
  AnnualDecision,
  AnnualReportCardData,
  AnnualReportCardDataApc,
} from "../../interfaces/AnnualReportCard";
import type { DisciplineOfClasseRow } from "../../interfaces/DisciplineOfClasseRow";
import { getCompComment, getNonApcComment, formatRangText } from "../reportCard/reportCardCompute";
import { EXCLUSION_OPTIONS } from "../reportCard/reportCardPdfShared";

// Pure row-building/formatting for the "Procès Verbaux" (PV) module - no fetching here, mirroring
// effectifs.ts/reportCardCompute.ts's own "pure computation layer, independent of fetch/render"
// convention. PV reuses the report-card module's already-computed averages/ranks/classification/
// decision wholesale (see loadPvData.ts) rather than re-deriving any of it - this file only reshapes
// that data into PV's own table-row/text-formatting shape.

export type PvSortMode = "alpha" | "merit";

// One row of the term PV table. isApc decides which columns the exporter actually renders
// (eval1/eval2/rang for non-APC only, cote for APC only) - kept as a single shape rather than a
// discriminated union so buildPvTermRows/the exporters stay simple.
export interface PvTermRow {
  no: number;
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  bday: string;
  sexe: string;
  repeating: boolean;
  // null = no `discipline` row at all for this student this term (renders as "", not "0" - see the
  // user's explicit answer during planning). ABS.1 has no data source at all and is always blank,
  // so it isn't modeled here - the exporters render it as a bare empty column.
  absUnjust: number | null;
  eval1: number | null;
  eval2: number | null;
  moy: number;
  cote: string | null;
  rang: number | null;
  observation: string;
  isApc: boolean;
}

// One row of the annual PV table - unified shape for both APC and non-APC (the sample PDFs confirm
// both use the exact same DISCIPLINE/TRAVAIL/MOY/RANG/Décision column layout at the annual level,
// unlike the term PV which genuinely differs between the two).
export interface PvAnnualRow {
  no: number;
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  bday: string;
  sexe: string;
  repeating: boolean;
  // Each term's absunjust; null where that student has no discipline row that term.
  absByTerm: [number | null, number | null, number | null];
  // null only when all 3 terms are null (no discipline data at all this year); otherwise the sum,
  // treating a null term as 0 - matches disciplineAnnual's own already-coalesced convention.
  absTotal: number | null;
  travailByTerm: [number, number, number];
  moy: number;
  rangAnnuel: number | null;
  rangText: string;
  decisionText: string;
}

const getNonApcShortObservation = (moy: number): string => {
  const match = getNonApcComment(moy, "fr").match(/\(([^)]+)\)/);
  return match ? match[1] : "";
};

export const formatPvTermRang = (rang: number | null): string => (rang === null ? "NC" : String(rang));

// Plain, unpadded number display ("7", "9.66", not "07.00") - matches the sample PVs' own raw
// styling, same "Mark values are raw numbers" precedent as exportAllMarksReport.ts's own per-mark
// formatting (a different, non-exported helper there since it operates on a raw Mark row, not a
// plain already-rounded number like PV's moy/eval1/eval2 fields).
export const formatPvNumber = (n: number | null): string => (n === null ? "" : String(n));

// formatPvDecisionText() - plain-text counterpart of drawAnnualDecisionBlock's checkbox-style PDF
// drawing (reportCardPdfShared.ts), reusing its exact EXCLUSION_OPTIONS reason labels so PV and the
// bulletin never diverge in wording.
export const formatPvDecisionText = (decision: AnnualDecision, sexe: string): string => {
  const isFemale = sexe.toLowerCase() === "f";
  switch (decision.kind) {
    case "promu": {
      const label = isFemale ? "Promue en" : "Promu en";
      return decision.promuEnClasseName
        ? `${label}: ${decision.promuEnClasseName}`
        : isFemale
          ? "Promue"
          : "Promu";
    }
    case "redouble":
      return "Redouble";
    case "redoubleSiEchec":
      return decision.redoubleSiEchecText ?? "";
    case "nc":
      return "NC";
    case "exclu": {
      const label = isFemale ? "Exclue" : "Exclu";
      const reason = EXCLUSION_OPTIONS.find((opt) => opt.code === decision.exclusionCode)?.label;
      return reason ? `${label}: ${reason}` : label;
    }
    default:
      return "";
  }
};

export const buildPvTermRows = (
  reportCardData: ReportCardData,
  disciplineByStudId: Map<number, DisciplineOfClasseRow>,
  isApc: boolean,
): PvTermRow[] =>
  reportCardData.students.map((s) => {
    const discipline = disciplineByStudId.get(s.studId);
    return {
      no: 0,
      studId: s.studId,
      matricule: s.matricule,
      name: s.name,
      surname: s.surname,
      bday: s.bday,
      sexe: s.sexe,
      repeating: s.repeating,
      absUnjust: discipline ? discipline.absunjust : null,
      eval1: isApc ? null : s.evalAvg,
      eval2: isApc ? null : s.examAvg,
      moy: s.moyenneTrim,
      cote: isApc ? s.cote : null,
      rang: isApc ? null : s.rang,
      observation: isApc ? getCompComment(s.moyenneTrim) : getNonApcShortObservation(s.moyenneTrim),
      isApc,
    };
  });

type DisciplineByTermMaps = [
  Map<number, DisciplineOfClasseRow>,
  Map<number, DisciplineOfClasseRow>,
  Map<number, DisciplineOfClasseRow>,
];

interface AnnualRowBase {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  bday: string;
  sexe: string;
  repeating: boolean;
  travailByTerm: [number, number, number];
  moy: number;
  rangAnnuel: number | null;
  decision: AnnualDecision;
}

const buildPvAnnualRow = (base: AnnualRowBase, disciplineByTerm: DisciplineByTermMaps): PvAnnualRow => {
  const absByTerm = disciplineByTerm.map(
    (m) => m.get(base.studId)?.absunjust ?? null,
  ) as PvAnnualRow["absByTerm"];
  const absTotal = absByTerm.every((a) => a === null)
    ? null
    : absByTerm.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  return {
    no: 0,
    studId: base.studId,
    matricule: base.matricule,
    name: base.name,
    surname: base.surname,
    bday: base.bday,
    sexe: base.sexe,
    repeating: base.repeating,
    absByTerm,
    absTotal,
    travailByTerm: base.travailByTerm,
    moy: base.moy,
    rangAnnuel: base.rangAnnuel,
    rangText: formatRangText(base.rangAnnuel, base.sexe, "fr"),
    decisionText: formatPvDecisionText(base.decision, base.sexe),
  };
};

export const buildPvAnnualRowsNonApc = (
  annualData: AnnualReportCardData,
  disciplineByTerm: DisciplineByTermMaps,
): PvAnnualRow[] =>
  annualData.students.map((s) =>
    buildPvAnnualRow(
      {
        studId: s.studId,
        matricule: s.matricule,
        name: s.name,
        surname: s.surname,
        bday: s.bday,
        sexe: s.sexe,
        repeating: s.repeating,
        travailByTerm: [
          s.termSummaries[0].bilanTrim,
          s.termSummaries[1].bilanTrim,
          s.termSummaries[2].bilanTrim,
        ],
        moy: s.avgAnnual,
        rangAnnuel: s.rangAnnuel,
        decision: s.decision,
      },
      disciplineByTerm,
    ),
  );

export const buildPvAnnualRowsApc = (
  annualData: AnnualReportCardDataApc,
  disciplineByTerm: DisciplineByTermMaps,
): PvAnnualRow[] =>
  annualData.students.map((s) =>
    buildPvAnnualRow(
      {
        studId: s.studId,
        matricule: s.matricule,
        name: s.name,
        surname: s.surname,
        bday: s.bday,
        sexe: s.sexe,
        repeating: s.repeating,
        travailByTerm: s.bilanTrimByTerm,
        moy: s.avgAnnual,
        rangAnnuel: s.rangAnnuel,
        decision: s.decision,
      },
      disciplineByTerm,
    ),
  );

// sortPvRows() - the "Par ordre alphabétique" / "Par ordre de mérite" radio toggle (prior art:
// BasculementManager's sortByMerit/sortByName). Mérite sorts every row together by moy descending,
// classified and NC alike - it does not preserve the RC's own classified-first/NC-last grouping, per
// the user's literal spec ("sorted by term average... in descending order"). Renumbers NO to the
// printed position either way - NO is the row's position in the printed list, RANG (a separate field)
// stays the true computed academic rank regardless of print order.
export const sortPvRows = <T extends { name: string; surname: string; no: number; moy: number }>(
  rows: T[],
  mode: PvSortMode,
): T[] => {
  const sorted =
    mode === "alpha"
      ? [...rows].sort((a, b) =>
          `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "fr", {
            sensitivity: "base",
          }),
        )
      : [...rows].sort((a, b) => b.moy - a.moy);
  return sorted.map((row, index) => ({ ...row, no: index + 1 }));
};
