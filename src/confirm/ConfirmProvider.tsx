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
  // Counts dialog.close() calls made by settle() whose native "close" event hasn't fired yet - see
  // the persistent-listener effect below for why this is needed.
  const pendingProgrammaticClosesRef = useRef(0);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest({ message, options: options ?? {} });
    });
  }, []);

  // A native <dialog>'s "close" event is deferred (queued as a task), not synchronous - calling
  // .close() imperatively (via settle(), below) hides the dialog immediately but the event itself
  // fires later. With two confirm() calls chained back-to-back (e.g. an "are you sure, really
  // sure?" pair, like the classe-import override flow), the second dialog can already be open on
  // this same shared <dialog> element by the time the first close's deferred event actually fires -
  // and since a "close" event carries no information about which close() call produced it, it gets
  // delivered to whichever listener is attached *at that moment*, incorrectly auto-cancelling the
  // second (unrelated, still-open) dialog the instant it opens. A per-open listener (removed before
  // each programmatic close) doesn't fix this - it only stops OUR OWN request's listener from
  // catching its own deferred event, not a *later* request's listener from catching an *earlier*
  // one's. The actual fix: one persistent listener, plus a counter of self-inflicted closes still
  // in flight - a real user dismissal (Escape/backdrop) only reaches this handler when that count
  // is zero.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const onNativeClose = () => {
      if (pendingProgrammaticClosesRef.current > 0) {
        pendingProgrammaticClosesRef.current -= 1;
        return;
      }
      resolveRef.current?.(false);
      resolveRef.current = null;
      setRequest(null);
    };
    dialog.addEventListener("close", onNativeClose);
    return () => dialog.removeEventListener("close", onNativeClose);
  }, []);

  // Opens (or re-opens with fresh content) whenever a new request comes in.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!request || !dialog) {
      return;
    }
    dialog.showModal();
  }, [request]);

  const settle = (result: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    const dialog = dialogRef.current;
    if (dialog?.open) {
      pendingProgrammaticClosesRef.current += 1;
      dialog.close();
    }
    setRequest(null);
    resolve?.(result);
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
