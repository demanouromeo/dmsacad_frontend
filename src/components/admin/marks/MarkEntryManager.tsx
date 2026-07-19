import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Download,
  Eraser,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Lock,
  RefreshCw,
  Save,
  Unlock,
  Upload,
} from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { markEntryManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { MarkReader, type MarkInput } from "../../../dbmanger/MarkReader";
import type { Classe } from "../../../interfaces/Classe";
import type { SubjectClasseRow } from "../../../interfaces/SubjectClasseRow";
import type { SubjectCompetence } from "../../../interfaces/SubjectCompetence";
import type { Student } from "../../../interfaces/Student";
import type { Mark } from "../../../interfaces/Mark";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import { sanitizeMarkInput, isMarkInRange, formatMarkValue } from "../../../utils/textValidation";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { parseMarkImportFile } from "../../../utils/markImport";
import {
  buildUniqueSheetName,
  exportMarksWorkbookToXlsx,
  type MarksSheet,
} from "../../../utils/exportMarksWorkbook";
import {
  exportAllMarksReportToPdf,
  type AllMarksReportBlock,
  type AllMarksReportRow,
} from "../../../utils/exportAllMarksReport";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import FillRateChartDialog from "./FillRateChartDialog";
import { computeDbSequence } from "../../../utils/markSequence";

const TERMS = [1, 2, 3];
const SEQUENCES = [1, 2];

// Column headers for a non-APC classe's block in the "all classes" PDF report - the term's two
// sequences, always exactly these two literal labels (see exportAllMarksReport.ts).
const NON_APC_COLUMN_HEADERS = ["NOTE1", "NOTE2"];

// Raw numeric value for the "all classes" PDF report - unlike the on-screen "XX.YY" display format
// (formatMarkValue), the report shows plain numbers ("16.5", "20"), matching the reference document.
const formatReportMarkValue = (row: Mark | undefined): string =>
  row && row.isEmpty !== 1 ? String(Number(row.mark)) : "";

interface MarkEntry {
  value: string;
  isEmpty: boolean;
  dirty: boolean;
}

// "Saisie des notes" - the ADMIN mark entry screen. Structural precedent: SubjectCompetenceManager's
// classe->subject->term cascade and isLevelApc(level) split (apc_level is a per-level flag, not a
// per-classe one - see that screen's comment). Two independent modes hang off the same selectors:
// non-APC classes edit student_subject rows keyed by a derived dbsequence, APC classes edit
// stud_comp_mark rows keyed by (term, competence). lock_sequence.is_blocked is genuinely global
// (keyed only by (sy_id, seq), no classe/subject column) - see the `effectiveLockSeq` comment below
// for how APC and non-APC classes share that same `seq` axis.
const MarkEntryManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = markEntryManagerTranslations[language];
  const schoolHeader = useSchoolHeader();
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [subjects, setSubjects] = useState<SubjectClasseRow[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [selectedSequence, setSelectedSequence] = useState(SEQUENCES[0]);

  const [competences, setCompetences] = useState<SubjectCompetence[]>([]);
  const [isLoadingCompetences, setIsLoadingCompetences] = useState(false);
  const [selectedCompetenceId, setSelectedCompetenceId] = useState<number | null>(null);

  const [roster, setRoster] = useState<Student[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  const [marks, setMarks] = useState<Map<number, MarkEntry>>(new Map());
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [locks, setLocks] = useState<Map<number, boolean>>(new Map());
  const [subjectFillRates, setSubjectFillRates] = useState<Map<number, number | null>>(new Map());

  const [searchQuery, setSearchQuery] = useState("");

  // Keyed by stud_id so Up/Down can jump straight to the neighboring row's mark input without a
  // mouse click - the only way to move between marks before this. Entries are added/removed by the
  // input's own ref callback as filteredRoster (search) changes which rows are actually mounted.
  const markInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const isLevelApc = (level: number): boolean => apcLevels.get(level) === true;
  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const isApc = selectedClasse ? isLevelApc(selectedClasse.level) : false;
  const dbsequence = computeDbSequence(selectedTerm, selectedSequence);
  // lock_sequence.seq has no APC/non-APC distinction, so APC classes reuse the term id (1-3) as
  // `seq` and non-APC classes use the dbsequence (1-6) - a school mixing both class types in the
  // same year could see a term-1 APC lock collide with a dbsequence-1 non-APC lock. Inherited
  // backend limitation, not fixed here (see plan notes).
  const effectiveLockSeq = isApc ? selectedTerm : dbsequence;
  const isLocked = locks.get(effectiveLockSeq) === true;
  const selectedSubject = subjects.find((s) => s.subject_id === selectedSubjectId) ?? null;
  const selectedCompetence =
    competences.find((c) => c.subject_competence_id === selectedCompetenceId) ?? null;

  const filteredRoster = roster.filter((s) =>
    `${s.name} ${s.surname ?? ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const currentFilledCount = Array.from(marks.values()).filter((m) => !m.isEmpty).length;
  const currentFillRate = roster.length > 0 ? (currentFilledCount / roster.length) * 100 : 0;
  // apc_level's competences are per (classe, subject, term), not per-classe (see the module comment
  // above) - so an APC classe can legitimately have zero competences defined yet for the currently
  // selected subject+term. Marks can't be attached to a nonexistent competence, so the whole
  // roster/save UI is hidden in favor of this message rather than letting the user type into a
  // table that has nothing to save against.
  const apcHasNoCompetence = isApc && !isLoadingCompetences && competences.length === 0;

  // Classes + APC levels + locks - reloaded whenever connection/schoolYear/section changes.
  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, apcLevelList, lockList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
        MarkReader.fetchLocksOfYear(accessToken, connection, schoolYear),
      ]);
      const levelMap = new Map(apcLevelList.map((entry) => [entry.level, entry.activated]));
      setClasses(classeList);
      setApcLevels(levelMap);
      setLocks(new Map(lockList.map((l) => [l.seq, l.is_blocked === 1])));
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

  // Subjects + roster of the selected classe.
  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null) {
        setSubjects([]);
        setSelectedSubjectId(null);
        setRoster([]);
        return;
      }
      setIsLoadingSubjects(true);
      setIsLoadingRoster(true);
      const [subjectList, rosterList] = await Promise.all([
        SubjectReader.fetchSubjectsOfClasse(
          accessToken,
          connection,
          schoolYear,
          section,
          selectedClasseId,
        ),
        StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, selectedClasseId),
      ]);
      setSubjects(subjectList);
      setRoster(rosterList);
      setSelectedSubjectId((prev) => {
        if (prev !== null && subjectList.some((s) => s.subject_id === prev)) {
          return prev;
        }
        return subjectList.length > 0 ? subjectList[0].subject_id : null;
      });
      setIsLoadingSubjects(false);
      setIsLoadingRoster(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  // Competences of the selected (classe, subject, term) - only fetched for an APC classe.
  useEffect(() => {
    const load = async () => {
      if (!isApc || selectedClasseId === null || selectedSubjectId === null) {
        setCompetences([]);
        setSelectedCompetenceId(null);
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
      setSelectedCompetenceId((prev) => {
        if (prev !== null && list.some((c) => c.subject_competence_id === prev)) {
          return prev;
        }
        return list.length > 0 ? list[0].subject_competence_id : null;
      });
      setIsLoadingCompetences(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApc, selectedClasseId, selectedSubjectId, selectedTerm]);

  const loadMarks = async () => {
    if (selectedClasseId === null || selectedSubjectId === null) {
      setMarks(new Map());
      return;
    }
    if (isApc && selectedCompetenceId === null) {
      setMarks(new Map());
      return;
    }
    setIsLoadingMarks(true);
    const rows = isApc
      ? await MarkReader.fetchCompMarks(
          accessToken,
          connection,
          schoolYear,
          selectedClasseId,
          selectedSubjectId,
          selectedTerm,
          selectedCompetenceId as number,
        )
      : await MarkReader.fetchSeqMarks(
          accessToken,
          connection,
          schoolYear,
          selectedClasseId,
          selectedSubjectId,
          dbsequence,
        );
    const byStudId = new Map(rows.map((r) => [r.stud_id, r]));
    const next = new Map<number, MarkEntry>();
    roster.forEach((student) => {
      const row = byStudId.get(student.stud_id);
      const isEmpty = !row || row.isEmpty === 1;
      next.set(student.stud_id, {
        value: isEmpty ? "" : formatMarkValue(String(row!.mark)),
        isEmpty,
        dirty: false,
      });
    });
    setMarks(next);
    setIsLoadingMarks(false);
  };

  useEffect(() => {
    loadMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, selectedSubjectId, selectedTerm, selectedSequence, selectedCompetenceId, roster]);

  const loadFillRates = async () => {
    if (selectedClasseId === null || subjects.length === 0 || roster.length === 0) {
      setSubjectFillRates(new Map());
      return;
    }
    const classeId = selectedClasseId;
    const entries = await Promise.all(
      subjects.map(async (subject): Promise<[number, number | null]> => {
        if (isApc) {
          const subjectCompetences = await SubjectReader.fetchCompetences(
            accessToken,
            connection,
            schoolYear,
            section,
            classeId,
            subject.subject_id,
            selectedTerm,
          );
          if (subjectCompetences.length === 0) {
            return [subject.subject_id, null];
          }
          const rates = await Promise.all(
            subjectCompetences.map(async (comp) => {
              const marksList = await MarkReader.fetchCompMarks(
                accessToken,
                connection,
                schoolYear,
                classeId,
                subject.subject_id,
                selectedTerm,
                comp.subject_competence_id,
              );
              const filled = marksList.filter((m) => m.isEmpty !== 1).length;
              return (filled / roster.length) * 100;
            }),
          );
          const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
          return [subject.subject_id, avg];
        }
        const marksList = await MarkReader.fetchSeqMarks(
          accessToken,
          connection,
          schoolYear,
          classeId,
          subject.subject_id,
          dbsequence,
        );
        const filled = marksList.filter((m) => m.isEmpty !== 1).length;
        return [subject.subject_id, (filled / roster.length) * 100];
      }),
    );
    setSubjectFillRates(new Map(entries));
  };

  useEffect(() => {
    loadFillRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, selectedTerm, selectedSequence, subjects, roster, isApc]);

  const handleMarkChange = (studId: number, raw: string) => {
    let sanitized = sanitizeMarkInput(raw);
    // Reject the newest keystroke if it pushed the value out of [0, MAX_MARK_VALUE] rather than
    // waiting for blur - e.g. "5" + "2" => "52" drops back to "5", not left invalid until blur.
    while (sanitized !== "" && !isMarkInRange(sanitized)) {
      sanitized = sanitized.slice(0, -1);
    }
    setMarks((prev) => {
      const next = new Map(prev);
      next.set(studId, { value: sanitized, isEmpty: sanitized.trim() === "", dirty: true });
      return next;
    });
  };

  // Shared by blur and Enter (see handleMarkKeyDown) - both are "the user is done editing this
  // cell" moments per the "XX.YY" display-format requirement: out-of-range clears the cell (same as
  // before), otherwise the value is reformatted to the fixed 2-digit-integer/2-digit-decimal shape.
  const commitMarkFormat = (studId: number) => {
    const entry = marks.get(studId);
    if (!entry) {
      return;
    }
    if (!isMarkInRange(entry.value)) {
      showToast(t.markOutOfRange, { type: "warning" });
      setMarks((prev) => {
        const next = new Map(prev);
        next.set(studId, { ...entry, value: "", isEmpty: true });
        return next;
      });
      return;
    }
    if (entry.value.trim() === "") {
      return;
    }
    const formatted = formatMarkValue(entry.value);
    if (formatted === entry.value) {
      return;
    }
    setMarks((prev) => {
      const next = new Map(prev);
      next.set(studId, { ...entry, value: formatted });
      return next;
    });
  };

  const handleMarkBlur = (studId: number) => {
    commitMarkFormat(studId);
  };

  const handleMarkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitMarkFormat(filteredRoster[rowIndex].stud_id);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
      return;
    }
    e.preventDefault();
    const targetIndex = e.key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;
    const targetStudent = filteredRoster[targetIndex];
    if (!targetStudent) {
      return;
    }
    const targetInput = markInputRefs.current.get(targetStudent.stud_id);
    targetInput?.focus();
    targetInput?.select();
  };

  const saveRows = async (rows: MarkInput[]) => {
    if (selectedSubjectId === null) {
      return { status: false, message: "" };
    }
    return isApc
      ? MarkReader.saveCompMarks(
          accessToken,
          connection,
          schoolYear,
          selectedSubjectId,
          selectedTerm,
          selectedCompetenceId as number,
          rows,
        )
      : MarkReader.saveSeqMarks(
          accessToken,
          connection,
          schoolYear,
          selectedSubjectId,
          dbsequence,
          rows,
        );
  };

  const handleSave = async () => {
    const rows: MarkInput[] = roster
      .filter((s) => marks.get(s.stud_id)?.dirty)
      .map((s) => {
        const entry = marks.get(s.stud_id) as MarkEntry;
        return {
          stud_id: s.stud_id,
          mark: entry.isEmpty ? 0 : Number(entry.value),
          isEmpty: entry.isEmpty ? 1 : 0,
        };
      });
    if (rows.length === 0) {
      showToast(t.noMarksToSave, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await saveRows(rows);
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await loadMarks();
      loadFillRates();
    }
  };

  const handleClearAll = async () => {
    if (filteredRoster.length === 0) {
      return;
    }
    const confirmed = await confirm(t.clearAllConfirm, { danger: true });
    if (!confirmed) {
      return;
    }
    const rows: MarkInput[] = filteredRoster.map((s) => ({
      stud_id: s.stud_id,
      mark: 0,
      isEmpty: 1,
    }));
    setIsSaving(true);
    const result = await saveRows(rows);
    setIsSaving(false);
    showToast(result.status ? t.clearAllSuccess : t.clearAllFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await loadMarks();
      loadFillRates();
    }
  };

  const handleToggleLock = async () => {
    const nextLocked = !isLocked;
    setIsSaving(true);
    const result = await MarkReader.saveLock(
      accessToken,
      connection,
      schoolYear,
      effectiveLockSeq,
      nextLocked,
    );
    setIsSaving(false);
    showToast(result.status ? t.lockSuccess : t.lockFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLocks((prev) => {
        const next = new Map(prev);
        next.set(effectiveLockSeq, nextLocked);
        return next;
      });
    }
  };

  // "Seq N"/"Comp id" segment shared by the export filename and the file's own header/import
  // confirm message - Comp uses the raw subject_competence_id (not the full competence text) since
  // it must stay short and filesystem-safe.
  const periodFilenameSegment = isApc ? `Comp ${selectedCompetenceId ?? ""}` : `Seq ${selectedSequence}`;

  const handleExportMarks = () => {
    const filename = buildTimestampedFilename(
      selectedClasse?.classe_name ?? "",
      [selectedSubject?.subject_title ?? "", `Trim ${selectedTerm}`, periodFilenameSegment],
      "csv",
    );
    // Always the full roster, never filteredRoster - matches every other manager's "export ignores
    // the active search filter" convention. The mark cell is re-parsed to a plain Number rather than
    // exported as the displayed "XX.YY" string, so re-importing the same file round-trips exactly
    // and a whole mark doesn't carry a misleading ".00".
    exportRowsToCsv(
      filename,
      [
        { header: t.exportMarksColIndex, accessor: (_row: Student, index: number) => index + 1 },
        { header: t.exportMarksColStudId, accessor: (row: Student) => row.stud_id },
        { header: t.exportMarksColMatricule, accessor: (row: Student) => row.matricule ?? "" },
        {
          header: t.exportMarksColName,
          accessor: (row: Student) => `${row.name} ${row.surname ?? ""}`.trim(),
        },
        {
          header: t.exportMarksColMark,
          accessor: (row: Student) => {
            const entry = marks.get(row.stud_id);
            return entry && !entry.isEmpty && entry.value.trim() !== "" ? Number(entry.value) : "";
          },
        },
      ],
      roster,
    );
  };

  const handleImportMarksFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || selectedSubjectId === null || (isApc && selectedCompetenceId === null)) {
      return;
    }

    setIsSaving(true);
    const parsed = await parseMarkImportFile(file, roster);
    setIsSaving(false);
    if (!parsed.status) {
      switch (parsed.error.type) {
        case "unsupportedExtension":
          showToast(t.importMarksUnsupportedExtension, { type: "danger" });
          break;
        case "emptyFile":
          showToast(t.importMarksEmptyFile, { type: "danger" });
          break;
        case "unknownMatricule":
          showToast(t.importMarksUnknownMatricule(parsed.error.row, parsed.error.matricule), {
            type: "danger",
          });
          break;
        case "invalidMark":
          showToast(t.importMarksInvalidMark(parsed.error.row, parsed.error.matricule), {
            type: "danger",
          });
          break;
      }
      return;
    }

    const periodLabel = isApc
      ? `${t.termInfoLabel} ${selectedTerm} - ${t.competenceInfoLabel} ${selectedCompetence?.competence_text ?? ""}`
      : `${t.termInfoLabel} ${selectedTerm} - ${t.sequenceInfoLabel} ${selectedSequence}`;
    const confirmed = await confirm(
      t.importMarksConfirm(selectedSubject?.subject_title ?? "", periodLabel),
      { danger: true, confirmLabel: t.importMarksConfirmBtn },
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    const result = await saveRows(
      parsed.marks.map((m) => ({ stud_id: m.stud_id, mark: m.mark, isEmpty: m.isEmpty })),
    );
    setIsSaving(false);
    showToast(result.status ? t.importMarksSuccess(parsed.marks.length) : t.importMarksFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      await loadMarks();
      loadFillRates();
    }
  };

  // "All marks" toolbox - one workbook, one sheet per subject (non-APC, current term+sequence) or
  // per (subject, competence) pair (APC, current term - APC marks have no sequence axis, but do
  // still need a competence to be a valid key, so "current term" alone isn't enough to address a
  // single sheet the way it is for non-APC). Subjects/competences with nothing to export (an APC
  // subject with zero competences this term) are simply skipped, matching apcHasNoCompetence's
  // handling elsewhere on this screen.
  const handleExportAllMarks = async () => {
    if (selectedClasseId === null || subjects.length === 0) {
      showToast(t.exportAllMarksEmpty, { type: "warning" });
      return;
    }
    const classeId = selectedClasseId;
    setIsExportingAll(true);
    const usedNames = new Set<string>();
    let sheets: MarksSheet[];
    if (isApc) {
      const perSubject = await Promise.all(
        subjects.map(async (subject) => {
          const subjectCompetences = await SubjectReader.fetchCompetences(
            accessToken,
            connection,
            schoolYear,
            section,
            classeId,
            subject.subject_id,
            selectedTerm,
          );
          return Promise.all(
            subjectCompetences.map(async (comp) => {
              const rows = await MarkReader.fetchCompMarks(
                accessToken,
                connection,
                schoolYear,
                classeId,
                subject.subject_id,
                selectedTerm,
                comp.subject_competence_id,
              );
              return {
                sheetName: buildUniqueSheetName(
                  `${subject.subject_title} - ${comp.competence_text}`,
                  usedNames,
                ),
                marksByStudId: new Map(rows.map((r) => [r.stud_id, r])),
              };
            }),
          );
        }),
      );
      sheets = perSubject.flat();
    } else {
      sheets = await Promise.all(
        subjects.map(async (subject) => {
          const rows = await MarkReader.fetchSeqMarks(
            accessToken,
            connection,
            schoolYear,
            classeId,
            subject.subject_id,
            dbsequence,
          );
          return {
            sheetName: buildUniqueSheetName(subject.subject_title, usedNames),
            marksByStudId: new Map(rows.map((r) => [r.stud_id, r])),
          };
        }),
      );
    }
    const filename = buildTimestampedFilename(
      selectedClasse?.classe_name ?? "",
      isApc ? [`Trim ${selectedTerm}`] : [`Trim ${selectedTerm}`, `Seq ${selectedSequence}`],
      "xlsx",
    );
    await exportMarksWorkbookToXlsx(filename, roster, sheets, {
      index: t.exportMarksColIndex,
      studId: t.exportMarksColStudId,
      matricule: t.exportMarksColMatricule,
      name: t.exportMarksColName,
      mark: t.exportMarksColMark,
    });
    setIsExportingAll(false);
  };

  // "Notes trim N" report - a single PDF spanning EVERY classe of the current section (not just the
  // selected one, unlike every other export on this screen) for the current term, one page-per-block
  // table per (classe, subject): NOTE1/NOTE2 columns for non-APC classes (the term's two sequences),
  // one "Comp. N" column per subject-competence for APC classes (the competence's own wording is
  // deliberately not used as the header, since it can be paragraph-length - see
  // exportAllMarksReport.ts). Same "whole scope, not just what's on screen" precedent as
  // EffectifsManager's report. Fetches each classe's own subjects/roster independently (not the
  // single-selected-classe `subjects`/`roster` state above), and classes with an empty roster or APC
  // subjects with zero competences this term are skipped entirely rather than emitting an empty block.
  const handleExportAllClassesMarks = async () => {
    if (classes.length === 0) {
      showToast(t.exportAllClassesMarksEmpty, { type: "warning" });
      return;
    }
    setIsExportingReport(true);
    const blocks: AllMarksReportBlock[] = [];
    for (const classe of classes) {
      const classeIsApc = isLevelApc(classe.level);
      const [subjectList, rosterList] = await Promise.all([
        SubjectReader.fetchSubjectsOfClasse(
          accessToken,
          connection,
          schoolYear,
          section,
          classe.classe_id,
        ),
        StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classe.classe_id),
      ]);
      if (rosterList.length === 0) {
        continue;
      }
      const nameByStudId = new Map(
        rosterList.map((s) => [s.stud_id, `${s.name} ${s.surname ?? ""}`.trim()]),
      );

      if (classeIsApc) {
        const subjectBlocks = await Promise.all(
          subjectList.map(async (subject): Promise<AllMarksReportBlock | null> => {
            const subjectCompetences = await SubjectReader.fetchCompetences(
              accessToken,
              connection,
              schoolYear,
              section,
              classe.classe_id,
              subject.subject_id,
              selectedTerm,
            );
            if (subjectCompetences.length === 0) {
              return null;
            }
            const marksPerCompetence = await Promise.all(
              subjectCompetences.map((comp) =>
                MarkReader.fetchCompMarks(
                  accessToken,
                  connection,
                  schoolYear,
                  classe.classe_id,
                  subject.subject_id,
                  selectedTerm,
                  comp.subject_competence_id,
                ),
              ),
            );
            const marksByStudIdPerCompetence = marksPerCompetence.map(
              (rows) => new Map(rows.map((r) => [r.stud_id, r])),
            );
            const rows: AllMarksReportRow[] = rosterList.map((student) => ({
              studId: student.stud_id,
              name: nameByStudId.get(student.stud_id) ?? "",
              values: marksByStudIdPerCompetence.map((m) =>
                formatReportMarkValue(m.get(student.stud_id)),
              ),
            }));
            return {
              classeName: classe.classe_name,
              subjectTitle: subject.subject_title,
              columnHeaders: subjectCompetences.map((_, index) => `Comp. ${index + 1}`),
              rows,
            };
          }),
        );
        subjectBlocks.forEach((block) => {
          if (block) {
            blocks.push(block);
          }
        });
      } else {
        const dbseq1 = computeDbSequence(selectedTerm, 1);
        const dbseq2 = computeDbSequence(selectedTerm, 2);
        const subjectBlocks = await Promise.all(
          subjectList.map(async (subject): Promise<AllMarksReportBlock> => {
            const [seq1Rows, seq2Rows] = await Promise.all([
              MarkReader.fetchSeqMarks(
                accessToken,
                connection,
                schoolYear,
                classe.classe_id,
                subject.subject_id,
                dbseq1,
              ),
              MarkReader.fetchSeqMarks(
                accessToken,
                connection,
                schoolYear,
                classe.classe_id,
                subject.subject_id,
                dbseq2,
              ),
            ]);
            const seq1ByStudId = new Map(seq1Rows.map((r) => [r.stud_id, r]));
            const seq2ByStudId = new Map(seq2Rows.map((r) => [r.stud_id, r]));
            const rows: AllMarksReportRow[] = rosterList.map((student) => ({
              studId: student.stud_id,
              name: nameByStudId.get(student.stud_id) ?? "",
              values: [
                formatReportMarkValue(seq1ByStudId.get(student.stud_id)),
                formatReportMarkValue(seq2ByStudId.get(student.stud_id)),
              ],
            }));
            return {
              classeName: classe.classe_name,
              subjectTitle: subject.subject_title,
              columnHeaders: NON_APC_COLUMN_HEADERS,
              rows,
            };
          }),
        );
        blocks.push(...subjectBlocks);
      }
    }

    if (blocks.length === 0) {
      setIsExportingReport(false);
      showToast(t.exportAllClassesMarksEmpty, { type: "warning" });
      return;
    }

    const filename = buildTimestampedFilename(
      `Notes trim ${selectedTerm}`,
      [`Section ${capitalizeSectionName(section)}`],
      "pdf",
    );
    await exportAllMarksReportToPdf(schoolYear, selectedTerm, blocks, schoolHeader, filename);
    setIsExportingReport(false);
  };

  const handleExportFillRatePdf = async () => {
    const classeName = selectedClasse?.classe_name ?? "";
    await exportRowsToPdf(
      t.fillRatePdfTitle(classeName),
      buildTimestampedFilename(t.fillRatePdfTitle(classeName), [], "pdf"),
      [
        { header: t.fillRatePdfColIndex, accessor: (_row: SubjectClasseRow, index: number) => index + 1 },
        { header: t.fillRatePdfColSubject, accessor: (row: SubjectClasseRow) => row.subject_title },
        {
          header: t.fillRatePdfColRate,
          accessor: (row: SubjectClasseRow) => {
            const rate = subjectFillRates.get(row.subject_id);
            return rate === null || rate === undefined ? "…" : rate.toFixed(1);
          },
        },
      ],
      subjects,
      schoolHeader,
    );
  };

  return (
    <div className="p-10 pb-32">
      {(isSaving || isExportingAll || isExportingReport) && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>

      {isLoadingClasses ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p className="opacity-60">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
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

            <label className="font-medium ml-2">{t.subjectLabel}</label>
            <select
              className="select w-48"
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

            <button
              type="button"
              className={`btn btn-sm gap-2 ml-2 ${isLocked ? "btn-error" : "btn-neutral"}`}
              onClick={handleToggleLock}
            >
              {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {isLocked ? t.unlockBtn : t.lockBtn}
            </button>

            <label className="font-medium ml-2">{t.termLabel}</label>
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

            {isApc ? (
              <>
                <label className="font-medium ml-2">{t.competenceLabel}</label>
                <select
                  className="select w-64"
                  disabled={isLoadingCompetences || competences.length === 0}
                  value={selectedCompetenceId ?? ""}
                  onChange={(e) => setSelectedCompetenceId(Number(e.target.value))}
                >
                  {competences.map((c) => (
                    <option key={c.subject_competence_id} value={c.subject_competence_id}>
                      {c.competence_text.length > 40
                        ? `${c.competence_text.slice(0, 40)}…`
                        : c.competence_text}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="font-medium ml-2">{t.sequenceLabel}</label>
                <select
                  className="select w-36"
                  value={selectedSequence}
                  onChange={(e) => setSelectedSequence(Number(e.target.value))}
                >
                  {SEQUENCES.map((seq) => (
                    <option key={seq} value={seq}>
                      {t.sequence(seq)}
                    </option>
                  ))}
                </select>
              </>
            )}

            <input
              type="text"
              className="input w-56 ml-2"
              placeholder={t.filterPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex items-center gap-2 ml-auto">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleImportMarksFileChange}
              />
              <div className="tooltip" data-tip={t.exportMarksTooltip}>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm gap-2"
                  disabled={selectedSubjectId === null || roster.length === 0}
                  onClick={handleExportMarks}
                >
                  <FileDown className="w-4 h-4" />
                </button>
              </div>
              <div
                className="tooltip"
                data-tip={isApc ? t.exportAllMarksTooltipApc : t.exportAllMarksTooltip}
              >
                <button
                  type="button"
                  className="btn btn-neutral btn-sm gap-2"
                  disabled={subjects.length === 0 || roster.length === 0 || isExportingAll}
                  onClick={handleExportAllMarks}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
              </div>
              <div className="tooltip" data-tip={t.exportAllClassesMarksTooltip}>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm gap-2"
                  disabled={classes.length === 0 || isExportingReport}
                  onClick={handleExportAllClassesMarks}
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
              <div className="tooltip" data-tip={t.importMarksTooltip}>
                <button
                  type="button"
                  className="btn btn-neutral btn-sm gap-2"
                  disabled={
                    selectedSubjectId === null ||
                    isLocked ||
                    (isApc && selectedCompetenceId === null)
                  }
                  onClick={() => importFileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                className="btn btn-neutral btn-sm gap-2"
                onClick={() => {
                  loadMarks();
                  loadFillRates();
                }}
              >
                <RefreshCw className="w-4 h-4" />
                {t.refreshBtn}
              </button>
            </div>
          </div>

          {!isLoadingSubjects && subjects.length === 0 && (
            <p className="opacity-60 mb-4">{t.emptySubjects}</p>
          )}

          {selectedSubjectId !== null && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 bg-base-200 rounded px-4 py-2">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium">
                    {t.classeInfo(selectedClasse?.classe_name ?? "", subjects.length)}
                  </span>
                  <span className="flex items-center gap-1">
                    {t.subjectInfoLabel}
                    <span className="tooltip" data-tip={selectedSubject?.subject_title ?? ""}>
                      <Eye className="w-4 h-4" />
                    </span>
                  </span>
                  <span>
                    {t.termInfoLabel} <strong>{selectedTerm}</strong>
                  </span>
                  {isApc ? (
                    <span className="flex items-center gap-1">
                      {t.competenceInfoLabel}
                      <span
                        className="tooltip"
                        data-tip={selectedCompetence?.competence_text ?? ""}
                      >
                        <Eye className="w-4 h-4" />
                      </span>
                    </span>
                  ) : (
                    <span>
                      {t.sequenceInfoLabel} <strong>{selectedSequence}</strong>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    {t.fillRateLabel} <strong>{currentFillRate.toFixed(1)}</strong>
                  </span>
                  <span>
                    {t.totalCountLabel} <strong>{roster.length}</strong>
                  </span>
                </div>
              </div>

              {apcHasNoCompetence ? (
                <p className="text-warning mb-4">{t.noCompetenceCannotEnterMarks}</p>
              ) : (
                <>
                  {isLocked && (
                    <p className="text-warning mb-4">
                      {isApc ? t.lockedHintTerm : t.lockedHint}
                    </p>
                  )}

                  <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 overflow-x-auto">
                      {isLoadingRoster || isLoadingMarks ? (
                        <Loading />
                      ) : (
                        <table className="table w-full">
                          <thead>
                            <tr>
                              <th>{t.tableHeaderIndex}</th>
                              <th>{t.tableHeaderName} ↑</th>
                              <th>{t.tableHeaderMark}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRoster.map((student, index) => {
                              const entry = marks.get(student.stud_id) ?? {
                                value: "",
                                isEmpty: true,
                                dirty: false,
                              };
                              return (
                                <tr key={student.stud_id}>
                                  <td>{index + 1}</td>
                                  <td>
                                    {student.name} {student.surname ?? ""}
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      className="input input-sm w-20"
                                      disabled={isLocked}
                                      value={entry.value}
                                      ref={(el) => {
                                        if (el) {
                                          markInputRefs.current.set(student.stud_id, el);
                                        } else {
                                          markInputRefs.current.delete(student.stud_id);
                                        }
                                      }}
                                      onChange={(e) =>
                                        handleMarkChange(student.stud_id, e.target.value)
                                      }
                                      onBlur={() => handleMarkBlur(student.stud_id)}
                                      onKeyDown={(e) => handleMarkKeyDown(e, index)}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                            {roster.length === 0 && (
                              <tr>
                                <td colSpan={3} className="text-center opacity-60">
                                  {t.emptyRoster}
                                </td>
                              </tr>
                            )}
                            {roster.length > 0 && filteredRoster.length === 0 && (
                              <tr>
                                <td colSpan={3} className="text-center opacity-60">
                                  {t.noSearchResults}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <aside className="lg:w-72 shrink-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h2 className="font-medium">
                          {t.fillRatePanelTitle(selectedClasse?.classe_name ?? "")}
                        </h2>
                        <div className="flex gap-1 shrink-0">
                          <div className="tooltip" data-tip={t.exportFillRatePdfTooltip}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-circle"
                              disabled={subjects.length === 0}
                              onClick={handleExportFillRatePdf}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="tooltip" data-tip={t.visualizeFillRateTooltip}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs btn-circle"
                              disabled={subjects.length === 0}
                              onClick={() => setIsChartDialogOpen(true)}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {subjects.map((subject, index) => {
                          const rate = subjectFillRates.get(subject.subject_id);
                          return (
                            <li key={subject.subject_id} className="flex justify-between gap-2">
                              <span>
                                {index + 1} - {subject.subject_title}
                              </span>
                              <strong
                                className={
                                  rate !== null && rate !== undefined && rate < 100
                                    ? "text-error"
                                    : ""
                                }
                              >
                                {rate === null || rate === undefined ? "…" : rate.toFixed(1)}
                              </strong>
                            </li>
                          );
                        })}
                      </ul>
                    </aside>
                  </div>

                  <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-8 z-10">
                    <div className="tooltip" data-tip={t.clearAllTooltip}>
                      <button
                        type="button"
                        className="btn btn-circle btn-error"
                        disabled={isLocked || isSaving || filteredRoster.length === 0}
                        onClick={handleClearAll}
                      >
                        <Eraser className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="tooltip" data-tip={t.saveTooltip}>
                      <button
                        type="button"
                        className="btn btn-circle btn-primary"
                        disabled={isLocked || isSaving}
                        onClick={handleSave}
                      >
                        <Save className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <FillRateChartDialog
        isOpen={isChartDialogOpen}
        onClose={() => setIsChartDialogOpen(false)}
        title={t.fillRateChartTitle(selectedClasse?.classe_name ?? "")}
        entries={subjects.map((s) => ({
          id: s.subject_id,
          label: s.subject_title,
          rate: subjectFillRates.get(s.subject_id) ?? null,
        }))}
      />
    </div>
  );
};

export default MarkEntryManager;
