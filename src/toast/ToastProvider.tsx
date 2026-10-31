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
    const group = options?.group;
    const id = nextId.current++;
    // An identical toast (same message and type) already on screen is replaced instead of stacked:
    // several components failing the same way at once (e.g. the login screen's school list, school
    // years and connectivity monitor when the server is down) would otherwise pile up copies. The
    // replacement is re-added last, so it also restarts its display time.
    setToasts((prev) => [
      ...prev.filter(
        (toast) =>
          !(toast.message === message && toast.type === type) &&
          !(group !== undefined && toast.group === group),
      ),
      { id, message, type, durationMs, group },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
