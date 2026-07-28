import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useConfirm } from "../../../confirm/useConfirm";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { parentManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudParentReader } from "../../../dbmanger/StudParentReader";
import type { StudParent, ParentChild, AssignableStudent } from "../../../interfaces/StudParent";
import type { Classe } from "../../../interfaces/Classe";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

interface ParentChildrenDialogProps {
  parent: StudParent | null;
  onClose: () => void;
}

// "Select a parent then browse through classe to add student to that parent" - a native <dialog>
// (same modal/modal-box/modal-backdrop pattern as every other dialog in the app) with two panels:
// left browses one classe's roster to add students to the selected parent (reassigning a student
// who already has a different parent is allowed, gated by a confirm naming that parent); right
// lists this parent's current children with a per-row unlink button. Not classe/section-scoped
// beyond the dialog's own local classe <select> - the parent record itself isn't year-scoped.
const ParentChildrenDialog = ({ parent, onClose }: ParentChildrenDialogProps) => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const confirm = useConfirm();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = parentManagerTranslations[language];

  const dialogRef = useRef<HTMLDialogElement>(null);

  const [classes, setClasses] = useState<Classe[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);
  const [roster, setRoster] = useState<AssignableStudent[]>([]);
  const [selectedStudIds, setSelectedStudIds] = useState<Set<number>>(new Set());
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadChildren = async (pId: number) => {
    setIsLoadingChildren(true);
    const list = await StudParentReader.fetchChildrenOfParent(accessToken, connection, schoolYear, pId);
    setChildren(list);
    setIsLoadingChildren(false);
  };

  const loadRoster = async (classeId: number) => {
    setIsLoadingRoster(true);
    const list = await StudParentReader.fetchStudentsOfClasseForAssignment(
      accessToken,
      connection,
      schoolYear,
      classeId,
    );
    setRoster(list);
    setSelectedStudIds(new Set());
    setIsLoadingRoster(false);
  };

  useEffect(() => {
    if (!parent) {
      dialogRef.current?.close();
      return;
    }
    dialogRef.current?.showModal();
    loadChildren(parent.p_id);
    setSelectedClasseId(null);
    setRoster([]);
    setSelectedStudIds(new Set());
    ClasseReader.fetchClasses(accessToken, connection, schoolYear, section).then((list) => {
      setClasses(list);
      if (list.length > 0) {
        setSelectedClasseId(list[0].classe_id);
        loadRoster(list[0].classe_id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parent]);

  const toggleSelect = (studId: number) => {
    setSelectedStudIds((prev) => {
      const next = new Set(prev);
      if (next.has(studId)) {
        next.delete(studId);
      } else {
        next.add(studId);
      }
      return next;
    });
  };

  const handleClasseChange = (classeId: number) => {
    setSelectedClasseId(classeId);
    loadRoster(classeId);
  };

  const handleAssignSelected = async () => {
    if (!parent || selectedStudIds.size === 0) {
      showToast(t.noSelectionWarning, { type: "warning" });
      return;
    }
    const conflicts = roster.filter(
      (s) => selectedStudIds.has(s.stud_id) && s.p_id !== null && s.p_id !== parent.p_id,
    );
    if (conflicts.length > 0) {
      const names = conflicts
        .map((s) => `${s.name} ${s.surname ?? ""} (${[s.p_name, s.p_surname].filter(Boolean).join(" ")})`)
        .join(", ");
      const confirmed = await confirm(t.reassignConfirm(names), { danger: true });
      if (!confirmed) {
        return;
      }
    }
    setIsSaving(true);
    const result = await StudParentReader.assignStudentsToParent(
      accessToken,
      connection,
      parent.p_id,
      Array.from(selectedStudIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.assignSuccess : t.assignFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadChildren(parent.p_id);
      if (selectedClasseId !== null) {
        loadRoster(selectedClasseId);
      }
    }
  };

  const handleRemoveChild = async (child: ParentChild) => {
    const confirmed = await confirm(t.removeConfirm(`${child.name} ${child.surname ?? ""}`), {
      danger: true,
    });
    if (!confirmed || !parent) {
      return;
    }
    setIsSaving(true);
    const result = await StudParentReader.removeStudentsFromParent(accessToken, connection, [
      child.stud_id,
    ]);
    setIsSaving(false);
    showToast(result.status ? t.removeSuccess : t.removeFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadChildren(parent.p_id);
      if (selectedClasseId !== null) {
        loadRoster(selectedClasseId);
      }
    }
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-4xl">
        {isSaving && <LoadingOverlay />}
        <h3 className="font-bold text-lg mb-4">
          {parent ? t.childrenDialogTitle(`${parent.p_name} ${parent.p_surname ?? ""}`.trim()) : ""}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="parentChildrenClasse">
              {t.classeLabel}
            </label>
            {classes.length === 0 ? (
              <p className="empty-state">{t.emptyClasses}</p>
            ) : (
              <select
                id="parentChildrenClasse"
                className="select select-sm w-full mb-2"
                title={t.classeSelectTooltip}
                value={selectedClasseId ?? ""}
                onChange={(e) => handleClasseChange(Number(e.target.value))}
              >
                {classes.map((c) => (
                  <option key={c.classe_id} value={c.classe_id}>
                    {c.classe_name}
                  </option>
                ))}
              </select>
            )}
            {isLoadingRoster ? (
              <div className="flex justify-center py-6">
                <Loading />
              </div>
            ) : (
              <div className="overflow-y-auto max-h-72 border border-base-300 rounded">
                <table className="table table-zebra table-xs">
                  <thead>
                    <tr>
                      <th></th>
                      <th>{t.rosterHeaderName}</th>
                      <th>{t.rosterHeaderMatricule}</th>
                      <th>{t.rosterHeaderCurrentParent}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s) => (
                      <tr key={s.stud_id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={selectedStudIds.has(s.stud_id)}
                            onChange={() => toggleSelect(s.stud_id)}
                          />
                        </td>
                        <td>{`${s.name} ${s.surname ?? ""}`.trim()}</td>
                        <td>{s.matricule}</td>
                        <td>
                          {s.p_id && s.p_id === parent?.p_id
                            ? "—"
                            : [s.p_name, s.p_surname].filter(Boolean).join(" ")}
                        </td>
                      </tr>
                    ))}
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <p className="empty-state">{t.rosterEmpty}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm mt-2"
              disabled={selectedStudIds.size === 0}
              onClick={handleAssignSelected}
            >
              {t.assignSelectedBtn(selectedStudIds.size)}
            </button>
          </div>

          <div>
            <h4 className="font-semibold mb-2">{t.currentChildrenTitle}</h4>
            {isLoadingChildren ? (
              <div className="flex justify-center py-6">
                <Loading />
              </div>
            ) : (
              <div className="overflow-y-auto max-h-80 border border-base-300 rounded">
                <table className="table table-zebra table-xs">
                  <thead>
                    <tr>
                      <th>{t.rosterHeaderName}</th>
                      <th>{t.rosterHeaderMatricule}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c) => (
                      <tr key={c.stud_id}>
                        <td>{`${c.name} ${c.surname ?? ""}`.trim()}</td>
                        <td>{c.matricule}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost text-error"
                            onClick={() => handleRemoveChild(c)}
                          >
                            {t.removeBtn}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {children.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <p className="empty-state">{t.childrenEmpty}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>
            {t.closeBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>{t.closeBtn}</button>
      </form>
    </dialog>
  );
};

export default ParentChildrenDialog;
