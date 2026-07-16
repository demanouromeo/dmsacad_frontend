// The backend isn't localized and sometimes leaks raw SQL text (e.g. from an undeployed/older
// server) instead of the friendlier "already exists" wording - matching both keeps duplicate-name
// detection working regardless of which backend version answered the request.
export const isDuplicateNameError = (message: string): boolean =>
  /duplicate|already exists/i.test(message);
