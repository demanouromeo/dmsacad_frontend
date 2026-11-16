import { useEffect, useState, type ReactNode } from "react";
import { MyConstants } from "../dbmanger/MyConstants";
import { LanguageContext } from "./languageContext";
import type { Language } from "./translations";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem(MyConstants.LANGUAGE_KEY) as Language) || "fr",
  );

  // Keep <html lang> truthful so the browser never guesses a mismatch and offers to translate the page.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(MyConstants.LANGUAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
