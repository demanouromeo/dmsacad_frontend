import type { ToastItem } from "./toastContext";
import Toast from "./Toast";

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const ToastViewport = ({ toasts, onDismiss }: ToastViewportProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast toast-center toast-bottom z-100">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export default ToastViewport;
