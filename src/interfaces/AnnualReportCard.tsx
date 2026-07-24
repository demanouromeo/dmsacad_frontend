import type { ReportCardDiscipline } from "./ReportCard";
import type { ClassifiedParam } from "./ClassifiedParam";

// Shapes for the annual report card ("Bulletin Annuel") - see
// src/utils/reportCard/annualReportCardCompute.ts for how these are assembled and
// src/utils/reportCard/exportAnnualReportCardPdf.ts / exportAnnualReportCardApcPdf.ts for how
// they're drawn. Distinct from (but reuses ReportCardDiscipline from) the term report card's
// ReportCard.tsx shapes. Non-APC classes use AnnualStudentData/AnnualSubjectRow below; APC classes
// use AnnualStudentDataApc/AnnualSubjectRowApc further down - the two layouts genuinely differ
// (see apcAnnual.md / the plan) so they're kept as separate shapes rather than one union.

export interface AnnualSubjectRow {
  subjectId: number;
  subjectTitle: string;
  staffLabel: string;
  coef: number;
  groupeId: number;
  groupeName: string;
  // One entry per dbsequence 1..6 (length 6) - null = no real (isEmpty=0) mark that sequence.
  notes: (number | null)[];
  // Annual average across whichever of the 6 sequences have a real mark - null = no marks at all
  // this year for this subject (row prints blank except Rang, same convention as the term RC).
  moy: number | null;
  mCoef: number | null;
  // 1-based dense/competition rank of this student's annual subject average among the whole
  // roster - missing marks ranked as 0, same convention as the term RC's per-subject rang.
  rang: number;
  appr: string;
}

// One term's contribution to the "RÉCAPITULATIF DES MOYENNES" box - bilanTrim/rangTrim/moyGenTrim
// are the term's own real moyenneTrim/rang/classeStats.moyenneGenerale, obtained by re-running the
// existing buildReportCardData for that term (not a new formula).
export interface AnnualTermSummary {
  term: number;
  // Coefficient-weighted overall average using only this term's sequence-1 / sequence-2 marks
  // across every subject ("Eval{2n-1}"/"Eval{2n}" columns) - see computeSeqOverallAverage.
  seqAverages: [number, number];
  bilanTrim: number;
  rangTrim: number | null;
  moyGenTrim: number;
}

export interface AnnualDecision {
  kind: "promu" | "redouble" | "redoubleSiEchec" | "nc" | "exclu";
  // Only set when kind === "promu" and basic_school_config.val2 (affichagePromotion) is truthy
  // and student_classe.promuEn resolves to a real classe.
  promuEnClasseName: string | null;
  // Only set when kind === "exclu": 2=Conduite, 3=Travail, 4=Ne peut trippler, 6=Insolvable.
  exclusionCode: number | null;
  // Only set when kind === "redoubleSiEchec" - precomputed here (not in the PDF layer) since it
  // depends on level/isTechnique/language, all already in hand at compute time.
  redoubleSiEchecText: string | null;
}

export interface AnnualStudentData {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  bday: string;
  bplace: string;
  sexe: string;
  repeating: boolean;
  subjects: AnnualSubjectRow[];
  totalGeneral: number;
  coefSum: number;
  avgAnnual: number;
  isAnnualAvgEmpty: boolean;
  isClassifiedAnnual: boolean;
  // 1-based rank among classified students, sorted by avgAnnual desc; null for NC students (still
  // present in the roster/print output, unranked, listed after every classified student).
  rangAnnuel: number | null;
  apprAnnuelle: string;
  disciplineByTerm: [ReportCardDiscipline, ReportCardDiscipline, ReportCardDiscipline];
  disciplineAnnual: ReportCardDiscipline;
  termSummaries: [AnnualTermSummary, AnnualTermSummary, AnnualTermSummary];
  decision: AnnualDecision;
  // Each term's own already-computed isClassified flag (see buildReportCardData) - exposed so a
  // caller (the Promotion module) can re-run computeAnnualClassified live against a manually-edited
  // override value without redoing the whole 3-term fetch. Not used by the RC print itself.
  termIsClassified: [boolean, boolean, boolean];
}

export interface AnnualClasseStats {
  effectif: number;
  moyenneGenerale: number;
  minMax: [number, number];
  nombreMoyennes: number;
  tauxReussite: number;
  ecartType: number;
}

export interface AnnualReportCardData {
  students: AnnualStudentData[];
  classeStats: AnnualClasseStats;
  // classifiedParam/nbMatieres are the ingredients computeAnnualClassified needs beyond
  // termIsClassified - exposed here (rather than only used internally) for the same live-recompute
  // reason as termIsClassified above.
  classifiedParam: ClassifiedParam | null;
  nbMatieres: number;
}

// ---- APC annual shapes ----
// A classe-year row here is one SUBJECT (not one competence, unlike the term APC RC) - Trim1/2/3
// are that subject's own per-term average (getStudCompTermAvg in apcAnnual.md), MOY is the
// subject's annual average across whichever of the 3 terms have data. No per-subject Rang (unlike
// the non-APC annual layout) - COTE/[Min-Max] take its place instead, matching the term APC
// layout's own per-subject columns.
export interface AnnualSubjectRowApc {
  subjectId: number;
  subjectTitle: string;
  staffLabel: string;
  coef: number;
  // [Trim1, Trim2, Trim3] - null where that term has no real (isEmpty=0) data for this subject.
  notes: [number | null, number | null, number | null];
  moy: number | null;
  mCoef: number | null;
  cote: string;
  subjectMin: number;
  subjectMax: number;
  appr: string;
}

export interface AnnualStudentDataApc {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  bday: string;
  bplace: string;
  sexe: string;
  repeating: boolean;
  subjects: AnnualSubjectRowApc[];
  totalGeneral: number;
  coefSum: number;
  avgAnnual: number;
  isAnnualAvgEmpty: boolean;
  isClassifiedAnnual: boolean;
  cote: string;
  // 1-based rank among classified students, sorted by avgAnnual desc; null for NC students.
  rangAnnuel: number | null;
  apprAnnuelle: string;
  // Annual totals only - unlike the non-APC annual layout's DISCIPLINE box, the APC sample shows
  // no per-term breakdown (see the plan's finding #3).
  disciplineAnnual: ReportCardDiscipline;
  decision: AnnualDecision;
  // See AnnualStudentData.termIsClassified above.
  termIsClassified: [boolean, boolean, boolean];
}

export interface AnnualReportCardDataApc {
  students: AnnualStudentDataApc[];
  classeStats: AnnualClasseStats;
  // See AnnualReportCardData.classifiedParam/nbMatieres above.
  classifiedParam: ClassifiedParam | null;
  nbMatieres: number;
}
