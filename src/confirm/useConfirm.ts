import { useContext } from "react";
import { ConfirmContext } from "./confirmContext";

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm() must be used within a ConfirmProvider");
  }
  return ctx.confirm;
};

// Three-way variant: resolves "yes" / "no" / "cancel" (third button, Escape or backdrop click).
export const useConfirmChoice = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirmChoice() must be used within a ConfirmProvider");
  }
  return ctx.confirmChoice;
};
