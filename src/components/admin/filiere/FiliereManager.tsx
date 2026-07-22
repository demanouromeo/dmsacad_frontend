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
import SearchInput from "../../sharedcomp/SearchInput";
import {
  MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH,
  sanitizeFiliereOrSpecialityName,
} from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
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
  const [searchQuery, setSearchQuery] = useState("");

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
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const filteredFilieres = filieres.filter((f) =>
    f.nom_filiere.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

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

  // Operates on the currently filtered rows, not the whole list - selecting "all" while a search is
  // active only selects what's visible, matching what the user can see they're selecting.
  const toggleSelectAll = () => {
    const filteredIds = filteredFilieres.map((f) => f.filiere_id);
    const allFilteredSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (allFilteredSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
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
      buildTimestampedFilename(
        "Liste des filière",
        [`Section ${capitalizeSectionName(section)}`],
        "csv",
      ),
      exportColumns,
      filieres,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildTimestampedFilename(
        "Liste des filière",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
      exportColumns,
      filieres,
      schoolHeader,
    );
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay />}

      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section)}</p>
        </div>
        <ExportButtons
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          excelLabel={et.excelBtn}
          pdfLabel={et.pdfBtn}
          disabled={isLoading || filieres.length === 0}
        />
      </div>

      {isLoading ? (
        <div className="surface-card flex justify-center py-20 mb-6">
          <Loading />
        </div>
      ) : (
        <div className="surface-card overflow-hidden mb-6">
          <div className="table-toolbar">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t.searchPlaceholder}
              className="input-sm w-full max-w-xs"
            />
            <button
              type="button"
              className="btn btn-error btn-sm"
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
            >
              {t.deleteSelectionBtn(selectedIds.size)}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        filteredFilieres.length > 0 &&
                        filteredFilieres.every((f) => selectedIds.has(f.filiere_id))
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
                {filteredFilieres.map((filiere, index) => (
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
                    <td className="text-right">
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
                    <td colSpan={4}>
                      <p className="empty-state">{t.emptySection}</p>
                    </td>
                  </tr>
                )}
                {filieres.length > 0 && filteredFilieres.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-state">{t.noSearchResults}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="surface-card p-4 md:p-5 max-w-md">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            className="input w-full"
            placeholder={t.addPlaceholder}
            value={newFiliereName}
            onChange={(e) =>
              setNewFiliereName(sanitizeFiliereOrSpecialityName(e.target.value))
            }
          />
          <button type="submit" className="btn btn-primary">
            {t.addBtn}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FiliereManager;
