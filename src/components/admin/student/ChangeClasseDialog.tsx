import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../../i18n/useLanguage";
import { studentManagerTranslations } from "../../../i18n/translations";
import type { Classe } from "../../../interfaces/Classe";
import type { Student } from "../../../interfaces/Student";

interface ChangeClasseDialogProps {
  student: Student | null;
  currentClasseId: number | null;
  classes: Classe[];
  onClose: () => void;
  onValidate: (targetClasseId: number) => void;
}

// Single shared instance rendered once by StudentManager (native <dialog>, same modal pattern as
// StudentPhotoDialog), opened/closed by whether `student` is set. Lists every classe of the section
// except the student's current one; Valider hands the choice back to the manager, which asks for the
// confirmation and performs the move.
const ChangeClasseDialog = ({
  student,
  currentClasseId,
  classes,
  onClose,
  onValidate,
}: ChangeClasseDialogProps) => {
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [targetId, setTargetId] = useState<number | null>(null);

  const targets = classes.filter((c) => c.classe_id !== currentClasseId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (student) {
      setTargetId(targets[0]?.classe_id ?? null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {student
            ? t.changeClasseDialogTitle(`${student.name} ${student.surname ?? ""}`.trim())
            : ""}
        </h3>
        {targets.length === 0 ? (
          <p className="text-sm">{t.changeClasseNoOtherClasse}</p>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm">{t.changeClasseTargetLabel}</span>
            <select
              className="select w-full"
              value={targetId ?? ""}
              onChange={(e) => setTargetId(Number(e.target.value))}
            >
              {targets.map((c) => (
                <option key={c.classe_id} value={c.classe_id}>
                  {c.classe_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-primary"
            disabled={targetId === null}
            onClick={() => targetId !== null && onValidate(targetId)}
          >
            {t.changeClasseValidateBtn}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t.changeClasseCancelBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label={t.changeClasseCancelBtn} />
      </form>
    </dialog>
  );
};

export default ChangeClasseDialog;
