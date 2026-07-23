export const SCHOOL_TYPES = [
  "CES",
  "CETIC",
  "CETIC BILINGUE",
  "COLLEGE",
  "ENIEG",
  "ENIEG BILINGUE",
  "LYCEE",
  "LYCEE BILINGUE",
  "LYCEE TECHNIQUE",
  "LYCEE TECHNIQUE BILINGUE",
];

export interface Responsable {
  fr: string;
  en: string;
}

// Director-type establishments (CES/ENIEG/CETIC/COLLEGE) use "Directeur/Director"; every other
// type (LYCEE and its variants) uses "Proviseur/Principal" - mirrors the mobile app's
// computeResponsable() so generated documents address the right title for the school type.
export const computeResponsable = (type: string): Responsable => {
  const lower = type.toLowerCase();
  if (
    lower.includes("ces") ||
    lower.includes("enieg") ||
    lower.includes("cetic") ||
    lower.includes("college")
  ) {
    return { fr: "Directeur", en: "Director" };
  }
  return { fr: "Proviseur", en: "Principal" };
};

// CES/CETIC/CETIC BILINGUE only go up to level 4 (classes de 6e-3e); every other type (LYCEE,
// COLLEGE, ENIEG and their variants) goes up to level 7 (classes de 6e-Terminale).
const SHORT_CYCLE_TYPES = ["CES", "CETIC", "CETIC BILINGUE"];

export const computeMaxClasseLevel = (type: string): number =>
  SHORT_CYCLE_TYPES.includes(type.toUpperCase()) ? 4 : 7;

// Ported from nonAPCannual.md's spec (mirrors the mobile app's own isTechnique check) - drives the
// annual report card's "Redouble si échec" level-4 special case (level 4 + isTechnique gets the
// CAP wording instead of the GCE one) and the level 6/7/level-4-technique "always redouble si
// échec" branch in annualReportCardCompute.ts's computeAnnualDecision.
export const computeIsTechnique = (type: string): boolean => {
  const upper = type.toUpperCase();
  return (
    upper.includes("TECHNIQUE") ||
    upper.includes("CETIC") ||
    upper.includes("GTHS") ||
    upper.includes("GTC") ||
    upper.includes("TECHNICAL")
  );
};
