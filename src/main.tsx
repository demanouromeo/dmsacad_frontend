import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { CookiesProvider } from "react-cookie";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { LanguageProvider } from "./i18n/LanguageProvider.tsx";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";
import ToastProvider from "./toast/ToastProvider.tsx";
import ConfirmProvider from "./confirm/ConfirmProvider.tsx";
import ConnectivityMonitor from "./connectivity/ConnectivityMonitor.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <ConnectivityMonitor />
          <ConfirmProvider>
            <CookiesProvider defaultSetOptions={{ path: "/" }}>
              <AuthProvider>
                <App />
              </AuthProvider>
            </CookiesProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>,
);
