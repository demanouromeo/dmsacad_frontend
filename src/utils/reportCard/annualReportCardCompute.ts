import type { SubjectClasseRow } from "../../interfaces/SubjectClasseRow";
import type { Mark } from "../../interfaces/Mark";
import type { ClassifiedParam } from "../../interfaces/ClassifiedParam";
import type { StudentClasseInfo } from "../../interfaces/StudentClasseInfo";
import type {
  ReportCardData,
  ReportCardDiscipline,
} from "../../interfaces/ReportCard";
import type {
  AnnualClasseStats,
  AnnualDecision,
  AnnualReportCardData,
  AnnualStudentData,
  AnnualSubjectRow,
  AnnualTermSummary,
} from "../../interfaces/AnnualReportCard";
import { round2, getNonApcComment } from "./reportCardCompute";
import type { ReportCardRosterEntry } from "./reportCardCompute";

// Annual (whole-school-year) counterpart to reportCardCompute.ts's term algorithm - see
// nonAPCannual.md (repo root) for the ported spec and the plan's "Key findings from verification"
// section for the concrete decisions made where the spec was ambiguous, buggy, or undocumented
// (RÉCAPITULATIF DES MOYENNES formula, totalExclusionTh fix, the 64-branch subject-average
// simplified to a plain non-null mean, etc). Non-APC only - see ReportCardManager's
// isSelectedClasseApc gate.

// One subject's full-year raw data - marksBySeq keyed by dbsequence 1..6 (not just the 2 sequences
// of a single term, unlike ReportCardSubjectBundleNonApc), fetched once per subject by
// ReportCardManager's loadAnnualReportCardDataForClasse rather than 3x (once per term).
export interface AnnualSubjectBundle {
  subject: SubjectClasseRow;
  staffLabel: string;
  marksBySeq: Map<number, Map<number, Mark>>;
}

const markValue = (bundle: AnnualSubjectBundle, dbsequence: number, studId: number): number | null => {
  const mark = bundle.marksBySeq.get(dbsequence)?.get(studId);
  if (!mark || Number(mark.isEmpty) !== 0) {
    return null;
  }
  const parsed = Number(mark.mark);
  return Number.isNaN(parsed) ? null : parsed;
};

// The 6 Note1..Note6 cells for one (subject, student) - null where no real mark was entered.
const studentSubjectNotes = (bundle: AnnualSubjectBundle, studId: number): (number | null)[] =>
  [1, 2, 3, 4, 5, 6].map((seq) => markValue(bundle, seq, studId));

// Replaces the spec's 64-branch computeAnnulAverageOfStudentInSubject - every one of those
// branches is just "average of whichever marks are present", since a subject's annual average
// only ever depends on which of the 6 sequences have a real mark, not on the caller's specific
// combination of empties. null (not 0) when every sequence is empty, matching the term RC's own
// "exclude, don't zero" convention for a subject with no data.
export const computeAnnualSubjectAverage = (notes: (number | null)[]): number | null => {
  const present = notes.filter((n): n is number => n !== null);
  return present.length > 0 ? round2(present.reduce((a, b) => a + b, 0) / present.length) : null;
};

// computeSeqOverallAverage() - coefficient-weighted average across every subject using only one
// specific dbsequence's marks. Generalizes computeEvalExam (which does exactly this for 2
// sequences at a time) to each of the 6 individual sequences - confirmed against the live DB
// during planning (student 398, classe 13, dbsequence 1 -> 10.91, matching the sample's Eval1).
export const computeSeqOverallAverage = (
  subjectsData: AnnualSubjectBundle[],
  studId: number,
  dbsequence: number,
): number => {
  let sum = 0;
  let coefSum = 0;
  subjectsData.forEach((bundle) => {
    const value = markValue(bundle, dbsequence, studId);
    if (value !== null) {
      sum += value * bundle.subject.coef;
      coefSum += bundle.subject.coef;
    }
  });
  return coefSum > 0 ? round2(sum / coefSum) : 0;
};

// computeAnnualSubjectRank() - per-subject dense/competition rank using annual subject averages
// (missing treated as 0), same convention as the term RC's computeSubjectRank.
const computeAnnualSubjectRank = (
  roster: ReportCardRosterEntry[],
  notesBySubjectStud: Map<number, Map<number, (number | null)[]>>,
): Map<number, Map<number, number>> => {
  const ranks = new Map<number, Map<number, number>>();
  notesBySubjectStud.forEach((notesByStud, subjectId) => {
    const sorted = roster
      .map((s) => ({
        studId: s.stud_id,
        avg: computeAnnualSubjectAverage(notesByStud.get(s.stud_id) ?? []) ?? 0,
      }))
      .sort((a, b) => b.avg - a.avg);
    const subjectRanks = new Map<number, number>();
    let lastAvg: number | null = null;
    let lastRank = 0;
    sorted.forEach((entry, index) => {
      if (lastAvg === null || entry.avg !== lastAvg) {
        lastRank = index + 1;
        lastAvg = entry.avg;
      }
      subjectRanks.set(entry.studId, lastRank);
    });
    ranks.set(subjectId, subjectRanks);
  });
  return ranks;
};

interface TermAvgInput {
  avg: number;
  isEmpty: boolean;
}

// simpleComputeAnnualAverage() - "CALCUL SIMPLE": average of whichever of the 3 terms have real
// data, collapsed from the spec's explicit 8-case listing into "average of present terms" (same
// simplification as computeAnnualSubjectAverage above - the branches only ever differ in which
// terms are non-empty).
const computeSimpleAnnualAverage = (
  terms: [TermAvgInput, TermAvgInput, TermAvgInput],
): { avgAnnual: number; isAnnualAvgEmpty: boolean } => {
  const present = terms.filter((t) => !t.isEmpty);
  if (present.length === 0) {
    return { avgAnnual: 0, isAnnualAvgEmpty: true };
  }
  return {
    avgAnnual: round2(present.reduce((sum, t) => sum + t.avg, 0) / present.length),
    isAnnualAvgEmpty: false,
  };
};

// complexComputeAnnualAverage() - "CALCUL COMPLEXE": coefficient-weighted average of each
// subject's own annual average, excluding subjects with no marks at all this year - same
// accumulation shape buildReportCardData already uses for totalGeneral/coefSum.
const computeComplexAnnualAverage = (
  subjectRows: { moy: number | null; mCoef: number | null; coef: number }[],
): { avgAnnual: number; isAnnualAvgEmpty: boolean } => {
  let totalMxC = 0;
  let coefSum = 0;
  subjectRows.forEach((row) => {
    if (row.moy !== null && row.mCoef !== null) {
      totalMxC += row.mCoef;
      coefSum += row.coef;
    }
  });
  if (coefSum <= 0) {
    return { avgAnnual: 0, isAnnualAvgEmpty: true };
  }
  return { avgAnnual: round2(totalMxC / coefSum), isAnnualAvgEmpty: false };
};

// computeAnnualClassified() - manual override (0/1) wins; else classifiedParam==null or
// classified===0 means everyone is classified; nbMatieres===0 means nobody is; otherwise
// classified iff classified in >=2 of the 3 terms (reusing each term's own already-computed
// isClassified rather than recomputing the per-term algorithm here).
export const computeAnnualClassified = (
  manualOverride: number,
  classifiedParam: ClassifiedParam | null,
  termIsClassified: [boolean, boolean, boolean],
  nbMatieres: number,
): boolean => {
  if (manualOverride === 1) return true;
  if (manualOverride === 0) return false;
  if (!classifiedParam || classifiedParam.classified === 0) return true;
  if (nbMatieres === 0) return false;
  return termIsClassified.filter(Boolean).length >= 2;
};

interface DismissResult {
  mustDismiss: boolean;
  code: number | null;
}

// computeMustDismiss() - manual override (0/1) wins (1 reuses the already-stored codeExclusion as
// the display reason, since a manual override has no other source for it); else the spec's
// OR-condition decides mustDismiss, using classe_year.totalExclusionTh (not totalAbsTh) for the
// exclusion-days leg - see the plan's finding #2 for why this diverges from the spec's literal
// text. The priority chain (Conduite -> Travail -> Ne peut trippler -> Insolvable) picks the
// display reason only when mustDismiss is true.
export const computeMustDismiss = (
  manualOverride: number,
  storedCodeExclusion: number,
  absUnjustTotal: number,
  totalExclusionDays: number,
  avgAnnual: number,
  avgDismissalTh: number,
  repeatUb: number,
  repeating: boolean,
  totalExclusionTh: number,
  totalAbsTh: number,
  solvable1: number | null,
): DismissResult => {
  if (manualOverride === 1) {
    return { mustDismiss: true, code: storedCodeExclusion > 0 ? storedCodeExclusion : null };
  }
  if (manualOverride === 0) {
    return { mustDismiss: false, code: null };
  }
  const conduiteFail = absUnjustTotal > totalAbsTh || totalExclusionDays > totalExclusionTh;
  const travailFail = avgAnnual < avgDismissalTh;
  const trippleFail = avgAnnual < repeatUb && repeating;
  const mustDismiss = conduiteFail || travailFail || trippleFail;
  if (!mustDismiss) {
    return { mustDismiss: false, code: null };
  }
  const code = conduiteFail ? 2 : travailFail ? 3 : trippleFail ? 4 : solvable1 === 0 ? 6 : null;
  return { mustDismiss: true, code };
};

// computeMustRepeat() - manual override wins; else spec's formula: below repeatUb and not already
// a repeater may repeat, unless also dismissed (can't repeat and be excluded at once) - an
// already-repeating student below repeatUb instead falls into computeMustDismiss's "Ne peut
// trippler" reason.
export const computeMustRepeat = (
  manualOverride: number,
  avgAnnual: number,
  repeatUb: number,
  repeating: boolean,
  mustDismiss: boolean,
): boolean => {
  if (manualOverride === 1) return true;
  if (manualOverride === 0) return false;
  if (avgAnnual < repeatUb && !repeating) {
    return !mustDismiss;
  }
  return false;
};

const isSpecialLevel = (level: number, isTechnique: boolean): boolean =>
  level === 6 || level === 7 || (level === 4 && isTechnique);

const redoubleSiEchecText = (level: number, isTechnique: boolean, language: "fr" | "en"): string => {
  if (language !== "en") {
    return "Redouble si echec";
  }
  return level === 4 && isTechnique ? "Repeat if should fail CAP" : "Repeat if should fail GCE";
};

// computeAnnualDecision() - assembles the "DÉCISION DU CONSEIL DE FIN D'ANNÉE" block. mustDismiss
// takes absolute priority (every sample RC with an exclusion shows only the exclusion block, never
// alongside a promu/redouble/NC message, despite the spec's pseudocode reading as independent,
// overlapping if-statements - see the plan's verification against all 12 samples), then the
// special-level "redouble si échec" case, then promu/redouble/nc.
//
// promuEnClasseName is the RAW resolved student_classe.promuEn target (or null) - per the spec's
// getPromuEnText, basic_school_config.val2 (affichagePromotion) only controls whether the *text*
// shows that resolved name or a blank underline; it never affects the underlying promu/nc/redouble
// eligibility test itself (which always uses "promuEn is set" as one of its OR-conditions,
// regardless of val2). So affichagePromotion only gates what ends up in the returned
// AnnualDecision.promuEnClasseName (the display value), not the `promu` boolean below.
export const computeAnnualDecision = (
  level: number,
  isTechnique: boolean,
  mustDismiss: boolean,
  dismissCode: number | null,
  mustRepeat: boolean,
  isClassifiedAnnual: boolean,
  avgAnnual: number,
  repeatUb: number,
  promuEnClasseName: string | null,
  affichagePromotion: boolean,
  language: "fr" | "en",
): AnnualDecision => {
  if (mustDismiss) {
    return {
      kind: "exclu",
      promuEnClasseName: null,
      exclusionCode: dismissCode,
      redoubleSiEchecText: null,
    };
  }
  if (isSpecialLevel(level, isTechnique)) {
    return {
      kind: "redoubleSiEchec",
      promuEnClasseName: null,
      exclusionCode: null,
      redoubleSiEchecText: redoubleSiEchecText(level, isTechnique, language),
    };
  }
  const promu =
    !mustRepeat && isClassifiedAnnual && (avgAnnual >= repeatUb || promuEnClasseName !== null);
  if (promu) {
    return {
      kind: "promu",
      promuEnClasseName: affichagePromotion ? promuEnClasseName : null,
      exclusionCode: null,
      redoubleSiEchecText: null,
    };
  }
  if (avgAnnual < repeatUb && isClassifiedAnnual) {
    return { kind: "redouble", promuEnClasseName: null, exclusionCode: null, redoubleSiEchecText: null };
  }
  return { kind: "nc", promuEnClasseName: null, exclusionCode: null, redoubleSiEchecText: null };
};

const sumDiscipline = (rows: ReportCardDiscipline[]): ReportCardDiscipline => ({
  absNonJust: rows.reduce((s, r) => s + r.absNonJust, 0),
  absJust: rows.reduce((s, r) => s + r.absJust, 0),
  lateness: rows.reduce((s, r) => s + r.lateness, 0),
  consigne: rows.reduce((s, r) => s + r.consigne, 0),
  avertissement: rows.reduce((s, r) => s + r.avertissement, 0),
  blame: rows.reduce((s, r) => s + r.blame, 0),
  exclusionJours: rows.reduce((s, r) => s + r.exclusionJours, 0),
  exclusionDefinitive: rows.reduce((s, r) => s + r.exclusionDefinitive, 0),
});

const computeAnnualClasseStats = (avgAnnuals: number[]): AnnualClasseStats => {
  const effectif = avgAnnuals.length;
  const moyenneGenerale =
    effectif > 0 ? round2(avgAnnuals.reduce((a, b) => a + b, 0) / effectif) : 0;
  const sorted = [...avgAnnuals].sort((a, b) => a - b);
  const minMax: [number, number] = sorted.length > 0 ? [sorted[0], sorted[sorted.length - 1]] : [0, 0];
  const nombreMoyennes = avgAnnuals.filter((m) => m >= 10).length;
  const tauxReussite = effectif > 0 ? round2((nombreMoyennes / effectif) * 100) : 0;
  const mean = moyenneGenerale;
  const variance =
    effectif > 0
      ? avgAnnuals.reduce((sum, m) => sum + (m - mean) * (m - mean), 0) / effectif
      : 0;
  const ecartType = round2(Math.sqrt(variance));
  return { effectif, moyenneGenerale, minMax, nombreMoyennes, tauxReussite, ecartType };
};

export interface BuildAnnualReportCardDataInput {
  roster: ReportCardRosterEntry[];
  subjectsData: AnnualSubjectBundle[];
  // Full term ReportCardData for terms 1, 2, 3 - built by the caller via the existing, unmodified
  // buildReportCardData (see reportCardCompute.ts), sliced from the same subjectsData's marksBySeq
  // rather than refetched.
  termsData: [ReportCardData, ReportCardData, ReportCardData];
  classifiedParam: ClassifiedParam | null;
  studentClasseByStudId: Map<number, StudentClasseInfo>;
  classe: {
    level: number;
    avgDismissalTh: number;
    repeatUB: number;
    totalAbsTh: number;
    totalExclusionTh: number;
  };
  isTechnique: boolean;
  // basic_school_config.val1: 1 (or null/missing) = simple, 0 = complex.
  computationMethod: number | null;
  classeNameById: Map<number, string>;
  language: "fr" | "en";
}

export const buildAnnualReportCardData = (
  input: BuildAnnualReportCardDataInput,
): AnnualReportCardData => {
  const {
    roster,
    subjectsData,
    termsData,
    classifiedParam,
    studentClasseByStudId,
    classe,
    isTechnique,
    computationMethod,
    classeNameById,
    language,
  } = input;

  const nbMatieres = subjectsData.length;

  // Per-subject, per-student Note1..Note6 - computed once and reused for the row display, the
  // annual subject average, and the annual subject rank.
  const notesBySubjectStud = new Map<number, Map<number, (number | null)[]>>();
  subjectsData.forEach((bundle) => {
    const byStud = new Map<number, (number | null)[]>();
    roster.forEach((s) => byStud.set(s.stud_id, studentSubjectNotes(bundle, s.stud_id)));
    notesBySubjectStud.set(bundle.subject.subject_id, byStud);
  });
  const subjectRankById = computeAnnualSubjectRank(roster, notesBySubjectStud);

  const termStudentMaps = termsData.map(
    (t) => new Map(t.students.map((s) => [s.studId, s])),
  );

  const built: AnnualStudentData[] = roster.map((student) => {
    const studentClasse = studentClasseByStudId.get(student.stud_id) ?? null;

    const subjects: AnnualSubjectRow[] = subjectsData.map((bundle) => {
      const notes = notesBySubjectStud.get(bundle.subject.subject_id)?.get(student.stud_id) ?? [];
      const moy = computeAnnualSubjectAverage(notes);
      const mCoef = moy !== null ? round2(moy * bundle.subject.coef) : null;
      return {
        subjectId: bundle.subject.subject_id,
        subjectTitle: bundle.subject.subject_title,
        staffLabel: bundle.staffLabel,
        coef: bundle.subject.coef,
        groupeId: bundle.subject.groupe_id,
        groupeName: bundle.subject.groupe_name,
        notes,
        moy,
        mCoef,
        rang: subjectRankById.get(bundle.subject.subject_id)?.get(student.stud_id) ?? 0,
        appr: moy !== null ? getNonApcComment(moy, language) : "",
      };
    });

    let totalGeneral = 0;
    let coefSum = 0;
    subjects.forEach((row) => {
      if (row.moy !== null && row.mCoef !== null) {
        totalGeneral += row.mCoef;
        coefSum += row.coef;
      }
    });
    totalGeneral = round2(totalGeneral);
    coefSum = round2(coefSum);

    const termAvgInputs = termStudentMaps.map((m) => {
      const s = m.get(student.stud_id);
      return { avg: s?.moyenneTrim ?? 0, isEmpty: s === undefined };
    }) as [TermAvgInput, TermAvgInput, TermAvgInput];

    const { avgAnnual, isAnnualAvgEmpty } =
      computationMethod === 0
        ? computeComplexAnnualAverage(subjects)
        : computeSimpleAnnualAverage(termAvgInputs);

    const termIsClassified = termStudentMaps.map(
      (m) => m.get(student.stud_id)?.isClassified ?? false,
    ) as [boolean, boolean, boolean];
    const isClassifiedAnnual = computeAnnualClassified(
      studentClasse?.isMannullalyClassified ?? 2,
      classifiedParam,
      termIsClassified,
      nbMatieres,
    );

    const discipline = termStudentMaps.map(
      (m) =>
        m.get(student.stud_id)?.discipline ?? {
          absNonJust: 0,
          absJust: 0,
          lateness: 0,
          consigne: 0,
          avertissement: 0,
          blame: 0,
          exclusionJours: 0,
          exclusionDefinitive: 0,
        },
    ) as [ReportCardDiscipline, ReportCardDiscipline, ReportCardDiscipline];
    const disciplineAnnual = sumDiscipline(discipline);

    const isRepeating = Number(student.repeating ?? 0) === 1;
    const { mustDismiss, code: dismissCode } = computeMustDismiss(
      studentClasse?.isMannullalyDismissed ?? 2,
      studentClasse?.codeExclusion ?? 0,
      disciplineAnnual.absNonJust,
      disciplineAnnual.exclusionJours,
      avgAnnual,
      classe.avgDismissalTh,
      classe.repeatUB,
      isRepeating,
      classe.totalExclusionTh,
      classe.totalAbsTh,
      studentClasse?.solvable1 ?? null,
    );
    const mustRepeat = computeMustRepeat(
      studentClasse?.mustRepeat ?? 2,
      avgAnnual,
      classe.repeatUB,
      isRepeating,
      mustDismiss,
    );

    const promuEnClasseName =
      studentClasse?.promuEn != null ? classeNameById.get(studentClasse.promuEn) ?? null : null;
    const decision = computeAnnualDecision(
      classe.level,
      isTechnique,
      mustDismiss,
      dismissCode,
      mustRepeat,
      isClassifiedAnnual,
      avgAnnual,
      classe.repeatUB,
      promuEnClasseName,
      language,
    );

    const termSummaries = [1, 2, 3].map((term) => {
      const idx = term - 1;
      const termStudent = termStudentMaps[idx].get(student.stud_id);
      return {
        term,
        seqAverages: [
          computeSeqOverallAverage(subjectsData, student.stud_id, idx * 2 + 1),
          computeSeqOverallAverage(subjectsData, student.stud_id, idx * 2 + 2),
        ],
        bilanTrim: termStudent?.moyenneTrim ?? 0,
        rangTrim: termStudent?.rang ?? null,
        moyGenTrim: termsData[idx].classeStats.moyenneGenerale,
      } as AnnualTermSummary;
    }) as [AnnualTermSummary, AnnualTermSummary, AnnualTermSummary];

    return {
      studId: student.stud_id,
      matricule: student.matricule ?? "",
      name: student.name,
      surname: student.surname ?? "",
      bday: student.bday ?? "",
      bplace: student.bplace ?? "",
      sexe: student.sexe,
      repeating: Number(student.repeating ?? 0) === 1,
      subjects,
      totalGeneral,
      coefSum,
      avgAnnual,
      isAnnualAvgEmpty,
      isClassifiedAnnual,
      rangAnnuel: null,
      apprAnnuelle: isAnnualAvgEmpty ? "" : getNonApcComment(avgAnnual, language),
      disciplineByTerm: discipline,
      disciplineAnnual,
      termSummaries,
      decision,
    };
  });

  const classified = built
    .filter((s) => s.isClassifiedAnnual)
    .sort((a, b) => b.avgAnnual - a.avgAnnual);
  const notClassified = built
    .filter((s) => !s.isClassifiedAnnual)
    .sort((a, b) => b.avgAnnual - a.avgAnnual);
  classified.forEach((s, index) => {
    s.rangAnnuel = index + 1;
  });
  const students = [...classified, ...notClassified];

  const classeStats = computeAnnualClasseStats(built.map((s) => s.avgAnnual));

  return { students, classeStats };
};
