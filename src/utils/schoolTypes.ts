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
