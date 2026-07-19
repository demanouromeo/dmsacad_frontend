// Shared between filiere and speciality name inputs - matches the backend's accepted charset for
// `nom_filiere`/`speciality_name` (letters incl. French/accented ones, digits, space, and a small
// set of separator punctuation). It's a negated class, so it matches exactly the characters to strip.
export const allowedCharactersForFiliereAndSpecialityRegex =
  /[^.&a-zA-Z0-9/_\-àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ ]/g;

export const MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH = 2;

export const MAX_SPECIALITY_DESCRIPTION_LENGTH = 55;

export const MAX_COMPETENCE_TEXT_LENGTH = 300;

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

// Mark entry cells accept a double in [0, MAX_MARK_VALUE] - strips anything but digits and a single
// decimal point while typing. Range clamping to [0, MAX_MARK_VALUE] is a separate check
// (isMarkInRange) rather than folded into sanitizing, since "2" is a valid in-progress prefix of "20"
// and shouldn't be rejected mid-keystroke.
export const MAX_MARK_VALUE = 20;

export const sanitizeMarkInput = (value: string): string => {
  const stripped = value.replace(/[^0-9.]/g, "");
  const firstDot = stripped.indexOf(".");
  if (firstDot === -1) {
    return stripped;
  }
  return stripped.slice(0, firstDot + 1) + stripped.slice(firstDot + 1).replace(/\./g, "");
};

export const isMarkInRange = (value: string): boolean => {
  if (value.trim() === "") {
    return true;
  }
  const parsed = Number(value);
  return !Number.isNaN(parsed) && parsed >= 0 && parsed <= MAX_MARK_VALUE;
};

// Displayed/committed mark format is always "XX.YY" (2-digit integer part, 2-digit decimal part) -
// applied both to marks freshly fetched from the server (which come back as a plain number, e.g.
// `5` or `12.5`) and to whatever the user typed once they leave the cell/press Enter. Left as-is
// (no formatting) for an empty or not-yet-valid-number value - isMarkInRange/handleMarkBlur already
// clears anything genuinely invalid before this would ever see it.
export const formatMarkValue = (value: string): string => {
  if (value.trim() === "") {
    return value;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  let intPart = Math.trunc(parsed);
  let decPart = Math.round((parsed - intPart) * 100);
  if (decPart === 100) {
    decPart = 0;
    intPart += 1;
  }
  return `${String(intPart).padStart(2, "0")}.${String(decPart).padStart(2, "0")}`;
};
