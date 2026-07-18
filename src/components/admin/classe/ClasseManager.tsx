import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { MyConstants } from "../../../dbmanger/MyConstants";
import { computeMaxClasseLevel } from "../../../utils/schoolTypes";
import { useConfirm } from "../../../confirm/useConfirm";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  classeManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { SpecialityReader } from "../../../dbmanger/SpecialityReader";
import type { Classe } from "../../../interfaces/Classe";
import type { Speciality } from "../../../interfaces/Speciality";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import {
  MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH,
  sanitizeFiliereOrSpecialityName,
} from "../../../utils/textValidation";
import { isDuplicateNameError, stripHtmlTags } from "../../../utils/apiErrors";
import {
  buildExportFilename,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import {
  parseImportFile,
  type ImportedClasse,
  type ImportError,
} from "../../../utils/classeImport";

const mapImportErrorToMessage = (
  error: ImportError,
  t: (typeof classeManagerTranslations)["fr"],
): string => {
  switch (error.type) {
    case "unsupportedExtension":
      return t.importUnsupportedExtension;
    case "emptyFile":
      return t.importEmptyFile;
    case "badHeader":
      return t.importBadHeader;
    case "emptyName":
      return t.importEmptyName(error.row);
    case "invalidLevel":
      return t.importInvalidLevel(error.row);
  }
};

const ClasseManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const confirm = useConfirm();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = classeManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();
  // The establishment type is seeded/kept in sync by SchoolInfoManager (see its "Session variables"
  // convention) - read directly rather than recomputing it, same as other modules needing school
  // identity info. CES/CETIC/CETIC BILINGUE only go up to level 4, every other type up to level 7.
  const schoolType =
    sessionStorage.getItem(MyConstants.SCHOOL_TYPE_KEY) ??
    MyConstants.DEFAULT_SCHOOL_TYPE;
  const maxLevel = computeMaxClasseLevel(schoolType);

  const [classes, setClasses] = useState<Classe[]>([]);
  const [specialities, setSpecialities] = useState<Speciality[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newClasseName, setNewClasseName] = useState("");
  const [newLevel, setNewLevel] = useState("1");
  const [newSpecialityId, setNewSpecialityId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLevel, setEditingLevel] = useState("");
  const [editingSpecialityId, setEditingSpecialityId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const loadClasses = async () => {
    setIsLoading(true);
    const list = await ClasseReader.fetchClasses(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setClasses(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  const loadSpecialitiesForSection = async () => {
    const list = await SpecialityReader.fetchSpecialities(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setSpecialities(list);
  };

  useEffect(() => {
    loadClasses();
    loadSpecialitiesForSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const parseLevel = (value: string): number | null => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }
    const parsed = Number(trimmed);
    return parsed >= 1 && parsed <= maxLevel ? parsed : null;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newClasseName.trim();
    if (!trimmedName) {
      return;
    }
    if (trimmedName.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    const level = parseLevel(newLevel);
    if (level === null) {
      showToast(t.levelInvalid(maxLevel), { type: "warning" });
      return;
    }
    const speciality = specialities.find(
      (s) => String(s.speciality_id) === newSpecialityId,
    );
    setIsSaving(true);
    const result = await ClasseReader.saveClasse(
      accessToken,
      connection,
      schoolYear,
      section,
      trimmedName,
      level,
      speciality?.speciality_name,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setNewClasseName("");
      setNewLevel("1");
      setNewSpecialityId("");
      loadClasses();
    } else {
      showToast(
        isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure,
        { type: "danger" },
      );
    }
  };

  const startEdit = (classe: Classe) => {
    setEditingId(classe.classe_id);
    setEditingName(classe.classe_name);
    setEditingLevel(String(classe.level));
    setEditingSpecialityId(
      classe.speciality_id !== null ? String(classe.speciality_id) : "",
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingLevel("");
    setEditingSpecialityId("");
  };

  const saveEdit = async (classe: Classe) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      cancelEdit();
      return;
    }
    const level = parseLevel(editingLevel);
    if (level === null) {
      showToast(t.levelInvalid(maxLevel), { type: "warning" });
      return;
    }
    const specialityId = editingSpecialityId ? Number(editingSpecialityId) : null;
    if (
      trimmedName === classe.classe_name &&
      level === classe.level &&
      specialityId === classe.speciality_id
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
    const result = await ClasseReader.updateClasses(accessToken, connection, schoolYear, [
      {
        classe_id: classe.classe_id,
        classe_name: trimmedName,
        level,
        speciality_id: specialityId,
        // Not editable from this screen - round-tripped unchanged so the backend doesn't
        // null out an existing classe master/SG assignment made via the dedicated
        // assignment endpoints (see ClasseReader.updateClasses).
        classe_master_id: classe.classe_master_id,
        sg_id: classe.sg_id,
      },
    ]);
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
      loadClasses();
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
      prev.size === classes.length
        ? new Set()
        : new Set(classes.map((c) => c.classe_id)),
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
    const result = await ClasseReader.deleteClasses(
      accessToken,
      connection,
      schoolYear,
      section,
      Array.from(selectedIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadClasses();
    }
  };

  // The backend only rejects an import as a duplicate when a classe_name already has a classe_year
  // record for the *current school year*, regardless of section (see ClasseController::
  // saveManyClasses/saveClasse - the uniqueness check has no section_id filter). Section is always
  // one of exactly these two literal values in this app (see LoginForm/TopBanner), so checking both
  // is equivalent to checking "the whole database for this year" without needing a new backend
  // endpoint. Always re-fetched live (not read from the `classes` state) so this is accurate even
  // right after the override path's delete.
  const findDuplicateAgainstDatabase = async (
    rows: ImportedClasse[],
  ): Promise<ImportedClasse | null> => {
    const otherSection = section === "francophone" ? "anglophone" : "francophone";
    const [currentSectionClasses, otherSectionClasses] = await Promise.all([
      ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
      ClasseReader.fetchClasses(accessToken, connection, schoolYear, otherSection),
    ]);
    const existingNames = new Set(
      [...currentSectionClasses, ...otherSectionClasses].map((c) =>
        c.classe_name.trim().toLowerCase(),
      ),
    );
    return (
      rows.find((r) => existingNames.has(r.classe_name.trim().toLowerCase())) ??
      null
    );
  };

  const saveImportedClasses = async (rows: ImportedClasse[]) => {
    setIsSaving(true);
    const duplicate = await findDuplicateAgainstDatabase(rows);
    if (duplicate) {
      setIsSaving(false);
      showToast(
        t.importDuplicateFound(duplicate.classe_name, duplicate.sourceRow),
        { type: "danger" },
      );
      return;
    }
    const saveResult = await ClasseReader.saveManyClasses(
      accessToken,
      connection,
      schoolYear,
      section,
      rows,
    );
    setIsSaving(false);
    if (saveResult.status) {
      showToast(t.importSuccess(rows.length), { type: "info" });
      loadClasses();
    } else {
      // The backend's message names exactly which class(es) it rejected and why (e.g. invalid
      // characters) - surface it rather than a generic failure toast.
      const detail = stripHtmlTags(saveResult.message);
      showToast(
        detail ? t.importFailureDetail(detail) : t.importFailure,
        { type: "danger" },
      );
    }
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    setIsSaving(true);
    const parsed = await parseImportFile(file);
    setIsSaving(false);
    if (!parsed.status) {
      showToast(mapImportErrorToMessage(parsed.error, t), { type: "danger" });
      return;
    }

    const wantsOverride = await confirm(t.importOverrideQuestion, {
      confirmLabel: t.importOverrideBtn,
      cancelLabel: t.importAddWithoutOverrideBtn,
    });

    if (wantsOverride) {
      const reallyOverride = await confirm(t.importOverrideConfirmAgain, {
        danger: true,
        confirmLabel: t.importOverrideFinalBtn,
      });
      if (!reallyOverride) {
        return;
      }
      setIsSaving(true);
      const delResult = await ClasseReader.deleteClassesOfSectionAndYear(
        accessToken,
        connection,
        schoolYear,
        section,
      );
      if (!delResult.status) {
        setIsSaving(false);
        showToast(t.importDeleteFailure, { type: "danger" });
        return;
      }
      await saveImportedClasses(parsed.classes);
      return;
    }

    await saveImportedClasses(parsed.classes);
  };

  const exportColumns = [
    {
      header: t.tableHeaderIndex,
      accessor: (_c: Classe, index: number) => index + 1,
    },
    { header: t.tableHeaderName, accessor: (c: Classe) => c.classe_name },
    { header: t.tableHeaderLevel, accessor: (c: Classe) => c.level },
    {
      header: t.tableHeaderSpeciality,
      accessor: (c: Classe) => c.speciality_name ?? "",
    },
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildExportFilename([t.title, connection, schoolYear, section], "csv"),
      exportColumns,
      classes,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildExportFilename([t.title, connection, schoolYear, section], "pdf"),
      exportColumns,
      classes,
      schoolHeader,
    );
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-4 opacity-70 text-sm">{t.sectionHint(section)}</p>
      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <ExportButtons
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          excelLabel={et.excelBtn}
          pdfLabel={et.pdfBtn}
          disabled={isLoading || classes.length === 0}
        />
        <input
          ref={importFileInputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={handleImportFileChange}
        />
        <button
          type="button"
          className="btn btn-neutral gap-2"
          disabled={isLoading}
          onClick={() => importFileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4" />
          {t.importBtn}
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="overflow-x-auto w-full max-w-3xl mx-auto mb-4">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        classes.length > 0 && selectedIds.size === classes.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderLevel}</th>
                  <th>{t.tableHeaderSpeciality}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((classe, index) => (
                  <tr key={classe.classe_id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.has(classe.classe_id)}
                        onChange={() => toggleSelect(classe.classe_id)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>
                      {editingId === classe.classe_id ? (
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
                            if (e.key === "Enter") saveEdit(classe);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        classe.classe_name
                      )}
                    </td>
                    <td>
                      {editingId === classe.classe_id ? (
                        <input
                          type="number"
                          min={1}
                          max={maxLevel}
                          className="input input-sm w-20"
                          value={editingLevel}
                          onChange={(e) => setEditingLevel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(classe);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        classe.level
                      )}
                    </td>
                    <td>
                      {editingId === classe.classe_id ? (
                        <select
                          className="select select-sm w-full"
                          value={editingSpecialityId}
                          onChange={(e) =>
                            setEditingSpecialityId(e.target.value)
                          }
                        >
                          <option value="">{t.noSpecialityOption}</option>
                          {specialities.map((speciality) => (
                            <option
                              key={speciality.speciality_id}
                              value={speciality.speciality_id}
                            >
                              {speciality.speciality_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        classe.speciality_name || ""
                      )}
                    </td>
                    <td>
                      {editingId === classe.classe_id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary mr-2"
                            onClick={() => saveEdit(classe)}
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
                          onClick={() => startEdit(classe)}
                        >
                          {t.editBtn}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center opacity-60">
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

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-2 max-w-2xl items-start"
      >
        <input
          type="text"
          className="input"
          placeholder={t.addPlaceholder}
          value={newClasseName}
          onChange={(e) =>
            setNewClasseName(sanitizeFiliereOrSpecialityName(e.target.value))
          }
        />
        <input
          type="number"
          min={1}
          max={maxLevel}
          className="input w-24"
          placeholder={t.levelPlaceholder}
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
        />
        <select
          className="select"
          value={newSpecialityId}
          onChange={(e) => setNewSpecialityId(e.target.value)}
        >
          <option value="">{t.noSpecialityOption}</option>
          {specialities.map((speciality) => (
            <option
              key={speciality.speciality_id}
              value={speciality.speciality_id}
            >
              {speciality.speciality_name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-neutral">
          {t.addBtn}
        </button>
      </form>
    </div>
  );
};

export default ClasseManager;
