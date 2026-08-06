import { useEffect, useState, type ReactNode } from "react";
import { MyConstants } from "../dbmanger/MyConstants";
import { ThemeContext, type ThemeMode } from "./themeContext";

// Maps the semantic mode (persisted to localStorage, independent of any daisyUI naming) to the
// actual daisyUI theme name declared in index.css.
const DAISYUI_THEME_NAME: Record<ThemeMode, string> = {
  dark: "dmsacad",
  light: "dmsacad-light",
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>(
    () =>
      (localStorage.getItem(MyConstants.THEME_KEY) as ThemeMode) || "light",
  );

  // index.html already sets data-theme synchronously (before this component mounts) to avoid a
  // flash of the wrong theme - this effect keeps <html> in sync on every subsequent change.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", DAISYUI_THEME_NAME[theme]);
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    localStorage.setItem(MyConstants.THEME_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
