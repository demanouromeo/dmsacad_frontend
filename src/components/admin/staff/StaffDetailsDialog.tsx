import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { staffManagerTranslations } from "../../../i18n/translations";
import { StaffReader } from "../../../dbmanger/StaffReader";
import type { Staff } from "../../../interfaces/Staff";

interface StaffDetailsDialogProps {
  staff: Staff | null;
  onClose: () => void;
  onSaved: (staffId: number, updates: Partial<Staff>) => void;
}

type FieldKey =
  | "grade"
  | "diplome"
  | "specilitee"
  | "matiereEnseignee"
  | "postingDecision"
  | "region"
  | "department"
  | "arrodissement"
  | "numeroRecrutement"
  | "provenantDe"
  | "dateReprise"
  | "dateEntree"
  | "date1erePrise";

// Extended HR profile fields on `staff` (grade/diplome/.../date1erePrise, plus the numeric
// `longivity`) that have no home anywhere else in StaffManager's row-edit form - editing them
// lives in this separate dialog, opened from the "more info" (IdCard) row button, and saved via
// StaffController::modifyStaff, a dedicated endpoint that only ever touches this extended profile
// (never name/login/pwd/... - those still go through updateManyStaffs).
const StaffDetailsDialog = ({ staff, onClose, onSaved }: StaffDetailsDialogProps) => {
  const { connection, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = staffManagerTranslations[language];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Seeded once from `staff` via a lazy initializer, not synced through an effect - StaffManager
  // remounts this component (key={staff.staff_id}) each time a different row's dialog is opened,
  // so a fresh initializer run is exactly the "reset state for a new prop" React itself recommends
  // over deriving it in an effect (see the react-hooks/set-state-in-effect rule this sidesteps).
  const [fields, setFields] = useState<Record<FieldKey, string>>(() => ({
    grade: staff?.grade ?? "",
    diplome: staff?.diplome ?? "",
    specilitee: staff?.specilitee ?? "",
    matiereEnseignee: staff?.matiereEnseignee ?? "",
    postingDecision: staff?.posting_decision ?? "",
    region: staff?.region ?? "",
    department: staff?.department ?? "",
    arrodissement: staff?.arrodissement ?? "",
    numeroRecrutement: staff?.numeroRecrutement ?? "",
    provenantDe: staff?.provenantDe ?? "",
    dateReprise: staff?.dateReprise ?? "",
    dateEntree: staff?.dateEntree ?? "",
    date1erePrise: staff?.date1erePrise ?? "",
  }));
  const [longivity, setLongivity] = useState(() =>
    staff?.longivity != null ? String(staff.longivity) : "",
  );

  const setField = (key: FieldKey, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // Purely an imperative DOM call (open/close the native <dialog>), not a setState - safe in an
  // effect.
  useEffect(() => {
    if (!staff) {
      dialogRef.current?.close();
      return;
    }
    dialogRef.current?.showModal();
  }, [staff]);

  const textFields: { key: FieldKey; label: string }[] = [
    { key: "grade", label: t.detailsGradeLabel },
    { key: "diplome", label: t.detailsDiplomeLabel },
    { key: "specilitee", label: t.detailsSpecialiteLabel },
    { key: "matiereEnseignee", label: t.detailsMatiereEnseigneeLabel },
    { key: "postingDecision", label: t.detailsPostingDecisionLabel },
    { key: "region", label: t.detailsRegionLabel },
    { key: "department", label: t.detailsDepartmentLabel },
    { key: "arrodissement", label: t.detailsArrondissementLabel },
    { key: "numeroRecrutement", label: t.detailsNumeroRecrutementLabel },
    { key: "provenantDe", label: t.detailsProvenantDeLabel },
    { key: "dateReprise", label: t.detailsDateRepriseLabel },
    { key: "dateEntree", label: t.detailsDateEntreeLabel },
    { key: "date1erePrise", label: t.detailsDate1erePriseLabel },
  ];

  const handleSave = async () => {
    if (!staff) {
      return;
    }
    const trimmed = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, value.trim()]),
    ) as Record<FieldKey, string>;
    const trimmedLongivity = longivity.trim();

    setIsSaving(true);
    const result = await StaffReader.modifyStaff(accessToken, connection, {
      staff_id: staff.staff_id,
      grade: trimmed.grade,
      diplome: trimmed.diplome,
      specilitee: trimmed.specilitee,
      matiereEnseignee: trimmed.matiereEnseignee,
      longivity: trimmedLongivity,
      posting_decision: trimmed.postingDecision,
      region: trimmed.region,
      department: trimmed.department,
      arrodissement: trimmed.arrodissement,
      numeroRecrutement: trimmed.numeroRecrutement,
      provenantDe: trimmed.provenantDe,
      dateReprise: trimmed.dateReprise,
      dateEntree: trimmed.dateEntree,
      date1erePrise: trimmed.date1erePrise,
    });
    setIsSaving(false);
    showToast(result.status ? t.detailsSaveSuccess : t.detailsSaveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      onSaved(staff.staff_id, {
        grade: trimmed.grade || null,
        diplome: trimmed.diplome || null,
        specilitee: trimmed.specilitee || null,
        matiereEnseignee: trimmed.matiereEnseignee || null,
        longivity: trimmedLongivity ? Number(trimmedLongivity) : null,
        posting_decision: trimmed.postingDecision || null,
        region: trimmed.region || null,
        department: trimmed.department || null,
        arrodissement: trimmed.arrodissement || null,
        numeroRecrutement: trimmed.numeroRecrutement || null,
        provenantDe: trimmed.provenantDe || null,
        dateReprise: trimmed.dateReprise || null,
        dateEntree: trimmed.dateEntree || null,
        date1erePrise: trimmed.date1erePrise || null,
      });
      dialogRef.current?.close();
    }
  };

  const staffName = staff ? `${staff.name} ${staff.surname ?? ""}`.trim() : "";

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          {staff ? t.detailsDialogTitle(staffName) : ""}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {textFields.map(({ key, label }) => (
            <label key={key} className="form-control">
              <span className="label-text">{label}</span>
              <input
                type="text"
                className="input input-sm w-full"
                value={fields[key]}
                onChange={(e) => setField(key, e.target.value)}
              />
            </label>
          ))}
          <label className="form-control">
            <span className="label-text">{t.detailsLongevityLabel}</span>
            <input
              type="number"
              min={0}
              className="input input-sm w-full"
              value={longivity}
              onChange={(e) => setLongivity(e.target.value)}
            />
          </label>
        </div>

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dialogRef.current?.close()}
          >
            {t.cancelBtn}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSaving}
            onClick={handleSave}
          >
            {t.saveBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>{t.cancelBtn}</button>
      </form>
    </dialog>
  );
};

export default StaffDetailsDialog;
