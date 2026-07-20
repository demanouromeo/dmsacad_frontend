import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  subjectManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import type { Subject } from "../../../interfaces/Subject";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import {
  MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH,
  sanitizeFiliereOrSpecialityName,
} from "../../../utils/textValidation";
import { isDuplicateNameError, stripHtmlTags } from "../../../utils/apiErrors";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import {
  parseSubjectImportFile,
  type ImportedSubject,
  type SubjectImportError,
} from "../../../utils/subjectImport";

const mapImportErrorToMessage = (
  error: SubjectImportError,
  t: (typeof subjectManagerTranslations)["fr"],
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
  }
};

const SubjectManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = subjectManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const loadSubjects = async () => {
    setIsLoading(true);
    const list = await SubjectReader.fetchSubjects(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    setSubjects(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadSubjects();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const filteredSubjects = subjects.filter((s) =>
    s.subject_title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubjectTitle.trim();
    if (trimmed.length < MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await SubjectReader.saveSubject(
      accessToken,
      connection,
      schoolYear,
      section,
      trimmed,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setNewSubjectTitle("");
      loadSubjects();
    } else {
      showToast(
        isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure,
        { type: "danger" },
      );
    }
  };

  const startEdit = (subject: Subject) => {
    setEditingId(subject.subject_id);
    setEditingValue(subject.subject_title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveEdit = async (subject: Subject) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === subject.subject_title) {
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
    const result = await SubjectReader.updateSubjects(
      accessToken,
      connection,
      schoolYear,
      section,
      [{ subject_id: subject.subject_id, subject_title: trimmed }],
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
      loadSubjects();
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
    const filteredIds = filteredSubjects.map((s) => s.subject_id);
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
    const result = await SubjectReader.deleteSubjects(
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
      loadSubjects();
    }
  };

  // Section+year scoped, matching what deleteAllSubjectsOfSectionAndYear clears and what's already
  // visible in this screen's own list - a subject_title can exist in another section/year without
  // conflicting (see SubjectController::saveManySubjects, which keys the actual uniqueness
  // violation on the subject_id+sy_id+section_id SubjectYear pairing, not the title alone). Always
  // re-fetched live (not read from the `subjects` state) so this is accurate even right after the
  // override path's delete.
  const findDuplicateAgainstDatabase = async (
    rows: ImportedSubject[],
  ): Promise<ImportedSubject | null> => {
    const currentSubjects = await SubjectReader.fetchSubjects(
      accessToken,
      connection,
      schoolYear,
      section,
    );
    const existingNames = new Set(
      currentSubjects.map((s) => s.subject_title.trim().toLowerCase()),
    );
    return (
      rows.find((r) => existingNames.has(r.subject_title.trim().toLowerCase())) ??
      null
    );
  };

  const saveImportedSubjects = async (rows: ImportedSubject[]) => {
    setIsSaving(true);
    const duplicate = await findDuplicateAgainstDatabase(rows);
    if (duplicate) {
      setIsSaving(false);
      showToast(
        t.importDuplicateFound(duplicate.subject_title, duplicate.sourceRow),
        { type: "danger" },
      );
      return;
    }
    const saveResult = await SubjectReader.saveManySubjects(
      accessToken,
      connection,
      schoolYear,
      section,
      rows.map((r) => ({ subject_title: r.subject_title })),
    );
    setIsSaving(false);
    if (saveResult.status) {
      showToast(t.importSuccess(rows.length), { type: "info" });
      loadSubjects();
    } else {
      const detail = stripHtmlTags(saveResult.message);
      showToast(detail ? t.importFailureDetail(detail) : t.importFailure, {
        type: "danger",
      });
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
    const parsed = await parseSubjectImportFile(file);
    setIsSaving(false);
    if (!parsed.status) {
      showToast(mapImportErrorToMessage(parsed.error, t), { type: "danger" });
      return;
    }

    const wantsDelete = await confirm(t.importDeleteExistingQuestion);

    if (wantsDelete) {
      const reallyDelete = await confirm(t.importDeleteExistingConfirm, {
        danger: true,
      });
      if (!reallyDelete) {
        return;
      }
      setIsSaving(true);
      const delResult = await SubjectReader.deleteAllSubjectsOfSectionAndYear(
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
      await saveImportedSubjects(parsed.subjects);
      return;
    }

    await saveImportedSubjects(parsed.subjects);
  };

  const exportColumns = [
    { header: t.tableHeaderName, accessor: (s: Subject) => s.subject_title },
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildTimestampedFilename(
        "Liste des matières",
        [`Section ${capitalizeSectionName(section)}`],
        "csv",
      ),
      exportColumns,
      subjects,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildTimestampedFilename(
        "Liste des matières",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
      exportColumns,
      subjects,
      schoolHeader,
    );
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
        <p className="mb-4 opacity-70 text-sm">{t.sectionHint(section)}</p>
        <div className="mb-6 flex flex-wrap gap-2 items-center">
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
            excelLabel={et.excelBtn}
            pdfLabel={et.pdfBtn}
            disabled={isLoading || subjects.length === 0}
          />
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx"
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
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <input
            type="text"
            className="input w-full max-w-2xl mb-4 mx-auto block"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="overflow-x-auto w-full max-w-2xl mx-auto mb-4">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        filteredSubjects.length > 0 &&
                        filteredSubjects.every((s) =>
                          selectedIds.has(s.subject_id),
                        )
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
                {filteredSubjects.map((subject, index) => (
                  <tr key={subject.subject_id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedIds.has(subject.subject_id)}
                        onChange={() => toggleSelect(subject.subject_id)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td>
                      {editingId === subject.subject_id ? (
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
                            if (e.key === "Enter") saveEdit(subject);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        subject.subject_title
                      )}
                    </td>
                    <td>
                      {editingId === subject.subject_id ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary mr-2"
                            onClick={() => saveEdit(subject)}
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
                          onClick={() => startEdit(subject)}
                        >
                          {t.editBtn}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center opacity-60">
                      {t.emptySection}
                    </td>
                  </tr>
                )}
                {subjects.length > 0 && filteredSubjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center opacity-60">
                      {t.noSearchResults}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              className="btn btn-error btn-sm mb-6"
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
            >
              {t.deleteSelectionBtn(selectedIds.size)}
            </button>
          </div>
        </>
      )}

      <form onSubmit={handleAdd} className="flex gap-2 max-w-xs mx-auto">
        <input
          type="text"
          className="input w-full"
          placeholder={t.addPlaceholder}
          value={newSubjectTitle}
          onChange={(e) =>
            setNewSubjectTitle(sanitizeFiliereOrSpecialityName(e.target.value))
          }
        />
        <button type="submit" className="btn btn-neutral">
          {t.addBtn}
        </button>
      </form>
    </div>
  );
};

export default SubjectManager;
