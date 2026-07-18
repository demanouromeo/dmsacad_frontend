import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmContext, type ConfirmOptions } from "./confirmContext";
import { confirmTranslations } from "../i18n/translations";
import { useLanguage } from "../i18n/useLanguage";

interface ConfirmRequest {
  message: string;
  options: ConfirmOptions;
}

interface ConfirmProviderProps {
  children: ReactNode;
}

const ConfirmProvider = ({ children }: ConfirmProviderProps) => {
  const [language] = useLanguage();
  const t = confirmTranslations[language];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((result: boolean) => void) | null>(null);
  // Tracks the native "close" listener currently attached to the dialog, so settle() can remove it
  // synchronously before calling close() - see the effect below for why this is necessary.
  const closeListenerRef = useRef<(() => void) | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest({ message, options: options ?? {} });
    });
  }, []);

  // The native <dialog>'s "close" event is deferred (queued as a task), not synchronous - calling
  // .close() imperatively (via settle(), below) hides the dialog immediately but the event itself
  // fires later. Chaining two confirm() calls back-to-back (e.g. an "are you sure, really sure?"
  // pair) used to race: the first dialog's deferred close event would fire *after* the second
  // confirm() had already replaced resolveRef, incorrectly auto-cancelling the second dialog the
  // instant it opened. Attaching/removing the listener per-open (rather than a single persistent
  // React onClose prop) lets settle() remove its own listener before closing, so a
  // programmatically-settled close never fires this handler at all - only a genuine user dismissal
  // (Escape key) does.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!request || !dialog) {
      return;
    }
    const onNativeClose = () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
      closeListenerRef.current = null;
      setRequest(null);
    };
    closeListenerRef.current = onNativeClose;
    dialog.addEventListener("close", onNativeClose);
    dialog.showModal();
    return () => {
      dialog.removeEventListener("close", onNativeClose);
      if (closeListenerRef.current === onNativeClose) {
        closeListenerRef.current = null;
      }
    };
  }, [request]);

  const settle = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    const dialog = dialogRef.current;
    if (dialog && closeListenerRef.current) {
      dialog.removeEventListener("close", closeListenerRef.current);
      closeListenerRef.current = null;
    }
    dialog?.close();
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">
            {request?.options.title ?? t.defaultTitle}
          </h3>
          <p className="whitespace-pre-line mb-6">{request?.message}</p>
          <div className="modal-action">
            <button type="button" className="btn" onClick={() => settle(false)}>
              {request?.options.cancelLabel ?? t.cancelBtn}
            </button>
            <button
              type="button"
              className={`btn ${request?.options.danger ? "btn-error" : "btn-primary"}`}
              onClick={() => settle(true)}
            >
              {request?.options.confirmLabel ?? t.confirmBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => settle(false)}>{t.cancelBtn}</button>
        </form>
      </dialog>
    </ConfirmContext.Provider>
  );
};

export default ConfirmProvider;
