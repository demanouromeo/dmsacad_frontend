import { ClasseReader } from "../dbmanger/ClasseReader";
import { StudentReader } from "../dbmanger/StudentReader";
import {
  loadAnnualApcReportCardDataForClasse,
  loadAnnualReportCardDataForClasse,
} from "./reportCard/loadAnnualReportCardData";
import { buildTimestampedFilename, exportRowsToPdf, type ExportColumn } from "./exportData";
import type { SchoolHeader } from "./exportHeader";
import type { StudentSearchResult } from "../interfaces/StudentSearchResult";

// "Parcours de l'élève" - one row per school year the student was enrolled in, with the term/annual
// averages, total absences and annual decision of that year. The figures come from the very same
// annual report-card pipeline (loadAnnual*ReportCardDataForClasse) the Promotion module and the
// annual bulletin use, run on the student's classe of that year, so they match those screens.

export interface StudentJourneyRow {
  year: string;
  section: string;
  classeName: string;
  // "" = no real mark recorded yet for that term / the year.
  moyTrim: [string, string, string];
  moyAnnuelle: string;
  totalAbsences: string;
  decision: string;
}

const formatAvg = (value: number): string => value.toFixed(2);

const decisionLabel = (kind: string): string => {
  switch (kind) {
    case "promu":
      return "Admis";
    case "redouble":
      return "Redouble";
    case "exclu":
      return "Exclu";
    case "redoubleSiEchec":
      return "Redouble si échec";
    case "nc":
      return "NC";
    default:
      return "";
  }
};

interface JourneyParams {
  accessToken: string | null;
  connection: string;
  schoolHeader: SchoolHeader;
  language: "fr" | "en";
}

const loadRowForEnrolment = async (
  params: JourneyParams,
  enrolment: StudentSearchResult,
): Promise<StudentJourneyRow> => {
  const { accessToken, connection, schoolHeader, language } = params;
  const year = enrolment.year ?? "";
  const section = enrolment.section ?? "";
  const row: StudentJourneyRow = {
    year,
    section,
    classeName: enrolment.classe_name ?? "",
    moyTrim: ["", "", ""],
    moyAnnuelle: "",
    totalAbsences: "",
    decision: "",
  };
  if (!enrolment.year || !enrolment.section || enrolment.classe_id === null) {
    return row;
  }
  const classeId = enrolment.classe_id;

  const [classes, apcLevelList, studentClasseList] = await Promise.all([
    ClasseReader.fetchClasses(accessToken, connection, year, section),
    ClasseReader.fetchApcLevels(accessToken, connection, year, section),
    StudentReader.fetchStudentClasseOfClasse(accessToken, connection, year, classeId),
  ]);
  const classe = classes.find((c) => c.classe_id === classeId);
  if (!classe) {
    return row;
  }
  const isApc = apcLevelList.some((entry) => entry.level === classe.level && entry.activated);
  const loaderParams = {
    accessToken,
    connection,
    schoolYear: year,
    section,
    classes,
    schoolHeader,
    language,
    classeId,
  };

  // The decision is only shown once the end-of-year promotion has been worked on for this classe
  // (some student has a saved promotion target or a manual dismiss/repeat/classified choice) -
  // otherwise it would just be the live preview of an unfinished year.
  const promotionDone = studentClasseList.some(
    (info) =>
      info.promuEn !== null ||
      info.mustRepeat !== 2 ||
      info.isMannullalyDismissed !== 2 ||
      info.isMannullalyClassified !== 2,
  );

  if (isApc) {
    const data = await loadAnnualApcReportCardDataForClasse(loaderParams);
    const s = data.students.find((st) => st.studId === enrolment.stud_id);
    if (!s) {
      return row;
    }
    row.moyTrim = [0, 1, 2].map((i) =>
      s.subjects.some((sub) => sub.notes[i] !== null) ? formatAvg(s.bilanTrimByTerm[i]) : "",
    ) as StudentJourneyRow["moyTrim"];
    if (!s.isAnnualAvgEmpty) {
      row.moyAnnuelle = formatAvg(s.avgAnnual);
      if (promotionDone) {
        row.decision = decisionLabel(s.decision.kind);
      }
    }
    row.totalAbsences = String(s.disciplineAnnual.absNonJust + s.disciplineAnnual.absJust);
    return row;
  }

  const data = await loadAnnualReportCardDataForClasse(loaderParams);
  const s = data.students.find((st) => st.studId === enrolment.stud_id);
  if (!s) {
    return row;
  }
  // notes holds the 6 dbsequences; term i (0-based) owns indexes 2i and 2i+1.
  row.moyTrim = [0, 1, 2].map((i) =>
    s.subjects.some((sub) => sub.notes[2 * i] !== null || sub.notes[2 * i + 1] !== null)
      ? formatAvg(s.termSummaries[i].bilanTrim)
      : "",
  ) as StudentJourneyRow["moyTrim"];
  if (!s.isAnnualAvgEmpty) {
    row.moyAnnuelle = formatAvg(s.avgAnnual);
    if (promotionDone) {
      row.decision = decisionLabel(s.decision.kind);
    }
  }
  row.totalAbsences = String(s.disciplineAnnual.absNonJust + s.disciplineAnnual.absJust);
  return row;
};

// Builds the journey rows (school years ascending) from one student's search-result enrolments.
export const loadStudentJourney = async (
  params: JourneyParams,
  enrolments: StudentSearchResult[],
): Promise<StudentJourneyRow[]> => {
  const sorted = enrolments
    .filter((e) => e.year)
    .sort((a, b) => (a.year ?? "").localeCompare(b.year ?? ""));
  const rows: StudentJourneyRow[] = [];
  // One enrolment at a time: each one already fans out into a bounded pool of requests.
  for (const enrolment of sorted) {
    rows.push(await loadRowForEnrolment(params, enrolment));
  }
  return rows;
};

export const exportStudentJourneyToPdf = async (
  student: { name: string; surname: string | null; sexe: string | null; bplace: string | null; bday: string },
  rows: StudentJourneyRow[],
  schoolHeader: SchoolHeader,
): Promise<void> => {
  const fullName = `${student.name} ${student.surname ?? ""}`.trim();
  const columns: ExportColumn<StudentJourneyRow>[] = [
    { header: "#", accessor: (_r, i) => i + 1, cellWidth: 8 },
    { header: "Année scolaire", accessor: (r) => r.year },
    { header: "Section", accessor: (r) => r.section.charAt(0).toUpperCase() + r.section.slice(1) },
    { header: "Classe", accessor: (r) => r.classeName },
    { header: "Moy. trim. 1", accessor: (r) => r.moyTrim[0] },
    { header: "Moy. trim. 2", accessor: (r) => r.moyTrim[1] },
    { header: "Moy. trim. 3", accessor: (r) => r.moyTrim[2] },
    { header: "Moy. annuelle", accessor: (r) => r.moyAnnuelle },
    { header: "Total absences", accessor: (r) => r.totalAbsences },
    { header: "Décision annuelle", accessor: (r) => r.decision },
  ];
  const subtitle = `Sexe: ${student.sexe ?? "-"}    Lieu naiss.: ${student.bplace || "-"}    Date nai.: ${student.bday || "-"}`;
  await exportRowsToPdf(
    `Parcours de l'élève ${fullName}`,
    buildTimestampedFilename("Parcours de l'élève", [fullName], "pdf"),
    columns,
    rows,
    schoolHeader,
    false,
    true,
    subtitle,
    "landscape",
    "below",
  );
};
