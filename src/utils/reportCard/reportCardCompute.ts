import type { SubjectClasseRow } from "../../interfaces/SubjectClasseRow";
import type { SubjectCompetence } from "../../interfaces/SubjectCompetence";
import type { Mark } from "../../interfaces/Mark";
import type { ClassifiedParam } from "../../interfaces/ClassifiedParam";
import type { ThParam } from "../../interfaces/ThParam";
import type { DisciplineOfClasseRow } from "../../interfaces/DisciplineOfClasseRow";
import { formatMarkValue } from "../textValidation";
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

// One subject's worth of already-fetched data for the whole classe - two shapes depending on
// whether the classe's level is APC (competence-based) or not (see ClasseReader.fetchApcLevels /
// isLevelApc, the same check every other screen uses to decide this). A classe is one or the
// other, never mixed, so ReportCardManager builds every bundle for a given call with the same
// `kind`.
export interface ReportCardSubjectBundleApc {
  kind: "apc";
  subject: SubjectClasseRow;
  // Keyed subject_competence_id -> stud_id -> Mark, matching how MarkReader.fetchCompMarks
  // naturally comes back (one call per (subject, competence) pair, each returning every student's
  // row at once).
  competences: SubjectCompetence[];
  marksByCompetence: Map<number, Map<number, Mark>>;
  staffLabel: string;
}

export interface ReportCardSubjectBundleNonApc {
  kind: "nonApc";
  subject: SubjectClasseRow;
  // Keyed logical sequence (1 | 2, within the selected term) -> stud_id -> Mark - one
  // MarkReader.fetchSeqMarks call per sequence, dbsequence resolved by the caller via
  // computeDbSequence(term, seq).
  marksBySeq: Map<number, Map<number, Mark>>;
  staffLabel: string;
}

export type ReportCardSubjectBundle = ReportCardSubjectBundleApc | ReportCardSubjectBundleNonApc;

export interface BuildReportCardDataInput {
  roster: ReportCardRosterEntry[];
  subjectsData: ReportCardSubjectBundle[];
  classifiedParam: ClassifiedParam | null;
  thParam: ThParam | null;
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

// getNonApcComment() - ported from the user's reference getCommentFR()/getCommentEN(), a distinct
// threshold/label table from getCote/getCompComment above - used only by the non-APC RC layout,
// both for its per-subject "Appréciation" column and its overall "APPRÉCIATION DU TRAVAIL" box.
const NON_APC_PASS_MARK = 10;

export const getNonApcComment = (avg: number, language: "fr" | "en"): string => {
  if (avg < 0 || avg > 20) {
    return "";
  }
  if (avg < NON_APC_PASS_MARK) {
    return language === "en" ? "Not acquired (NA)" : "Compétences non acquises (NA)";
  }
  if (avg < 14) {
    return language === "en" ? "Under acquisition (UA)" : "En cours d'aquisition (ECA)";
  }
  if (avg < 17) {
    return language === "en" ? "Acquired (A)" : "Compétences acquises (A)";
  }
  return "Expert (A+)";
};

// formatRangText() - ported from the user's reference getSuperScriptFR()/getSuperScriptEN(),
// replacing the old bare "1er"/"Nème"/"-" formatting - shared by both the APC and non-APC PDF
// layouts (and by the non-APC layout's per-subject Rang column too). rang === null (NC student -
// see buildReportCardData's rank assignment below) always renders the literal "NC".
export const formatRangText = (
  rang: number | null,
  sexe: string,
  language: "fr" | "en",
): string => {
  if (rang === null) {
    return "NC";
  }
  if (language === "en") {
    // Ported verbatim from the user's reference getSuperScriptEN() - deliberately no
    // 11th/12th/13th exception (matches the reference's own last-digit-only rule for rang >= 10).
    if (rang === 1) return "1st";
    if (rang === 2) return "2nd";
    if (rang === 3) return "3rd";
    if (rang < 10) return `${rang}th`;
    const lastDigit = rang % 10;
    if (lastDigit === 1) return `${rang}st`;
    if (lastDigit === 2) return `${rang}nd`;
    if (lastDigit === 3) return `${rang}rd`;
    return `${rang}th`;
  }
  if (rang === 1) {
    return sexe.toLowerCase() === "f" ? "1ère" : "1er";
  }
  return `${rang}ème`;
};

// getThText() - ported from the user's reference Tableau d'honneur (Honor Roll) algorithm.
// thText === "" means this student doesn't deserve it this term; a future whole-classe Honor Roll
// printout will filter on that same emptiness check rather than a separate boolean. thParam.lb/ub
// are the school's own encouragement/félicitations thresholds; thParam.lb_default is the actual
// minimum term average required to make the roll at all (independent of lb/ub).
export const getThText = (
  thParam: ThParam | null,
  absUnjust: number,
  avgTerm: number,
  isClassified: boolean,
  language: "fr" | "en",
): string => {
  if (!thParam) {
    return "";
  }
  if (!(avgTerm >= thParam.lb_default && isClassified && absUnjust < thParam.seuil_abs)) {
    return "";
  }
  // encouragement/felicitation deliberately compare avgTerm against the algorithm's own
  // hardcoded 14/16 thresholds, not thParam.lb/thParam.ub - ported as-is from the reference
  // implementation, which computes these two flags before reassigning its working thresholds
  // from thParam at all.
  const encouragement = avgTerm >= 14 && absUnjust < thParam.seuil_abs;
  const felicitation = avgTerm >= 16 && absUnjust < thParam.seuil_abs;
  let thText = language === "en" ? "Honor roll" : "Tableau d'honneur";
  if (encouragement) {
    thText += "+Encouragements";
  }
  if (felicitation) {
    thText += language === "en" ? "& Congrat." : " & F.";
  }
  return thText;
};

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

// RC's N/20 and MOY cells (both APC and non-APC) use Mark entry's own zero-padded "XX.YY" display
// format (formatMarkValue) rather than the raw/trimmed formats above, matching Mark entry's own
// on-screen convention across the board.
export const formatRcMarkDisplay = (mark: number): string => formatMarkValue(String(mark));

export const formatRcMoyDisplay = (moy: number): string => formatMarkValue(String(moy));

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

// Non-APC equivalent of computeSubjectAverage - averages this student's marks across the term's
// two sequences for one subject (student_subject rows, via MarkReader.fetchSeqMarks), counting
// only isEmpty===0 marks. null if neither sequence has a real mark yet, same "exclude, don't
// zero-fill" convention as computeSubjectAverage.
export const computeSeqAverage = (
  marksBySeq: Map<number, Map<number, Mark>>,
  studId: number,
): number | null => {
  let sum = 0;
  let count = 0;
  marksBySeq.forEach((studMap) => {
    const mark = studMap.get(studId);
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

// computeEvalExam() - non-APC-only "Eval"/"Exam" split shown in the footer's APPRÉCIATION DU
// TRAVAIL box: the student's coefficient-weighted average using only sequence-1 marks (Eval) vs.
// only sequence-2 marks (Exam) across every non-APC subject. The two sequences are independent -
// a subject missing only one of its two marks still contributes to whichever sequence it does
// have (unlike computeSeqAverage's per-subject MOY, which averages across both together). APC
// bundles are skipped entirely (0/0 result if subjectsData has no nonApc bundles).
export const computeEvalExam = (
  subjectsData: ReportCardSubjectBundle[],
  studId: number,
): { evalAvg: number; examAvg: number } => {
  let evalSum = 0;
  let evalCoef = 0;
  let examSum = 0;
  let examCoef = 0;
  subjectsData.forEach((bundle) => {
    if (bundle.kind !== "nonApc") {
      return;
    }
    const { coef } = bundle.subject;
    const seq1Mark = bundle.marksBySeq.get(1)?.get(studId);
    if (seq1Mark && Number(seq1Mark.isEmpty) === 0) {
      const parsed = Number(seq1Mark.mark);
      if (!Number.isNaN(parsed)) {
        evalSum += parsed * coef;
        evalCoef += coef;
      }
    }
    const seq2Mark = bundle.marksBySeq.get(2)?.get(studId);
    if (seq2Mark && Number(seq2Mark.isEmpty) === 0) {
      const parsed = Number(seq2Mark.mark);
      if (!Number.isNaN(parsed)) {
        examSum += parsed * coef;
        examCoef += coef;
      }
    }
  });
  return {
    evalAvg: evalCoef > 0 ? round2(evalSum / evalCoef) : 0,
    examAvg: examCoef > 0 ? round2(examSum / examCoef) : 0,
  };
};

// Dispatches to computeSubjectAverage/computeSeqAverage depending on the bundle's kind - the one
// place that needs to know which of the two shapes a bundle is to compute a per-student average.
export const computeSubjectAverageForBundle = (
  bundle: ReportCardSubjectBundle,
  studId: number,
): number | null =>
  bundle.kind === "apc"
    ? computeSubjectAverage(bundle.competences, bundle.marksByCompetence, studId)
    : computeSeqAverage(bundle.marksBySeq, studId);

// getMinMax() - sort every student's computeAverage for one subject ascending, take [first, last].
// [0, 0] if the roster is empty (formatting layer renders "[ ]" for that case).
const computeSubjectMinMax = (
  roster: ReportCardRosterEntry[],
  bundle: ReportCardSubjectBundle,
): [number, number] => {
  if (roster.length === 0) {
    return [0, 0];
  }
  const averages = roster
    .map((s) => computeSubjectAverageForBundle(bundle, s.stud_id) ?? 0)
    .sort((a, b) => a - b);
  return [averages[0], averages[averages.length - 1]];
};

// computeSubjectRank() - non-APC-only per-subject class rank (the marks table's own "Rang" column,
// not to be confused with the student's overall term rang). Dense/competition ranking: sort every
// student's subjectAverage (missing treated as 0, same convention as computeSubjectMinMax above)
// descending, ties share a rank. Independent of isClassified - unlike the overall term rank, a
// subject's own rank ranks the whole roster regardless of classification status.
const computeSubjectRank = (
  roster: ReportCardRosterEntry[],
  bundle: ReportCardSubjectBundle,
): Map<number, number> => {
  const sorted = roster
    .map((s) => ({ studId: s.stud_id, avg: computeSubjectAverageForBundle(bundle, s.stud_id) ?? 0 }))
    .sort((a, b) => b.avg - a.avg);
  const ranks = new Map<number, number>();
  let lastAvg: number | null = null;
  let lastRank = 0;
  sorted.forEach((entry, index) => {
    if (lastAvg === null || entry.avg !== lastAvg) {
      lastRank = index + 1;
      lastAvg = entry.avg;
    }
    ranks.set(entry.studId, lastRank);
  });
  return ranks;
};

// computeParticipations() - count of isEmpty===0 marks across every subject of the classe for this
// student this term: for APC bundles, every competence of every subject (not deduped to
// one-per-subject - a subject with 3 filled competences contributes 3, matching nbMatieres being a
// subject *count*, not a competence count, in computeClassified below); for non-APC bundles, both
// sequences of every subject (0, 1, or 2 per subject).
export const computeParticipations = (
  studId: number,
  subjectsData: ReportCardSubjectBundle[],
): number => {
  let count = 0;
  subjectsData.forEach((bundle) => {
    if (bundle.kind === "apc") {
      bundle.competences.forEach((comp) => {
        const mark = bundle.marksByCompetence.get(comp.subject_competence_id)?.get(studId);
        if (mark && Number(mark.isEmpty) === 0) {
          count += 1;
        }
      });
    } else {
      bundle.marksBySeq.forEach((studMap) => {
        const mark = studMap.get(studId);
        if (mark && Number(mark.isEmpty) === 0) {
          count += 1;
        }
      });
    }
  });
  return count;
};

// computeClassified() - ported verbatim from the user's reference pseudocode (originally named
// computeClassifiedAPC; renamed since it's generic over both APC and non-APC nbMatieres/
// participations, see the backend CLAUDE.md's "Classified / Not Classified (NC) parameter" section
// for the nbMatieres weighting difference between the two - 1 per subject for APC, 2 per subject
// for non-APC). A missing classifiedparam row (null) is treated the same as classified=0 -
// classify everyone.
export const computeClassified = (
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

// computeEcartType() - population standard deviation of the classe's moyenneTrim values, used by
// the non-APC layout's "Ecart type" field. Same full-roster population as moyenneGenerale/minMax
// above.
const computeEcartType = (moyennes: number[]): number => {
  if (moyennes.length === 0) {
    return 0;
  }
  const mean = moyennes.reduce((a, b) => a + b, 0) / moyennes.length;
  const variance =
    moyennes.reduce((sum, m) => sum + (m - mean) * (m - mean), 0) / moyennes.length;
  return round2(Math.sqrt(variance));
};

// computeGroupSubtotal() - non-APC-only per-group subtotal (the "Moyenne du groupe" row under
// each of Matières Scientifiques/Littéraires/Autres, etc.). Sums coef/mCoef only over rows the
// student has a real mark for (moy !== null), same exclusion rule buildReportCardData already
// applies to the student's own totalGeneral/coefSum - a subject the student has no marks in
// doesn't drag the group average down to 0, it's simply excluded.
export const computeGroupSubtotal = (
  rows: ReportCardSubjectRow[],
): { coefSum: number; mCoefSum: number; moyenneGroupe: number } => {
  let coefSum = 0;
  let mCoefSum = 0;
  rows.forEach((row) => {
    if (row.moy !== null && row.mCoef !== null) {
      coefSum += row.coef;
      mCoefSum += row.mCoef;
    }
  });
  coefSum = round2(coefSum);
  mCoefSum = round2(mCoefSum);
  return {
    coefSum,
    mCoefSum,
    moyenneGroupe: coefSum > 0 ? round2(mCoefSum / coefSum) : 0,
  };
};

// Assembles every student's full report-card row plus the classe-wide stats box ("Profil de la
// classe") in one pass - both are computed once per (classe, term) and reused across every printed
// page, never refetched/recomputed per student. See ReportCardManager for how subjectsData is
// fetched (one SubjectReader.fetchCompetences + one MarkReader.fetchCompMarks per competence, mirroring
// MarkEntryManager's own fill-rate/handleExportAllClassesMarks nested-fetch pattern).
export const buildReportCardData = (input: BuildReportCardDataInput): ReportCardData => {
  const { roster, subjectsData, classifiedParam, thParam, disciplineByStudId, language } = input;
  // nbMatieres weighting differs by kind (see computeClassified's comment): 1 per subject for
  // APC (competence-based participation), 2 per subject for non-APC (one per sequence).
  const nbMatieres = subjectsData.reduce((sum, b) => sum + (b.kind === "apc" ? 1 : 2), 0);

  const subjectMinMaxById = new Map<number, [number, number]>();
  const subjectRankById = new Map<number, Map<number, number>>();
  subjectsData.forEach((bundle) => {
    subjectMinMaxById.set(bundle.subject.subject_id, computeSubjectMinMax(roster, bundle));
    subjectRankById.set(bundle.subject.subject_id, computeSubjectRank(roster, bundle));
  });

  const built: ReportCardStudentData[] = roster.map((student) => {
    const subjectRows: ReportCardSubjectRow[] = [];
    let totalGeneral = 0;
    let coefSum = 0;

    subjectsData.forEach((bundle) => {
      const { subject, staffLabel } = bundle;
      const moy = computeSubjectAverageForBundle(bundle, student.stud_id);
      const mCoef = moy !== null ? round2(moy * subject.coef) : null;
      if (moy !== null && mCoef !== null) {
        totalGeneral += mCoef;
        coefSum += subject.coef;
      }
      const [subjectMin, subjectMax] = subjectMinMaxById.get(subject.subject_id) ?? [0, 0];
      const rang = subjectRankById.get(subject.subject_id)?.get(student.stud_id) ?? 0;
      // APC rows list one real competence per line; non-APC rows synthesize one line per
      // sequence of the term instead (there's no competence concept there) - both funnel into
      // the same ReportCardCompetenceRow shape the PDF layer already knows how to render.
      const competenceRows =
        bundle.kind === "apc"
          ? bundle.competences.map((c) => {
              const mark = bundle.marksByCompetence.get(c.subject_competence_id)?.get(student.stud_id);
              const hasMark = mark && Number(mark.isEmpty) === 0;
              return {
                subjectCompetenceId: c.subject_competence_id,
                competenceText: c.competence_text,
                mark: hasMark ? Number(mark!.mark) : null,
              };
            })
          : Array.from(bundle.marksBySeq.keys())
              .sort((a, b) => a - b)
              .map((seq) => {
                const mark = bundle.marksBySeq.get(seq)?.get(student.stud_id);
                const hasMark = mark && Number(mark.isEmpty) === 0;
                return {
                  subjectCompetenceId: -seq,
                  competenceText: `Séquence ${seq}`,
                  mark: hasMark ? Number(mark!.mark) : null,
                };
              });
      subjectRows.push({
        subjectId: subject.subject_id,
        subjectTitle: subject.subject_title,
        staffLabel,
        coef: subject.coef,
        isApc: bundle.kind === "apc",
        competences: competenceRows,
        moy,
        mCoef,
        cote: moy !== null ? getCote(moy) : "",
        apprLabel: moy !== null ? getCompComment(moy) : "",
        subjectMin,
        subjectMax,
        groupeId: subject.groupe_id,
        groupeName: subject.groupe_name,
        rang,
      });
    });

    totalGeneral = round2(totalGeneral);
    const moyenneTrim = coefSum > 0 ? round2(totalGeneral / coefSum) : 0;
    const participations = computeParticipations(student.stud_id, subjectsData);
    const isClassified = computeClassified(classifiedParam, nbMatieres, participations);
    const discipline = disciplineByStudId.get(student.stud_id);
    const effortLine = computeEffortLine(
      subjectRows.map((r) => ({ subjectTitle: r.subjectTitle, moy: r.moy })),
      language,
    );
    const { evalAvg, examAvg } = computeEvalExam(subjectsData, student.stud_id);
    const thText = getThText(
      thParam,
      discipline?.absunjust ?? 0,
      moyenneTrim,
      isClassified,
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
      evalAvg,
      examAvg,
      thText,
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
  const ecartType = computeEcartType(allMoys);

  const classeStats: ReportCardClasseStats = {
    effectif,
    moyenneGenerale,
    minMax,
    nombreMoyennes,
    tauxReussite,
    ecartType,
  };

  return { students, classeStats };
};
