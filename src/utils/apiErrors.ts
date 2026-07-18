// The backend isn't localized and sometimes leaks raw SQL text (e.g. from an undeployed/older
// server) instead of the friendlier "already exists" wording - matching both keeps duplicate-name
// detection working regardless of which backend version answered the request. "already used" covers
// StaffController's login/phone1 uniqueness messages, which use different wording than Filiere/
// Speciality/Classe's "already exists".
export const isDuplicateNameError = (message: string): boolean =>
  /duplicate|already exists|already used/i.test(message);

// Some backend error messages (e.g. ClasseController::saveManyClasses' partial-failure summary)
// are built with raw `<br/>` separators rather than being localized/structured - strip them down to
// plain text so they're readable inside a toast instead of showing literal "<br/>" characters.
export const stripHtmlTags = (message: string): string =>
  message
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
