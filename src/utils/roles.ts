// SUBADMIN (account.type=9) has every ADMIN right except adding/deleting students - the backend's
// RoleMiddleware maps it to ADMIN on any route group that allows ADMIN (unless the group lists
// "!SUBADMIN"). Use this wherever the UI checks "is this an ADMIN-level user".
export const isAdminRole = (role: string | undefined | null): boolean =>
  role === "ADMIN" || role === "SUBADMIN";
