import { createContext } from "react";

export type ToastType = "info" | "warning" | "danger";

export interface ToastOptions {
  type?: ToastType;
  durationMs?: number;
  // Toasts sharing a group replace one another (at most one on screen per group) even when their
  // texts differ - used to fold several symptoms of one cause, e.g. "server unreachable", into one.
  group?: string;
}

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
  group?: string;
}

export interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
