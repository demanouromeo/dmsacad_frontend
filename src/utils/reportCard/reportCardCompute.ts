import type { SubjectClasseRow } from "../../interfaces/SubjectClasseRow";
import type { SubjectCompetence } from "../../interfaces/SubjectCompetence";
import type { Mark } from "../../interfaces/Mark";
import type { ClassifiedParam } from "../../interfaces/ClassifiedParam";
import type { DisciplineOfClasseRow } from "../../interfaces/DisciplineOfClasseRow";
import type {
  ReportCardClasseStats,
  ReportCardData,
  ReportCardStudentData,
  ReportCardSubjectRow,
} from "../../interfaces/ReportCard";

// Merged student roster row this module consumes - StudentManager's own convention of overlaying
// StudentClasseInfo (real repeating/cas_social) onto Student (whose own repeating/cas_social are
// hardcoded 0 by the backend) by stud_id, done once by the caller before building report cards.
export interface ReportCardRosterEntry {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  bday: string | null;
  bplace: string | null;
  sexe: string;
  repeating: number | null;
}

// One subject's worth of already-fetched data for the whole classe - marksByCompetence is keyed
// subject_competence_id -> stud_id -> Mark, matching how MarkReader.fetchCompMarks naturally comes
// back (one call per (subject, competence) pair, each returning every student's row at once).
export interface ReportCardSubjectBundle {
  subject: SubjectClasseRow;
  competences: SubjectCompetence[];
  marksByCompetence: Map<number, Map<number, Mark>>;
  staffLabel: string;
}

export interface BuildReportCardDataInput {
  roster: ReportCardRosterEntry[];
  subjectsData: ReportCardSubjectBundle[];
  classifiedParam: ClassifiedParam | null;
  disciplineByStudId: Map<number, DisciplineOfClasseRow>;
  language: "fr" | "en";
}

// getCote() - the school's own reference letter-grade scale, generic over whatever average is
// passed in (per-subject MOY, term MOYENNE TRIM, and later an annual average). Fixed absolute
// thresholds on the /20 value, independent of the classe-wide [Min-Max] range.
export const getCote = (avg: number): string => {
  if (avg < 10) return "D";
  if (avg < 12) return "C";
  if (avg < 14) return "C+";
  if (avg < 15) return "B";
  if (avg < 16) return "B+";
  if (avg < 18) return "A";
  if (avg <= 20) return "A+";
  return "";
};

// getCompComment() - the per-subject competency-mastery abbreviation (Appr column / decision-block
// checklist), a different fixed threshold table from getCote's.
export const getCompComment = (avg: number): string => {
  if (avg < 10) return "CNA";
  if (avg < 12) return "CMA";
  if (avg < 14) return "CA";
  if (avg < 16) return "CBA";
  if (avg <= 20) return "CTBA";
  return "";
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Matches the reference RC's own number formatting for MOY/MOYENNE TRIM/Total général/[Min-Max]
// values: always at least 1 decimal digit, at most 2 - i.e. toFixed(2) with exactly one trailing
// zero trimmed off when present (never trimmed down to a bare integer, e.g. "18.00" -> "18.0", not
// "18"; "12.47" is left alone since it has no trailing zero to trim).
export const formatRcNumber = (n: number): string => {
  const fixed = n.toFixed(2);
  return fixed.endsWith("0") ? fixed.slice(0, -1) : fixed;
};

// M x Coef always shows a full 2 decimals, never trimmed (unlike formatRcNumber) - e.g. "6.00",
// "18.00", "52.02".
export const formatRcFixed2 = (n: number): string => n.toFixed(2);

// Individual competence marks (N/20 column) are shown as their raw entered value, not zero-padded
// the way Mark entry's own on-screen "XX.YY" format is - same convention as
// exportAllMarksReport.ts's formatReportMarkValue.
export const formatRcMark = (mark: number): string => String(Number(mark));

// One (student, subject) average across every competence of that subject this term, counting only
// isEmpty===0 marks - shared by both call sites that need it: the student's own subject MOY (where
// a null result means "exclude this subject from the term average entirely", see
// buildReportCardData below) and the classe-wide [Min-Max]/effort-line computations (which per the
// reference computeAverage() treat "no marks" as a genuine 0 rather than excluding it - callers
// there should coalesce null to 0 themselves rather than this function doing it for them, since the
// two call sites need different behavior for the exact same "no data" case).
export const computeSubjectAverage = (
  competences: SubjectCompetence[],
  marksByCompetence: Map<number, Map<number, Mark>>,
  studId: number,
): number | null => {
  let sum = 0;
  let count = 0;
  competences.forEach((comp) => {
    const mark = marksByCompetence.get(comp.subject_competence_id)?.get(studId);
    if (mark && Number(mark.isEmpty) === 0) {
      const parsed = Number(mark.mark);
      if (!Number.isNaN(parsed)) {
        sum += parsed;
        count += 1;
      }
    }
  });
  return count > 0 ? round2(sum / count) : null;
};

// getMinMax() - sort every student's computeAverage for one subject ascending, take [first, last].
// [0, 0] if the roster is empty (formatting layer renders "[ ]" for that case).
const computeSubjectMinMax = (
  roster: ReportCardRosterEntry[],
  competences: SubjectCompetence[],
  marksByCompetence: Map<number, Map<number, Mark>>,
): [number, number] => {
  if (roster.length === 0) {
    return [0, 0];
  }
  const averages = roster
    .map((s) => computeSubjectAverage(competences, marksByCompetence, s.stud_id) ?? 0)
    .sort((a, b) => a - b);
  return [averages[0], averages[averages.length - 1]];
};

// computeParticipationsAPC() - count of isEmpty===0 competence marks across every competence of
// every subject of the classe for this student this term (not deduped to one-per-subject - a
// subject with 3 filled competences contributes 3, matching nbMatieres being a subject *count*, not
// a competence count, in computeClassifiedAPC below).
export const computeParticipationsAPC = (
  studId: number,
  subjectsData: ReportCardSubjectBundle[],
): number => {
  let count = 0;
  subjectsData.forEach(({ competences, marksByCompetence }) => {
    competences.forEach((comp) => {
      const mark = marksByCompetence.get(comp.subject_competence_id)?.get(studId);
      if (mark && Number(mark.isEmpty) === 0) {
        count += 1;
      }
    });
  });
  return count;
};

// computeClassifiedAPC() - ported verbatim from the user's reference pseudocode. A missing
// classifiedparam row (null) is treated the same as classified=0 - classify everyone (see the
// backend CLAUDE.md's "Classified / Not Classified (NC) parameter" section).
export const computeClassifiedAPC = (
  classifiedParam: ClassifiedParam | null,
  nbMatieres: number,
  participations: number,
): boolean => {
  if (!classifiedParam) {
    return true;
  }
  const classified = classifiedParam.classified ?? 1;
  if (classified === 0) {
    return true;
  }
  if (nbMatieres === 0) {
    return false;
  }
  const rate = (participations / nbMatieres) * 100;
  return rate >= classifiedParam.nb_matieres_rate;
};

// computeUnEffortSimposeEn() - for each subject of the classe, treat a missing subjectAverage (no
// marks at all) as 0 (per the reference computeAverage(), same "0 not excluded" rule as the
// classe-wide [Min-Max] computation above - a deliberately different rule from the student's own
// term-average, which excludes a no-data subject entirely rather than scoring it 0).
const computeEffortLine = (
  subjectMoys: { subjectTitle: string; moy: number | null }[],
  language: "fr" | "en",
): string => {
  const weakSubjects = subjectMoys.filter((s) => (s.moy ?? 0) < 10);
  if (subjectMoys.length > 0 && weakSubjects.length > subjectMoys.length / 2) {
    return language === "en" ? "Put an effort in all the subjects" : "Un effort s'impose en tout";
  }
  if (weakSubjects.length === 0) {
    return language === "en" ? "Sufficient efforts" : "Efforts suffisant";
  }
  const list = weakSubjects.map((s) => s.subjectTitle).join(", ");
  return language === "en" ? `Put in more effort in: ${list}` : `Un effort s'impose en: ${list}`;
};

// Assembles every student's full report-card row plus the classe-wide stats box ("Profil de la
// classe") in one pass - both are computed once per (classe, term) and reused across every printed
// page, never refetched/recomputed per student. See ReportCardManager for how subjectsData is
// fetched (one SubjectReader.fetchCompetences + one MarkReader.fetchCompMarks per competence, mirroring
// MarkEntryManager's own fill-rate/handleExportAllClassesMarks nested-fetch pattern).
export const buildReportCardData = (input: BuildReportCardDataInput): ReportCardData => {
  const { roster, subjectsData, classifiedParam, disciplineByStudId, language } = input;
  const nbMatieres = subjectsData.length;

  const subjectMinMaxById = new Map<number, [number, number]>();
  subjectsData.forEach(({ subject, competences, marksByCompetence }) => {
    subjectMinMaxById.set(
      subject.subject_id,
      computeSubjectMinMax(roster, competences, marksByCompetence),
    );
  });

  const built: ReportCardStudentData[] = roster.map((student) => {
    const subjectRows: ReportCardSubjectRow[] = [];
    let totalGeneral = 0;
    let coefSum = 0;

    subjectsData.forEach(({ subject, competences, marksByCompetence, staffLabel }) => {
      const moy = computeSubjectAverage(competences, marksByCompetence, student.stud_id);
      const mCoef = moy !== null ? round2(moy * subject.coef) : null;
      if (moy !== null && mCoef !== null) {
        totalGeneral += mCoef;
        coefSum += subject.coef;
      }
      const [subjectMin, subjectMax] = subjectMinMaxById.get(subject.subject_id) ?? [0, 0];
      subjectRows.push({
        subjectId: subject.subject_id,
        subjectTitle: subject.subject_title,
        staffLabel,
        coef: subject.coef,
        competences: competences.map((c) => {
          const mark = marksByCompetence.get(c.subject_competence_id)?.get(student.stud_id);
          const hasMark = mark && Number(mark.isEmpty) === 0;
          return {
            subjectCompetenceId: c.subject_competence_id,
            competenceText: c.competence_text,
            mark: hasMark ? Number(mark!.mark) : null,
          };
        }),
        moy,
        mCoef,
        cote: moy !== null ? getCote(moy) : "",
        apprLabel: moy !== null ? getCompComment(moy) : "",
        subjectMin,
        subjectMax,
      });
    });

    totalGeneral = round2(totalGeneral);
    const moyenneTrim = coefSum > 0 ? round2(totalGeneral / coefSum) : 0;
    const participations = computeParticipationsAPC(student.stud_id, subjectsData);
    const isClassified = computeClassifiedAPC(classifiedParam, nbMatieres, participations);
    const discipline = disciplineByStudId.get(student.stud_id);
    const effortLine = computeEffortLine(
      subjectRows.map((r) => ({ subjectTitle: r.subjectTitle, moy: r.moy })),
      language,
    );

    return {
      studId: student.stud_id,
      matricule: student.matricule ?? "",
      name: student.name,
      surname: student.surname ?? "",
      bday: student.bday ?? "",
      bplace: student.bplace ?? "",
      sexe: student.sexe,
      repeating: Number(student.repeating ?? 0) === 1,
      subjects: subjectRows,
      totalGeneral,
      coefSum,
      moyenneTrim,
      cote: getCote(moyenneTrim),
      isClassified,
      rang: null,
      discipline: {
        absNonJust: discipline?.absunjust ?? 0,
        absJust: discipline?.absjust ?? 0,
        lateness: discipline?.lateness ?? 0,
        consigne: discipline?.consigne ?? 0,
        avertissement: discipline?.avertissement ?? 0,
        blame: discipline?.blame ?? 0,
        exclusionJours: discipline?.nb_jour_exclusion ?? 0,
        exclusionDefinitive: discipline?.exclusion_definitive ?? 0,
      },
      effortLine,
    };
  });

  // Rank: classified students sorted by moyenneTrim desc get rang 1..N; NC students are appended
  // after (also sorted desc among themselves, since no sample shows a documented tie-break rule),
  // rang stays null - this is also the order pages are printed in.
  const classified = built
    .filter((s) => s.isClassified)
    .sort((a, b) => b.moyenneTrim - a.moyenneTrim);
  const notClassified = built
    .filter((s) => !s.isClassified)
    .sort((a, b) => b.moyenneTrim - a.moyenneTrim);
  classified.forEach((s, index) => {
    s.rang = index + 1;
  });
  const students = [...classified, ...notClassified];

  // Classe-wide "Profil de la classe" stats - over the FULL roster (classified + NC alike),
  // confirmed against the 3 sample RC batches (identical value stamped on every RC of the same
  // classe+term).
  const effectif = roster.length;
  const allMoys = built.map((s) => s.moyenneTrim);
  const moyenneGenerale = effectif > 0 ? round2(allMoys.reduce((a, b) => a + b, 0) / effectif) : 0;
  const sortedMoys = [...allMoys].sort((a, b) => a - b);
  const minMax: [number, number] =
    sortedMoys.length > 0 ? [sortedMoys[0], sortedMoys[sortedMoys.length - 1]] : [0, 0];
  const nombreMoyennes = allMoys.filter((m) => m >= 10).length;
  const tauxReussite = effectif > 0 ? round2((nombreMoyennes / effectif) * 100) : 0;

  const classeStats: ReportCardClasseStats = {
    effectif,
    moyenneGenerale,
    minMax,
    nombreMoyennes,
    tauxReussite,
  };

  return { students, classeStats };
};
