import { StudentReader } from "../../dbmanger/StudentReader";
import { SubjectReader } from "../../dbmanger/SubjectReader";
import { StaffReader } from "../../dbmanger/StaffReader";
import { ClassifiedParamReader } from "../../dbmanger/ClassifiedParamReader";
import { SchoolInfoReader } from "../../dbmanger/SchoolInfoReader";
import { MarkReader } from "../../dbmanger/MarkReader";
import { DisciplineReader } from "../../dbmanger/DisciplineReader";
import { ThParamReader } from "../../dbmanger/ThParamReader";
import { computeDbSequence } from "../markSequence";
import { computeIsTechnique } from "../schoolTypes";
import { mapWithConcurrencyLimit } from "../concurrencyLimit";
import type { SchoolHeader } from "../exportHeader";
import type { Classe } from "../../interfaces/Classe";
import type { Mark } from "../../interfaces/Mark";
import type { SubjectCompetence } from "../../interfaces/SubjectCompetence";
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

// Caps how many concurrent MarkReader.fetch{Seq,Comp}Marks/fetchCompetences requests a single
// report-card load can have in flight - see concurrencyLimit.ts's comment for why (a full annual
// load fans out to dozens of these, which was enough to exceed the remote shared-hosting MySQL
// connection limit).
const MARK_FETCH_CONCURRENCY = 6;

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

interface TermLoaderParams {
  accessToken: string | null;
  connection: string;
  schoolYear: string;
  section: string;
  language: "fr" | "en";
  classeId: number;
  term: number;
  isApc: boolean;
}

// One classe's full term ReportCardData ("Bulletin de notes du X trimestre") - extracted from
// ReportCardManager.tsx's own loadReportCardDataForClasse useCallback so the parent portal
// (ParentChildDetailManager.tsx) can generate the exact same document (under a different title,
// "Relevé de notes...") for a single child, reusing exportReportCardsToPdf/
// exportNonApcReportCardsToPdf's existing student-subset support rather than a bespoke layout. Pure
// extraction: behavior unchanged from the original closure, just parameterized explicitly.
export const loadReportCardDataForClasse = async (params: TermLoaderParams): Promise<ReportCardData> => {
  const { accessToken, connection, schoolYear, section, language, classeId, term, isApc } = params;
  const [
    studentsRaw,
    studentClasseRaw,
    subjectsRaw,
    attributions,
    staffList,
    classifiedParam,
    thParam,
    disciplineRows,
  ] = await Promise.all([
    StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
    StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
    SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
    StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
    StaffReader.fetchStaff(accessToken, connection, schoolYear),
    ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
    ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear),
    DisciplineReader.fetchDisciplineOfClasse(accessToken, connection, schoolYear, term, classeId),
  ]);

  const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
  const roster: ReportCardRosterEntry[] = studentsRaw.map((s) => ({
    stud_id: s.stud_id,
    matricule: s.matricule,
    name: s.name,
    surname: s.surname,
    bday: s.bday,
    bplace: s.bplace,
    sexe: s.sexe,
    repeating: infoByStudId.get(s.stud_id)?.repeating ?? s.repeating,
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

  let subjectsData: ReportCardSubjectBundle[];
  if (isApc) {
    const withCompetences = await mapWithConcurrencyLimit(
      subjectsSorted,
      MARK_FETCH_CONCURRENCY,
      async (subject) => ({
        subject,
        competences: await SubjectReader.fetchCompetences(
          accessToken,
          connection,
          schoolYear,
          section,
          classeId,
          subject.subject_id,
          term,
        ),
      }),
    );
    const eligible = withCompetences.filter(({ competences }) => competences.length > 0);
    const competencePairs = eligible.flatMap(({ subject, competences }) =>
      competences.map((comp) => ({ subject, comp })),
    );
    const marksByPair = await mapWithConcurrencyLimit(
      competencePairs,
      MARK_FETCH_CONCURRENCY,
      async ({ subject, comp }) => ({
        subjectId: subject.subject_id,
        competenceId: comp.subject_competence_id,
        marks: await MarkReader.fetchCompMarks(
          accessToken,
          connection,
          schoolYear,
          classeId,
          subject.subject_id,
          term,
          comp.subject_competence_id,
        ),
      }),
    );
    const marksByCompetenceBySubjectId = new Map<number, Map<number, Map<number, Mark>>>();
    for (const { subjectId, competenceId, marks } of marksByPair) {
      if (!marksByCompetenceBySubjectId.has(subjectId)) {
        marksByCompetenceBySubjectId.set(subjectId, new Map());
      }
      marksByCompetenceBySubjectId
        .get(subjectId)!
        .set(competenceId, new Map(marks.map((m) => [m.stud_id, m])));
    }
    subjectsData = eligible.map(({ subject, competences }) => ({
      kind: "apc" as const,
      subject,
      competences,
      marksByCompetence: marksByCompetenceBySubjectId.get(subject.subject_id) ?? new Map(),
      staffLabel: findStaffLabel(subject.subject_id),
    }));
  } else {
    const seqPairs = subjectsSorted.flatMap((subject) =>
      [1, 2].map((seq) => ({ subject, seq })),
    );
    const marksByPair = await mapWithConcurrencyLimit(
      seqPairs,
      MARK_FETCH_CONCURRENCY,
      async ({ subject, seq }) => ({
        subjectId: subject.subject_id,
        seq,
        marks: await MarkReader.fetchSeqMarks(
          accessToken,
          connection,
          schoolYear,
          classeId,
          subject.subject_id,
          computeDbSequence(term, seq),
        ),
      }),
    );
    const marksBySeqBySubjectId = new Map<number, Map<number, Map<number, Mark>>>();
    for (const { subjectId, seq, marks } of marksByPair) {
      if (!marksBySeqBySubjectId.has(subjectId)) {
        marksBySeqBySubjectId.set(subjectId, new Map());
      }
      marksBySeqBySubjectId.get(subjectId)!.set(seq, new Map(marks.map((m) => [m.stud_id, m])));
    }
    subjectsData = subjectsSorted.map((subject) => ({
      kind: "nonApc" as const,
      subject,
      marksBySeq: marksBySeqBySubjectId.get(subject.subject_id) ?? new Map(),
      staffLabel: findStaffLabel(subject.subject_id),
    }));
  }

  const disciplineByStudId = new Map(disciplineRows.map((r) => [r.stud_id, r]));

  return buildReportCardData({
    roster,
    subjectsData,
    classifiedParam,
    thParam,
    disciplineByStudId,
    language,
  });
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

  // One subject's whole-year marks, all 6 dbsequences - flattened into a single concurrency-limited
  // pool across every (subject, dbsequence) pair rather than nested Promise.all's, which used to
  // fire all ~66 requests at once (see MARK_FETCH_CONCURRENCY's comment).
  const dbsequencePairs = subjectsSorted.flatMap((subject) =>
    [1, 2, 3, 4, 5, 6].map((dbsequence) => ({ subject, dbsequence })),
  );
  const marksByPair = await mapWithConcurrencyLimit(
    dbsequencePairs,
    MARK_FETCH_CONCURRENCY,
    async ({ subject, dbsequence }) => ({
      subjectId: subject.subject_id,
      dbsequence,
      marks: await MarkReader.fetchSeqMarks(
        accessToken,
        connection,
        schoolYear,
        classeId,
        subject.subject_id,
        dbsequence,
      ),
    }),
  );
  const marksBySeqBySubjectId = new Map<number, Map<number, Map<number, Mark>>>();
  for (const { subjectId, dbsequence, marks } of marksByPair) {
    if (!marksBySeqBySubjectId.has(subjectId)) {
      marksBySeqBySubjectId.set(subjectId, new Map());
    }
    marksBySeqBySubjectId.get(subjectId)!.set(dbsequence, new Map(marks.map((m) => [m.stud_id, m])));
  }
  const subjectsData: AnnualSubjectBundle[] = subjectsSorted.map((subject) => ({
    subject,
    staffLabel: findStaffLabel(subject.subject_id),
    marksBySeq: marksBySeqBySubjectId.get(subject.subject_id) ?? new Map(),
  }));

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

  // Each subject's competences + marks, all 3 terms - flattened into concurrency-limited pools
  // (first competences per (subject, term), then marks per (subject, term, competence)) instead of
  // triple-nested Promise.all's (see MARK_FETCH_CONCURRENCY's comment).
  const subjectTermPairs = subjectsSorted.flatMap((subject) =>
    [1, 2, 3].map((term) => ({ subject, term })),
  );
  const competencesByPair = await mapWithConcurrencyLimit(
    subjectTermPairs,
    MARK_FETCH_CONCURRENCY,
    async ({ subject, term }) => ({
      subject,
      term,
      competences: await SubjectReader.fetchCompetences(
        accessToken,
        connection,
        schoolYear,
        section,
        classeId,
        subject.subject_id,
        term,
      ),
    }),
  );
  const competenceTriples = competencesByPair.flatMap(({ subject, term, competences }) =>
    competences.map((comp) => ({ subject, term, comp })),
  );
  const marksByTriple = await mapWithConcurrencyLimit(
    competenceTriples,
    MARK_FETCH_CONCURRENCY,
    async ({ subject, term, comp }) => ({
      subjectId: subject.subject_id,
      term,
      competenceId: comp.subject_competence_id,
      marks: await MarkReader.fetchCompMarks(
        accessToken,
        connection,
        schoolYear,
        classeId,
        subject.subject_id,
        term,
        comp.subject_competence_id,
      ),
    }),
  );
  const marksByCompetenceBySubjectIdByTerm: Map<number, Map<number, Map<number, Mark>>>[] = [
    new Map(),
    new Map(),
    new Map(),
  ];
  for (const { subjectId, term, competenceId, marks } of marksByTriple) {
    const perTerm = marksByCompetenceBySubjectIdByTerm[term - 1];
    if (!perTerm.has(subjectId)) {
      perTerm.set(subjectId, new Map());
    }
    perTerm.get(subjectId)!.set(competenceId, new Map(marks.map((m) => [m.stud_id, m])));
  }
  const competencesBySubjectIdByTerm: Map<number, SubjectCompetence[]>[] = [
    new Map(),
    new Map(),
    new Map(),
  ];
  for (const { subject, term, competences } of competencesByPair) {
    competencesBySubjectIdByTerm[term - 1].set(subject.subject_id, competences);
  }
  const subjectsData: AnnualSubjectBundleApc[] = subjectsSorted.map((subject) => {
    const competencesByTerm = [1, 2, 3].map(
      (term) => competencesBySubjectIdByTerm[term - 1].get(subject.subject_id) ?? [],
    ) as AnnualSubjectBundleApc["competencesByTerm"];
    const marksByCompetenceByTerm = [1, 2, 3].map(
      (term) => marksByCompetenceBySubjectIdByTerm[term - 1].get(subject.subject_id) ?? new Map(),
    ) as AnnualSubjectBundleApc["marksByCompetenceByTerm"];
    return {
      subject,
      staffLabel: findStaffLabel(subject.subject_id),
      competencesByTerm,
      marksByCompetenceByTerm,
    };
  });

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
