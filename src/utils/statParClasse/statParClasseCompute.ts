import type { ReportCardData } from "../../interfaces/ReportCard";
import type { AnnualReportCardData, AnnualReportCardDataApc } from "../../interfaces/AnnualReportCard";
import { getCote, formatRangText } from "../reportCard/reportCardCompute";

// "Statistiques par classe" is the existing Report Card computation (buildReportCardData /
// buildAnnualReportCardData(Apc)) turned sideways into a whole-classe listing table instead of one
// page per student - confirmed by hand (6ème A term 1: student AHMADOU ISSA's printed TOTAL/Moyenne
// exactly equal Σ(subjectAverage × coef) / totalCoef off the RC's own already-computed values). This
// module only adapts/aggregates that already-computed data; it never re-derives a subject average,
// a coefficient, or the overall weighted average.

export interface StatParClasseSubjectCol {
  subjectId: number;
  subjectTitle: string;
  coef: number;
}

export interface StatParClasseStudentRow {
  studId: number;
  name: string;
  surname: string;
  sexe: string;
  repeating: boolean;
  subjectMoys: Map<number, number | null>;
  totalGeneral: number;
  moyenne: number;
  // getCote(moyenne) for non-APC classes (COTE column), formatRangText(rang, sexe, "fr") for APC
  // classes (Rang column) - the sample's own column choice, keyed off isLevelApc like everywhere
  // else in this app, not off the classe's level range.
  coteOrRang: string;
  absences: number;
}

export interface StatParClasseClasseStats {
  effectif: number;
  moyenneGenerale: number;
  minMax: [number, number];
  nombreMoyennes: number;
  tauxReussite: number;
  ecartType: number;
}

export interface StatParClasseData {
  subjects: StatParClasseSubjectCol[];
  rows: StatParClasseStudentRow[];
  classeStats: StatParClasseClasseStats;
}

const buildSubjects = (
  subjects: { subjectId: number; subjectTitle: string; coef: number }[],
): StatParClasseSubjectCol[] =>
  subjects.map((s) => ({ subjectId: s.subjectId, subjectTitle: s.subjectTitle, coef: s.coef }));

// Term data (both APC and non-APC share the same ReportCardData shape - isApc only decides which
// column (COTE vs Rang) this listing shows, matching the sample's own convention).
export const adaptTermData = (data: ReportCardData, isApc: boolean): StatParClasseData => ({
  subjects: buildSubjects(data.students[0]?.subjects ?? []),
  rows: data.students.map((s) => ({
    studId: s.studId,
    name: s.name,
    surname: s.surname,
    sexe: s.sexe,
    repeating: s.repeating,
    subjectMoys: new Map(s.subjects.map((sub) => [sub.subjectId, sub.moy])),
    totalGeneral: s.totalGeneral,
    moyenne: s.moyenneTrim,
    coteOrRang: isApc ? formatRangText(s.rang, s.sexe, "fr") : s.cote,
    absences: s.discipline.absNonJust + s.discipline.absJust,
  })),
  classeStats: data.classeStats,
});

// Annual, non-APC - AnnualStudentData has no `cote` field (only rangAnnuel), so it's computed fresh
// here via the same getCote every other cote in the app uses, for consistency across all 3 shapes.
export const adaptAnnualData = (data: AnnualReportCardData): StatParClasseData => ({
  subjects: buildSubjects(data.students[0]?.subjects ?? []),
  rows: data.students.map((s) => ({
    studId: s.studId,
    name: s.name,
    surname: s.surname,
    sexe: s.sexe,
    repeating: s.repeating,
    subjectMoys: new Map(s.subjects.map((sub) => [sub.subjectId, sub.moy])),
    totalGeneral: s.totalGeneral,
    moyenne: s.avgAnnual,
    coteOrRang: getCote(s.avgAnnual),
    absences: s.disciplineAnnual.absNonJust + s.disciplineAnnual.absJust,
  })),
  classeStats: data.classeStats,
});

// Annual, APC.
export const adaptAnnualApcData = (data: AnnualReportCardDataApc): StatParClasseData => ({
  subjects: buildSubjects(data.students[0]?.subjects ?? []),
  rows: data.students.map((s) => ({
    studId: s.studId,
    name: s.name,
    surname: s.surname,
    sexe: s.sexe,
    repeating: s.repeating,
    subjectMoys: new Map(s.subjects.map((sub) => [sub.subjectId, sub.moy])),
    totalGeneral: s.totalGeneral,
    moyenne: s.avgAnnual,
    coteOrRang: formatRangText(s.rangAnnuel, s.sexe, "fr"),
    absences: s.disciplineAnnual.absNonJust + s.disciplineAnnual.absJust,
  })),
  classeStats: data.classeStats,
});

export interface StatParClasseDemographics {
  garcons: number;
  filles: number;
  redoublants: number;
  tauxGarcons: number;
  tauxFilles: number;
  tauxRedoublants: number;
  nbMatieres: number;
  subjectSuccessRates: Map<number, number>;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

const subgroupSuccessRate = (
  rows: StatParClasseStudentRow[],
  predicate: (row: StatParClasseStudentRow) => boolean,
): number => {
  const subgroup = rows.filter(predicate);
  if (subgroup.length === 0) {
    return 0;
  }
  const passed = subgroup.filter((r) => r.moyenne >= 10).length;
  return round2((passed / subgroup.length) * 100);
};

// Demographics/subgroup pass rates are computed over the FULL roster (confirmed against 6ème A
// term 1: 7/42 garçons ≥10 = 16.67%, 0/20 filles = 0.0%, matching the printed values exactly, and
// 7 = the classeStats.nombreMoyennes already computed by buildReportCardData). Per-subject success
// rate uses the subject's own PARTICIPANTS as the denominator (students with a non-null subject
// average), not the full roster - same precedent StatMatiere's buildStatMatiereClasseRow already
// established for %RÉUSSITE.
export const computeStatParClasseDemographics = (
  rows: StatParClasseStudentRow[],
  subjects: StatParClasseSubjectCol[],
): StatParClasseDemographics => {
  const isFemale = (sexe: string) => sexe.toLowerCase() === "f";

  const subjectSuccessRates = new Map<number, number>();
  subjects.forEach((subject) => {
    const participantMoys = rows
      .map((r) => r.subjectMoys.get(subject.subjectId))
      .filter((moy): moy is number => moy !== null && moy !== undefined);
    if (participantMoys.length === 0) {
      subjectSuccessRates.set(subject.subjectId, 0);
      return;
    }
    const passed = participantMoys.filter((moy) => moy >= 10).length;
    subjectSuccessRates.set(subject.subjectId, round2((passed / participantMoys.length) * 100));
  });

  return {
    garcons: rows.filter((r) => !isFemale(r.sexe)).length,
    filles: rows.filter((r) => isFemale(r.sexe)).length,
    redoublants: rows.filter((r) => r.repeating).length,
    tauxGarcons: subgroupSuccessRate(rows, (r) => !isFemale(r.sexe)),
    tauxFilles: subgroupSuccessRate(rows, (r) => isFemale(r.sexe)),
    tauxRedoublants: subgroupSuccessRate(rows, (r) => r.repeating),
    nbMatieres: subjects.length,
    subjectSuccessRates,
  };
};
