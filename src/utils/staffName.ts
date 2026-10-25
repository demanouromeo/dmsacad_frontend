// Prefixes a staff member's civility (Mr, Mme, ...) to their name for every printed/exported
// document (PDF/Excel) where a staff name appears: "Mr Momo" instead of "Momo". Returns the name
// unchanged when there's no civility, and "" when there's no name at all.
export const withCivility = (
  civility: string | null | undefined,
  name: string | null | undefined,
): string => {
  const trimmedName = (name ?? "").trim();
  if (!trimmedName) {
    return "";
  }
  const trimmedCivility = (civility ?? "").trim();
  return trimmedCivility ? `${trimmedCivility} ${trimmedName}` : trimmedName;
};
