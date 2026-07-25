import type { Mark } from "../../interfaces/Mark";
import type { ClasseOfSubject } from "../../interfaces/ClasseOfSubject";
import { ClasseReader } from "../../dbmanger/ClasseReader";
import { SubjectReader } from "../../dbmanger/SubjectReader";
import { StudentReader } from "../../dbmanger/StudentReader";
import { MarkReader } from "../../dbmanger/MarkReader";
import { computeDbSequence } from "../markSequence";
import { computeSeqAverage, computeSubjectAverage, round2 } from "../reportCard/reportCardCompute";
import {
  buildLevelBilanRow,
  buildStatMatiereClasseRow,
  buildSubjectBilanRow,
  type StatMatiereParticipant,
  type StatMatiereSubjectBlock,
} from "./statMatiereCompute";
import type { StatGroupeesRow } from "../statGroupees/statGroupeesCompute";

// Fetch orchestration for "Statistiques par matière" - whole section+year, one call per subject.
// Iterates subjects SEQUENTIALLY (not all-parallel) to avoid firing hundreds of requests at once,
// same defensive precedent as MarkEntryManager.handleExportAllClassesMarks, reporting progress via
// onProgress so the screen can drive LoadingOverlay's progress bar subject-by-subject.

export type StatMatiereProgressCallback = (current: number, total: number, subjectTitle: string) => void;

interface BaseParams {
  accessToken: string | null;
  connection: string;
  schoolYear: string;
  section: string;
  onProgress?: StatMatiereProgressCallback;
}

const toMarkMap = (rows: Mark[]): Map<number, Mark> => new Map(rows.map((m) => [m.stud_id, m]));

// One student's subject average for ONE term - the shared building block for both the term loader
// (used directly) and the annual loader (called 3x per classe+subject, then averaged). Returns a
// Map<stud_id, average|null> for the whole classe roster in one pass (marks are already fetched
// per-classe, not per-student).
const fetchTermSubjectAverages = async (
  accessToken: string | null,
  connection: string,
  schoolYear: string,
  section: string,
  classeId: number,
  subjectId: number,
  term: number,
  isApc: boolean,
  studIds: number[],
): Promise<Map<number, number | null>> => {
  if (isApc) {
    const competences = await SubjectReader.fetchCompetences(
      accessToken,
      connection,
      schoolYear,
      section,
      classeId,
      subjectId,
      term,
    );
    if (competences.length === 0) {
      return new Map(studIds.map((id) => [id, null]));
    }
    const marksPerCompetence = await Promise.all(
      competences.map((c) =>
        MarkReader.fetchCompMarks(accessToken, connection, schoolYear, classeId, subjectId, term, c.subject_competence_id),
      ),
    );
    const marksByCompetence = new Map<number, Map<number, Mark>>();
    competences.forEach((c, i) => marksByCompetence.set(c.subject_competence_id, toMarkMap(marksPerCompetence[i])));
    return new Map(studIds.map((id) => [id, computeSubjectAverage(competences, marksByCompetence, id)]));
  }

  const [seq1Rows, seq2Rows] = await Promise.all([
    MarkReader.fetchSeqMarks(accessToken, connection, schoolYear, classeId, subjectId, computeDbSequence(term, 1)),
    MarkReader.fetchSeqMarks(accessToken, connection, schoolYear, classeId, subjectId, computeDbSequence(term, 2)),
  ]);
  const marksBySeq = new Map<number, Map<number, Mark>>([
    [1, toMarkMap(seq1Rows)],
    [2, toMarkMap(seq2Rows)],
  ]);
  return new Map(studIds.map((id) => [id, computeSeqAverage(marksBySeq, id)]));
};

const buildClasseRowForSubjectTerm = async (
  accessToken: string | null,
  connection: string,
  schoolYear: string,
  section: string,
  classe: ClasseOfSubject,
  subjectId: number,
  term: number,
  isApc: boolean,
): Promise<StatGroupeesRow> => {
  const roster = await StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classe.classe_id);
  const studIds = roster.map((s) => s.stud_id);
  const averages = await fetchTermSubjectAverages(
    accessToken,
    connection,
    schoolYear,
    section,
    classe.classe_id,
    subjectId,
    term,
    isApc,
    studIds,
  );
  const sexeById = new Map(roster.map((s) => [s.stud_id, s.sexe]));
  const participants: StatMatiereParticipant[] = [];
  averages.forEach((moy, studId) => {
    if (moy !== null) {
      participants.push({ sexe: sexeById.get(studId) ?? "M", moy });
    }
  });
  return buildStatMatiereClasseRow(classe.classe_name, roster.map((s) => s.sexe), participants);
};

// Annual: a student's annual subject average is the plain average of the (up to 3) per-term subject
// averages that are non-null, skipping terms with no participation - the same "skip nulls" rule
// computeSeqAverage/computeSubjectAverage already apply at the mark level. A student is an annual
// participant iff at least one term is non-null.
const buildClasseRowForSubjectAnnual = async (
  accessToken: string | null,
  connection: string,
  schoolYear: string,
  section: string,
  classe: ClasseOfSubject,
  subjectId: number,
  isApc: boolean,
): Promise<StatGroupeesRow> => {
  const roster = await StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classe.classe_id);
  const studIds = roster.map((s) => s.stud_id);
  const termAverages = await Promise.all(
    [1, 2, 3].map((term) =>
      fetchTermSubjectAverages(accessToken, connection, schoolYear, section, classe.classe_id, subjectId, term, isApc, studIds),
    ),
  );
  const sexeById = new Map(roster.map((s) => [s.stud_id, s.sexe]));
  const participants: StatMatiereParticipant[] = [];
  studIds.forEach((studId) => {
    const values = termAverages
      .map((m) => m.get(studId) ?? null)
      .filter((v): v is number => v !== null);
    if (values.length > 0) {
      participants.push({
        sexe: sexeById.get(studId) ?? "M",
        moy: round2(values.reduce((a, b) => a + b, 0) / values.length),
      });
    }
  });
  return buildStatMatiereClasseRow(classe.classe_name, roster.map((s) => s.sexe), participants);
};

// Groups one subject's classesOfSubject by level (ascending, classes within a level sorted by name),
// builds each level's classe rows + "Bilan du niv." row, then the subject's own bilan row from those
// - shared shape for both term and annual, parametrized by which per-classe row builder to call.
// Every classe of the subject is fetched/built in one flat Promise.all (not looped level-by-level
// sequentially) - grouping into levels happens afterward, purely client-side, so a subject taught in
// many classes across many levels (e.g. Anglais) doesn't pay for (levels × sequential round trips)
// on top of the already-sequential subject loop in loadStatMatiereTermData/AnnualData.
const buildSubjectBlock = async (
  subjectTitle: string,
  classesOfSubject: ClasseOfSubject[],
  isLevelApc: (level: number) => boolean,
  buildRow: (classe: ClasseOfSubject, isApc: boolean) => Promise<StatGroupeesRow>,
): Promise<StatMatiereSubjectBlock> => {
  if (classesOfSubject.length === 0) {
    return { subjectTitle, levels: [], subjectBilanRow: null };
  }
  const sortedClasses = [...classesOfSubject].sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    return a.classe_name.localeCompare(b.classe_name, "fr", { sensitivity: "base" });
  });
  const rows = await Promise.all(sortedClasses.map((c) => buildRow(c, isLevelApc(c.level))));

  const byLevel = new Map<number, StatGroupeesRow[]>();
  sortedClasses.forEach((c, index) => {
    const list = byLevel.get(c.level) ?? [];
    list.push(rows[index]);
    byLevel.set(c.level, list);
  });
  const levels = [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => {
      const classeRows = byLevel.get(level) ?? [];
      return { level, classeRows, bilanRow: buildLevelBilanRow(level, classeRows) };
    });
  const subjectBilanRow = buildSubjectBilanRow(subjectTitle, levels.map((l) => l.bilanRow));
  return { subjectTitle, levels, subjectBilanRow };
};

const loadSubjectsAndApcMap = async (params: BaseParams) => {
  const { accessToken, connection, schoolYear, section } = params;
  const [apcLevels, subjects] = await Promise.all([
    ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
    SubjectReader.fetchSubjects(accessToken, connection, schoolYear, section),
  ]);
  const levelMap = new Map(apcLevels.map((e) => [e.level, e.activated]));
  const isLevelApc = (level: number): boolean => levelMap.get(level) === true;
  const sortedSubjects = [...subjects].sort((a, b) =>
    a.subject_title.localeCompare(b.subject_title, "fr", { sensitivity: "base" }),
  );
  return { isLevelApc, sortedSubjects };
};

export const loadStatMatiereTermData = async (
  params: BaseParams & { term: number },
): Promise<StatMatiereSubjectBlock[]> => {
  const { accessToken, connection, schoolYear, section, term, onProgress } = params;
  const { isLevelApc, sortedSubjects } = await loadSubjectsAndApcMap(params);

  const blocks: StatMatiereSubjectBlock[] = [];
  for (let i = 0; i < sortedSubjects.length; i++) {
    const subject = sortedSubjects[i];
    onProgress?.(i, sortedSubjects.length, subject.subject_title);
    const classesOfSubject = await ClasseReader.fetchClassesOfSubject(
      accessToken,
      connection,
      schoolYear,
      section,
      subject.subject_id,
    );
    const block = await buildSubjectBlock(subject.subject_title, classesOfSubject, isLevelApc, (classe, isApc) =>
      buildClasseRowForSubjectTerm(accessToken, connection, schoolYear, section, classe, subject.subject_id, term, isApc),
    );
    blocks.push(block);
  }
  return blocks;
};

export const loadStatMatiereAnnualData = async (params: BaseParams): Promise<StatMatiereSubjectBlock[]> => {
  const { accessToken, connection, schoolYear, section, onProgress } = params;
  const { isLevelApc, sortedSubjects } = await loadSubjectsAndApcMap(params);

  const blocks: StatMatiereSubjectBlock[] = [];
  for (let i = 0; i < sortedSubjects.length; i++) {
    const subject = sortedSubjects[i];
    onProgress?.(i, sortedSubjects.length, subject.subject_title);
    const classesOfSubject = await ClasseReader.fetchClassesOfSubject(
      accessToken,
      connection,
      schoolYear,
      section,
      subject.subject_id,
    );
    const block = await buildSubjectBlock(subject.subject_title, classesOfSubject, isLevelApc, (classe, isApc) =>
      buildClasseRowForSubjectAnnual(accessToken, connection, schoolYear, section, classe, subject.subject_id, isApc),
    );
    blocks.push(block);
  }
  return blocks;
};
