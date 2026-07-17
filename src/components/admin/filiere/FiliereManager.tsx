import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  filiereManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { FiliereReader } from "../../../dbmanger/FiliereReader";
import type { Filiere } from "../../../interfaces/Filiere";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import {
  MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH,
  sanitizeFiliereOrSpecialityName,
} from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import {
  buildExportFilename,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";

const FiliereManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = filiereManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newFiliereName, setNewFiliereName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadFilieres = async () => {
    setIsLoading(true);
    const list = await FiliereReader.fetchFilieres(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setFilieres(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadFilieres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFiliereName.trim();
    if (trimmed.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await FiliereReader.saveFiliere(
      accessToken,
      connection,
      schoolYear,
      section,
      trimmed,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setNewFiliereName("");
      loadFilieres();
    } else {
      showToast(
        isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure,
        { type: "danger" },
      );
    }
  };

  const startEdit = (filiere: Filiere) => {
    setEditingId(filiere.filiere_id);
    setEditingValue(filiere.nom_filiere);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEdit = async (filiere: Filiere) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === filiere.nom_filiere) {
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
    const result = await FiliereReader.renameFiliere(
      accessToken,
      connection,
      filiere.nom_filiere,
      trimmed,
    );
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
      loadFilieres();
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
      prev.size === filieres.length
        ? new Set()
        : new Set(filieres.map((f) => f.filiere_id)),
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
    const result = await FiliereReader.deleteFilieres(
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
      loadFilieres();
    }
  };

  const exportColumns = [
    { header: t.tableHeaderIndex, accessor: (_f: Filiere, index: number) => index + 1 },
    { header: t.tableHeaderName, accessor: (f: Filiere) => f.nom_filiere },
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildExportFilename([t.title, connection, schoolYear, section], "csv"),
      exportColumns,
      filieres,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildExportFilename([t.title, connection, schoolYear, section], "pdf"),
      exportColumns,
      filieres,
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
          disabled={isLoading || filieres.length === 0}
        />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <table className="table w-full max-w-2xl mb-4 mx-auto">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={
                      filieres.length > 0 &&
                      selectedIds.size === filieres.length
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
              {filieres.map((filiere, index) => (
                <tr key={filiere.filiere_id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.has(filiere.filiere_id)}
                      onChange={() => toggleSelect(filiere.filiere_id)}
                    />
                  </td>
                  <td>{index + 1}</td>
                  <td>
                    {editingId === filiere.filiere_id ? (
                      <input
                        type="text"
                        className="input input-sm w-full"
                        value={editingValue}
                        autoFocus
                        onChange={(e) =>
                          setEditingValue(
                            sanitizeFiliereOrSpecialityName(e.target.value),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(filiere);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      filiere.nom_filiere
                    )}
                  </td>
                  <td>
                    {editingId === filiere.filiere_id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs btn-primary mr-2"
                          onClick={() => saveEdit(filiere)}
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
                        onClick={() => startEdit(filiere)}
                      >
                        {t.editBtn}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filieres.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center opacity-60">
                    {t.emptySection}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

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
          value={newFiliereName}
          onChange={(e) =>
            setNewFiliereName(sanitizeFiliereOrSpecialityName(e.target.value))
          }
        />
        <button type="submit" className="btn btn-neutral">
          {t.addBtn}
        </button>
      </form>
    </div>
  );
};

export default FiliereManager;
