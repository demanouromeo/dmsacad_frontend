import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { CookiesProvider } from "react-cookie";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { LanguageProvider } from "./i18n/LanguageProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <CookiesProvider defaultSetOptions={{ path: "/" }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </CookiesProvider>
    </LanguageProvider>
  </StrictMode>,
);
