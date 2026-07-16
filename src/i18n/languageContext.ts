import { createContext } from "react";
import type { Language } from "./translations";

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(
  null,
);
