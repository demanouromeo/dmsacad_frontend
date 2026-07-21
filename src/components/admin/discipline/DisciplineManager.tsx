import { useEffect, useRef, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { disciplineManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { DisciplineReader, type DisciplineInput } from "../../../dbmanger/DisciplineReader";
import type { Classe } from "../../../interfaces/Classe";
import {
  isNonNegativeIntegerInRange,
  sanitizeNonNegativeIntegerInput,
} from "../../../utils/textValidation";
import { sanitizeSubjectTitle } from "../../../utils/subjectImport";
import {
  buildTimestampedFilename,
  exportRowsToCsv,
  exportRowsToPdf,
  type ExportColumn,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";

const TERMS = [1, 2, 3];

interface RosterStudent {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  sexe: string;
  repeating: number;
}

interface DisciplineEntry {
  absences: string;
  exclusion: string;
  lateness: string;
  consigne: string;
  warning: string;
  dismissed: boolean;
  comment: string;
  dirty: boolean;
}

type DisciplineField = "absences" | "exclusion" | "lateness" | "consigne" | "warning";

// Every editable column, in on-screen left-to-right order - keys the cellRefs map below so
// ArrowUp/ArrowDown can jump to the same column of the previous/next visible row.
type DisciplineColumn = DisciplineField | "dismissed" | "comment";

// Max accepted value per numeric column (min is always 0) - out-of-range keystrokes are rejected
// while typing, same "drop the newest keystroke" convention as MarkEntryManager's mark inputs.
const FIELD_MAX: Record<DisciplineField, number> = {
  absences: 2000,
  exclusion: 300,
  lateness: 100,
  consigne: 50,
  warning: 50,
};

// A real value of 0 displays as blank - "no incidents" reads better than a wall of zeros; the field
// is still empty-able and saves as 0 either way (handleSave's `Number(...) || 0`).
const displayCount = (value: number | undefined | null): string => (value ? String(value) : "");

// "Gestion de la discipline" - classe+term scoped like MarkEntryManager, and reusing its "no
// per-row Modifier/Enregistrer toggle, every cell always editable, one global Save" pattern (the
// only existing precedent for this shape in the app) rather than the per-cell click-to-edit the
// reference screenshot's pencil icons might otherwise suggest - confirmed with the user, the pencil
// is decorative here. Backed entirely by existing, previously-unused backend endpoints
// (StudentController::allStudentsOfClasseForAbs/getDisciplineOfClasse/saveOrUpdateABS) - no backend
// changes were needed.
const DisciplineManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = disciplineManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [entries, setEntries] = useState<Map<number, DisciplineEntry>>(new Map());
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // Keyed by "field:stud_id" so ArrowUp/ArrowDown can jump straight to the same column in the
  // previous/next *visible* row (respecting the active search filter), same pattern as
  // MarkEntryManager's markInputRefs - just one ref map shared across every column here instead of
  // one column. Entries are added/removed by each cell's own ref callback as filteredRoster changes
  // which rows are actually mounted.
  const cellRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());
  const cellKey = (field: DisciplineColumn, studId: number): string => `${field}:${studId}`;
  const registerCellRef =
    (field: DisciplineColumn, studId: number) => (el: HTMLInputElement | HTMLSelectElement | null) => {
      if (el) {
        cellRefs.current.set(cellKey(field, studId), el);
      } else {
        cellRefs.current.delete(cellKey(field, studId));
      }
    };
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    field: DisciplineColumn,
    rowIndex: number,
  ) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
      return;
    }
    e.preventDefault();
    const targetIndex = e.key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;
    const targetStudent = filteredRoster[targetIndex];
    if (!targetStudent) {
      return;
    }
    const target = cellRefs.current.get(cellKey(field, targetStudent.stud_id));
    target?.focus();
    if (target instanceof HTMLInputElement) {
      target.select();
    }
  };

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const filteredRoster = roster.filter((s) =>
    `${s.name} ${s.surname ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  // Filles/Garçons/Total/Redoublants/Nouveaux, computed client-side from the full (unfiltered)
  // roster - same convention as StudentManager's own stats bar, "Nouveaux" = Total - Redoublants.
  const stats = {
    filles: roster.filter((s) => s.sexe === "F").length,
    garcons: roster.filter((s) => s.sexe === "M").length,
    total: roster.length,
    redoublants: roster.filter((s) => s.repeating === 1).length,
  };
  const nouveaux = stats.total - stats.redoublants;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const classeList = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(classeList);
      setSelectedClasseId((prev) => {
        if (prev !== null && classeList.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return classeList.length > 0 ? classeList[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  // Roster seed (allStudentsOfClasseForAbs) with the real `repeating` flag overlaid from the
  // student_classe pivot - same "seed + pivot merge" StudentManager already does, since
  // allStudentsOfClasseForAbs hardcodes repeating to 0.
  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null) {
        setRoster([]);
        return;
      }
      setIsLoadingRoster(true);
      const [seedRows, pivotRows] = await Promise.all([
        DisciplineReader.fetchRosterForAbs(accessToken, connection, schoolYear, selectedClasseId),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, selectedClasseId),
      ]);
      const pivotByStudId = new Map(pivotRows.map((p) => [p.stud_id, p]));
      setRoster(
        seedRows.map((s) => ({
          stud_id: s.stud_id,
          matricule: s.matricule,
          name: s.name,
          surname: s.surname,
          sexe: s.sexe,
          repeating: pivotByStudId.get(s.stud_id)?.repeating ? 1 : 0,
        })),
      );
      setIsLoadingRoster(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  const loadEntries = async () => {
    if (selectedClasseId === null || roster.length === 0) {
      setEntries(new Map());
      return;
    }
    setIsLoadingEntries(true);
    const rows = await DisciplineReader.fetchDisciplineOfClasse(
      accessToken,
      connection,
      schoolYear,
      selectedTerm,
      selectedClasseId,
    );
    const byStudId = new Map(rows.map((r) => [r.stud_id, r]));
    const next = new Map<number, DisciplineEntry>();
    roster.forEach((student) => {
      const real = byStudId.get(student.stud_id);
      next.set(student.stud_id, {
        absences: displayCount(real?.absunjust),
        exclusion: displayCount(real?.nb_jour_exclusion),
        lateness: displayCount(real?.lateness),
        consigne: displayCount(real?.consigne),
        warning: displayCount(real?.avertissement),
        dismissed: real?.exclusion_definitive === 1,
        comment: real?.commentOnDiscipline ?? "",
        dirty: false,
      });
    });
    setEntries(next);
    setIsLoadingEntries(false);
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, selectedTerm, roster]);

  const handleFieldChange = (studId: number, field: DisciplineField, raw: string) => {
    let sanitized = sanitizeNonNegativeIntegerInput(raw);
    const max = FIELD_MAX[field];
    while (sanitized !== "" && !isNonNegativeIntegerInRange(sanitized, max)) {
      sanitized = sanitized.slice(0, -1);
    }
    setEntries((prev) => {
      const entry = prev.get(studId);
      if (!entry) {
        return prev;
      }
      const next = new Map(prev);
      next.set(studId, { ...entry, [field]: sanitized, dirty: true });
      return next;
    });
  };

  const handleDismissedChange = (studId: number, dismissed: boolean) => {
    setEntries((prev) => {
      const entry = prev.get(studId);
      if (!entry) {
        return prev;
      }
      const next = new Map(prev);
      next.set(studId, { ...entry, dismissed, dirty: true });
      return next;
    });
  };

  const handleCommentChange = (studId: number, raw: string) => {
    const comment = sanitizeSubjectTitle(raw);
    setEntries((prev) => {
      const entry = prev.get(studId);
      if (!entry) {
        return prev;
      }
      const next = new Map(prev);
      next.set(studId, { ...entry, comment, dirty: true });
      return next;
    });
  };

  const handleSave = async () => {
    const rows: DisciplineInput[] = roster
      .filter((s) => entries.get(s.stud_id)?.dirty)
      .map((s) => {
        const entry = entries.get(s.stud_id) as DisciplineEntry;
        return {
          stud_id: s.stud_id,
          nbAbs: Number(entry.absences) || 0,
          exclusion: Number(entry.exclusion) || 0,
          lateness: Number(entry.lateness) || 0,
          consigne: Number(entry.consigne) || 0,
          avertissement: Number(entry.warning) || 0,
          dismissed: entry.dismissed ? 1 : 0,
          comment: entry.comment,
        };
      });
    if (rows.length === 0) {
      showToast(t.noChangesToSave, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await DisciplineReader.saveDiscipline(
      accessToken,
      connection,
      schoolYear,
      selectedTerm,
      rows,
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await loadEntries();
    }
  };

  const exportColumns: ExportColumn<RosterStudent>[] = [
    { header: t.tableHeaderIndex, accessor: (_row, index) => index + 1 },
    { header: t.tableHeaderName, accessor: (row) => `${row.name} ${row.surname ?? ""}`.trim() },
    { header: t.tableHeaderAbsences, accessor: (row) => entries.get(row.stud_id)?.absences ?? "" },
    { header: t.tableHeaderExclusion, accessor: (row) => entries.get(row.stud_id)?.exclusion ?? "" },
    { header: t.tableHeaderLateness, accessor: (row) => entries.get(row.stud_id)?.lateness ?? "" },
    { header: t.tableHeaderConsigne, accessor: (row) => entries.get(row.stud_id)?.consigne ?? "" },
    { header: t.tableHeaderWarning, accessor: (row) => entries.get(row.stud_id)?.warning ?? "" },
    {
      header: t.tableHeaderDismiss,
      accessor: (row) => (entries.get(row.stud_id)?.dismissed ? t.dismissYes : t.dismissNo),
    },
    { header: t.tableHeaderComment, accessor: (row) => entries.get(row.stud_id)?.comment ?? "" },
  ];

  const handleExportExcel = () => {
    const title = t.pdfTitle(selectedClasse?.classe_name ?? "", selectedTerm);
    exportRowsToCsv(buildTimestampedFilename(title, [], "csv"), exportColumns, roster);
  };

  const handleExportPdf = async () => {
    const title = t.pdfTitle(selectedClasse?.classe_name ?? "", selectedTerm);
    await exportRowsToPdf(
      title,
      buildTimestampedFilename(title, [], "pdf"),
      exportColumns,
      roster,
      schoolHeader,
    );
  };

  return (
    <div className="p-10 pb-32">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>

      {isLoadingClasses ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p className="opacity-60">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="w-full bg-base-200/60 border border-base-content/10 rounded-2xl p-4 md:p-6 mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <label className="font-medium">{t.classeLabel}</label>
                <select
                  className="select w-48"
                  value={selectedClasseId ?? ""}
                  onChange={(e) => setSelectedClasseId(Number(e.target.value))}
                >
                  {classes.map((c) => (
                    <option key={c.classe_id} value={c.classe_id}>
                      {c.classe_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-medium">{t.termLabel}</label>
                <select
                  className="select w-36"
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(Number(e.target.value))}
                >
                  {TERMS.map((term) => (
                    <option key={term} value={term}>
                      {t.term(term)}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                className="input w-64"
                placeholder={t.filterPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-neutral btn-sm gap-2"
                onClick={() => {
                  loadEntries();
                }}
              >
                <RefreshCw className="w-4 h-4" />
                {t.refreshBtn}
              </button>
              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPdf}
                excelLabel={t.exportExcelLabel}
                pdfLabel={t.exportPdfLabel}
                disabled={roster.length === 0}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-base-100 rounded-xl px-4 py-2">
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  {t.statFilles}: <strong>{stats.filles}</strong>
                </span>
                <span>
                  {t.statGarcons}: <strong>{stats.garcons}</strong>
                </span>
                <span>
                  {t.statTotal}: <strong>{stats.total}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span>
                  {t.statRedoublants}: <strong>{stats.redoublants}</strong>
                </span>
                <span>
                  {t.statNouveaux}: <strong>{nouveaux}</strong>
                </span>
              </div>
            </div>
          </div>

          {isLoadingRoster || isLoadingEntries ? (
            <Loading />
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>{t.tableHeaderIndex}</th>
                    <th>{t.tableHeaderName} ↑</th>
                    <th>{t.tableHeaderAbsences}</th>
                    <th>{t.tableHeaderExclusion}</th>
                    <th>{t.tableHeaderLateness}</th>
                    <th>{t.tableHeaderConsigne}</th>
                    <th>{t.tableHeaderWarning}</th>
                    <th>{t.tableHeaderDismiss}</th>
                    <th>{t.tableHeaderComment}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map((student, index) => {
                    const entry = entries.get(student.stud_id);
                    if (!entry) {
                      return null;
                    }
                    return (
                      <tr key={student.stud_id}>
                        <td>{index + 1}</td>
                        <td>
                          {student.name} {student.surname ?? ""}
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="input input-sm w-16"
                            value={entry.absences}
                            ref={registerCellRef("absences", student.stud_id)}
                            onChange={(e) =>
                              handleFieldChange(student.stud_id, "absences", e.target.value)
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, "absences", index)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="input input-sm w-16"
                            value={entry.exclusion}
                            ref={registerCellRef("exclusion", student.stud_id)}
                            onChange={(e) =>
                              handleFieldChange(student.stud_id, "exclusion", e.target.value)
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, "exclusion", index)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="input input-sm w-16"
                            value={entry.lateness}
                            ref={registerCellRef("lateness", student.stud_id)}
                            onChange={(e) =>
                              handleFieldChange(student.stud_id, "lateness", e.target.value)
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, "lateness", index)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="input input-sm w-16"
                            value={entry.consigne}
                            ref={registerCellRef("consigne", student.stud_id)}
                            onChange={(e) =>
                              handleFieldChange(student.stud_id, "consigne", e.target.value)
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, "consigne", index)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="input input-sm w-16"
                            value={entry.warning}
                            ref={registerCellRef("warning", student.stud_id)}
                            onChange={(e) =>
                              handleFieldChange(student.stud_id, "warning", e.target.value)
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, "warning", index)}
                          />
                        </td>
                        <td>
                          <select
                            className="select select-sm w-24"
                            value={entry.dismissed ? "1" : "0"}
                            ref={registerCellRef("dismissed", student.stud_id)}
                            onChange={(e) =>
                              handleDismissedChange(student.stud_id, e.target.value === "1")
                            }
                            onKeyDown={(e) => handleCellKeyDown(e, "dismissed", index)}
                          >
                            <option value="0">{t.dismissNo}</option>
                            <option value="1">{t.dismissYes}</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="input input-sm w-56"
                            value={entry.comment}
                            ref={registerCellRef("comment", student.stud_id)}
                            onChange={(e) => handleCommentChange(student.stud_id, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, "comment", index)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center opacity-60">
                        {t.emptyRoster}
                      </td>
                    </tr>
                  )}
                  {roster.length > 0 && filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center opacity-60">
                        {t.noSearchResults}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10">
            <div className="tooltip" data-tip={t.saveTooltip}>
              <button
                type="button"
                className="btn btn-circle btn-primary"
                disabled={isSaving}
                onClick={handleSave}
              >
                <Save className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DisciplineManager;
