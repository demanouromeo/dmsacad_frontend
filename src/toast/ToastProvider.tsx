import { useCallback, useRef, useState, type ReactNode } from "react";
import { ToastContext, type ToastItem, type ToastOptions, type ToastType } from "./toastContext";
import ToastViewport from "./ToastViewport";

const DEFAULT_DURATION_MS: Record<ToastType, number> = {
  info: 60_000,
  warning: 60_000,
  danger: 60_000,
};

interface ToastProviderProps {
  children: ReactNode;
}

const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const type = options?.type ?? "info";
    const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS[type];
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type, durationMs }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
