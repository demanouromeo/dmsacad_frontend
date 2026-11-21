import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

// Native Android only: makes the hardware/gesture back button behave like the browser's Back
// button - go to the previous page of the app's history, and only leave the app when there is
// nothing left to go back to. React Router's BrowserRouter keeps its position in history.state.idx
// (0 = first entry of this session), which tells us whether a previous page exists.
const AndroidBackButton = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    const handle = CapacitorApp.addListener("backButton", () => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) {
        window.history.back();
      } else {
        void CapacitorApp.exitApp();
      }
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
  return null;
};

export default AndroidBackButton;
