import type { ReportCardClasseStats } from "../../interfaces/ReportCard";
import type { ThParam } from "../../interfaces/ThParam";
import { computeThEligibility, round2 } from "../reportCard/reportCardCompute";

// One already-built student's worth of input this report needs - deliberately narrow (not the
// full ReportCardStudentData/AnnualStudentData shape) so buildSyntheseGlobaleRow works for both
// the term and annual loaders, which expose the same fields under different names
// (moyenneTrim/isClassified/discipline.absNonJust/discipline.exclusionJours for term,
// avgAnnual/isClassifiedAnnual/disciplineAnnual.* for annual) - the caller maps either shape into
// this one before calling.
export interface SyntheseGlobaleStudentInput {
  name: string;
  surname: string;
  moy: number;
  isClassified: boolean;
  absNonJust: number;
  exclusionJours: number;
}

export interface SyntheseGlobaleRow {
  classeName: string;
  moyenneClasse: number;
  moyenneDuPremier: number;
  moyenneDuDernier: number;
  ecartType: number;
  nbExclusion: number;
  tableauHonneur: number;
  tableauHEncourag: number;
  tableauHonneurEF: number;
  effectif: number;
  classes: number;
  nonClasses: number;
  nbSup10: number;
  nbInf10: number;
  reussitesText: string;
  tauxReussite: number;
  nomDuPremier: string;
}

// Reverse-engineered from 4 sample "Synthèse Globale" PDFs (Trim 1/2/3 + Annuelle, 24 classes
// each). Every "Moyenne de la classe"/"Moyenne du premier"/"Moyenne du dernier"/"Ecart type"
// figure matched classeStats.moyenneGenerale/minMax[1]/minMax[0]/ecartType exactly (already
// computed by buildReportCardData/the annual equivalent - see reportCardCompute.ts), so this
// module reuses those wholesale rather than recomputing, same "single source of truth" precedent
// as statGroupeesCompute.ts.
//
// The one figure classeStats doesn't already carry is "Réussites (classés)"/"Taux Réussites
// (classés)": headers explicitly annotate these two (and only these two - "Nb. moyennes >= 10/20"
// has no such annotation) with "(classés)", so unlike classeStats.tauxReussite (a whole-roster
// rate), this counts successes (moy >= 10) among CLASSIFIED students only, divided by the
// classified count - not distinguishable from the whole-roster rate in the sample data itself
// (this test school's classifiedparam happens to classify everyone, so classified === effectif in
// every one of the 96 sampled rows), but the "(classés)" wording is explicit enough to implement
// literally rather than reuse classeStats.tauxReussite here.
export const buildSyntheseGlobaleRow = (
  classeName: string,
  students: SyntheseGlobaleStudentInput[],
  classeStats: ReportCardClasseStats,
  thParam: ThParam | null,
): SyntheseGlobaleRow => {
  const effectif = classeStats.effectif;
  const classifiedStudents = students.filter((s) => s.isClassified);
  const classes = classifiedStudents.length;
  const nonClasses = effectif - classes;

  // Tableau d'honneur's 3 tiers are computeThEligibility's own deserves/encouragement/felicitation
  // ladder (already used by the term RC's "APPRÉCIATION DU TRAVAIL" thText and the dedicated
  // Honor Roll certificate batch, exportThPdf.ts) - the sample headers' literal bracket numbers
  // ([12.5, 14.5[, [14.5, 15.0[, [15.0, 20]) are exactly this test school's thparam.lb_default/
  // lb/ub, confirming the columns are these three eligibility tiers, not an independent formula.
  let tableauHonneur = 0;
  let tableauHEncourag = 0;
  let tableauHonneurEF = 0;
  students.forEach((s) => {
    const eligibility = computeThEligibility(thParam, s.absNonJust, s.moy, s.isClassified);
    if (eligibility.felicitation) {
      tableauHonneurEF += 1;
    } else if (eligibility.encouragement) {
      tableauHEncourag += 1;
    } else if (eligibility.deserves) {
      tableauHonneur += 1;
    }
  });

  const nbExclusion = students.filter((s) => s.exclusionJours > 0).length;

  const nbSup10 = classeStats.nombreMoyennes;
  const nbInf10 = effectif - nbSup10;

  const successCount = classifiedStudents.filter((s) => s.moy >= 10).length;
  const tauxReussite = classes > 0 ? round2((successCount / classes) * 100) : 0;

  // "Nom du premier" - whichever student actually holds the classe's max moyenne (matches
  // "Moyenne du premier" = classeStats.minMax[1] exactly, ties broken by roster order since no
  // sample shows a tie), not assumed to be the top-ranked CLASSIFIED student specifically -
  // classeStats.minMax spans the whole roster (classified + NC), same convention already reused
  // above for moyenneDuPremier/moyenneDuDernier.
  let topStudent: SyntheseGlobaleStudentInput | null = null;
  students.forEach((s) => {
    if (!topStudent || s.moy > topStudent.moy) {
      topStudent = s;
    }
  });
  const top = topStudent as SyntheseGlobaleStudentInput | null;

  return {
    classeName,
    moyenneClasse: classeStats.moyenneGenerale,
    moyenneDuPremier: classeStats.minMax[1],
    moyenneDuDernier: classeStats.minMax[0],
    ecartType: classeStats.ecartType,
    nbExclusion,
    tableauHonneur,
    tableauHEncourag,
    tableauHonneurEF,
    effectif,
    classes,
    nonClasses,
    nbSup10,
    nbInf10,
    reussitesText: `${successCount} sur ${classes}`,
    tauxReussite,
    nomDuPremier: top ? `${top.name} ${top.surname}`.trim() : "",
  };
};
