import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  groupeManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { GroupeReader } from "../../../dbmanger/GroupeReader";
import type { Groupe } from "../../../interfaces/Groupe";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import { MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH } from "../../../utils/textValidation";
import { sanitizeSubjectTitle } from "../../../utils/subjectImport";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import {
  buildExportFilename,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";

// No import feature here (not requested for groups, unlike Filiere/Classe/Subject/Staff) - just the
// same section-scoped CRUD table shape.
const GroupeManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = groupeManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newGroupeName, setNewGroupeName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadGroupes = async () => {
    setIsLoading(true);
    const list = await GroupeReader.fetchGroupes(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setGroupes(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadGroupes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupeName.trim();
    if (trimmed.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await GroupeReader.saveGroupe(
      accessToken,
      connection,
      schoolYear,
      section,
      trimmed,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setNewGroupeName("");
      loadGroupes();
    } else {
      showToast(
        isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure,
        { type: "danger" },
      );
    }
  };

  const startEdit = (groupe: Groupe) => {
    setEditingId(groupe.groupe_id);
    setEditingValue(groupe.groupe_name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEdit = async (groupe: Groupe) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === groupe.groupe_name) {
      cancelEdit();
      return;
    }
    if (trimmed.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await GroupeReader.updateGroupes(accessToken, connection, [
      { groupe_id: groupe.groupe_id, groupe_name: trimmed },
    ]);
    setIsSaving(false);
    if (result.status) {
      showToast(t.renameSuccess, { type: "info" });
    } else {
      showToast(
        isDuplicateNameError(result.message)
          ? t.renameDuplicate
          : t.renameFailure,
        { type: "danger" },
      );
    }
    cancelEdit();
    if (result.status) {
      loadGroupes();
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === groupes.length
        ? new Set()
        : new Set(groupes.map((g) => g.groupe_id)),
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    const confirmed = await confirm(t.deleteConfirm(selectedIds.size), {
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await GroupeReader.deleteGroupes(
      accessToken,
      connection,
      schoolYear,
      Array.from(selectedIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadGroupes();
    }
  };

  const exportColumns = [
    {
      header: t.tableHeaderIndex,
      accessor: (_g: Groupe, index: number) => index + 1,
    },
    { header: t.tableHeaderName, accessor: (g: Groupe) => g.groupe_name },
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildExportFilename([t.title, connection, schoolYear, section], "csv"),
      exportColumns,
      groupes,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildExportFilename([t.title, connection, schoolYear, section], "pdf"),
      exportColumns,
      groupes,
      schoolHeader,
    );
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-4 opacity-70 text-sm">{t.sectionHint(section)}</p>
      <div className="mb-6">
        <ExportButtons
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          excelLabel={et.excelBtn}
          pdfLabel={et.pdfBtn}
          disabled={isLoading || groupes.length === 0}
        />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="overflow-x-auto w-full max-w-2xl mx-auto mb-4">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        groupes.length > 0 &&
                        selectedIds.size === groupes.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>{t.tableHeaderName}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groupes.map((groupe, index) => (
                  <tr key={groupe.groupe_id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.has(groupe.groupe_id)}
                        onChange={() => toggleSelect(groupe.groupe_id)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>
                      {editingId === groupe.groupe_id ? (
                        <input
                          type="text"
                          className="input input-sm w-full"
                          value={editingValue}
                          autoFocus
                          onChange={(e) =>
                            setEditingValue(sanitizeSubjectTitle(e.target.value))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(groupe);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        groupe.groupe_name
                      )}
                    </td>
                    <td>
                      {editingId === groupe.groupe_id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary mr-2"
                            onClick={() => saveEdit(groupe)}
                          >
                            {t.saveBtn}
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={cancelEdit}
                          >
                            {t.cancelBtn}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost"
                          onClick={() => startEdit(groupe)}
                        >
                          {t.editBtn}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {groupes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center opacity-60">
                      {t.emptySection}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="btn btn-error btn-sm mb-6"
            disabled={selectedIds.size === 0}
            onClick={handleDeleteSelected}
          >
            {t.deleteSelectionBtn(selectedIds.size)}
          </button>
        </>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 max-w-xs">
        <input
          type="text"
          className="input w-full"
          placeholder={t.addPlaceholder}
          value={newGroupeName}
          onChange={(e) => setNewGroupeName(sanitizeSubjectTitle(e.target.value))}
        />
        <button type="submit" className="btn btn-neutral">
          {t.addBtn}
        </button>
      </form>
    </div>
  );
};

export default GroupeManager;
