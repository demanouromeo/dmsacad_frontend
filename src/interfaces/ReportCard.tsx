// Shared shapes for the term report card (bulletin) feature, covering both APC and non-APC
// classes - see src/utils/reportCard/reportCardCompute.ts for how these are assembled (including
// the ReportCardSubjectBundle union that drives which shape a subject's data came from) and
// src/utils/reportCard/exportReportCardPdf.ts for how they're drawn.

// For an APC subject this is a real competence (subjectCompetenceId is a genuine DB id); for a
// non-APC subject it's synthesized per sequence of the term instead (subjectCompetenceId is the
// negated sequence number, e.g. -1/-2, since real ids are always positive) - see
// ReportCardSubjectRow.isApc to tell which.
export interface ReportCardCompetenceRow {
  subjectCompetenceId: number;
  competenceText: string;
  // null = no real (isEmpty=0) mark recorded for this competence/sequence, not a genuine 0.
  mark: number | null;
}

export interface ReportCardSubjectRow {
  subjectId: number;
  subjectTitle: string;
  // "Mr KAVAYE" / "Mme MBENGONO" style label, "" if no staff is assigned to this (subject, classe).
  staffLabel: string;
  coef: number;
  // true if this subject's classe/level is APC (competence-based) - drives what `competences`
  // actually represents (see ReportCardCompetenceRow). N/20 & MOY display formatting
  // (formatRcMarkDisplay/formatRcMoyDisplay) is the same for both APC and non-APC.
  isApc: boolean;
  competences: ReportCardCompetenceRow[];
  // null = the student has zero recorded marks for every competence of this subject this term - the
  // whole row is excluded from the student's own term-average coefficient sum (see moy's comment in
  // reportCardCompute.ts), and cote/apprLabel/mCoef are "" / null to match.
  moy: number | null;
  mCoef: number | null;
  cote: string;
  apprLabel: string;
  // Classe-wide min/max of every student's own subjectAverage for this subject (0/0 treated as "no
  // data" the same way as moy===null when the roster itself is empty) - identical across every
  // student's RC for the same (classe, subject, term), per the reference getMinMax().
  subjectMin: number;
  subjectMax: number;
}

export interface ReportCardDiscipline {
  absNonJust: number;
  absJust: number;
  lateness: number;
  consigne: number;
  avertissement: number;
  blame: number;
  exclusionJours: number;
  exclusionDefinitive: number;
}

export interface ReportCardStudentData {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  bday: string;
  bplace: string;
  sexe: string;
  repeating: boolean;
  subjects: ReportCardSubjectRow[];
  // Sum of every included subject's mCoef (2-decimal rounded, same as what's displayed per row).
  totalGeneral: number;
  // Sum of every included subject's coef - excludes subjects the student has zero marks for.
  coefSum: number;
  moyenneTrim: number;
  cote: string;
  isClassified: boolean;
  // 1-based rank among classified students, sorted by moyenneTrim desc; null for NC students (who
  // are still present in the roster/print output, just unranked and listed after every classified
  // student - see buildReportCardData's sort).
  rang: number | null;
  discipline: ReportCardDiscipline;
  effortLine: string;
}

export interface ReportCardClasseStats {
  effectif: number;
  moyenneGenerale: number;
  minMax: [number, number];
  nombreMoyennes: number;
  tauxReussite: number;
}

export interface ReportCardData {
  students: ReportCardStudentData[];
  classeStats: ReportCardClasseStats;
}
