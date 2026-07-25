import { DisciplineReader } from "../../dbmanger/DisciplineReader";
import {
  loadReportCardDataForClasse,
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../reportCard/loadAnnualReportCardData";
import type { ReportCardData } from "../../interfaces/ReportCard";
import type { AnnualReportCardData, AnnualReportCardDataApc } from "../../interfaces/AnnualReportCard";
import type { DisciplineOfClasseRow } from "../../interfaces/DisciplineOfClasseRow";
import type { Classe } from "../../interfaces/Classe";
import type { SchoolHeader } from "../exportHeader";

// Fetch orchestration for the PV module - reuses the report card module's own extracted,
// already-multi-consumer loaders (loadReportCardDataForClasse/loadAnnualReportCardDataForClasse/
// loadAnnualApcReportCardDataForClasse, src/utils/reportCard/loadAnnualReportCardData.ts) for every
// average/rank/classification/decision PV needs, adding only its own discipline fetch(es) - the
// existing loaders coalesce a missing discipline row to 0 internally and don't expose the raw
// per-student presence, which PV needs to render "" (not "0") for a student with no discipline row
// that term (see pvCompute.ts's PvTermRow.absUnjust/PvAnnualRow.absByTerm).

export type DisciplineByTermMaps = [
  Map<number, DisciplineOfClasseRow>,
  Map<number, DisciplineOfClasseRow>,
  Map<number, DisciplineOfClasseRow>,
];

const toDisciplineMap = (rows: DisciplineOfClasseRow[]): Map<number, DisciplineOfClasseRow> =>
  new Map(rows.map((r) => [r.stud_id, r]));

interface PvTermLoaderParams {
  accessToken: string | null;
  connection: string;
  schoolYear: string;
  section: string;
  classeId: number;
  term: number;
  isApc: boolean;
}

export interface PvTermData {
  reportCardData: ReportCardData;
  disciplineByStudId: Map<number, DisciplineOfClasseRow>;
}

export const loadPvTermData = async (params: PvTermLoaderParams): Promise<PvTermData> => {
  const { accessToken, connection, schoolYear, section, classeId, term, isApc } = params;
  const [reportCardData, disciplineRows] = await Promise.all([
    loadReportCardDataForClasse({
      accessToken,
      connection,
      schoolYear,
      section,
      language: "fr",
      classeId,
      term,
      isApc,
    }),
    DisciplineReader.fetchDisciplineOfClasse(accessToken, connection, schoolYear, term, classeId),
  ]);
  return { reportCardData, disciplineByStudId: toDisciplineMap(disciplineRows) };
};

interface PvAnnualLoaderParams {
  accessToken: string | null;
  connection: string;
  schoolYear: string;
  section: string;
  classes: Classe[];
  schoolHeader: SchoolHeader;
  classeId: number;
  isApc: boolean;
}

export interface PvAnnualData {
  annualData: AnnualReportCardData | AnnualReportCardDataApc;
  isApc: boolean;
  disciplineByTerm: DisciplineByTermMaps;
}

export const loadPvAnnualData = async (params: PvAnnualLoaderParams): Promise<PvAnnualData> => {
  const { accessToken, connection, schoolYear, section, classes, schoolHeader, classeId, isApc } = params;
  const annualLoaderParams = {
    accessToken,
    connection,
    schoolYear,
    section,
    classes,
    schoolHeader,
    language: "fr" as const,
    classeId,
  };
  const [annualData, disc1, disc2, disc3] = await Promise.all([
    isApc
      ? loadAnnualApcReportCardDataForClasse(annualLoaderParams)
      : loadAnnualReportCardDataForClasse(annualLoaderParams),
    DisciplineReader.fetchDisciplineOfClasse(accessToken, connection, schoolYear, 1, classeId),
    DisciplineReader.fetchDisciplineOfClasse(accessToken, connection, schoolYear, 2, classeId),
    DisciplineReader.fetchDisciplineOfClasse(accessToken, connection, schoolYear, 3, classeId),
  ]);
  return {
    annualData,
    isApc,
    disciplineByTerm: [toDisciplineMap(disc1), toDisciplineMap(disc2), toDisciplineMap(disc3)],
  };
};
