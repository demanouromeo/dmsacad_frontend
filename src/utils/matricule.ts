// No backend endpoint generates matricules - this is pure client-side logic per the school's own
// numbering convention: {yearPrev}-{cl}{sectionCode}{2 random letters}-{2 random digits}, e.g.
// "2025-6e01BG-47" for school year "2025/2026", classe "6ème A", section francophone.
const SECTION_CODES: Record<string, string> = {
  francophone: "01",
  anglophone: "02",
};

const DIACRITICS_REGEX = /[̀-ͯ]/g;

// "6ème A" -> "6eme a" -> "6e" (strip accents/case before slicing, so the code doesn't depend on
// whether the accented character survives the slice).
const classeCode = (classeName: string): string =>
  classeName
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .slice(0, 2);

const randomLetters = (): string =>
  Array.from({ length: 2 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join("");

const randomDigits = (): string =>
  Array.from({ length: 2 }, () => String(Math.floor(Math.random() * 10))).join(
    "",
  );

const buildCandidate = (
  schoolYear: string,
  classeName: string,
  section: string,
): string => {
  const yearPrev = schoolYear.split("/")[0];
  const sectionCode = SECTION_CODES[section] ?? "01";
  return `${yearPrev}-${classeCode(classeName)}${sectionCode}${randomLetters()}-${randomDigits()}`;
};

const MAX_ATTEMPTS = 50;

// Regenerates until the candidate isn't in `existingMatricules` (per the school's requirement that
// a freshly generated matricule must be verified unique against every student in the system before
// use) - falls back to whatever the last attempt produced if genuinely unlucky after MAX_ATTEMPTS.
export const generateUniqueMatricule = (
  schoolYear: string,
  classeName: string,
  section: string,
  existingMatricules: ReadonlySet<string>,
): string => {
  let candidate = buildCandidate(schoolYear, classeName, section);
  let attempts = 0;
  while (existingMatricules.has(candidate) && attempts < MAX_ATTEMPTS) {
    candidate = buildCandidate(schoolYear, classeName, section);
    attempts++;
  }
  return candidate;
};
