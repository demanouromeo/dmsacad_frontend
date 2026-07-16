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
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest({ message, options: options ?? {} });
    });
  }, []);

  useEffect(() => {
    if (request) {
      dialogRef.current?.showModal();
    }
  }, [request]);

  const settle = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    dialogRef.current?.close();
  };

  const handleDialogClose = () => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <dialog ref={dialogRef} className="modal" onClose={handleDialogClose}>
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
