import type { Language } from "../i18n/translations";
import { adminMenuTranslations } from "../i18n/translations";
import { ADMIN_MENU_ITEMS, NON_ADMIN_MENU_ITEMS } from "../components/dashboard/menuItems";
import { KNOWLEDGE_BASE, type KbEntry, type Role } from "./knowledgeBase";

// Matches whatever the user typed against the local knowledge base (see knowledgeBase.ts for why
// this isn't a real AI call) and, for role-restricted entries the user isn't allowed to see,
// answers with a role-restricted notice instead of leaking the real instructions - this is what
// "enable them to access resources they have right to" means in practice here.

const ROLE_LABELS: Record<Role, { fr: string; en: string }> = {
  ADMIN: { fr: "Administrateur", en: "Administrator" },
  SG: { fr: "Surveillant Général (SG)", en: "Senior Supervisor (SG)" },
  TEACHER: { fr: "Enseignant(e)", en: "Teacher" },
  CENSEUR: { fr: "Censeur", en: "Deputy Principal (Censeur)" },
  PARENT: { fr: "Parent", en: "Parent" },
  BURSAR: { fr: "Économe", en: "Bursar" },
  TOP_MANAGEMENT: { fr: "Direction (Proviseur/Directeur)", en: "Management (Principal/Director)" },
  STUDENT: { fr: "Élève", en: "Student" },
};

function isKnownRole(role: string): role is Role {
  return role in ROLE_LABELS;
}

const DIACRITIC_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITIC_MARKS_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MY_ACCESS_KEYWORDS = [
  "quelles fonctionnalites",
  "qu est ce que je peux faire",
  "mes acces",
  "a quoi ai je acces",
  "what can i access",
  "what can i do",
  "my access",
  "my permissions",
];

function scoreEntry(entry: KbEntry, normalizedInput: string): number {
  const allKeywords = [...entry.keywords.fr, ...entry.keywords.en].map(normalize);
  let score = 0;
  for (const keyword of allKeywords) {
    if (keyword.length > 0 && normalizedInput.includes(keyword)) {
      score += keyword.split(" ").length; // reward longer/more specific phrase matches
    }
  }
  const questionFr = normalize(entry.question.fr);
  const questionEn = normalize(entry.question.en);
  if (normalizedInput.includes(questionFr) || questionFr.includes(normalizedInput)) score += 3;
  if (normalizedInput.includes(questionEn) || questionEn.includes(normalizedInput)) score += 3;
  return score;
}

function buildMyAccessAnswer(role: string, language: Language): string {
  const menuT = adminMenuTranslations[language];
  if (role === "ADMIN") {
    const items = ADMIN_MENU_ITEMS.filter((item) => item.to).map((item) => `- ${menuT[item.key]}`);
    return language === "fr"
      ? `En tant qu'administrateur, vous avez accès à tout, notamment :\n${items.join("\n")}`
      : `As an administrator, you have access to everything, including:\n${items.join("\n")}`;
  }
  if (role === "PARENT") {
    return language === "fr"
      ? "En tant que parent, vous pouvez consulter (en lecture seule) les résultats et la discipline de vos enfants liés à votre compte."
      : "As a parent, you can view (read-only) the results and discipline record of the children linked to your account.";
  }
  const nonAdminItems = NON_ADMIN_MENU_ITEMS[role];
  if (nonAdminItems && nonAdminItems.length > 0) {
    const items = nonAdminItems.map((item) => `- ${menuT[item.key]}`);
    const roleLabel = isKnownRole(role) ? ROLE_LABELS[role][language] : role;
    return language === "fr"
      ? `En tant que ${roleLabel}, vous avez accès à :\n${items.join("\n")}`
      : `As ${roleLabel}, you have access to:\n${items.join("\n")}`;
  }
  return language === "fr"
    ? "Votre rôle n'a pas encore de module dédié dans l'application - seule la gestion de vos identifiants est disponible pour l'instant."
    : "Your role doesn't have a dedicated module in the app yet - only managing your own credentials is available for now.";
}

export interface AssistantAnswer {
  text: string;
  matchedId: string | null;
}

export function getAssistantAnswer(
  rawInput: string,
  role: string,
  language: Language,
  fallbackText: string,
): AssistantAnswer {
  const normalizedInput = normalize(rawInput);
  if (normalizedInput.length === 0) {
    return { text: fallbackText, matchedId: null };
  }

  if (MY_ACCESS_KEYWORDS.some((keyword) => normalizedInput.includes(normalize(keyword)))) {
    return { text: buildMyAccessAnswer(role, language), matchedId: "my_access" };
  }

  const allowedEntries = KNOWLEDGE_BASE.filter(
    (entry) => !entry.roles || entry.roles.includes(role as Role),
  );

  let bestAllowed: { entry: KbEntry; score: number } | null = null;
  for (const entry of allowedEntries) {
    const score = scoreEntry(entry, normalizedInput);
    if (score > 0 && (!bestAllowed || score > bestAllowed.score)) {
      bestAllowed = { entry, score };
    }
  }

  let bestOverall: { entry: KbEntry; score: number } | null = null;
  for (const entry of KNOWLEDGE_BASE) {
    const score = scoreEntry(entry, normalizedInput);
    if (score > 0 && (!bestOverall || score > bestOverall.score)) {
      bestOverall = { entry, score };
    }
  }

  // The best match overall is restricted to roles the current user doesn't have - tell them so
  // rather than silently falling back to a weaker/no match, or answering with instructions for a
  // feature they can't reach.
  if (
    bestOverall &&
    bestOverall.entry.roles &&
    !bestOverall.entry.roles.includes(role as Role) &&
    (!bestAllowed || bestOverall.score >= bestAllowed.score)
  ) {
    const roleNames = bestOverall.entry.roles
      .map((r) => (isKnownRole(r) ? ROLE_LABELS[r][language] : r))
      .join(", ");
    const text =
      language === "fr"
        ? `Cette fonctionnalité n'est pas accessible avec votre rôle actuel (réservée à : ${roleNames}). Contactez votre administrateur si vous pensez en avoir besoin.`
        : `This feature isn't available with your current role (restricted to: ${roleNames}). Contact your administrator if you believe you need it.`;
    return { text, matchedId: bestOverall.entry.id };
  }

  if (bestAllowed) {
    return { text: bestAllowed.entry.answer[language], matchedId: bestAllowed.entry.id };
  }

  return { text: fallbackText, matchedId: null };
}

export function getSuggestedQuestions(role: string, limit = 5): KbEntry[] {
  return KNOWLEDGE_BASE.filter((entry) => !entry.roles || entry.roles.includes(role as Role)).slice(
    0,
    limit,
  );
}
