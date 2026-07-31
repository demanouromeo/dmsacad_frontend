import type { Classe } from "../interfaces/Classe";
import { normalize } from "../assistant/assistantEngine";

// Fuzzy-matches free text (typed by a user, or said to Lindsay) against a list of classes by
// name - exact-normalized-substring match first (handles diacritic/case differences like
// "5ème A" vs "5eme a"), falling back to a token-overlap match (every word of the classe name
// must appear somewhere in the query, for slightly reordered phrasing). Returns null rather than
// guessing when nothing scores above zero. Shared by the assistant's command engine (resolving a
// classe named in a chat command) and StudentManager (resolving a classe name Lindsay navigated
// in with) so both stay in sync on what counts as a match.
export function findClasseByName(query: string, classes: Classe[]): Classe | null {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  let best: { classe: Classe; score: number } | null = null;
  for (const classe of classes) {
    const normalizedName = normalize(classe.classe_name);
    if (!normalizedName) continue;

    let score = 0;
    if (normalizedQuery.includes(normalizedName)) {
      score = normalizedName.length;
    } else {
      const nameTokens = normalizedName.split(" ").filter(Boolean);
      const queryTokens = new Set(normalizedQuery.split(" ").filter(Boolean));
      if (nameTokens.length > 0 && nameTokens.every((tok) => queryTokens.has(tok))) {
        score = nameTokens.join("").length;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { classe, score };
    }
  }
  return best?.classe ?? null;
}
