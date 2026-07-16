import { useEffect } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type { ToastItem, ToastType } from "./toastContext";

const ALERT_CLASS: Record<ToastType, string> = {
  info: "alert-info",
  warning: "alert-warning",
  danger: "alert-error",
};

const ICON: Record<ToastType, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

const Toast = ({ toast, onDismiss }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const Icon = ICON[toast.type];

  return (
    <div className={`alert ${ALERT_CLASS[toast.type]} shadow-lg max-w-sm items-start`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span className="whitespace-pre-line">{toast.message}</span>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
