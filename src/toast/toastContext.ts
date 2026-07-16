import { createContext } from "react";

export type ToastType = "info" | "warning" | "danger";

export interface ToastOptions {
  type?: ToastType;
  durationMs?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
}

export interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
