// Shared between filiere and speciality name inputs - matches the backend's accepted charset for
// `nom_filiere`/`speciality_name` (letters incl. French/accented ones, digits, space, and a small
// set of separator punctuation). It's a negated class, so it matches exactly the characters to strip.
export const allowedCharactersForFiliereAndSpecialityRegex =
  /[^.&a-zA-Z0-9/_\-àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ ]/g;

export const MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH = 2;

export const MAX_SPECIALITY_DESCRIPTION_LENGTH = 55;

export const sanitizeFiliereOrSpecialityName = (value: string): string =>
  value.replace(allowedCharactersForFiliereAndSpecialityRegex, "");
