import { MAX_MARK_VALUE } from "./textValidation";

export type VoiceLanguage = "fr" | "en";

// Most STT engines already transcribe spoken numbers as digits ("12.5", "12,5", "20"), so digit
// parsing is tried first. The word tables below are a fallback for engines/locales that transcribe
// numbers literally as words instead (0-20 covers every valid mark value).
const FR_NUMBER_WORDS: Record<string, number> = {
  zéro: 0,
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  "dix-sept": 17,
  "dix sept": 17,
  "dix-huit": 18,
  "dix huit": 18,
  "dix-neuf": 19,
  "dix neuf": 19,
  vingt: 20,
};

const EN_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const DECIMAL_WORD: Record<VoiceLanguage, string> = { fr: "virgule", en: "point" };
const OUT_OF_PATTERN: Record<VoiceLanguage, RegExp> = {
  fr: /\s*sur\s*(20|vingt)\s*$/,
  en: /\s*(out of|over)\s*(20|twenty)\s*$/,
};

const inRange = (value: number): boolean => value >= 0 && value <= MAX_MARK_VALUE;

// A single token is either a bare digit string or a known number word - never both falsy-checked
// against 0, since "0"/"zero" must parse to a real 0, not fall through to "not a number".
const parseToken = (token: string, words: Record<string, number>): number | null => {
  const trimmed = token.trim();
  if (trimmed === "") {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed in words ? words[trimmed] : null;
};

// Parses one recognized utterance ("12.5", "douze virgule cinq", "twelve point five", "15 sur 20")
// into a mark value in [0, MAX_MARK_VALUE], or null if it can't be understood/is out of range.
export const parseVoiceMarkText = (rawText: string, lang: VoiceLanguage): number | null => {
  const text = rawText.trim().toLowerCase().replace(/[.,]$/, "");
  if (text === "") {
    return null;
  }

  const normalizedDigits = text.replace(",", ".").replace(/\s+/g, "");
  if (/^\d+(\.\d+)?$/.test(normalizedDigits)) {
    const value = Number(normalizedDigits);
    return Number.isFinite(value) && inRange(value) ? value : null;
  }

  const withoutOutOf = text.replace(OUT_OF_PATTERN[lang], "").trim();
  const words = lang === "fr" ? FR_NUMBER_WORDS : EN_NUMBER_WORDS;

  const decimalParts = withoutOutOf.split(DECIMAL_WORD[lang]).map((p) => p.trim());
  if (decimalParts.length === 2) {
    const intPart = parseToken(decimalParts[0], words);
    const fracPart = parseToken(decimalParts[1], words);
    if (intPart !== null && fracPart !== null) {
      const value = Number(`${intPart}.${fracPart}`);
      return inRange(value) ? value : null;
    }
  }

  const wordValue = parseToken(withoutOutOf, words);
  return wordValue !== null && inRange(wordValue) ? wordValue : null;
};

// The speech-recognition plugin can return several candidate transcriptions per utterance
// (maxResults) - tries each in order and returns the first one that parses into a valid mark.
export const parseVoiceMarkCandidates = (
  matches: string[] | undefined,
  lang: VoiceLanguage,
): number | null => {
  for (const match of matches ?? []) {
    const parsed = parseVoiceMarkText(match, lang);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};
