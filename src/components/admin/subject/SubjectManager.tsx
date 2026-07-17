import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { subjectManagerTranslations } from "../../../i18n/translations";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import type { Subject } from "../../../interfaces/Subject";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import {
  MIN_FILIERE_OR_SPECIALITY_NAME_LENGTH,
  sanitizeFiliereOrSpecialityName,
} from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";

const SubjectManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = subjectManagerTranslations[language];

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newSubjectTitle, setNewSubjectTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

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

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === subjects.length
        ? new Set()
        : new Set(subjects.map((s) => s.subject_id)),
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

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-6 opacity-70 text-sm">{t.sectionHint(section)}</p>

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
                        subjects.length > 0 &&
                        selectedIds.size === subjects.length
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
                {subjects.map((subject, index) => (
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
