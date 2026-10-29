import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eraser, ImagePlus, Printer, Search, RefreshCw, Upload, Wand2 } from "lucide-react";
import changeClasseIcon from "../../../assets/compo/eleve/change.png";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm, useConfirmChoice } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  studentManagerTranslations,
  exportTranslations,
} from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import type { Classe } from "../../../interfaces/Classe";
import type { Student } from "../../../interfaces/Student";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import SearchInput from "../../sharedcomp/SearchInput";
import ExportButtons from "../../sharedcomp/ExportButtons";
import StudentPhotoCell from "./StudentPhotoCell";
import StudentPhotoDialog from "./StudentPhotoDialog";
import ChangeClasseDialog from "./ChangeClasseDialog";
import StudentSearchDialog from "./StudentSearchDialog";
import { parsePhotoFileNumber, preparePhotoForUpload } from "../../../utils/studentPhotoImport";
import { loadSchoolHeader, useSchoolHeader } from "../../../hooks/useSchoolHeader";
import {
  sanitizeStudentName,
  parseStudentImportFile,
} from "../../../utils/studentImport";
import { findClasseByName } from "../../../utils/classeMatch";
import { generateUniqueMatricule } from "../../../utils/matricule";
import { stripHtmlTags } from "../../../utils/apiErrors";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToXlsx,
} from "../../../utils/exportData";
import {
  drawPdfLetterhead,
  drawPdfFooters,
  drawPdfSignature,
  type SchoolHeader,
} from "../../../utils/exportHeader";
import { exportAttendanceSheetsToPdf } from "../../../utils/exportAttendanceSheets";
import { saveOrShareBlob } from "../../../utils/nativeFileSave";
import {
  mapWithConcurrency,
  DEFAULT_REPORT_CONCURRENCY,
} from "../../../utils/concurrency";
import type { jsPDF } from "jspdf";

type AutoTableFn = typeof import("jspdf-autotable").default;

const MIN_NAME_LENGTH = 2;

interface EditableFields {
  name: string;
  surname: string;
  bday: string;
  bplace: string;
  sexe: "M" | "F";
  repeating: boolean;
  handicape: boolean;
}

// One-shot "Manage students" screen scoped to a single classe at a time (like SubjectClasseManager/
// SubjectCompetenceManager) - allStudentsOfClasse hardcodes repeating/cas_social to 0, so the real
// values are merged in from allStudClassOfAClasse (the student_classe pivot) by stud_id. Phone/parent
// linkage is deliberately out of scope - there's no backend parent module yet (no StudParentController/
// routes), so unlike the reference mockup this screen has no Phone filter/column.
const StudentManager = () => {
  const { connection, schoolYear, section, accessToken, authPayload } =
    useAuth();
  // Only ADMIN can add/delete/import students (SUBADMIN and CENSEUR cannot).
  const canAddOrDeleteStudents = authPayload?.role === "ADMIN";
  // changeStudentClasse is in the backend's ADMIN group (SUBADMIN passes it too, CENSEUR doesn't).
  const canChangeClasse =
    authPayload?.role === "ADMIN" || authPayload?.role === "SUBADMIN";
  const showToast = useToast();
  const confirm = useConfirm();
  const confirmChoice = useConfirmChoice();
  const location = useLocation();
  const navigate = useNavigate();
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newFields, setNewFields] = useState<EditableFields>({
    name: "",
    surname: "",
    bday: "",
    bplace: "",
    sexe: "M",
    repeating: false,
    handicape: false,
  });
  const [newMatricule, setNewMatricule] = useState("");
  const [isGeneratingMatricule, setIsGeneratingMatricule] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFields, setEditingFields] = useState<EditableFields | null>(
    null,
  );
  const [editingMatricule, setEditingMatricule] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const photosFolderInputRef = useRef<HTMLInputElement>(null);

  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [changeClasseStudent, setChangeClasseStudent] = useState<Student | null>(null);
  const [photoDialogStudent, setPhotoDialogStudent] = useState<Student | null>(
    null,
  );
  const [photoVersions, setPhotoVersions] = useState<Record<number, number>>(
    {},
  );
  const bumpPhotoVersion = (studId: number) => {
    setPhotoVersions((prev) => ({
      ...prev,
      [studId]: (prev[studId] ?? 0) + 1,
    }));
  };

  const selectedClasse =
    classes.find((c) => c.classe_id === selectedClasseId) ?? null;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const list = await ClasseReader.fetchClasses(
        accessToken,
        connection,
        schoolYear,
        section,
      );
      // CENSEUR can only manage students of the classes they're assigned to as VP (Classe.vp_id,
      // matched against the JWT's user_id) - same precedent as DisciplineManager's SG scoping.
      // ADMIN sees every classe.
      const visibleClasses =
        authPayload?.role === "CENSEUR"
          ? list.filter((c) => c.vp_id === authPayload.user_id)
          : list;
      setClasses(visibleClasses);
      // Lindsay (the app assistant) can navigate here with a target classe name in nav state
      // (e.g. "Affiche les élèves de 5ème A") - honor it once, ahead of the usual
      // prev-still-valid/first-classe fallback, then clear it so revisiting this screen later
      // (sidebar, back button) doesn't keep re-forcing the same classe.
      const navState = location.state as { initialClasseName?: string } | null;
      const preselected = navState?.initialClasseName
        ? findClasseByName(navState.initialClasseName, visibleClasses)
        : null;
      setSelectedClasseId((prev) => {
        if (preselected) return preselected.classe_id;
        if (prev !== null && visibleClasses.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return visibleClasses.length > 0 ? visibleClasses[0].classe_id : null;
      });
      if (navState?.initialClasseName) {
        navigate(location.pathname, { replace: true, state: null });
      }
      setIsLoadingClasses(false);
    };
    load();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  // Roster of one classe with the pivot's real repeating/cas_social merged in (see
  // CLAUDE.md "Students"), sorted by name - shared by the on-screen list and "Print all".
  const fetchMergedStudents = async (classeId: number): Promise<Student[]> => {
    const [studentRows, pivotRows] = await Promise.all([
      StudentReader.fetchStudentsOfClasse(
        accessToken,
        connection,
        schoolYear,
        classeId,
      ),
      StudentReader.fetchStudentClasseOfClasse(
        accessToken,
        connection,
        schoolYear,
        classeId,
      ),
    ]);
    const pivotByStudId = new Map(pivotRows.map((p) => [p.stud_id, p]));
    return studentRows
      .map((s) => {
        const pivot = pivotByStudId.get(s.stud_id);
        return {
          ...s,
          repeating: pivot?.repeating ? 1 : 0,
          cas_social: pivot?.cas_social ? 1 : 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const loadStudents = async (classeId: number) => {
    setIsLoadingStudents(true);
    const merged = await fetchMergedStudents(classeId);
    setStudents(merged);
    setSelectedIds(new Set());
    setIsLoadingStudents(false);
  };

  useEffect(() => {
    if (selectedClasseId !== null) {
      loadStudents(selectedClasseId);
    } else {
      setStudents([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  const resetAddForm = () => {
    setNewFields({
      name: "",
      surname: "",
      bday: "",
      bplace: "",
      sexe: "M",
      repeating: false,
      handicape: false,
    });
    setNewMatricule("");
  };

  const handleGenerateMatricule = async () => {
    if (!selectedClasse) {
      return;
    }
    setIsGeneratingMatricule(true);
    const all = await StudentReader.fetchAllStudentsOfYear(
      accessToken,
      connection,
      schoolYear,
    );
    const existing = new Set(
      all.map((s) => s.matricule).filter((m): m is string => Boolean(m)),
    );
    setIsGeneratingMatricule(false);
    setNewMatricule(
      generateUniqueMatricule(
        schoolYear,
        selectedClasse.classe_name,
        section,
        existing,
      ),
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClasseId === null) {
      return;
    }
    const trimmedName = newFields.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH) {
      showToast(t.nameRequired, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.saveAStudent(
      accessToken,
      connection,
      schoolYear,
      selectedClasseId,
      {
        name: trimmedName,
        surname: newFields.surname.trim(),
        bday: newFields.bday,
        bplace: newFields.bplace.trim(),
        sexe: newFields.sexe,
        repeating: newFields.repeating,
        handicape: newFields.handicape,
        cas_social: false,
        matricule: newMatricule.trim(),
      },
    );
    setIsSaving(false);
    showToast(result.status ? t.addSuccess : t.addFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      resetAddForm();
      loadStudents(selectedClasseId);
    }
  };

  const startEdit = (student: Student) => {
    setEditingId(student.stud_id);
    setEditingFields({
      name: student.name,
      surname: student.surname ?? "",
      bday: student.bday ?? "",
      bplace: student.bplace ?? "",
      sexe: student.sexe === "F" ? "F" : "M",
      repeating: student.repeating === 1,
      handicape: student.handicape === 1,
    });
    setEditingMatricule(student.matricule ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingFields(null);
    setEditingMatricule("");
  };

  const saveEdit = async (student: Student) => {
    if (!editingFields) {
      return;
    }
    const trimmedName = editingFields.name.trim();
    if (trimmedName.length < MIN_NAME_LENGTH) {
      showToast(t.nameRequired, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.updateStudents(
      accessToken,
      connection,
      schoolYear,
      [
        {
          stud_id: student.stud_id,
          name: trimmedName,
          surname: editingFields.surname.trim(),
          bday: editingFields.bday,
          bplace: editingFields.bplace.trim(),
          sexe: editingFields.sexe,
          repeating: editingFields.repeating,
          handicape: editingFields.handicape,
          cas_social: student.cas_social === 1,
          matricule: editingMatricule.trim(),
        },
      ],
    );
    setIsSaving(false);
    showToast(result.status ? t.updateSuccess : t.updateFailure, {
      type: result.status ? "info" : "danger",
    });
    cancelEdit();
    if (result.status && selectedClasseId !== null) {
      loadStudents(selectedClasseId);
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
    const filteredIds = filteredStudents.map((s) => s.stud_id);
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
    const result = await StudentReader.deleteStudents(
      accessToken,
      connection,
      schoolYear,
      Array.from(selectedIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status && selectedClasseId !== null) {
      loadStudents(selectedClasseId);
    }
  };

  // Confirm, then move the student to the target classe for the current year (the backend deletes
  // the old enrollment, creates the new one and copies marks of same-titled subjects).
  const handleChangeClasse = async (targetClasseId: number) => {
    const student = changeClasseStudent;
    const from = classes.find((c) => c.classe_id === selectedClasseId);
    const to = classes.find((c) => c.classe_id === targetClasseId);
    if (!student || !from || !to) {
      return;
    }
    const fullName = `${student.name} ${student.surname ?? ""}`.trim();
    const confirmed = await confirm(
      t.changeClasseConfirm(fullName, from.classe_name, to.classe_name),
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.changeStudentClasse(
      accessToken,
      connection,
      schoolYear,
      student.stud_id,
      from.classe_id,
      to.classe_id,
    );
    setIsSaving(false);
    showToast(result.status ? t.changeClasseSuccess : t.changeClasseFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setChangeClasseStudent(null);
      loadStudents(from.classe_id);
    }
  };

  // School-wide database cleanup (confirm first), then reload the current roster to show the result.
  const handleCleanBirthDates = async () => {
    if (!(await confirm(t.cleanBirthDatesConfirm))) {
      return;
    }
    setIsSaving(true);
    const updated = await StudentReader.cleanBirthDates(accessToken, connection);
    setIsSaving(false);
    if (updated === null) {
      showToast(t.cleanBirthDatesFailure, { type: "danger" });
      return;
    }
    showToast(t.cleanBirthDatesDone(updated), { type: "info" });
    if (selectedClasseId !== null) {
      loadStudents(selectedClasseId);
    }
  };

  // Folder import: file `k.<ext>` goes to the student numbered k in the current classe (the Nº
  // column, i.e. position in the full roster, ignoring any active search). Every photo is first
  // brought under the backend's 500 KB limit (see preparePhotoForUpload), then uploaded through the
  // same endpoint as the single-photo dialog.
  const handlePhotosFolderChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!selectedClasse) {
      return;
    }
    // An empty folder, or one with no png/jpg/jpeg named `<number>.<ext>`, ends up here too.
    if (files.length === 0) {
      showToast(t.importPhotosNoMatch, { type: "warning" });
      return;
    }
    const byNumber = new Map<number, File>();
    files.forEach((file) => {
      const n = parsePhotoFileNumber(file.name);
      if (n !== null) {
        byNumber.set(n, file);
      }
    });
    if (byNumber.size === 0) {
      showToast(t.importPhotosNoMatch, { type: "warning" });
      return;
    }
    const jobs = Array.from(byNumber.entries())
      .filter(([n]) => n <= students.length)
      .map(([n, file]) => ({ student: students[n - 1], file }));
    const noStudent = byNumber.size - jobs.length;
    if (jobs.length === 0) {
      showToast(t.importPhotosDone(0, noStudent, 0), { type: "warning" });
      return;
    }
    const confirmed = await confirm(
      t.importPhotosConfirm(jobs.length, selectedClasse.classe_name),
    );
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const results = await mapWithConcurrency(
      jobs,
      DEFAULT_REPORT_CONCURRENCY,
      async ({ student, file }) => {
        const blob = await preparePhotoForUpload(file);
        if (!blob) {
          return false;
        }
        const result = await StudentReader.uploadStudentPhoto(
          accessToken,
          connection,
          student.stud_id,
          blob,
        );
        if (result.status) {
          bumpPhotoVersion(student.stud_id);
        }
        return result.status;
      },
    );
    setIsSaving(false);
    const ok = results.filter(Boolean).length;
    const failed = results.length - ok;
    showToast(t.importPhotosDone(ok, noStudent, failed), {
      type: failed > 0 || ok === 0 ? "warning" : "info",
    });
  };

  const persistImportedStudents = async (
    rows: {
      name: string;
      surname: string;
      matricule: string;
      sexe: "M" | "F";
      bday: string;
      bplace: string;
      repeating: boolean;
    }[],
    override: boolean,
  ) => {
    if (selectedClasseId === null) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.saveManyStudents(
      accessToken,
      connection,
      schoolYear,
      selectedClasseId,
      override,
      rows.map((row) => ({
        name: row.name,
        surname: row.surname,
        bday: row.bday,
        bplace: row.bplace,
        sexe: row.sexe,
        repeating: row.repeating,
        handicape: false,
        cas_social: false,
        matricule: row.matricule,
      })),
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.importSuccess(rows.length), { type: "info" });
      loadStudents(selectedClasseId);
    } else {
      const detail = stripHtmlTags(result.message);
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
    if (!file || selectedClasseId === null) {
      return;
    }

    setIsSaving(true);
    const parsed = await parseStudentImportFile(file);
    setIsSaving(false);
    if (!parsed.status) {
      switch (parsed.error.type) {
        case "unsupportedExtension":
          showToast(t.importUnsupportedExtension, { type: "danger" });
          break;
        case "emptyFile":
          showToast(t.importEmptyFile, { type: "danger" });
          break;
        case "badHeader":
          showToast(t.importBadHeader, { type: "danger" });
          break;
        case "emptyName":
          showToast(t.importEmptyName(parsed.error.row), { type: "danger" });
          break;
      }
      return;
    }

    const choice = await confirmChoice(t.importDeleteExistingQuestion, {
      confirmLabel: t.importDeleteBtn,
      cancelLabel: t.importAddWithoutDeleteBtn,
      extraCancel: true,
    });
    // Third button (or Escape/backdrop): the user no longer wants to import - nothing is saved.
    if (choice === "cancel") {
      return;
    }

    if (choice === "yes") {
      const reallyDelete = await confirm(t.importDeleteConfirmAgain, {
        danger: true,
        confirmLabel: t.importDeleteFinalBtn,
      });
      if (!reallyDelete) {
        return;
      }
      await persistImportedStudents(parsed.students, true);
      return;
    }

    await persistImportedStudents(parsed.students, false);
  };

  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.surname ?? "").toLowerCase().includes(q) ||
      (s.matricule ?? "").toLowerCase().includes(q) ||
      (s.bplace ?? "").toLowerCase().includes(q)
    );
  });

  const stats = {
    filles: students.filter((s) => s.sexe === "F").length,
    //garcons: students.filter((s) => s.sexe === "M").length,
    garcons: students.length - students.filter((s) => s.sexe === "F").length,
    total: students.length,
    redoublants: students.filter((s) => s.repeating === 1).length,
    handicapes: students.filter((s) => s.handicape === 1).length,
    casSocial: students.filter((s) => s.cas_social === 1).length,
  };
  const nouveaux = stats.total - stats.redoublants;

  // Some student records store bday as a full ISO datetime ("2008-07-14T00:00:00.000Z") instead of
  // a plain date - strip the time/zone portion for the printed PDF so it always reads as just
  // "2008-07-14". Already-plain values ("16/08/2012", "2011-01-01") have no "T" and pass through
  // untouched.
  const formatBdayForPdf = (bday: string | null | undefined): string => {
    if (!bday) {
      return "";
    }
    const isoDateMatch = bday.match(/^(\d{4}-\d{2}-\d{2})T/);
    return isoDateMatch ? isoDateMatch[1] : bday;
  };

  // Birth place has no fixed-width column of its own in the PDF (unlike Nom/Prénom's autotable
  // "ellipsize" style) - cap it at 15 characters here instead, trimming to 14 + "…" so the shown
  // value (ellipsis included) never exceeds 15.
  const MAX_BPLACE_LENGTH_PDF = 15;
  const formatBplaceForPdf = (bplace: string | null | undefined): string => {
    const value = bplace ?? "";
    return value.length > MAX_BPLACE_LENGTH_PDF
      ? `${value.slice(0, MAX_BPLACE_LENGTH_PDF - 1)}…`
      : value;
  };

  const exportColumns = [
    {
      header: t.tableHeaderMatricule,
      accessor: (s: Student) => s.matricule ?? "",
    },
    { header: t.tableHeaderName, accessor: (s: Student) => s.name },
    { header: t.tableHeaderSurname, accessor: (s: Student) => s.surname ?? "" },
    { header: t.tableHeaderBday, accessor: (s: Student) => s.bday ?? "" },
    { header: t.tableHeaderBplace, accessor: (s: Student) => s.bplace ?? "" },
    { header: t.tableHeaderSexe, accessor: (s: Student) => s.sexe },
    {
      header: t.tableHeaderRepeating,
      accessor: (s: Student) =>
        s.repeating === 1 ? t.repeatingYes : t.repeatingNo,
    },
  ];

  // Mostly the same columns as exportColumns (CSV/Excel keeps Name and Surname separate), but the
  // printed PDF prepends a visible Nº column (CSV/Excel already has an implicit row number via the
  // spreadsheet itself) and merges Name+Surname into one wider "Nom/Prénom" column so a student's
  // full name has more room to fit on a single row of the table.
  const pdfExportColumns = [
    {
      header: t.tableHeaderIndex,
      accessor: (_s: Student, index: number) => index + 1,
    },
    {
      header: t.tableHeaderMatricule,
      accessor: (s: Student) => s.matricule ?? "",
    },
    {
      header: t.tableHeaderNameSurname,
      accessor: (s: Student) => `${s.name} ${s.surname ?? ""}`.trim(),
    },
    {
      header: t.tableHeaderBday,
      accessor: (s: Student) => formatBdayForPdf(s.bday),
    },
    {
      header: t.tableHeaderBplace,
      accessor: (s: Student) => formatBplaceForPdf(s.bplace),
    },
    { header: t.tableHeaderSexe, accessor: (s: Student) => s.sexe },
    {
      header: "Red.",
      accessor: (s: Student) =>
        s.repeating === 1 ? t.repeatingYes : t.repeatingNo,
    },
  ];

  const handleExportExcel = () => {
    if (!selectedClasse) {
      return;
    }
    exportRowsToXlsx(
      buildTimestampedFilename(
        "Liste des élèves",
        [
          `Classe ${selectedClasse.classe_name}`,
          `Section ${capitalizeSectionName(section)}`,
        ],
        "xlsx",
      ),
      exportColumns,
      students,
    );
  };

  // Custom layout instead of the generic exportRowsToPdf: this document needs a title block
  // (title left, "Année Scolaire"/"Classe" labels, a small G/F/T stats grid on the right) inserted
  // right after the letterhead, which the generic single-line title exporter can't produce.
  // Draws one classe's full list (letterhead, title block, G/F/T grid, table, signature) starting
  // on the doc's current page - callers add a page first for every classe after the first.
  const drawClassePage = (
    doc: jsPDF,
    autoTable: AutoTableFn,
    classe: Classe,
    rows: Student[],
    header: SchoolHeader,
  ) => {
    const classeStats = {
      filles: rows.filter((s) => s.sexe === "F").length,
      garcons: rows.length - rows.filter((s) => s.sexe === "F").length,
      total: rows.length,
    };
    const pageWidth = doc.internal.pageSize.getWidth();
    const blockTop = drawPdfLetterhead(doc, header);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(t.printTitle, 14, blockTop + 0);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(t.printYearLabel, 14, blockTop + 8);
    doc.setFont("helvetica", "bold");
    doc.text(
      schoolYear,
      14 + doc.getTextWidth(`${t.printYearLabel} `),
      blockTop + 8,
    );

    const classeBlockX = pageWidth * 0.42;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(t.printClasseLabel, classeBlockX, blockTop);
    doc.setFont("helvetica", "bold");
    doc.text(
      classe.classe_name,
      classeBlockX + doc.getTextWidth(`${t.printClasseLabel} `),
      blockTop,
    );

    doc.setFont("helvetica", "normal");
    doc.text(t.printSectionLabel, classeBlockX, blockTop + 8);
    doc.setFont("helvetica", "bold");
    doc.text(
      capitalizeSectionName(section),
      classeBlockX + doc.getTextWidth(`${t.printSectionLabel} `),
      blockTop + 8,
    );

    autoTable(doc, {
      startY: blockTop - 6,
      margin: { left: pageWidth - 60 },
      tableWidth: 46,
      theme: "grid",
      styles: {
        halign: "center",
        valign: "middle",
        // Compact stats grid: vertical padding is small (autotable default is 5, far too tall for
        // this header block); symmetric top/bottom keeps the text centered with valign middle.
        cellPadding: { top: 1.45, bottom: 1.45, left: 5, right: 5 },
        fontSize: 10,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
      },
      headStyles: { fontStyle: "bold" },
      head: [["G", "F", "T"]],
      body: [
        [
          String(classeStats.garcons),
          String(classeStats.filles),
          String(classeStats.total),
        ],
      ],
    });
    // jspdf-autotable patches the doc instance with `lastAutoTable` at runtime - its published
    // types don't expose this on the plain jsPDF type this project imports, hence the cast.
    const statsTableFinalY = (
      doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;

    const listStartY = Math.max(blockTop + 11, statsTableFinalY) + 1.5;
    autoTable(doc, {
      startY: listStartY,
      head: [pdfExportColumns.map((c) => c.header)],
      body: rows.map((row, index) =>
        pdfExportColumns.map((c) => String(c.accessor(row, index))),
      ),
      // Body text defaults to the "striped" theme's dark gray otherwise - force pure black, and
      // keep the head row's white text explicit too (a bare `styles.textColor` merges in after
      // the theme's own head color and would flip it to black-on-blue - see exportData.ts's
      // exportRowsToPdf for the same fix).
      // "grid" theme (not the default "striped") so body cells get borders and no zebra fill:
      // only the header row is colored, every cell below it is white with a thin gray border.
      theme: "grid",
      styles: {
        textColor: [0, 0, 0],
        cellPadding: { top: 0.75, bottom: 0.5, left: 1, right: 2 },
      },
      headStyles: {
        textColor: [255, 255, 255],
        fillColor: [41, 128, 185],
        lineWidth: 0,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.05,
      },
      // Nom/Prénom (column index 2) gets the freed-up room from merging Name+Surname into one
      // column - "ellipsize" truncates with "…" instead of wrapping to a second line if an
      // unusually long name still doesn't fit, so every row stays a single line.
      columnStyles: { 2: { overflow: "ellipsize" } },
    });
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY;

    drawPdfSignature(doc, header, finalY);
  };

  // The hook's header can still be empty when an export is clicked (first fetch not resolved yet,
  // or it failed transiently) - reload it right then rather than printing a PDF with no letterhead.
  const resolveSchoolHeader = async (): Promise<SchoolHeader> =>
    schoolHeader.config || schoolHeader.logoImage
      ? schoolHeader
      : await loadSchoolHeader(accessToken, connection, schoolYear);

  const loadPdfLibs = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    return { jsPDF, autoTable };
  };

  const handleExportPdf = async () => {
    if (!selectedClasse) {
      return;
    }
    const { jsPDF, autoTable } = await loadPdfLibs();
    const header = await resolveSchoolHeader();
    const doc = new jsPDF();
    drawClassePage(doc, autoTable, selectedClasse, students, header);
    drawPdfFooters(doc, header);

    await saveOrShareBlob(
      doc.output("blob"),
      buildTimestampedFilename(
        "Liste des élèves",
        [
          `Classe ${selectedClasse.classe_name}`,
          `Section ${capitalizeSectionName(section)}`,
        ],
        "pdf",
      ),
    );
  };

  // Every classe of the section (the role-visible `classes`) in one PDF, each starting on its own
  // page with the same layout as the single-classe export. Rosters are fetched per classe through
  // the bounded-concurrency helper (see CLAUDE.md on the remote MySQL connection ceiling).
  const handlePrintAll = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    const rosters = await mapWithConcurrency(
      classes,
      DEFAULT_REPORT_CONCURRENCY,
      async (classe) => ({
        classe,
        rows: await fetchMergedStudents(classe.classe_id),
      }),
    );
    const nonEmpty = rosters.filter((r) => r.rows.length > 0);
    if (nonEmpty.length === 0) {
      setIsSaving(false);
      showToast(t.printAllEmpty, { type: "warning" });
      return;
    }
    const { jsPDF, autoTable } = await loadPdfLibs();
    const header = await resolveSchoolHeader();
    const doc = new jsPDF();
    nonEmpty.forEach(({ classe, rows }, index) => {
      if (index > 0) {
        doc.addPage();
      }
      drawClassePage(doc, autoTable, classe, rows, header);
    });
    drawPdfFooters(doc, header);
    await saveOrShareBlob(
      doc.output("blob"),
      buildTimestampedFilename(
        "Liste des élèves",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
    );
    setIsSaving(false);
  };

  // Blank weekly attendance sheets (see exportAttendanceSheets.ts): the selected classe only, or
  // every classe of the section.
  const handleAttendanceSheets = async (all: boolean) => {
    const targets = all ? classes : selectedClasse ? [selectedClasse] : [];
    if (targets.length === 0) {
      return;
    }
    setIsSaving(true);
    const rosters = await mapWithConcurrency(targets, DEFAULT_REPORT_CONCURRENCY, async (classe) => ({
      classeName: classe.classe_name,
      students: await fetchMergedStudents(classe.classe_id),
    }));
    const sheets = rosters.filter((r) => r.students.length > 0);
    if (sheets.length === 0) {
      setIsSaving(false);
      showToast(t.printAllEmpty, { type: "warning" });
      return;
    }
    await exportAttendanceSheetsToPdf(
      sheets,
      schoolYear,
      schoolHeader,
      buildTimestampedFilename(
        "Fiche de presence",
        [all ? `Section ${capitalizeSectionName(section)}` : `Classe ${targets[0].classe_name}`],
        "pdf",
      ),
    );
    setIsSaving(false);
  };

  return (
    <div className="page-shell-wide">
      {isSaving && <LoadingOverlay />}

      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section)}</p>
        </div>
        <CloseButton />
      </div>

      {isLoadingClasses ? (
        <div
          className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-4"
          aria-hidden="true"
        >
          <div className="flex items-center gap-2">
            <div className="skeleton h-4 w-24 rounded"></div>
            <div className="skeleton h-8 w-56 rounded-lg"></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="skeleton h-8 w-28 rounded-lg"></div>
            <div className="skeleton h-8 w-28 rounded-lg"></div>
            <div className="skeleton h-8 w-28 rounded-lg"></div>
            <div className="skeleton h-8 w-28 rounded-lg"></div>
          </div>
          <div className="skeleton h-12 w-full rounded-xl"></div>
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <label className="font-medium">{t.classeLabel}</label>
              <select
                className="select w-56"
                title={t.classeSelectTooltip}
                value={selectedClasseId ?? ""}
                onChange={(e) => setSelectedClasseId(Number(e.target.value))}
              >
                {classes.map((c) => (
                  <option key={c.classe_id} value={c.classe_id}>
                    {c.classe_name}
                  </option>
                ))}
              </select>
              {canChangeClasse && (
                <div className="tooltip tooltip-left ml-auto" data-tip={t.searchStudentTooltip}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-square"
                    aria-label={t.searchStudentTooltip}
                    onClick={() => setSearchDialogOpen(true)}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {canAddOrDeleteStudents && (
                <>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                disabled={isLoadingStudents}
                onClick={() => importFileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" />
                {t.importBtn}
              </button>
                </>
              )}
              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPdf}
                excelLabel={et.excelBtn}
                pdfLabel={et.pdfBtn}
                disabled={isLoadingStudents || students.length === 0}
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isLoadingStudents || classes.length === 0}
                onClick={handlePrintAll}
              >
                {t.printAllBtn}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm gap-2"
                disabled={isLoadingStudents || selectedClasseId === null}
                onClick={() =>
                  selectedClasseId && loadStudents(selectedClasseId)
                }
              >
                <RefreshCw className="w-4 h-4" />
                {t.refreshBtn}
              </button>
              <div
                className="tooltip"
                data-tip={t.importPhotosTooltip(selectedClasse?.classe_name ?? "")}
              >
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-square"
                  aria-label={t.importPhotosTooltip(selectedClasse?.classe_name ?? "")}
                  disabled={isLoadingStudents || selectedClasseId === null || students.length === 0}
                  onClick={() => photosFolderInputRef.current?.click()}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>
                <input
                  ref={photosFolderInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  // webkitdirectory makes the system picker choose a folder; it is not in React's typings.
                  {...({ webkitdirectory: "" } as Record<string, string>)}
                  onChange={handlePhotosFolderChosen}
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                {canAddOrDeleteStudents && (
                  <div
                    className="tooltip tooltip-left before:w-56 before:max-w-56 before:whitespace-pre-line before:text-center"
                    data-tip={t.cleanBirthDatesTooltip}
                  >
                    <button
                      type="button"
                      className="btn btn-outline btn-sm btn-square"
                      aria-label={t.cleanBirthDatesTooltip}
                      disabled={isLoadingStudents}
                      onClick={handleCleanBirthDates}
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="tooltip tooltip-left before:w-44 before:max-w-44 before:whitespace-normal before:text-center" data-tip={t.attendanceSheetTooltip(selectedClasse?.classe_name ?? "")}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-square"
                    aria-label={t.attendanceSheetTooltip(selectedClasse?.classe_name ?? "")}
                    disabled={isLoadingStudents || selectedClasseId === null}
                    onClick={() => handleAttendanceSheets(false)}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
                <div className="tooltip tooltip-left before:w-44 before:max-w-44 before:whitespace-normal before:text-center" data-tip={t.attendanceSheetsAllTooltip}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm btn-square"
                    aria-label={t.attendanceSheetsAllTooltip}
                    disabled={isLoadingStudents || classes.length === 0}
                    onClick={() => handleAttendanceSheets(true)}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm bg-base-200/50 rounded-xl px-4 py-3">
              <span className="badge badge-ghost gap-1">
                {t.statFilles}: <b>{stats.filles}</b>
              </span>
              <span className="badge badge-ghost gap-1">
                {t.statGarcons}: <b>{stats.garcons}</b>
              </span>
              <span className="badge badge-primary badge-outline gap-1">
                {t.statTotal}: <b>{stats.total}</b>
              </span>
              <span className="badge badge-ghost gap-1">
                {t.statRedoublants}: <b>{stats.redoublants}</b>
              </span>
              <span className="badge badge-ghost gap-1">
                {t.statNouveaux}: <b>{nouveaux}</b>
              </span>
              <span className="badge badge-ghost gap-1">
                {t.statHandicapes}: <b>{stats.handicapes}</b>
              </span>
              <span className="badge badge-ghost gap-1">
                {t.statCasSocial}: <b>{stats.casSocial}</b>
              </span>
            </div>
          </div>

          {isLoadingStudents ? (
            <TableSkeleton rows={7} columns={12} className="mb-6" />
          ) : (
            <div className="surface-card overflow-hidden mb-6">
              <div className="table-toolbar">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t.searchPlaceholder}
                  className="input-sm w-full max-w-xs"
                />
                {canAddOrDeleteStudents && (
                <button
                  type="button"
                  className="btn btn-error btn-sm"
                  disabled={selectedIds.size === 0}
                  onClick={handleDeleteSelected}
                >
                  {t.deleteSelectionBtn(selectedIds.size)}
                </button>
                )}
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
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) =>
                              selectedIds.has(s.stud_id),
                            )
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>{t.tableHeaderIndex}</th>
                      <th>{t.tableHeaderPhoto}</th>
                      <th>{t.tableHeaderMatricule}</th>
                      <th>{t.tableHeaderName}</th>
                      <th>{t.tableHeaderSurname}</th>
                      <th>{t.tableHeaderBday}</th>
                      <th>{t.tableHeaderBplace}</th>
                      <th>{t.tableHeaderSexe}</th>
                      <th>{t.tableHeaderRepeating}</th>
                      <th>{t.tableHeaderHandicape}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, index) => {
                      const isEditing = editingId === student.stud_id;
                      return (
                        <tr key={student.stud_id}>
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selectedIds.has(student.stud_id)}
                              onChange={() => toggleSelect(student.stud_id)}
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>
                            <StudentPhotoCell
                              studId={student.stud_id}
                              refreshVersion={
                                photoVersions[student.stud_id] ?? 0
                              }
                              onClick={() => setPhotoDialogStudent(student)}
                            />
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                title={t.matriculeTooltip}
                                value={editingMatricule}
                                onChange={(e) =>
                                  setEditingMatricule(e.target.value)
                                }
                              />
                            ) : (
                              student.matricule || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                title={t.nameHint}
                                value={editingFields.name}
                                autoFocus
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    name: sanitizeStudentName(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              student.name
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                title={t.surnameHint}
                                value={editingFields.surname}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    surname: sanitizeStudentName(
                                      e.target.value,
                                    ),
                                  })
                                }
                              />
                            ) : (
                              student.surname || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="date"
                                className="input input-sm w-full"
                                title={t.bdayHint}
                                value={editingFields.bday}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    bday: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              student.bday || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="text"
                                className="input input-sm w-full"
                                title={t.bplaceHint}
                                value={editingFields.bplace}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    bplace: sanitizeStudentName(e.target.value),
                                  })
                                }
                              />
                            ) : (
                              student.bplace || ""
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <select
                                className="select select-sm"
                                title={t.sexeHint}
                                value={editingFields.sexe}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    sexe: e.target.value === "F" ? "F" : "M",
                                  })
                                }
                              >
                                <option value="M">{t.sexeMale}</option>
                                <option value="F">{t.sexeFemale}</option>
                              </select>
                            ) : (
                              student.sexe
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <select
                                className="select select-sm"
                                title={t.repeatingHint}
                                value={editingFields.repeating ? "1" : "0"}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    repeating: e.target.value === "1",
                                  })
                                }
                              >
                                <option value="0">{t.repeatingNo}</option>
                                <option value="1">{t.repeatingYes}</option>
                              </select>
                            ) : student.repeating === 1 ? (
                              t.repeatingYes
                            ) : (
                              t.repeatingNo
                            )}
                          </td>
                          <td>
                            {isEditing && editingFields ? (
                              <input
                                type="checkbox"
                                className="checkbox"
                                title={t.handicapeHint}
                                checked={editingFields.handicape}
                                onChange={(e) =>
                                  setEditingFields({
                                    ...editingFields,
                                    handicape: e.target.checked,
                                  })
                                }
                              />
                            ) : (
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={student.handicape === 1}
                                disabled
                              />
                            )}
                          </td>
                          <td className="text-right">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-primary mr-2"
                                  onClick={() => saveEdit(student)}
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
                              <div className="flex items-center justify-end gap-1">
                                {canChangeClasse && (
                                  <div className="tooltip tooltip-left" data-tip={t.changeClasseTooltip}>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-ghost btn-square"
                                      aria-label={t.changeClasseTooltip}
                                      onClick={() => setChangeClasseStudent(student)}
                                    >
                                      <img src={changeClasseIcon} alt="" className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-xs btn-ghost"
                                  onClick={() => startEdit(student)}
                                >
                                  {t.editBtn}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={12}>
                          <p className="empty-state">{t.emptyList}</p>
                        </td>
                      </tr>
                    )}
                    {students.length > 0 && filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={12}>
                          <p className="empty-state">{t.noSearchResults}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {canAddOrDeleteStudents && (
          <div className="surface-card p-4 md:p-5">
            <form
              onSubmit={handleAdd}
              className="flex flex-wrap gap-2 items-start"
            >
              <div className="tooltip" data-tip={t.nameHint}>
                <input
                  type="text"
                  className="input"
                  placeholder={t.addPlaceholderName}
                  value={newFields.name}
                  onChange={(e) =>
                    setNewFields({
                      ...newFields,
                      name: sanitizeStudentName(e.target.value),
                    })
                  }
                />
              </div>
              <div className="tooltip" data-tip={t.surnameHint}>
                <input
                  type="text"
                  className="input"
                  placeholder={t.addPlaceholderSurname}
                  value={newFields.surname}
                  onChange={(e) =>
                    setNewFields({
                      ...newFields,
                      surname: sanitizeStudentName(e.target.value),
                    })
                  }
                />
              </div>
              <div className="tooltip" data-tip={t.bdayHint}>
                <input
                  type="date"
                  className="input"
                  value={newFields.bday}
                  onChange={(e) =>
                    setNewFields({ ...newFields, bday: e.target.value })
                  }
                />
              </div>
              <div className="tooltip" data-tip={t.bplaceHint}>
                <input
                  type="text"
                  className="input"
                  placeholder={t.addPlaceholderBplace}
                  value={newFields.bplace}
                  onChange={(e) =>
                    setNewFields({
                      ...newFields,
                      bplace: sanitizeStudentName(e.target.value),
                    })
                  }
                />
              </div>
              <div className="tooltip" data-tip={t.sexeHint}>
                <select
                  className="select"
                  value={newFields.sexe}
                  onChange={(e) =>
                    setNewFields({
                      ...newFields,
                      sexe: e.target.value === "F" ? "F" : "M",
                    })
                  }
                >
                  <option value="M">{t.sexeMale}</option>
                  <option value="F">{t.sexeFemale}</option>
                </select>
              </div>
              <div className="tooltip" data-tip={t.repeatingHint}>
                <select
                  className="select"
                  value={newFields.repeating ? "1" : "0"}
                  onChange={(e) =>
                    setNewFields({
                      ...newFields,
                      repeating: e.target.value === "1",
                    })
                  }
                >
                  <option value="0">{t.repeatingNo}</option>
                  <option value="1">{t.repeatingYes}</option>
                </select>
              </div>
              <div className="tooltip" data-tip={t.handicapeHint}>
                <label className="flex items-center gap-2">
                  {t.tableHeaderHandicape}
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={newFields.handicape}
                    onChange={(e) =>
                      setNewFields({
                        ...newFields,
                        handicape: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>
              <div className="tooltip" data-tip={t.matriculeHint}>
                <input
                  type="text"
                  className="input"
                  placeholder={t.addPlaceholderMatricule}
                  value={newMatricule}
                  onChange={(e) => setNewMatricule(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-outline gap-2"
                disabled={!selectedClasse || isGeneratingMatricule}
                onClick={handleGenerateMatricule}
              >
                <Wand2 className="w-4 h-4" />
                {t.generateMatriculeBtn}
              </button>
              <button type="submit" className="btn btn-primary">
                {t.addBtn}
              </button>
            </form>
          </div>
          )}
        </>
      )}

      <StudentPhotoDialog
        student={photoDialogStudent}
        onClose={() => setPhotoDialogStudent(null)}
        onSaved={bumpPhotoVersion}
      />
      <StudentSearchDialog open={searchDialogOpen} onClose={() => setSearchDialogOpen(false)} />
      <ChangeClasseDialog
        student={changeClasseStudent}
        currentClasseId={selectedClasseId}
        classes={classes}
        onClose={() => setChangeClasseStudent(null)}
        onValidate={handleChangeClasse}
      />
    </div>
  );
};

export default StudentManager;
