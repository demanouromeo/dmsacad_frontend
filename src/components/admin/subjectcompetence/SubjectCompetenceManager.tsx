import { useEffect, useState } from "react";
import { Eraser, Trash2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { subjectCompetenceManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import { MarkReader } from "../../../dbmanger/MarkReader";
import type { Classe } from "../../../interfaces/Classe";
import type { SubjectClasseRow } from "../../../interfaces/SubjectClasseRow";
import type { SubjectCompetence } from "../../../interfaces/SubjectCompetence";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import SearchInput from "../../sharedcomp/SearchInput";
import { sanitizeSubjectTitle } from "../../../utils/subjectImport";
import { MAX_COMPETENCE_TEXT_LENGTH } from "../../../utils/textValidation";

const TERMS = [1, 2, 3];

const isSameCompetenceText = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

// "Matières et compétences" - 4th sub-module of "Manage subjects". Only classes whose level is
// flagged APC (competence-based) in the current year+section are selectable here - see
// ClasseManager's apcLevels/isLevelApc for the same (year, section, level) -> activated map this
// screen reuses. For each (classe, subject, term) triple it lists/edits/deletes
// subject_competences rows (SubjectController::allCompetences1/saveCompetence/updateManyCompetences/
// deleteManyCompetences); a separate icon button wipes every competence of the selected classe for
// the whole year regardless of subject/term (deleteCompetencesOfAClasse).
const SubjectCompetenceManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = subjectCompetenceManagerTranslations[language];

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(
    null,
  );

  const [subjects, setSubjects] = useState<SubjectClasseRow[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    null,
  );

  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);

  const [competences, setCompetences] = useState<SubjectCompetence[]>([]);
  const [isLoadingCompetences, setIsLoadingCompetences] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newCompetenceText, setNewCompetenceText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const isLevelApc = (level: number): boolean => apcLevels.get(level) === true;
  const apcClasses = classes.filter((c) => isLevelApc(c.level));
  const selectedClasse =
    apcClasses.find((c) => c.classe_id === selectedClasseId) ?? null;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, apcLevelList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      ]);
      const levelMap = new Map(
        apcLevelList.map((entry) => [entry.level, entry.activated]),
      );
      const apcList = classeList.filter((c) => levelMap.get(c.level) === true);
      setClasses(classeList);
      setApcLevels(levelMap);
      setSelectedClasseId((prev) => {
        if (prev !== null && apcList.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return apcList.length > 0 ? apcList[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null) {
        setSubjects([]);
        setSelectedSubjectId(null);
        return;
      }
      setIsLoadingSubjects(true);
      const list = await SubjectReader.fetchSubjectsOfClasse(
        accessToken,
        connection,
        schoolYear,
        section,
        selectedClasseId,
      );
      setSubjects(list);
      setSelectedSubjectId((prev) => {
        if (prev !== null && list.some((s) => s.subject_id === prev)) {
          return prev;
        }
        return list.length > 0 ? list[0].subject_id : null;
      });
      setIsLoadingSubjects(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  const loadCompetences = async () => {
    if (selectedClasseId === null || selectedSubjectId === null) {
      setCompetences([]);
      return;
    }
    setIsLoadingCompetences(true);
    const list = await SubjectReader.fetchCompetences(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedClasseId,
      selectedSubjectId,
      selectedTerm,
    );
    setCompetences(list);
    setSelectedIds(new Set());
    setIsLoadingCompetences(false);
  };

  useEffect(() => {
    loadCompetences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, selectedSubjectId, selectedTerm]);

  const filteredCompetences = competences.filter((c) =>
    c.competence_text.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const handleAddCompetence = async () => {
    if (selectedClasseId === null || selectedSubjectId === null) {
      return;
    }
    const trimmed = newCompetenceText.trim();
    if (!trimmed) {
      showToast(t.addTextRequired, { type: "warning" });
      return;
    }
    if (competences.some((c) => isSameCompetenceText(c.competence_text, trimmed))) {
      showToast(t.addDuplicate, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await SubjectReader.saveCompetence(
      accessToken,
      connection,
      schoolYear,
      section,
      selectedClasseId,
      selectedSubjectId,
      selectedTerm,
      trimmed,
    );
    setIsSaving(false);
    showToast(result.status ? t.addSuccess : t.addFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setNewCompetenceText("");
      loadCompetences();
    }
  };

  const startEdit = (comp: SubjectCompetence) => {
    setEditingId(comp.subject_competence_id);
    setEditingText(comp.competence_text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async (comp: SubjectCompetence) => {
    const trimmed = editingText.trim();
    if (!trimmed || trimmed === comp.competence_text) {
      cancelEdit();
      return;
    }
    if (
      competences.some(
        (c) =>
          c.subject_competence_id !== comp.subject_competence_id &&
          isSameCompetenceText(c.competence_text, trimmed),
      )
    ) {
      showToast(t.renameDuplicate, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await SubjectReader.updateCompetences(accessToken, connection, [
      { subject_competence_id: comp.subject_competence_id, competence_text: trimmed },
    ]);
    setIsSaving(false);
    showToast(result.status ? t.renameSuccess : t.renameFailure, {
      type: result.status ? "info" : "danger",
    });
    cancelEdit();
    if (result.status) {
      loadCompetences();
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
    const filteredIds = filteredCompetences.map((c) => c.subject_competence_id);
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
    const result = await SubjectReader.deleteCompetences(
      accessToken,
      connection,
      Array.from(selectedIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadCompetences();
    }
  };

  const handleDeleteAllOfClasse = async () => {
    if (!selectedClasse) {
      return;
    }
    const confirmed = await confirm(
      t.deleteAllOfClasseConfirm(selectedClasse.classe_name),
      { danger: true },
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await SubjectReader.deleteCompetencesOfAClasse(
      accessToken,
      connection,
      schoolYear,
      selectedClasse.classe_id,
    );
    setIsSaving(false);
    showToast(
      result.status ? t.deleteAllOfClasseSuccess : t.deleteAllOfClasseFailure,
      { type: result.status ? "info" : "danger" },
    );
    if (result.status) {
      loadCompetences();
    }
  };

  // "Toolbox" cleanup action, scoped to the currently selected (classe, subject, term) list - the
  // backend's deleteCompetencesWithNoMarks route deletes whatever ids it's given without checking
  // marks itself (see SubjectController::deleteCompetencesWithNoMarks), so the "no marks" filtering
  // happens here: fetch each currently loaded competence's marks (MarkReader.fetchCompMarks, the
  // same stud_comp_mark lookup MarkEntryManager uses) and keep only the ones where every row is
  // isEmpty (or there are no rows at all) - a row can exist with isEmpty=1 from a prior "clear all"
  // without that meaning a mark was ever genuinely entered.
  const handleDeleteWithNoMarks = async () => {
    if (selectedClasseId === null || selectedSubjectId === null || competences.length === 0) {
      return;
    }
    const classeId = selectedClasseId;
    const subjectId = selectedSubjectId;
    setIsSaving(true);
    const results = await Promise.all(
      competences.map(async (comp) => {
        const rows = await MarkReader.fetchCompMarks(
          accessToken,
          connection,
          schoolYear,
          classeId,
          subjectId,
          selectedTerm,
          comp.subject_competence_id,
        );
        const hasAnyMark = rows.some((r) => r.isEmpty !== 1);
        return { id: comp.subject_competence_id, hasAnyMark };
      }),
    );
    const idsWithNoMarks = results.filter((r) => !r.hasAnyMark).map((r) => r.id);
    if (idsWithNoMarks.length === 0) {
      setIsSaving(false);
      showToast(t.deleteNoMarksNoneFound, { type: "warning" });
      return;
    }
    setIsSaving(false);
    const confirmed = await confirm(t.deleteNoMarksConfirm(idsWithNoMarks.length), {
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await SubjectReader.deleteCompetencesWithNoMarks(
      accessToken,
      connection,
      schoolYear,
      idsWithNoMarks,
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteNoMarksSuccess : t.deleteNoMarksFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadCompetences();
    }
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay />}
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.sectionHint(section)}</p>
          </div>
        </div>

        {isLoadingClasses ? (
          <div className="surface-card flex justify-center py-20">
            <Loading />
          </div>
        ) : apcClasses.length === 0 ? (
          <p className="empty-state">{t.emptyClasses}</p>
        ) : (
          <>
            <div className="surface-card p-4 md:p-6 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <label className="font-medium">{t.classeLabel}</label>
                <select
                  className="select w-56"
                  value={selectedClasseId ?? ""}
                  onChange={(e) => setSelectedClasseId(Number(e.target.value))}
                >
                  {apcClasses.map((c) => (
                    <option key={c.classe_id} value={c.classe_id}>
                      {c.classe_name}
                    </option>
                  ))}
                </select>

                {selectedClasse && (
                  <button
                    type="button"
                    className="btn btn-error btn-sm btn-square"
                    title={t.deleteAllOfClasseTooltip(selectedClasse.classe_name)}
                    onClick={handleDeleteAllOfClasse}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="font-medium">{t.subjectLabel}</label>
                <select
                  className="select w-56"
                  disabled={isLoadingSubjects || subjects.length === 0}
                  value={selectedSubjectId ?? ""}
                  onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                >
                  {subjects.map((s) => (
                    <option key={s.subject_id} value={s.subject_id}>
                      {s.subject_title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!isLoadingSubjects && subjects.length === 0 && (
              <p className="empty-state">{t.emptySubjects}</p>
            )}

            {selectedSubjectId !== null && (
              <>
                <div className="surface-card p-4 md:p-5 flex flex-col gap-3 mb-6">
                  <textarea
                    className="textarea w-full"
                    rows={2}
                    maxLength={MAX_COMPETENCE_TEXT_LENGTH}
                    placeholder={t.addPlaceholder}
                    value={newCompetenceText}
                    onChange={(e) =>
                      setNewCompetenceText(
                        sanitizeSubjectTitle(e.target.value).slice(
                          0,
                          MAX_COMPETENCE_TEXT_LENGTH,
                        ),
                      )
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="font-medium">{t.termLabel}</label>
                    <select
                      className="select w-40"
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(Number(e.target.value))}
                    >
                      {TERMS.map((term) => (
                        <option key={term} value={term}>
                          {t.term(term)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAddCompetence}
                    >
                      {t.addBtn}
                    </button>
                  </div>
                </div>

                {isLoadingCompetences ? (
                  <div className="surface-card flex justify-center py-20">
                    <Loading />
                  </div>
                ) : (
                  <>
                    <div className="surface-card overflow-hidden mb-4">
                    <div className="table-toolbar">
                      <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder={t.searchPlaceholder}
                        className="input-sm w-full max-w-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-error btn-sm"
                          disabled={selectedIds.size === 0}
                          onClick={handleDeleteSelected}
                        >
                          {t.deleteSelectionBtn(selectedIds.size)}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-error btn-sm gap-2"
                          title={t.deleteNoMarksTooltip}
                          disabled={competences.length === 0}
                          onClick={handleDeleteWithNoMarks}
                        >
                          <Eraser className="w-4 h-4" />
                          {t.deleteNoMarksBtn}
                        </button>
                      </div>
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
                                filteredCompetences.length > 0 &&
                                filteredCompetences.every((c) =>
                                  selectedIds.has(c.subject_competence_id),
                                )
                              }
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th>{t.tableHeaderIndex}</th>
                          <th>{t.tableHeaderCompetence}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompetences.map((comp, index) => (
                          <tr key={comp.subject_competence_id}>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={selectedIds.has(
                                  comp.subject_competence_id,
                                )}
                                onChange={() =>
                                  toggleSelect(comp.subject_competence_id)
                                }
                              />
                            </td>
                            <td>{index + 1}</td>
                            <td>
                              {editingId === comp.subject_competence_id ? (
                                <textarea
                                  className="textarea textarea-sm w-full"
                                  rows={2}
                                  maxLength={MAX_COMPETENCE_TEXT_LENGTH}
                                  autoFocus
                                  value={editingText}
                                  onChange={(e) =>
                                    setEditingText(
                                      sanitizeSubjectTitle(
                                        e.target.value,
                                      ).slice(0, MAX_COMPETENCE_TEXT_LENGTH),
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") cancelEdit();
                                  }}
                                />
                              ) : (
                                comp.competence_text
                              )}
                            </td>
                            <td>
                              {editingId === comp.subject_competence_id ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-xs btn-primary mr-2"
                                    onClick={() => saveEdit(comp)}
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
                                  onClick={() => startEdit(comp)}
                                >
                                  {t.editBtn}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {competences.length === 0 && (
                          <tr>
                            <td colSpan={4}>
                              <p className="empty-state">{t.emptyCompetences}</p>
                            </td>
                          </tr>
                        )}
                        {competences.length > 0 &&
                          filteredCompetences.length === 0 && (
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
                </>
              )}
            </>
          )}
        </>
        )}
      </div>
    </div>
  );
};

export default SubjectCompetenceManager;
