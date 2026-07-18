import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { subjectClasseManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { GroupeReader } from "../../../dbmanger/GroupeReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import type { Classe } from "../../../interfaces/Classe";
import type { Groupe } from "../../../interfaces/Groupe";
import type { Subject } from "../../../interfaces/Subject";
import type { SubjectClasseRow } from "../../../interfaces/SubjectClasseRow";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import { stripHtmlTags } from "../../../utils/apiErrors";
import { exportRowsToPdf, buildExportFilename } from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";

const byTitle = <T extends { subject_title: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.subject_title.localeCompare(b.subject_title));

const MIN_COEF = 0;
const MAX_COEF = 10;

// "Matières et classes" - assigns/unassigns subjects to a single classe (left/right dual list),
// edits coef/groupe inline on the right panel, and can bulk-copy a classe's subject list onto other
// classes of the same level (SubjectController::subjectsNotOfClasse/subjectOfClasse/saveManySC/
// deleteASubjectOfAClasseYearAndSection/calquerSubjects). No import here - only Print, per product
// decision (Import needs its own file-format spec, deferred).
const SubjectClasseManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = subjectClasseManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [groups, setGroups] = useState<Groupe[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(
    null,
  );

  const [unassigned, setUnassigned] = useState<Subject[]>([]);
  const [assigned, setAssigned] = useState<SubjectClasseRow[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<
    Set<number>
  >(new Set());
  const [selectedAssignedIds, setSelectedAssignedIds] = useState<Set<number>>(
    new Set(),
  );

  const copyDialogRef = useRef<HTMLDialogElement>(null);
  const [copyTargetIds, setCopyTargetIds] = useState<Set<number>>(new Set());

  const selectedClasse =
    classes.find((c) => c.classe_id === selectedClasseId) ?? null;

  // Classes + groups aren't tied to the currently selected classe, so they're loaded independently
  // of it - only re-run when connection/schoolYear/section change.
  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, groupeList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        GroupeReader.fetchGroupes(accessToken, connection, schoolYear, section),
      ]);
      setClasses(classeList);
      setGroups(groupeList);
      setSelectedClasseId((prev) => {
        if (prev !== null && classeList.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return classeList.length > 0 ? classeList[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const loadLists = async (classeId: number) => {
    setIsLoadingLists(true);
    const [notOf, of_] = await Promise.all([
      SubjectReader.fetchSubjectsNotOfClasse(
        accessToken,
        connection,
        schoolYear,
        section,
        classeId,
      ),
      SubjectReader.fetchSubjectsOfClasse(
        accessToken,
        connection,
        schoolYear,
        section,
        classeId,
      ),
    ]);
    setUnassigned(byTitle(notOf));
    setAssigned(byTitle(of_));
    setSelectedUnassignedIds(new Set());
    setSelectedAssignedIds(new Set());
    setIsLoadingLists(false);
  };

  useEffect(() => {
    if (selectedClasseId !== null) {
      loadLists(selectedClasseId);
    } else {
      setUnassigned([]);
      setAssigned([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  const toggleUnassigned = (id: number) => {
    setSelectedUnassignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAssigned = (id: number) => {
    setSelectedAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedClasseId === null || selectedUnassignedIds.size === 0) {
      return;
    }
    if (groups.length === 0) {
      showToast(t.noGroupsHint, { type: "warning" });
      return;
    }
    const defaultGroupeId = groups[0].groupe_id;
    const rows = Array.from(selectedUnassignedIds).map((subjectId) => ({
      subject_id: subjectId,
      coef: 1.0,
      classe_id: selectedClasseId,
      groupe_id: defaultGroupeId,
    }));
    setIsSaving(true);
    const result = await SubjectReader.saveManySC(
      accessToken,
      connection,
      schoolYear,
      section,
      rows,
    );
    setIsSaving(false);
    showToast(result.status ? t.addSuccess : t.addFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadLists(selectedClasseId);
    }
  };

  const handleRemove = async () => {
    if (selectedClasseId === null || selectedAssignedIds.size === 0) {
      return;
    }
    const confirmed = await confirm(t.removeConfirm(selectedAssignedIds.size), {
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const results = await Promise.all(
      Array.from(selectedAssignedIds).map((subjectId) =>
        SubjectReader.deleteSubjectOfClasse(
          accessToken,
          connection,
          schoolYear,
          section,
          selectedClasseId,
          subjectId,
        ),
      ),
    );
    setIsSaving(false);
    const allOk = results.every((r) => r.status);
    showToast(allOk ? t.removeSuccess : t.removePartialFailure, {
      type: allOk ? "info" : "danger",
    });
    loadLists(selectedClasseId);
  };

  const updateAssignedField = (
    subjectId: number,
    field: "coef" | "groupe_id",
    value: number,
  ) => {
    setAssigned((prev) =>
      prev.map((row) =>
        row.subject_id === subjectId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const handleSave = async () => {
    if (selectedClasseId === null || assigned.length === 0) {
      return;
    }
    const invalidRow = assigned.find(
      (row) =>
        !Number.isFinite(row.coef) ||
        row.coef <= MIN_COEF ||
        row.coef > MAX_COEF,
    );
    if (invalidRow) {
      showToast(t.invalidCoef(invalidRow.subject_title), { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await SubjectReader.saveManySC(
      accessToken,
      connection,
      schoolYear,
      section,
      assigned.map((row) => ({
        subject_id: row.subject_id,
        coef: row.coef,
        classe_id: selectedClasseId,
        groupe_id: row.groupe_id,
      })),
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadLists(selectedClasseId);
    }
  };

  const handlePrint = () => {
    if (selectedClasseId === null || !selectedClasse) {
      return;
    }
    const title = t.rightPanelTitle(selectedClasse.classe_name);
    exportRowsToPdf(
      title,
      buildExportFilename(
        [t.title, selectedClasse.classe_name, connection, schoolYear, section],
        "pdf",
      ),
      [
        {
          header: t.tableHeaderIndex,
          accessor: (_r: SubjectClasseRow, index: number) => index + 1,
        },
        {
          header: t.tableHeaderSubject,
          accessor: (r: SubjectClasseRow) => r.subject_title,
        },
        { header: t.tableHeaderCoef, accessor: (r: SubjectClasseRow) => r.coef },
        {
          header: t.tableHeaderGroup,
          accessor: (r: SubjectClasseRow) => r.groupe_name,
        },
      ],
      assigned,
      schoolHeader,
    );
  };

  const sameLevelClasses = selectedClasse
    ? classes.filter(
        (c) =>
          c.level === selectedClasse.level &&
          c.classe_id !== selectedClasse.classe_id,
      )
    : [];

  const openCopyDialog = () => {
    setCopyTargetIds(new Set());
    copyDialogRef.current?.showModal();
  };

  const toggleCopyTarget = (id: number) => {
    setCopyTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyCopy = async () => {
    if (!selectedClasse || copyTargetIds.size === 0) {
      showToast(t.copyNoTargetSelected, { type: "warning" });
      return;
    }
    const confirmed = await confirm(
      t.copyConfirmAgain(copyTargetIds.size, selectedClasse.classe_name),
      { danger: true, confirmLabel: t.copyConfirmFinalBtn },
    );
    if (!confirmed) {
      return;
    }
    const targets = classes.filter((c) => copyTargetIds.has(c.classe_id));
    setIsSaving(true);
    const results = await Promise.all(
      targets.map((target) =>
        SubjectReader.calquerSubjects(
          accessToken,
          connection,
          schoolYear,
          section,
          selectedClasse.classe_id,
          target.classe_name,
        ),
      ),
    );
    setIsSaving(false);
    const allOk = results.every((r) => r.status);
    if (allOk) {
      showToast(t.copySuccess, { type: "info" });
    } else {
      const detail = results.find((r) => !r.status)?.message;
      showToast(
        detail
          ? `${t.copyPartialFailure} ${stripHtmlTags(detail)}`
          : t.copyPartialFailure,
        { type: "danger" },
      );
    }
    copyDialogRef.current?.close();
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-4 opacity-70 text-sm">{t.sectionHint(section)}</p>

      {isLoadingClasses ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p className="opacity-60">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <label className="font-medium">{t.classeLabel}</label>
            <select
              className="select w-64"
              value={selectedClasseId ?? ""}
              onChange={(e) => setSelectedClasseId(Number(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.classe_id} value={c.classe_id}>
                  {c.classe_name}
                </option>
              ))}
            </select>

            <div className="flex-1" />
            {selectedClasse && (
              <button
                type="button"
                className="btn btn-neutral btn-sm"
                onClick={openCopyDialog}
              >
                {t.copyBtn(selectedClasse.classe_name)}
              </button>
            )}
            <button
              type="button"
              className="btn btn-neutral btn-sm"
              disabled={selectedClasseId === null}
              onClick={() => selectedClasseId && loadLists(selectedClasseId)}
            >
              {t.refreshBtn}
            </button>
            <button
              type="button"
              className="btn btn-neutral btn-sm"
              disabled={assigned.length === 0}
              onClick={handlePrint}
            >
              {t.printBtn}
            </button>
          </div>

          {isLoadingLists ? (
            <Loading />
          ) : (
            selectedClasse && (
              <div className="flex flex-col lg:flex-row gap-4 items-start">
                <div className="flex-1 min-w-0 w-full">
                  <h2 className="font-semibold mb-2">
                    {t.leftPanelTitle(selectedClasse.classe_name)}
                  </h2>
                  <div className="overflow-x-auto border rounded max-h-112 overflow-y-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th></th>
                          <th>{t.tableHeaderIndex}</th>
                          <th>{t.tableHeaderSubject}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unassigned.map((s, index) => (
                          <tr key={s.subject_id}>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={selectedUnassignedIds.has(
                                  s.subject_id,
                                )}
                                onChange={() => toggleUnassigned(s.subject_id)}
                              />
                            </td>
                            <td>{index + 1}</td>
                            <td>{s.subject_title}</td>
                          </tr>
                        ))}
                        {unassigned.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center opacity-60">
                              {t.emptyLeft}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex lg:flex-col gap-2 pt-8 shrink-0 self-center">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={selectedUnassignedIds.size === 0}
                    onClick={handleAdd}
                  >
                    {t.addBtn}
                  </button>
                  <button
                    type="button"
                    className="btn btn-error"
                    disabled={selectedAssignedIds.size === 0}
                    onClick={handleRemove}
                  >
                    {t.removeBtn}
                  </button>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    disabled={assigned.length === 0}
                    onClick={handleSave}
                  >
                    {t.saveBtn}
                  </button>
                </div>

                <div className="flex-1 min-w-0 w-full">
                  <h2 className="font-semibold mb-2">
                    {t.rightPanelTitle(selectedClasse.classe_name)}
                  </h2>
                  <div className="overflow-x-auto border rounded max-h-112 overflow-y-auto">
                    <table className="table w-full">
                      <thead>
                        <tr>
                          <th></th>
                          <th>{t.tableHeaderIndex}</th>
                          <th>{t.tableHeaderSubject}</th>
                          <th>{t.tableHeaderCoef}</th>
                          <th>{t.tableHeaderGroup}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assigned.map((row, index) => (
                          <tr key={row.subject_id}>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={selectedAssignedIds.has(
                                  row.subject_id,
                                )}
                                onChange={() => toggleAssigned(row.subject_id)}
                              />
                            </td>
                            <td>{index + 1}</td>
                            <td>{row.subject_title}</td>
                            <td>
                              <input
                                type="number"
                                className="input input-sm w-20"
                                min={MIN_COEF}
                                max={MAX_COEF}
                                step="0.1"
                                value={row.coef}
                                onChange={(e) =>
                                  updateAssignedField(
                                    row.subject_id,
                                    "coef",
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <select
                                className="select select-sm"
                                value={row.groupe_id}
                                onChange={(e) =>
                                  updateAssignedField(
                                    row.subject_id,
                                    "groupe_id",
                                    Number(e.target.value),
                                  )
                                }
                              >
                                {groups.map((g) => (
                                  <option key={g.groupe_id} value={g.groupe_id}>
                                    {g.groupe_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                        {assigned.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center opacity-60">
                              {t.emptyRight}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          )}
        </>
      )}

      <dialog ref={copyDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">
            {selectedClasse ? t.copyDialogTitle(selectedClasse.classe_name) : ""}
          </h3>
          {sameLevelClasses.length === 0 ? (
            <p className="opacity-60">{t.copyNoOtherClassesOfLevel}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {sameLevelClasses.map((c) => (
                <li key={c.classe_id} className="py-1">
                  <label className="label gap-2 justify-start cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={copyTargetIds.has(c.classe_id)}
                      onChange={() => toggleCopyTarget(c.classe_id)}
                    />
                    {c.classe_name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => copyDialogRef.current?.close()}
            >
              {t.copyCancelBtn}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={sameLevelClasses.length === 0}
              onClick={handleApplyCopy}
            >
              {t.copyApplyBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t.copyCancelBtn}</button>
        </form>
      </dialog>
    </div>
  );
};

export default SubjectClasseManager;
