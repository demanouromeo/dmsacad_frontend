import { useEffect, useRef, useState } from "react";
import { FileDown, FileText, Trash2, UserX } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { vpManagerTranslations, exportTranslations } from "../../../i18n/translations";
import { StaffReader } from "../../../dbmanger/StaffReader";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import type { Staff } from "../../../interfaces/Staff";
import type { Classe } from "../../../interfaces/Classe";
import type { VpClasse } from "../../../interfaces/VpClasse";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import SearchInput from "../../sharedcomp/SearchInput";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";

// staff.function code for a Vice Principal / Censeur (see the backend CLAUDE.md's MyHelper::findRole
// mapping - account type 8 = CENSEUR - and StaffController::arrangeSGSimple, which maps
// staff.function == 2 to that same account type).
const VP_FUNCTION = 2;

interface StaffLike {
  staff_id: number;
  name: string;
  surname: string | null;
}

const formatStaffLabel = (staff: StaffLike): string =>
  `${staff.name}${staff.surname ? ` ${staff.surname}` : ""}`;

// "Gestion des censeurs" - assigns whole classes (classe_year.vp_id) to a Vice Principal, mirroring
// CourseAssignmentManager's dual-list shape but with no subject dimension: a classe has exactly one
// VP at a time, so the left panel only offers classes not already assigned to the *selected* VP
// (annotated with their current VP's name if assigned to a different one), and the right panel is
// exactly that VP's assigned classes.
const VpManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = vpManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();
  const noVpDialogRef = useRef<HTMLDialogElement>(null);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [vpClasses, setVpClasses] = useState<VpClasse[]>([]);

  const [selectedVpId, setSelectedVpId] = useState<number | null>(null);
  const [leftSelectedClasseIds, setLeftSelectedClasseIds] = useState<
    Set<number>
  >(new Set());
  const [rightSelectedClasseIds, setRightSelectedClasseIds] = useState<
    Set<number>
  >(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // "Assign per VP" (dual-list, one VP at a time) vs. "Assign from class list" (one row per classe,
  // VP picked directly in a per-row combobox) - two views over the same underlying classe_year.vp_id
  // data, per the admin's request to add the latter alongside the existing former view.
  const [viewMode, setViewMode] = useState<"perVp" | "classList">("perVp");
  const [classListSearchQuery, setClassListSearchQuery] = useState("");

  const sortedVpStaff = [...staffList]
    .filter((s) => s.function === VP_FUNCTION)
    .sort((a, b) => formatStaffLabel(a).localeCompare(formatStaffLabel(b)));

  const loadBaseData = async () => {
    setIsLoading(true);
    const [staff, classeList] = await Promise.all([
      StaffReader.fetchStaff(accessToken, connection, schoolYear),
      ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
    ]);
    setStaffList(staff);
    setClasses(classeList);
    const sVp = [...staff]
      .filter((s) => s.function === VP_FUNCTION)
      .sort((a, b) => formatStaffLabel(a).localeCompare(formatStaffLabel(b)));
    setSelectedVpId((prev) =>
      prev !== null && sVp.some((s) => s.staff_id === prev)
        ? prev
        : (sVp[0]?.staff_id ?? null),
    );
    setIsLoading(false);
  };

  const reloadClassesAndVpClasses = async (vpId: number) => {
    const [classeList, vpClasseList] = await Promise.all([
      ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
      ClasseReader.fetchVpClasses(
        accessToken,
        connection,
        schoolYear,
        section,
        vpId,
      ),
    ]);
    setClasses(classeList);
    setVpClasses(vpClasseList);
  };

  useEffect(() => {
    loadBaseData();
    setLeftSelectedClasseIds(new Set());
    setRightSelectedClasseIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    setLeftSelectedClasseIds(new Set());
    setRightSelectedClasseIds(new Set());
    if (selectedVpId === null) {
      setVpClasses([]);
      return;
    }
    let cancelled = false;
    ClasseReader.fetchVpClasses(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedVpId,
    ).then((list) => {
      if (!cancelled) {
        setVpClasses(list);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVpId, connection, schoolYear, section]);

  const selectedVp = staffList.find((s) => s.staff_id === selectedVpId) ?? null;
  const selectedVpLabel = selectedVp ? formatStaffLabel(selectedVp) : "";

  const assignedClasseIds = new Set(vpClasses.map((c) => c.classe_id));

  const leftPanelRows = classes
    .filter((c) => !assignedClasseIds.has(c.classe_id))
    .map((c) => {
      const currentVp =
        c.vp_id !== null
          ? (staffList.find((s) => s.staff_id === c.vp_id) ?? null)
          : null;
      return {
        classe_id: c.classe_id,
        classe_name: c.classe_name,
        currentVpName: currentVp ? formatStaffLabel(currentVp) : null,
      };
    });

  const classesWithoutVp = classes.filter((c) => c.vp_id === null);

  const classListQuery = classListSearchQuery.trim().toLowerCase();
  const filteredClassList = classes.filter((c) =>
    c.classe_name.toLowerCase().includes(classListQuery),
  );

  // Toolbox export - every classe of the section (not just the selected VP's), independent of the
  // dual-list panels above, with an empty cell for classes that have no VP yet - same
  // fixed-French-title convention as every other export in this app (CourseAssignmentManager's
  // "Liste des attributions", etc.), regardless of the FR/EN language toggle.
  const buildVpColumns = () => [
    { header: t.tableHeaderIndex, accessor: (_r: Classe, index: number) => index + 1 },
    { header: t.tableHeaderClasse, accessor: (r: Classe) => r.classe_name },
    {
      header: t.tableHeaderVp,
      accessor: (r: Classe) => {
        const vp =
          r.vp_id !== null
            ? (staffList.find((s) => s.staff_id === r.vp_id) ?? null)
            : null;
        return vp ? formatStaffLabel(vp) : "";
      },
    },
  ];

  const handleExportClassesExcel = () => {
    exportRowsToCsv(
      buildTimestampedFilename(
        "Liste des classes et censeurs",
        [`Section ${capitalizeSectionName(section)}`],
        "csv",
      ),
      buildVpColumns(),
      classes,
    );
  };

  const handleExportClassesPdf = async () => {
    await exportRowsToPdf(
      "Liste des classes et censeurs",
      buildTimestampedFilename(
        "Liste des classes et censeurs",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
      buildVpColumns(),
      classes,
      schoolHeader,
    );
  };

  const toggleLeftClasse = (classeId: number) => {
    setLeftSelectedClasseIds((prev) => {
      const next = new Set(prev);
      if (next.has(classeId)) {
        next.delete(classeId);
      } else {
        next.add(classeId);
      }
      return next;
    });
  };

  const toggleRightClasse = (classeId: number) => {
    setRightSelectedClasseIds((prev) => {
      const next = new Set(prev);
      if (next.has(classeId)) {
        next.delete(classeId);
      } else {
        next.add(classeId);
      }
      return next;
    });
  };

  const toggleSelectAllRight = () => {
    const ids = vpClasses.map((c) => c.classe_id);
    const allSelected =
      ids.length > 0 && ids.every((id) => rightSelectedClasseIds.has(id));
    setRightSelectedClasseIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (selectedVpId === null) {
      return;
    }
    if (leftSelectedClasseIds.size === 0) {
      showToast(t.noClasseSelected, { type: "warning" });
      return;
    }
    const confirmed = await confirm(
      t.assignConfirm(leftSelectedClasseIds.size, selectedVpLabel),
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.assignClassesToVp(
      accessToken,
      connection,
      schoolYear,
      selectedVpId,
      Array.from(leftSelectedClasseIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftSelectedClasseIds(new Set());
      await reloadClassesAndVpClasses(selectedVpId);
    }
  };

  const handleRemoveRow = async (classeId: number) => {
    if (selectedVpId === null) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.removeClasseFromVp(
      accessToken,
      connection,
      schoolYear,
      selectedVpId,
      classeId,
    );
    setIsSaving(false);
    showToast(result.status ? t.removeSuccess : t.removeFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await reloadClassesAndVpClasses(selectedVpId);
    }
  };

  // No batch-remove endpoint exists for VP classes (unlike StaffReader.batchRemoveCourses), so this
  // composes the existing single-classe removeClasseFromVp call per selected row - same "compose
  // existing endpoints client-side" precedent as CourseAssignmentManager's own "Wipe section" button.
  const handleBulkRemoveSelected = async () => {
    if (selectedVpId === null || rightSelectedClasseIds.size === 0) {
      return;
    }
    const confirmed = await confirm(
      t.removeConfirm(rightSelectedClasseIds.size),
      { danger: true },
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    let allOk = true;
    for (const classeId of rightSelectedClasseIds) {
      const result = await ClasseReader.removeClasseFromVp(
        accessToken,
        connection,
        schoolYear,
        selectedVpId,
        classeId,
      );
      if (!result.status) {
        allOk = false;
      }
    }
    setIsSaving(false);
    showToast(allOk ? t.removeSuccess : t.removeFailure, {
      type: allOk ? "info" : "danger",
    });
    setRightSelectedClasseIds(new Set());
    await reloadClassesAndVpClasses(selectedVpId);
  };

  // Refreshes the classes list after a row-level VP change in the "class list" view - also refreshes
  // the selected VP's dual-list panels if one happens to be selected, since a change made here can
  // add/remove a classe from that VP's own assigned set.
  const refreshClasses = async () => {
    const classeList = await ClasseReader.fetchClasses(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setClasses(classeList);
    if (selectedVpId !== null) {
      const vpClasseList = await ClasseReader.fetchVpClasses(
        accessToken,
        connection,
        schoolYear,
        section,
        selectedVpId,
      );
      setVpClasses(vpClasseList);
    }
  };

  // Handles the "class list" view's per-row VP combobox: an empty selection removes the classe's
  // current VP (if any), any other selection assigns/reassigns it - classe_year.vp_id being a plain
  // column overwrite means picking a new VP silently replaces whatever was there before, so the
  // confirm message always names both the outgoing and incoming VP when there is a change.
  const handleChangeRowVp = async (classe: Classe, rawValue: string) => {
    const newVpId = rawValue === "" ? null : Number(rawValue);
    if (newVpId === classe.vp_id) {
      return;
    }
    const oldVp =
      classe.vp_id !== null
        ? (staffList.find((s) => s.staff_id === classe.vp_id) ?? null)
        : null;
    const oldVpLabel = oldVp ? formatStaffLabel(oldVp) : "";

    if (newVpId === null) {
      if (classe.vp_id === null) {
        return;
      }
      const confirmed = await confirm(
        t.removeVpConfirm(classe.classe_name, oldVpLabel),
        { danger: true },
      );
      if (!confirmed) {
        return;
      }
      setIsSaving(true);
      const result = await ClasseReader.removeClasseFromVp(
        accessToken,
        connection,
        schoolYear,
        classe.vp_id,
        classe.classe_id,
      );
      setIsSaving(false);
      showToast(result.status ? t.removeSuccess : t.removeFailure, {
        type: result.status ? "info" : "danger",
      });
      if (result.status) {
        await refreshClasses();
      }
      return;
    }

    const newVp = staffList.find((s) => s.staff_id === newVpId) ?? null;
    const newVpLabel = newVp ? formatStaffLabel(newVp) : "";
    const confirmed = await confirm(
      t.changeVpConfirm(classe.classe_name, oldVpLabel, newVpLabel),
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.assignVpToClasse(
      accessToken,
      connection,
      schoolYear,
      newVpId,
      classe.classe_id,
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await refreshClasses();
    }
  };

  return (
    <div className="page-shell-wide">
      {isSaving && <LoadingOverlay />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section, schoolYear)}</p>
        </div>
        <CloseButton />
      </div>

      {isLoading ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : (
        <>
          <div className="surface-card p-4 flex flex-wrap gap-3 mb-6">
            <div className="tooltip" data-tip={t.exportExcelTooltip}>
              <button
                type="button"
                className="btn btn-outline btn-success btn-sm gap-2"
                onClick={handleExportClassesExcel}
                disabled={classes.length === 0}
              >
                <FileDown className="w-4 h-4" />
                {et.excelBtn}
              </button>
            </div>
            <div className="tooltip" data-tip={t.exportPdfTooltip}>
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm gap-2"
                onClick={handleExportClassesPdf}
                disabled={classes.length === 0}
              >
                <FileText className="w-4 h-4" />
                {et.pdfBtn}
              </button>
            </div>
            <div className="tooltip" data-tip={t.noVpToolboxTooltip}>
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                onClick={() => noVpDialogRef.current?.showModal()}
              >
                <UserX className="w-4 h-4" />
                {t.noVpToolboxBtn}
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <button
              type="button"
              className={`btn btn-sm ${viewMode === "perVp" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("perVp")}
            >
              {t.viewModeTabPerVp}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === "classList" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("classList")}
            >
              {t.viewModeTabClassList}
            </button>
          </div>

          {viewMode === "classList" ? (
            <div className="surface-card overflow-hidden mb-6">
              <div className="p-4 border-b border-base-content/10">
                <SearchInput
                  value={classListSearchQuery}
                  onChange={setClassListSearchQuery}
                  placeholder={t.classListSearchPlaceholder}
                  className="w-full max-w-sm"
                />
              </div>
              <div className="overflow-x-auto max-h-128 overflow-y-auto">
                <table className="table table-zebra data-table">
                  <thead>
                    <tr>
                      <th>{t.tableHeaderIndex}</th>
                      <th>{t.tableHeaderClasse}</th>
                      <th>{t.tableHeaderVp}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClassList.map((row, index) => (
                      <tr key={row.classe_id}>
                        <td>{index + 1}</td>
                        <td>{row.classe_name}</td>
                        <td>
                          <div
                            className="tooltip"
                            data-tip={t.classListVpSelectTooltip}
                          >
                            <select
                              className="select select-sm w-64"
                              value={row.vp_id ?? ""}
                              onChange={(e) =>
                                handleChangeRowVp(row, e.target.value)
                              }
                              disabled={sortedVpStaff.length === 0}
                            >
                              <option value="">{t.classListNoVpOption}</option>
                              {sortedVpStaff.map((staff) => (
                                <option key={staff.staff_id} value={staff.staff_id}>
                                  {formatStaffLabel(staff)} ({staff.staff_id})
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredClassList.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <p className="empty-state">
                            {classes.length === 0
                              ? t.classListEmpty
                              : t.classListNoResults}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              <div className="surface-card p-4 flex flex-wrap gap-6 mb-6">
                <div className="flex items-center gap-2">
                  <label className="font-medium">{t.vpLabel}</label>
                  <select
                    className="select w-64"
                    title={t.vpSelectTooltip}
                    value={selectedVpId ?? ""}
                    onChange={(e) => setSelectedVpId(Number(e.target.value))}
                    disabled={sortedVpStaff.length === 0}
                  >
                    {sortedVpStaff.length === 0 && (
                      <option value="">{t.noVpOption}</option>
                    )}
                    {sortedVpStaff.map((staff) => (
                      <option key={staff.staff_id} value={staff.staff_id}>
                        {formatStaffLabel(staff)} ({staff.staff_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="surface-card overflow-hidden">
              <h2 className="font-semibold p-4 border-b border-base-content/10">
                {selectedVp ? t.leftPanelTitle(selectedVpLabel) : ""}
              </h2>
              <div className="p-3 max-h-96 overflow-y-auto">
                {leftPanelRows.length === 0 && (
                  <p className="empty-state">{t.emptyLeft}</p>
                )}
                {leftPanelRows.map((row) => (
                  <label
                    key={row.classe_id}
                    className="flex items-center gap-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={leftSelectedClasseIds.has(row.classe_id)}
                      onChange={() => toggleLeftClasse(row.classe_id)}
                    />
                    <span>
                      {row.classe_name}
                      {row.currentVpName && ` ${t.currentVpHint(row.currentVpName)}`}
                    </span>
                  </label>
                ))}
              </div>
              <div className="p-3 border-t border-base-content/10 flex justify-start">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={leftSelectedClasseIds.size === 0}
                  onClick={handleSaveAssignments}
                  title={t.assignBtnTooltip(selectedVpLabel)}
                >
                  {t.saveBtn}
                </button>
              </div>
            </div>

            <div className="surface-card overflow-hidden">
              <h2 className="font-semibold p-4 border-b border-base-content/10">
                {selectedVp ? t.rightPanelTitle(selectedVpLabel) : ""}
              </h2>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="table table-zebra data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={
                            vpClasses.length > 0 &&
                            vpClasses.every((c) =>
                              rightSelectedClasseIds.has(c.classe_id),
                            )
                          }
                          onChange={toggleSelectAllRight}
                        />
                      </th>
                      <th>{t.tableHeaderIndex}</th>
                      <th>{t.tableHeaderClasse}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vpClasses.map((row, index) => (
                      <tr key={row.classe_id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={rightSelectedClasseIds.has(row.classe_id)}
                            onChange={() => toggleRightClasse(row.classe_id)}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>{row.classe_name}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-error btn-xs btn-square"
                            onClick={() => handleRemoveRow(row.classe_id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {vpClasses.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <p className="empty-state">{t.emptyRight}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-base-content/10">
                <button
                  type="button"
                  className="btn btn-error btn-sm"
                  disabled={rightSelectedClasseIds.size === 0}
                  onClick={handleBulkRemoveSelected}
                  title={t.removeSelectionTooltip(selectedVpLabel)}
                >
                  {t.deleteSelectionBtn(rightSelectedClasseIds.size)}
                </button>
              </div>
            </div>
          </div>
            </>
          )}
        </>
      )}

      <dialog ref={noVpDialogRef} className="modal">
        <div className="modal-box border border-base-content/10">
          <h3 className="font-bold text-lg mb-4">{t.noVpDialogTitle}</h3>
          {classesWithoutVp.length === 0 ? (
            <p className="empty-state">{t.noVpDialogEmpty}</p>
          ) : (
            <ul className="list-disc list-inside flex flex-col gap-1 max-h-80 overflow-y-auto">
              {classesWithoutVp.map((c) => (
                <li key={c.classe_id}>{c.classe_name}</li>
              ))}
            </ul>
          )}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => noVpDialogRef.current?.close()}
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t.closeBtn}</button>
        </form>
      </dialog>
    </div>
  );
};

export default VpManager;
