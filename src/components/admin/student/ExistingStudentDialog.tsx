import { useEffect, useRef } from "react";
import { useLanguage } from "../../../i18n/useLanguage";
import { studentManagerTranslations } from "../../../i18n/translations";

export interface ExistingStudentInfo {
  name: string;
  surname: string | null;
  bday: string | null;
  bplace: string | null;
  sexe: string | null;
  handicape: number;
}

export type ExistingStudentChoice = "use" | "update" | "cancel";

interface ExistingStudentDialogProps {
  open: boolean;
  matricule: string;
  classeName: string;
  existing: ExistingStudentInfo | null;
  onChoose: (choice: ExistingStudentChoice) => void;
}

// Shown when the matricule typed in the add-student form already belongs to a student known from
// ANOTHER school year (a student is one row per matricule - see StudentController::saveAStudent).
// Three outcomes: enrol the existing student as is ("Enregistrer"), refresh his info with what was
// typed and enrol him ("Mettre à jour et Enregistrer"), or cancel. Native <dialog>, same pattern as
// the other student dialogs; Escape/backdrop count as Annuler.
const ExistingStudentDialog = ({
  open,
  matricule,
  classeName,
  existing,
  onChoose,
}: ExistingStudentDialogProps) => {
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const fullName = existing ? `${existing.name} ${existing.surname ?? ""}`.trim() : "";
  const bday = existing?.bday ? existing.bday.slice(0, 10) : "-";

  return (
    <dialog ref={dialogRef} className="modal" onCancel={() => onChoose("cancel")}>
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-3">{t.existingStudentTitle}</h3>
        <p className="mb-3">{t.existingStudentIntro(fullName, matricule)}</p>
        {existing && (
          <ul className="text-sm mb-3 space-y-1 rounded-lg bg-base-200 p-3">
            <li>
              {t.existingStudentBday}: {bday}
            </li>
            <li>
              {t.existingStudentBplace}: {existing.bplace || "-"}
            </li>
            <li>
              {t.existingStudentSexe}: {existing.sexe || "-"}
            </li>
          </ul>
        )}
        <p className="mb-2">{t.existingStudentQuestion(classeName)}</p>
        <div className="modal-action flex-wrap">
          <button type="button" className="btn" onClick={() => onChoose("cancel")}>
            {t.existingStudentCancel}
          </button>
          <button type="button" className="btn btn-outline btn-primary" onClick={() => onChoose("update")}>
            {t.existingStudentUpdate}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onChoose("use")}>
            {t.existingStudentUse}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" aria-label={t.existingStudentCancel} onClick={() => onChoose("cancel")} />
      </form>
    </dialog>
  );
};

export default ExistingStudentDialog;
