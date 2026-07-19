import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useConfirm } from "../../../confirm/useConfirm";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  specialityManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { FiliereReader } from "../../../dbmanger/FiliereReader";
import { SpecialityReader } from "../../../dbmanger/SpecialityReader";
import type { Filiere } from "../../../interfaces/Filiere";
import type { Speciality } from "../../../interfaces/Speciality";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import {
  MAX_SPECIALITY_DESCRIPTION_LENGTH,
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

const SpecialityManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const confirm = useConfirm();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = specialityManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [selectedFiliere, setSelectedFiliere] = useState("");
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newSpecialityName, setNewSpecialityName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingFiliere, setEditingFiliere] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const loadSpecialities = async () => {
    setIsLoading(true);
    const list = await SpecialityReader.fetchSpecialities(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setSpecialities(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  const loadFilieresForSection = async () => {
    const list = await FiliereReader.fetchFilieres(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setFilieres(list);
    setSelectedFiliere(list.length > 0 ? list[0].nom_filiere : "");
  };

  useEffect(() => {
    loadSpecialities();
    loadFilieresForSection();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const filteredSpecialities = specialities.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      s.speciality_name.toLowerCase().includes(q) ||
      s.nom_filiere.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q)
    );
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newSpecialityName.trim();
    if (!trimmedName || !selectedFiliere) {
      return;
    }
    if (trimmedName.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await SpecialityReader.saveSpeciality(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedFiliere,
      trimmedName,
      newDescription.trim(),
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setNewSpecialityName("");
      setNewDescription("");
      loadSpecialities();
    } else {
      showToast(
        isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure,
        { type: "danger" },
      );
    }
  };

  const startEdit = (speciality: Speciality) => {
    setEditingId(speciality.speciality_id);
    setEditingName(speciality.speciality_name);
    setEditingDescription(speciality.description ?? "");
    setEditingFiliere(speciality.nom_filiere);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingFiliere("");
  };

  const saveEdit = async (speciality: Speciality) => {
    const trimmedName = editingName.trim();
    const trimmedDescription = editingDescription.trim();
    if (!trimmedName || !editingFiliere) {
      cancelEdit();
      return;
    }
    if (
      trimmedName === speciality.speciality_name &&
      trimmedDescription === (speciality.description ?? "") &&
      editingFiliere === speciality.nom_filiere
    ) {
      cancelEdit();
      return;
    }
    if (trimmedName.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await SpecialityReader.updateManySpecialities(
      accessToken,
      connection,
      schoolYear,
      section,
      [
        {
          speciality_id: speciality.speciality_id,
          speciality_name: trimmedName,
          description: trimmedDescription,
          nom_filiere: editingFiliere,
        },
      ],
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.updateSuccess, { type: "info" });
    } else {
      showToast(
        isDuplicateNameError(result.message)
          ? t.updateDuplicate
          : t.updateFailure,
        { type: "danger" },
      );
    }
    cancelEdit();
    if (result.status) {
      loadSpecialities();
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
    const filteredIds = filteredSpecialities.map((s) => s.speciality_id);
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
    const result = await SpecialityReader.deleteSpecialities(
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
      loadSpecialities();
    }
  };

  const exportColumns = [
    {
      header: t.tableHeaderIndex,
      accessor: (_s: Speciality, index: number) => index + 1,
    },
    {
      header: t.tableHeaderName,
      accessor: (s: Speciality) => s.speciality_name,
    },
    { header: t.tableHeaderFiliere, accessor: (s: Speciality) => s.nom_filiere },
    {
      header: t.tableHeaderDescription,
      accessor: (s: Speciality) => s.description ?? "",
    },
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildTimestampedFilename(
        "Liste des specialités",
        [`Section ${capitalizeSectionName(section)}`],
        "csv",
      ),
      exportColumns,
      specialities,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildTimestampedFilename(
        "Liste des specialités",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
      exportColumns,
      specialities,
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
          disabled={isLoading || specialities.length === 0}
        />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <input
            type="text"
            className="input w-full max-w-3xl mb-4"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="overflow-x-auto w-full max-w-3xl mx-auto mb-4">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        filteredSpecialities.length > 0 &&
                        filteredSpecialities.every((s) =>
                          selectedIds.has(s.speciality_id),
                        )
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>N°</th>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderFiliere}</th>
                  <th>{t.tableHeaderDescription}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSpecialities.map((speciality, index) => (
                  <tr key={speciality.speciality_id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.has(speciality.speciality_id)}
                        onChange={() => toggleSelect(speciality.speciality_id)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>
                      {editingId === speciality.speciality_id ? (
                        <input
                          type="text"
                          className="input input-sm w-full"
                          value={editingName}
                          autoFocus
                          onChange={(e) =>
                            setEditingName(
                              sanitizeFiliereOrSpecialityName(e.target.value),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(speciality);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        speciality.speciality_name
                      )}
                    </td>
                    <td>
                      {editingId === speciality.speciality_id ? (
                        <select
                          className="select select-sm w-full"
                          value={editingFiliere}
                          onChange={(e) => setEditingFiliere(e.target.value)}
                        >
                          {filieres.map((filiere) => (
                            <option
                              key={filiere.filiere_id}
                              value={filiere.nom_filiere}
                            >
                              {filiere.nom_filiere}
                            </option>
                          ))}
                        </select>
                      ) : (
                        speciality.nom_filiere
                      )}
                    </td>
                    <td>
                      {editingId === speciality.speciality_id ? (
                        <input
                          type="text"
                          className="input input-sm w-full"
                          value={editingDescription}
                          maxLength={MAX_SPECIALITY_DESCRIPTION_LENGTH}
                          onChange={(e) =>
                            setEditingDescription(
                              sanitizeFiliereOrSpecialityName(
                                e.target.value,
                              ).slice(0, MAX_SPECIALITY_DESCRIPTION_LENGTH),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(speciality);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        speciality.description || ""
                      )}
                    </td>
                    <td>
                      {editingId === speciality.speciality_id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary mr-2"
                            onClick={() => saveEdit(speciality)}
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
                          onClick={() => startEdit(speciality)}
                        >
                          {t.editBtn}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {specialities.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center opacity-60">
                      {t.emptySection}
                    </td>
                  </tr>
                )}
                {specialities.length > 0 && filteredSpecialities.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center opacity-60">
                      {t.noSearchResults}
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

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-2 max-w-2xl items-start"
      >
        <select
          className="select"
          value={selectedFiliere}
          onChange={(e) => setSelectedFiliere(e.target.value)}
          disabled={filieres.length === 0}
        >
          {filieres.length === 0 && (
            <option value="">{t.noFiliereOption}</option>
          )}
          {filieres.map((filiere) => (
            <option key={filiere.filiere_id} value={filiere.nom_filiere}>
              {filiere.nom_filiere}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="input"
          placeholder={t.addPlaceholder}
          value={newSpecialityName}
          onChange={(e) =>
            setNewSpecialityName(sanitizeFiliereOrSpecialityName(e.target.value))
          }
        />
        <input
          type="text"
          className="input"
          placeholder={t.descriptionPlaceholder}
          value={newDescription}
          maxLength={MAX_SPECIALITY_DESCRIPTION_LENGTH}
          onChange={(e) =>
            setNewDescription(
              sanitizeFiliereOrSpecialityName(e.target.value).slice(
                0,
                MAX_SPECIALITY_DESCRIPTION_LENGTH,
              ),
            )
          }
        />
        <button
          type="submit"
          className="btn btn-neutral"
          disabled={filieres.length === 0}
        >
          {t.addBtn}
        </button>
      </form>
      {filieres.length === 0 && (
        <p className="text-sm opacity-60 mt-2">{t.createFiliereFirst}</p>
      )}
    </div>
  );
};

export default SpecialityManager;
