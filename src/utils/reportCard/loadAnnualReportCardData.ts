import { StudentReader } from "../../dbmanger/StudentReader";
import { SubjectReader } from "../../dbmanger/SubjectReader";
import { StaffReader } from "../../dbmanger/StaffReader";
import { ClassifiedParamReader } from "../../dbmanger/ClassifiedParamReader";
import { SchoolInfoReader } from "../../dbmanger/SchoolInfoReader";
import { MarkReader } from "../../dbmanger/MarkReader";
import { DisciplineReader } from "../../dbmanger/DisciplineReader";
import { computeDbSequence } from "../markSequence";
import { computeIsTechnique } from "../schoolTypes";
import type { SchoolHeader } from "../exportHeader";
import type { Classe } from "../../interfaces/Classe";
import type { Mark } from "../../interfaces/Mark";
import type { Staff } from "../../interfaces/Staff";
import type { ReportCardData } from "../../interfaces/ReportCard";
import type { AnnualReportCardData, AnnualReportCardDataApc } from "../../interfaces/AnnualReportCard";
import {
  buildReportCardData,
  type ReportCardRosterEntry,
  type ReportCardSubjectBundle,
} from "./reportCardCompute";
import {
  buildAnnualReportCardData,
  buildAnnualReportCardDataApc,
  type AnnualSubjectBundle,
  type AnnualSubjectBundleApc,
} from "./annualReportCardCompute";

// Extracted from ReportCardManager.tsx so the Promotion module (PromotionManager.tsx) can reuse the
// exact same "same data load as annual RC" fetch/compute pipeline instead of duplicating it - see
// the plan's "Extract the annual-data loader so it's shared, not duplicated" section. Pure
// extraction: behavior is unchanged from the original useCallback closures, just parameterized
// explicitly instead of closing over component state.

export const buildStaffLabel = (staff: Staff | undefined): string => {
  if (!staff) {
    return "";
  }
  const civility = staff.civility?.trim();
  const surname = staff.surname?.trim() || staff.name;
  return civility ? `${civility} ${surname}` : surname;
};

interface AnnualLoaderParams {
  accessToken: string | null;
  connection: string;
  schoolYear: string;
  section: string;
  classes: Classe[];
  schoolHeader: SchoolHeader;
  language: "fr" | "en";
  classeId: number;
}

// Non-APC annual RC ("Bulletin Annuel") - fetches all 6 dbsequences per subject in one pass (rather
// than 3 separate term fetches), then reuses buildReportCardData 3x (once per term, slicing the
// matching 2 sequences out of the same already-fetched data) to get each term's real
// moyenneTrim/isClassified/rang/moyenneGenerale.
export const loadAnnualReportCardDataForClasse = async (
  params: AnnualLoaderParams,
): Promise<AnnualReportCardData> => {
  const { accessToken, connection, schoolYear, section, classes, schoolHeader, language, classeId } =
    params;
  const classe = classes.find((c) => c.classe_id === classeId);
  const [
    studentsRaw,
    studentClasseRaw,
    subjectsRaw,
    attributions,
    staffList,
    classifiedParam,
    annualParams,
  ] = await Promise.all([
    StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
    StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
    SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
    StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
    StaffReader.fetchStaff(accessToken, connection, schoolYear),
    ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
    SchoolInfoReader.fetchAnnualReportCardParams(accessToken, connection, schoolYear),
  ]);

  const studentClasseByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
  const roster: ReportCardRosterEntry[] = studentsRaw.map((s) => ({
    stud_id: s.stud_id,
    matricule: s.matricule,
    name: s.name,
    surname: s.surname,
    bday: s.bday,
    bplace: s.bplace,
    sexe: s.sexe,
    repeating: studentClasseByStudId.get(s.stud_id)?.repeating ?? s.repeating,
  }));

  const subjectsSorted = [...subjectsRaw].sort((a, b) =>
    a.subject_title.localeCompare(b.subject_title, "fr", { sensitivity: "base" }),
  );

  const staffById = new Map(staffList.map((s) => [s.staff_id, s]));
  const findStaffLabel = (subjectId: number) => {
    const attribution = attributions.find(
      (a) => a.subject_id === subjectId && a.classe_id === classeId,
    );
    return attribution ? buildStaffLabel(staffById.get(attribution.staff_id)) : "";
  };

  // One subject's whole-year marks, all 6 dbsequences at once.
  const subjectsData: AnnualSubjectBundle[] = await Promise.all(
    subjectsSorted.map(async (subject) => {
      const marksBySeq = new Map<number, Map<number, Mark>>();
      await Promise.all(
        [1, 2, 3, 4, 5, 6].map(async (dbsequence) => {
          const marks = await MarkReader.fetchSeqMarks(
            accessToken,
            connection,
            schoolYear,
            classeId,
            subject.subject_id,
            dbsequence,
          );
          marksBySeq.set(dbsequence, new Map(marks.map((m) => [m.stud_id, m])));
        }),
      );
      return { subject, staffLabel: findStaffLabel(subject.subject_id), marksBySeq };
    }),
  );

  // Term 1/2/3 full ReportCardData - sliced from the already-fetched 6-sequence data (no refetch),
  // each term's own discipline fetched separately.
  const termsData = (await Promise.all(
    [1, 2, 3].map(async (term) => {
      const disciplineRows = await DisciplineReader.fetchDisciplineOfClasse(
        accessToken,
        connection,
        schoolYear,
        term,
        classeId,
      );
      const disciplineByStudId = new Map(disciplineRows.map((r) => [r.stud_id, r]));
      const bundlesForTerm: ReportCardSubjectBundle[] = subjectsData.map((bundle) => ({
        kind: "nonApc" as const,
        subject: bundle.subject,
        staffLabel: bundle.staffLabel,
        marksBySeq: new Map([
          [1, bundle.marksBySeq.get(computeDbSequence(term, 1)) ?? new Map()],
          [2, bundle.marksBySeq.get(computeDbSequence(term, 2)) ?? new Map()],
        ]),
      }));
      return buildReportCardData({
        roster,
        subjectsData: bundlesForTerm,
        classifiedParam,
        thParam: null,
        disciplineByStudId,
        language,
      });
    }),
  )) as [ReportCardData, ReportCardData, ReportCardData];

  const classeNameById = new Map(classes.map((c) => [c.classe_id, c.classe_name]));

  return buildAnnualReportCardData({
    roster,
    subjectsData,
    termsData,
    classifiedParam,
    studentClasseByStudId,
    classe: {
      level: classe?.level ?? 0,
      avgDismissalTh: classe?.avgDismissalTh ?? 7.5,
      repeatUB: classe?.repeatUB ?? 9,
      totalAbsTh: classe?.totalAbsTh ?? 40,
      totalExclusionTh: classe?.totalExclusionTh ?? 8,
    },
    isTechnique: computeIsTechnique(schoolHeader.config?.type ?? ""),
    computationMethod: annualParams?.computationMethod ?? null,
    affichagePromotion: annualParams?.affichagePromotion === 1,
    classeNameById,
    language,
  });
};

// APC annual RC ("Bulletin Annuel") - unlike non-APC's single 6-dbsequence bulk fetch, APC
// competences are scoped per term_id with no equivalent linear numbering, so each subject's
// competences/marks are fetched once per term (3x).
export const loadAnnualApcReportCardDataForClasse = async (
  params: AnnualLoaderParams,
): Promise<AnnualReportCardDataApc> => {
  const { accessToken, connection, schoolYear, section, classes, schoolHeader, language, classeId } =
    params;
  const classe = classes.find((c) => c.classe_id === classeId);
  const [
    studentsRaw,
    studentClasseRaw,
    subjectsRaw,
    attributions,
    staffList,
    classifiedParam,
    annualParams,
  ] = await Promise.all([
    StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
    StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
    SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
    StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
    StaffReader.fetchStaff(accessToken, connection, schoolYear),
    ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
    SchoolInfoReader.fetchAnnualReportCardParams(accessToken, connection, schoolYear),
  ]);

  const studentClasseByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
  const roster: ReportCardRosterEntry[] = studentsRaw.map((s) => ({
    stud_id: s.stud_id,
    matricule: s.matricule,
    name: s.name,
    surname: s.surname,
    bday: s.bday,
    bplace: s.bplace,
    sexe: s.sexe,
    repeating: studentClasseByStudId.get(s.stud_id)?.repeating ?? s.repeating,
  }));

  const subjectsSorted = [...subjectsRaw].sort((a, b) =>
    a.subject_title.localeCompare(b.subject_title, "fr", { sensitivity: "base" }),
  );

  const staffById = new Map(staffList.map((s) => [s.staff_id, s]));
  const findStaffLabel = (subjectId: number) => {
    const attribution = attributions.find(
      (a) => a.subject_id === subjectId && a.classe_id === classeId,
    );
    return attribution ? buildStaffLabel(staffById.get(attribution.staff_id)) : "";
  };

  // Each subject's competences + marks, all 3 terms.
  const subjectsData: AnnualSubjectBundleApc[] = await Promise.all(
    subjectsSorted.map(async (subject) => {
      const perTerm = await Promise.all(
        [1, 2, 3].map(async (term) => {
          const competences = await SubjectReader.fetchCompetences(
            accessToken,
            connection,
            schoolYear,
            section,
            classeId,
            subject.subject_id,
            term,
          );
          const marksByCompetence = new Map<number, Map<number, Mark>>();
          await Promise.all(
            competences.map(async (comp) => {
              const marks = await MarkReader.fetchCompMarks(
                accessToken,
                connection,
                schoolYear,
                classeId,
                subject.subject_id,
                term,
                comp.subject_competence_id,
              );
              marksByCompetence.set(
                comp.subject_competence_id,
                new Map(marks.map((m) => [m.stud_id, m])),
              );
            }),
          );
          return { competences, marksByCompetence };
        }),
      );
      return {
        subject,
        staffLabel: findStaffLabel(subject.subject_id),
        competencesByTerm: [perTerm[0].competences, perTerm[1].competences, perTerm[2].competences],
        marksByCompetenceByTerm: [
          perTerm[0].marksByCompetence,
          perTerm[1].marksByCompetence,
          perTerm[2].marksByCompetence,
        ],
      } as AnnualSubjectBundleApc;
    }),
  );

  // Term 1/2/3 full ReportCardData, via the existing buildReportCardData with "apc" bundles - sliced
  // from the already-fetched per-term competences/marks (no refetch).
  const termsData = (await Promise.all(
    [1, 2, 3].map(async (term) => {
      const idx = term - 1;
      const disciplineRows = await DisciplineReader.fetchDisciplineOfClasse(
        accessToken,
        connection,
        schoolYear,
        term,
        classeId,
      );
      const disciplineByStudId = new Map(disciplineRows.map((r) => [r.stud_id, r]));
      const bundlesForTerm: ReportCardSubjectBundle[] = subjectsData.map((bundle) => ({
        kind: "apc" as const,
        subject: bundle.subject,
        staffLabel: bundle.staffLabel,
        competences: bundle.competencesByTerm[idx],
        marksByCompetence: bundle.marksByCompetenceByTerm[idx],
      }));
      return buildReportCardData({
        roster,
        subjectsData: bundlesForTerm,
        classifiedParam,
        thParam: null,
        disciplineByStudId,
        language,
      });
    }),
  )) as [ReportCardData, ReportCardData, ReportCardData];

  const classeNameById = new Map(classes.map((c) => [c.classe_id, c.classe_name]));

  return buildAnnualReportCardDataApc({
    roster,
    subjectsData,
    termsData,
    classifiedParam,
    studentClasseByStudId,
    classe: {
      level: classe?.level ?? 0,
      avgDismissalTh: classe?.avgDismissalTh ?? 7.5,
      repeatUB: classe?.repeatUB ?? 9,
      totalAbsTh: classe?.totalAbsTh ?? 40,
      totalExclusionTh: classe?.totalExclusionTh ?? 8,
    },
    isTechnique: computeIsTechnique(schoolHeader.config?.type ?? ""),
    computationMethod: annualParams?.computationMethod ?? null,
    affichagePromotion: annualParams?.affichagePromotion === 1,
    classeNameById,
    language,
  });
};
