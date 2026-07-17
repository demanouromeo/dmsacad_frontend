// Shared between filiere and speciality name inputs - matches the backend's accepted charset for
// `nom_filiere`/`speciality_name` (letters incl. French/accented ones, digits, space, and a small
// set of separator punctuation). It's a negated class, so it matches exactly the characters to strip.
export const allowedCharactersForFiliereAndSpecialityRegex =
  /[^.&a-zA-Z0-9/_\-àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ ]/g;

export const MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH = 2;

export const MAX_SPECIALITY_DESCRIPTION_LENGTH = 55;

export const sanitizeFiliereOrSpecialityName = (value: string): string =>
  value.replace(allowedCharactersForFiliereAndSpecialityRegex, "");

// Person names (unlike filiere/speciality taxonomy labels) legitimately contain characters the
// regex above strips, e.g. apostrophes ("N'Diaye") - staff name/surname/login/pwd fields are only
// trimmed and length-checked against the backend's own saveStaff/updateManyStaffs rules, not
// character-whitelisted.
export const MIN_STAFF_NAME_LENGTH = 2;
export const MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH = 4;

// School basic-info form fields (establishment name, region, department, address references,
// signature place, ...): letters incl. French/accented, digits, space, and punctuation commonly
// found in official establishment names/addresses.
const allowedCharactersForSchoolInfoRegex =
  /[^a-zA-Z0-9 _\-àâçéèêîôùûÀÂÇÉÈÊÎÔŒÙÛ,/&.()'œ]/g;

export const sanitizeSchoolInfoText = (value: string): string =>
  value.replace(allowedCharactersForSchoolInfoRegex, "");

export const sanitizePhoneNumber = (value: string): string =>
  value.replace(/[^0-9]/g, "");
