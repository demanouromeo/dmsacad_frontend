import { createContext } from "react";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // Only meaningful for confirmChoice: adds a third "Cancel" button that aborts the whole flow, in
  // addition to the usual cancelLabel/confirmLabel pair (which then mean "no"/"yes").
  extraCancel?: boolean;
}

export type ConfirmChoice = "yes" | "no" | "cancel";

export interface ConfirmContextValue {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  confirmChoice: (message: string, options?: ConfirmOptions) => Promise<ConfirmChoice>;
}

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);
