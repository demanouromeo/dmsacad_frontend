import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/useLanguage";
import { studentManagerTranslations } from "../../../i18n/translations";

export interface IgnoredDuplicate {
  matricule: string;
  name: string;
  surname: string;
}

interface ImportDuplicatesDialogProps {
  // null = closed
  summary: { imported: number; saved: number; duplicates: IgnoredDuplicate[] } | null;
  onClose: () => void;
}

// Shown after an import whose file listed the same matricule more than once: says how many rows
// were read vs. really saved, and lets the user inspect the ignored rows on demand.
const ImportDuplicatesDialog = ({ summary, onClose }: ImportDuplicatesDialogProps) => {
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (summary && !dialog.open) {
      setShowList(false);
      dialog.showModal();
    } else if (!summary && dialog.open) {
      dialog.close();
    }
  }, [summary]);

  return (
    <dialog ref={dialogRef} className="modal" onCancel={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-3">{t.importDuplicatesTitle}</h3>
        {summary && (
          <>
            <p className="mb-3">{t.importDuplicatesMessage(summary.imported, summary.saved)}</p>
            {showList && (
              <ul className="text-sm mb-3 rounded-lg bg-base-200 p-3 max-h-64 overflow-y-auto space-y-1">
                {summary.duplicates.map((d, i) => (
                  <li key={i}>
                    {d.name} {d.surname} — {d.matricule}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="modal-action">
          {!showList && (
            <button type="button" className="btn btn-outline" onClick={() => setShowList(true)}>
              {t.importDuplicatesView}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t.importDuplicatesClose}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" aria-label={t.importDuplicatesClose} onClick={onClose} />
      </form>
    </dialog>
  );
};

export default ImportDuplicatesDialog;
