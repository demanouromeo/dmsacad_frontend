// Computes the school year that immediately follows the given one - "2025/2026" -> "2026/2027".
// Only understands this app's own "YYYY/YYYY" convention (see SchoolYear.tsx); returns null for
// anything else rather than guessing, so callers (BasculementManager) can distinguish "next year
// not computable" from "next year not found in the DB".
export const computeNextSchoolYear = (year: string): string | null => {
  const match = /^(\d{4})\/(\d{4})$/.exec(year.trim());
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  return `${start + 1}/${end + 1}`;
};
