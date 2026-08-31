import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Settings2,
  Mail,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Users,
  Clock,
} from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  timetableHubTranslations,
  timetableGridViewTranslations,
  myTimetableTranslations,
  staffFunctionLabels,
} from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import type { Classe } from "../../../interfaces/Classe";
import type {
  Jour,
  TtConfig,
  AllStaffCell,
  StaffMaxPeriods,
  UnassignedTeacherPeriodEntry,
} from "../../../interfaces/Timetable";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  exportRowsToPdf,
  type ExportColumn,
} from "../../../utils/exportData";
import { DEFAULT_REPORT_CONCURRENCY, mapWithConcurrency } from "../../../utils/concurrency";
import type { TimelineEntry } from "../../../utils/timetableTime";
import {
  buildTimetableTimeline,
  buildClasseTimetableRows,
  buildStaffWeeklyGrid,
  computeStaffClasseHours,
  computeStaffHours,
  displayOrDash,
  type ClasseTimetableExport,
} from "../../../utils/timetableGrid";
import { exportTimetablesToPdf } from "../../../utils/exportTimetablePdf";
import { exportTimetablesToXlsx } from "../../../utils/exportTimetableWorkbook";
import {
  type MyTimetablePdfLabels,
  type StaffTimetableExportEntry,
} from "../../../utils/exportMyTimetablePdf";
import { exportAllStaffTimetablesToPdf } from "../../../utils/exportAllStaffTimetablesPdf";
import { exportAllStaffTimetablesToXlsx } from "../../../utils/exportAllStaffTimetablesXlsx";

const formatStaffLabel = (staff: { name: string; surname: string | null }): string =>
  `${staff.name} ${staff.surname ?? ""}`.trim();

// Backs "Voir les heures du personnel" (More options menu) - one row per staff member, reusing the
// exact StaffHours figures (dues/faites/supplementaires/sousEmployees) already computed by
// computeStaffHours for the per-staff PDF/Excel export, just flattened into a single whole-school
// table instead of scattered across each staff member's own page/sheet.
interface StaffHoursRow {
  staffFullName: string;
  dues: number;
  faites: number;
  supplementaires: number;
  sousEmployees: number;
}

// Landing page for the "Time table" dashboard card - Generate (confirm-gated, regenerates the whole
// school's time table for the current year) and Time table settings buttons, plus a per-class list
// linking into TimetableGridView (viewing the whole school means flipping through classes, same as a
// paper timetable is one sheet per class).
const TimetableHub = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = timetableHubTranslations[language];
  const gridLabels = timetableGridViewTranslations[language];
  const mt = myTimetableTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [isExportingTimetable, setIsExportingTimetable] = useState(false);
  const [isExportingUnassigned, setIsExportingUnassigned] = useState(false);

  // "Voir l'emploi de temps individuel du personnel" dialog (More options menu) - staffList is
  // fetched lazily on first open rather than on mount, since it's only needed here (the toolbar's
  // own bulk export buttons fetch it as part of buildAllStaffExportData instead).
  const individualDialogRef = useRef<HTMLDialogElement>(null);
  const [staffList, setStaffList] = useState<StaffMaxPeriods[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">("");

  // "Voir les heures du personnel" dialog (More options menu) - fetched once on open and cached in
  // state, so the dialog's own Export PDF/Excel buttons reuse it instead of refetching.
  const hoursDialogRef = useRef<HTMLDialogElement>(null);
  const [staffHoursRows, setStaffHoursRows] = useState<StaffHoursRow[]>([]);
  const [isLoadingStaffHours, setIsLoadingStaffHours] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const list = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(list);
      setIsLoading(false);
    };
    load();
  }, [connection, schoolYear, section, accessToken]);

  const handleGenerate = async () => {
    if (!(await confirm(t.generateConfirmMessage, { danger: true }))) {
      return;
    }
    setIsGenerating(true);
    const result = await TimetableReader.generate(accessToken, connection, schoolYear);
    setIsGenerating(false);

    if (!result.status) {
      showToast(result.message || t.generateFailure, { type: "danger" });
      return;
    }
    const unassigned = result.warnings?.unassignedTeacher.reduce((sum, w) => sum + w.count, 0) ?? 0;
    const noCapacity = result.warnings?.noCapacity.reduce((sum, w) => sum + w.count, 0) ?? 0;
    if (unassigned > 0 || noCapacity > 0) {
      showToast(t.generateSuccessWithWarnings(unassigned, noCapacity), { type: "warning" });
    } else {
      showToast(t.generateSuccess, { type: "info" });
    }
  };

  const handleSendEmails = async () => {
    if (!(await confirm(t.sendEmailsConfirmMessage))) {
      return;
    }
    setIsSendingEmails(true);
    const result = await TimetableReader.sendTeacherEmails(accessToken, connection, schoolYear);
    setIsSendingEmails(false);

    if (!result.status) {
      showToast(result.message || t.sendEmailsFailure, { type: "danger" });
      return;
    }
    const sentCount = result.sentCount ?? 0;
    const noEmail = result.warnings?.noEmail.length ?? 0;
    const sendFailed = result.warnings?.sendFailed.length ?? 0;
    if (noEmail > 0 || sendFailed > 0) {
      showToast(t.sendEmailsSuccessWithWarnings(sentCount, noEmail, sendFailed), { type: "warning" });
    } else {
      showToast(t.sendEmailsSuccess(sentCount), { type: "info" });
    }
  };

  const sortedClasses = [...classes].sort(
    (a, b) => a.level - b.level || a.classe_name.localeCompare(b.classe_name),
  );

  // Shared by every export builder below (per-class and per-staff alike) - fetches the school
  // days/time config once and derives the timeline, warning + bailing out if no days are configured
  // yet rather than exporting an empty document.
  const loadTimetableBasics = async (): Promise<
    { jours: Jour[]; ttConfig: TtConfig | null; timeline: TimelineEntry[] } | null
  > => {
    const [jourList, ttConfig] = await Promise.all([
      TimetableReader.fetchJours(accessToken, connection),
      TimetableReader.fetchTtConfig(accessToken, connection, schoolYear),
    ]);
    const jours = [...jourList].sort((a, b) => a.num - b.num);
    if (jours.length === 0) {
      showToast(t.exportNotConfiguredMessage, { type: "warning" });
      return null;
    }
    return { jours, ttConfig, timeline: buildTimetableTimeline(ttConfig, jours) };
  };

  // Shared by every export button below (the toolbar's whole-section pair and each row's own
  // per-class pair) - every requested class's own cells (bounded concurrency, same
  // DEFAULT_REPORT_CONCURRENCY convention as every other whole-section export loop in this app - a
  // single-class call just runs one worker), reducing each into the same plain grid rows
  // buildClasseTimetableRows already uses to back TimetableGridView's on-screen table.
  const buildTimetableExportData = async (
    classesToExport: Classe[],
  ): Promise<ClasseTimetableExport[] | null> => {
    const basics = await loadTimetableBasics();
    if (!basics) {
      return null;
    }
    const { jours, timeline } = basics;
    const labels = {
      breakLabel: gridLabels.breakLabel,
      freeSlotLabel: gridLabels.freeSlotLabel,
      noTeacherLabel: gridLabels.noTeacherLabel,
    };
    return mapWithConcurrency(classesToExport, DEFAULT_REPORT_CONCURRENCY, async (classe) => {
      const cells = await TimetableReader.fetchClasseCells(
        accessToken,
        connection,
        schoolYear,
        classe.classe_id,
      );
      return {
        classeName: classe.classe_name,
        dayLabels: jours.map((j) => j.label),
        rows: buildClasseTimetableRows(jours, timeline, cells, labels),
      };
    });
  };

  // Backs both the "print/export every staff member's individual time table at once" toolbar
  // buttons AND the "More options" single-staff dialog below - two requests (getAllStaffCells/
  // getAllStaffInfo) instead of looping the single-staff "My Timetable" endpoints once per staff
  // member, then groups the flat cells list by staff_id and reduces each staff's own slice through
  // the exact same buildStaffWeeklyGrid/computeStaffClasseHours/computeStaffHours pipeline
  // MyTimetableManager already uses for the logged-in staff's own export. `staffIdFilter` narrows
  // the result to just that one staff member (still going through fetchAllStaffCells/Info rather
  // than a new single-staff-by-id endpoint - filtering an already-fetched list client-side, same
  // "compose existing bulk endpoints" precedent as CourseAssignmentManager's "Wipe section").
  const buildAllStaffExportData = async (
    staffIdFilter?: number,
  ): Promise<{ entries: StaffTimetableExportEntry[]; ttConfig: TtConfig | null } | null> => {
    const basics = await loadTimetableBasics();
    if (!basics) {
      return null;
    }
    const { jours, ttConfig, timeline } = basics;
    const [cells, staffInfoListAll] = await Promise.all([
      TimetableReader.fetchAllStaffCells(accessToken, connection, schoolYear),
      TimetableReader.fetchAllStaffInfo(accessToken, connection, schoolYear),
    ]);
    const staffInfoList = staffIdFilter
      ? staffInfoListAll.filter((s) => s.staff_id === staffIdFilter)
      : staffInfoListAll;
    if (staffInfoList.length === 0) {
      showToast(t.staffEmptyState, { type: "warning" });
      return null;
    }

    const cellsByStaff = new Map<number, AllStaffCell[]>();
    cells.forEach((c) => {
      const existing = cellsByStaff.get(c.staff_id);
      if (existing) {
        existing.push(c);
      } else {
        cellsByStaff.set(c.staff_id, [c]);
      }
    });

    const functionLabels = staffFunctionLabels[language];
    const entries: StaffTimetableExportEntry[] = staffInfoList.map((info) => {
      const staffCells = cellsByStaff.get(info.staff_id) ?? [];
      const { columns, rows } = buildStaffWeeklyGrid(jours, timeline, staffCells);
      return {
        header: {
          staffFullName: `${info.name} ${info.surname ?? ""}`.trim(),
          functionLabel:
            functionLabels[info.function as keyof typeof functionLabels] ?? String(info.function),
          statut: displayOrDash(info.status),
          diplome: displayOrDash(info.diplome),
          grade: displayOrDash(info.grade),
          specialite: displayOrDash(info.specilitee),
          matiereEnseignee: displayOrDash(info.matiereEnseignee),
          anciennete: displayOrDash(info.longivity),
          hours: computeStaffHours(staffCells, info.max_periods_per_week),
        },
        columns,
        rows,
        classeHours: computeStaffClasseHours(staffCells),
      };
    });

    return { entries, ttConfig };
  };

  // Same field/label set MyTimetableManager builds for the single logged-in staff's own PDF/Excel
  // export - reused as-is so every individual page/sheet this bulk export produces reads identically
  // to what that staff member would get exporting "My Timetable" themselves.
  const buildStaffPdfLabels = (): MyTimetablePdfLabels => {
    return {
      documentTitle: mt.documentTitle,
      fieldStaffName: mt.fieldStaffName,
      fieldFunction: mt.fieldFunction,
      fieldStatut: mt.fieldStatut,
      fieldDiplome: mt.fieldDiplome,
      fieldGrade: mt.fieldGrade,
      fieldSpecialite: mt.fieldSpecialite,
      fieldMatiereEnseignee: mt.fieldMatiereEnseignee,
      fieldAnciennete: mt.fieldAnciennete,
      fieldHeuresDues: mt.fieldHeuresDues,
      fieldHeuresFaites: mt.fieldHeuresFaites,
      fieldHeuresSupplementaires: mt.fieldHeuresSupplementaires,
      fieldHeuresSousEmployees: mt.fieldHeuresSousEmployees,
      summaryClasseHeader: mt.summaryClasseHeader,
      summaryHoursRow: mt.summaryHoursRow,
      summaryTotalHeader: mt.summaryTotalHeader,
      breakDurationSuffix: mt.breakDurationSuffix,
      breakLabel: gridLabels.breakLabel,
    };
  };

  const handleExportAllStaffPdf = async () => {
    setIsExportingTimetable(true);
    const data = await buildAllStaffExportData();
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportAllStaffTimetablesToPdf(
      data.entries,
      data.ttConfig,
      schoolHeader,
      buildStaffPdfLabels(),
      buildTimestampedFilename(
        t.individualTimetablesTitle,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
    );
  };

  const handleExportAllStaffExcel = async () => {
    setIsExportingTimetable(true);
    const data = await buildAllStaffExportData();
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportAllStaffTimetablesToXlsx(
      myTimetableTranslations[language].documentTitle,
      data.entries,
      data.ttConfig,
      buildStaffPdfLabels(),
      buildTimestampedFilename(
        t.individualTimetablesTitle,
        [`Section ${capitalizeSectionName(section)}`],
        "xlsx",
      ),
    );
  };

  // "Voir l'emploi de temps individuel du personnel" (More options menu) - staffList is fetched
  // lazily on first open (see staffList state above), reusing the same StaffMaxPeriods shape/reader
  // TimetableGridView's own staff picker already uses.
  const openIndividualStaffDialog = async () => {
    if (staffList.length === 0) {
      const list = await TimetableReader.fetchStaffMaxPeriods(accessToken, connection, schoolYear);
      setStaffList(list);
    }
    setSelectedStaffId("");
    individualDialogRef.current?.showModal();
  };

  const closeIndividualStaffDialog = () => {
    individualDialogRef.current?.close();
  };

  const handleExportSelectedStaffPdf = async () => {
    if (selectedStaffId === "") {
      return;
    }
    setIsExportingTimetable(true);
    const data = await buildAllStaffExportData(selectedStaffId);
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportAllStaffTimetablesToPdf(
      data.entries,
      data.ttConfig,
      schoolHeader,
      buildStaffPdfLabels(),
      buildTimestampedFilename(t.individualTimetablesTitle, [data.entries[0].header.staffFullName], "pdf"),
    );
  };

  const handleExportSelectedStaffExcel = async () => {
    if (selectedStaffId === "") {
      return;
    }
    setIsExportingTimetable(true);
    const data = await buildAllStaffExportData(selectedStaffId);
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportAllStaffTimetablesToXlsx(
      myTimetableTranslations[language].documentTitle,
      data.entries,
      data.ttConfig,
      buildStaffPdfLabels(),
      buildTimestampedFilename(t.individualTimetablesTitle, [data.entries[0].header.staffFullName], "xlsx"),
    );
  };

  // "Voir les heures du personnel" (More options menu) - whole-school, one row per staff member;
  // reuses buildAllStaffExportData (no staffId filter) purely for its already-computed
  // header.hours figures, discarding the per-staff grid/columns this report doesn't need.
  const staffHoursExportColumns: ExportColumn<StaffHoursRow>[] = [
    { header: "#", accessor: (_r, index) => index + 1 },
    { header: t.staffHoursTableHeaderPersonnel, accessor: (r) => r.staffFullName },
    { header: mt.fieldHeuresDues, accessor: (r) => r.dues },
    { header: mt.fieldHeuresFaites, accessor: (r) => r.faites },
    { header: mt.fieldHeuresSupplementaires, accessor: (r) => r.supplementaires },
    {
      header: mt.fieldHeuresSousEmployees,
      accessor: (r) => r.sousEmployees,
      textColor: (r) => (r.sousEmployees > 0 ? [220, 38, 38] : undefined),
    },
  ];

  const openStaffHoursDialog = async () => {
    setIsLoadingStaffHours(true);
    const data = await buildAllStaffExportData();
    setIsLoadingStaffHours(false);
    if (!data) {
      return;
    }
    const rows: StaffHoursRow[] = data.entries
      .map((e) => ({
        staffFullName: e.header.staffFullName,
        dues: e.header.hours.dues,
        faites: e.header.hours.faites,
        supplementaires: e.header.hours.supplementaires,
        sousEmployees: e.header.hours.sousEmployees,
      }))
      .sort((a, b) => a.staffFullName.localeCompare(b.staffFullName));
    setStaffHoursRows(rows);
    hoursDialogRef.current?.showModal();
  };

  const closeStaffHoursDialog = () => {
    hoursDialogRef.current?.close();
  };

  const handleExportStaffHoursPdf = async () => {
    setIsExportingTimetable(true);
    await exportRowsToPdf(
      t.staffHoursDialogTitle,
      buildTimestampedFilename(t.staffHoursDialogTitle, [], "pdf"),
      staffHoursExportColumns,
      staffHoursRows,
      schoolHeader,
    );
    setIsExportingTimetable(false);
  };

  const handleExportStaffHoursExcel = async () => {
    setIsExportingTimetable(true);
    await exportRowsToCsv(
      buildTimestampedFilename(t.staffHoursDialogTitle, [], "csv"),
      staffHoursExportColumns,
      staffHoursRows,
    );
    setIsExportingTimetable(false);
  };

  const handleExportExcel = async () => {
    if (sortedClasses.length === 0) {
      showToast(t.emptyState, { type: "warning" });
      return;
    }
    setIsExportingTimetable(true);
    const data = await buildTimetableExportData(sortedClasses);
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportTimetablesToXlsx(
      buildTimestampedFilename(t.title, [`Section ${capitalizeSectionName(section)}`], "xlsx"),
      data,
    );
  };

  const handleExportPdf = async () => {
    if (sortedClasses.length === 0) {
      showToast(t.emptyState, { type: "warning" });
      return;
    }
    setIsExportingTimetable(true);
    const data = await buildTimetableExportData(sortedClasses);
    if (!data) {
      setIsExportingTimetable(false);
      return;
    }
    await exportTimetablesToPdf(
      t.title,
      data,
      schoolHeader,
      buildTimestampedFilename(t.title, [`Section ${capitalizeSectionName(section)}`], "pdf"),
    );
    setIsExportingTimetable(false);
  };

  // Per-row equivalents of the toolbar's whole-section pair above - same buildTimetableExportData
  // helper, scoped to just the one class the admin clicked, so a single row's PDF/Excel download
  // never has to wait on every other class's cells being fetched too.
  const handleExportClassePdf = async (classe: Classe) => {
    setIsExportingTimetable(true);
    const data = await buildTimetableExportData([classe]);
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportTimetablesToPdf(
      t.title,
      data,
      schoolHeader,
      buildTimestampedFilename(t.title, [`Classe ${classe.classe_name}`], "pdf"),
    );
  };

  const handleExportClasseExcel = async (classe: Classe) => {
    setIsExportingTimetable(true);
    const data = await buildTimetableExportData([classe]);
    setIsExportingTimetable(false);
    if (!data) {
      return;
    }
    await exportTimetablesToXlsx(
      buildTimestampedFilename(t.title, [`Classe ${classe.classe_name}`], "xlsx"),
      data,
    );
  };

  // One display row per (classe, subject) pair - groups the backend's per-period rows and renders
  // the gaps as "<count>(<day> <start>-<end>, ...)" in the same cell, e.g. "2(Lundi 07H30-08H30,
  // Mercredi 09H30-10H30)", so the admin sees exactly which slots the algorithm/an edit left without
  // a teacher instead of just a bare count.
  interface UnassignedTeacherReportRow {
    section_name: string;
    classe_name: string;
    subject_title: string;
    periodsLabel: string;
  }

  const capitalizeFirst = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const formatMissingPeriods = (
    periods: UnassignedTeacherPeriodEntry[],
    timeline: TimelineEntry[],
  ): string => {
    const parts = periods.map((p) => {
      const dayLabel = capitalizeFirst(p.jour_label);
      const entry = timeline.find((e) => e.type === "period" && e.period_number === p.period_number);
      return entry && entry.type === "period" && entry.start
        ? `${dayLabel} ${entry.start}-${entry.end}`
        : dayLabel;
    });
    return `${periods.length}(${parts.join(", ")})`;
  };

  const groupUnassignedTeacherPeriods = (
    entries: UnassignedTeacherPeriodEntry[],
    timeline: TimelineEntry[],
  ): UnassignedTeacherReportRow[] => {
    const groups = new Map<string, UnassignedTeacherPeriodEntry[]>();
    entries.forEach((e) => {
      const key = `${e.classe_id}-${e.subject_id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(e);
      } else {
        groups.set(key, [e]);
      }
    });
    return Array.from(groups.values()).map((periods) => ({
      section_name: periods[0].section_name,
      classe_name: periods[0].classe_name,
      subject_title: periods[0].subject_title,
      periodsLabel: formatMissingPeriods(periods, timeline),
    }));
  };

  // Whole-school report (both sections - see fetchUnassignedTeacherSubjects), so the section column
  // is worth keeping even though every other export column set on this screen doesn't need one.
  const unassignedTeacherExportColumns: ExportColumn<UnassignedTeacherReportRow>[] = [
    { header: t.unassignedTeacherTableHeaderSection, accessor: (r) => capitalizeSectionName(r.section_name) },
    { header: t.unassignedTeacherTableHeaderClasse, accessor: (r) => r.classe_name },
    { header: t.unassignedTeacherTableHeaderSubject, accessor: (r) => r.subject_title },
    { header: t.unassignedTeacherTableHeaderCount, accessor: (r) => r.periodsLabel },
  ];

  // Shared by both "More options" report buttons below - a null result means the fetch came back
  // empty (already toasted here), so the caller can bail out without exporting a blank document.
  const loadUnassignedTeacherSubjects = async (): Promise<UnassignedTeacherReportRow[] | null> => {
    const entries = await TimetableReader.fetchUnassignedTeacherSubjects(accessToken, connection, schoolYear);
    if (entries.length === 0) {
      showToast(t.unassignedTeacherEmptyState, { type: "info" });
      return null;
    }
    const basics = await loadTimetableBasics();
    return groupUnassignedTeacherPeriods(entries, basics?.timeline ?? []);
  };

  const handleExportUnassignedPdf = async () => {
    setIsExportingUnassigned(true);
    const rows = await loadUnassignedTeacherSubjects();
    setIsExportingUnassigned(false);
    if (!rows) {
      return;
    }
    await exportRowsToPdf(
      t.unassignedTeacherReportTitle,
      buildTimestampedFilename(t.unassignedTeacherReportTitle, [], "pdf"),
      unassignedTeacherExportColumns,
      rows,
      schoolHeader,
    );
  };

  const handleExportUnassignedExcel = async () => {
    setIsExportingUnassigned(true);
    const rows = await loadUnassignedTeacherSubjects();
    setIsExportingUnassigned(false);
    if (!rows) {
      return;
    }
    await exportRowsToCsv(
      buildTimestampedFilename(t.unassignedTeacherReportTitle, [], "csv"),
      unassignedTeacherExportColumns,
      rows,
    );
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {(isGenerating ||
        isSendingEmails ||
        isExportingTimetable ||
        isExportingUnassigned ||
        isLoadingStaffHours) && (
        <LoadingOverlay />
      )}
      <div className="page-header w-full max-w-3xl">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            disabled={isGenerating || isSendingEmails}
            onClick={handleGenerate}
          >
            <CalendarClock className="w-4 h-4" />
            {t.generateBtn}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm gap-2"
            disabled={isGenerating || isSendingEmails}
            title={t.sendEmailsTooltip}
            onClick={handleSendEmails}
          >
            <Mail className="w-4 h-4" />
            {t.sendEmailsBtn}
          </button>
          <div className="tooltip" data-tip={t.settingsTooltip}>
            <Link to="/admin/timetable/settings" className="btn btn-ghost btn-sm btn-square">
              <Settings2 className="w-4 h-4" />
            </Link>
          </div>
          <div className="tooltip" data-tip={t.exportExcelTooltip}>
            <button
              type="button"
              className="btn btn-outline btn-success btn-sm btn-square"
              disabled={isLoading || isExportingTimetable}
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
          <div className="tooltip" data-tip={t.exportPdfTooltip}>
            <button
              type="button"
              className="btn btn-outline btn-error btn-sm btn-square"
              disabled={isLoading || isExportingTimetable}
              onClick={handleExportPdf}
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-6 bg-base-300 mx-1" aria-hidden="true" />
          <div className="tooltip" data-tip={t.exportAllStaffExcelTooltip}>
            <button
              type="button"
              className="btn btn-success btn-sm btn-square"
              disabled={isLoading || isExportingTimetable}
              onClick={handleExportAllStaffExcel}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
          <div className="tooltip" data-tip={t.exportAllStaffPdfTooltip}>
            <button
              type="button"
              className="btn btn-error btn-sm btn-square"
              disabled={isLoading || isExportingTimetable}
              onClick={handleExportAllStaffPdf}
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
          <CloseButton />
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <h2 className="text-lg font-semibold mb-2">{t.classesListTitle}</h2>
        {isLoading ? (
          <TableSkeleton rows={8} columns={4} showToolbar={false} className="w-full" />
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra data-table">
                <thead>
                  <tr>
                    <th>{t.tableHeaderClasse}</th>
                    <th>{t.tableHeaderLevel}</th>
                    <th>{t.tableHeaderExport}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClasses.map((c) => (
                    <tr key={c.classe_id}>
                      <td>{c.classe_name}</td>
                      <td>{c.level}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <div className="tooltip" data-tip={t.exportClassePdfTooltip}>
                            <button
                              type="button"
                              className="btn btn-outline btn-error btn-sm btn-square"
                              disabled={isExportingTimetable}
                              onClick={() => handleExportClassePdf(c)}
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="tooltip" data-tip={t.exportClasseExcelTooltip}>
                            <button
                              type="button"
                              className="btn btn-outline btn-success btn-sm btn-square"
                              disabled={isExportingTimetable}
                              onClick={() => handleExportClasseExcel(c)}
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/admin/timetable/view/${c.classe_id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          {t.viewBtn}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {sortedClasses.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <p className="empty-state">{t.emptyState}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Page-scoped "More options" menu (unlike MagicAssistant's global bottom-right FAB, this one
          only exists on this screen) - reuses the same floating-button visual language (circular,
          hover-scale, ring-ping) for consistency, mirrored to the bottom-left so the two never
          overlap. */}
      <div className="fixed bottom-[calc(1.5rem+var(--safe-bottom))] left-[calc(1.5rem+var(--safe-left))] z-40">
        <div className="dropdown dropdown-top">
          <div className="tooltip tooltip-right" data-tip={t.moreOptionsTooltip}>
            <div
              tabIndex={0}
              role="button"
              aria-label={t.moreOptionsTooltip}
              className="more-options-fab group relative btn btn-circle btn-lg btn-primary shadow-lg shadow-primary/30 transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl"
            >
              <span className="absolute inset-0 rounded-full bg-primary/40 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
              <MoreHorizontal className="relative w-6 h-6 transition-transform duration-300 ease-out group-hover:rotate-90" />
            </div>
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content menu bg-base-100 border border-base-content/10 rounded-box z-10 w-80 p-2 shadow-xl mb-2"
          >
            <li>
              <button
                type="button"
                disabled={isExportingUnassigned}
                onClick={handleExportUnassignedPdf}
              >
                <FileText className="w-4 h-4 text-error shrink-0" />
                <span>{t.unassignedTeacherPdfBtn}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled={isExportingUnassigned}
                onClick={handleExportUnassignedExcel}
              >
                <FileSpreadsheet className="w-4 h-4 text-success shrink-0" />
                <span>{t.unassignedTeacherExcelBtn}</span>
              </button>
            </li>
            <li>
              <button type="button" onClick={openIndividualStaffDialog}>
                <Users className="w-4 h-4 text-primary shrink-0" />
                <span>{t.individualStaffMenuBtn}</span>
              </button>
            </li>
            <li>
              <button type="button" disabled={isLoadingStaffHours} onClick={openStaffHoursDialog}>
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>{t.staffHoursMenuBtn}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <dialog ref={individualDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">{t.individualStaffDialogTitle}</h3>

          <label className="form-control mb-4">
            <span className="label-text font-semibold">{t.individualStaffSelectLabel}</span>
            <select
              className="select select-bordered w-full"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">{t.individualStaffNoSelection}</option>
              {[...staffList]
                .sort((a, b) => formatStaffLabel(a).localeCompare(formatStaffLabel(b)))
                .map((s) => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {formatStaffLabel(s)}
                  </option>
                ))}
            </select>
          </label>

          <div className="mb-4">
            <span className="label-text font-semibold block mb-2">{t.individualStaffExportOneLabel}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm gap-2"
                disabled={selectedStaffId === "" || isExportingTimetable}
                onClick={handleExportSelectedStaffPdf}
              >
                <FileText className="w-4 h-4" />
                {t.individualStaffExportPdfBtn}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-success btn-sm gap-2"
                disabled={selectedStaffId === "" || isExportingTimetable}
                onClick={handleExportSelectedStaffExcel}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {t.individualStaffExportExcelBtn}
              </button>
            </div>
          </div>

          <div className="border-t border-base-200 pt-4">
            <span className="label-text font-semibold block mb-2">{t.individualStaffExportAllLabel}</span>
            <div className="flex gap-2">
              <div className="tooltip" data-tip={t.exportAllStaffPdfTooltip}>
                <button
                  type="button"
                  className="btn btn-error btn-sm gap-2"
                  disabled={isExportingTimetable}
                  onClick={handleExportAllStaffPdf}
                >
                  <FileText className="w-4 h-4" />
                  {t.individualStaffExportAllPdfBtn}
                </button>
              </div>
              <div className="tooltip" data-tip={t.exportAllStaffExcelTooltip}>
                <button
                  type="button"
                  className="btn btn-success btn-sm gap-2"
                  disabled={isExportingTimetable}
                  onClick={handleExportAllStaffExcel}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {t.individualStaffExportAllExcelBtn}
                </button>
              </div>
            </div>
          </div>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={closeIndividualStaffDialog}>
              {t.cancelBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      <dialog ref={hoursDialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-lg mb-4">{t.staffHoursDialogTitle}</h3>

          <div className="overflow-x-auto mb-4">
            <table className="table table-zebra table-sm data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.staffHoursTableHeaderPersonnel}</th>
                  <th>{mt.fieldHeuresDues}</th>
                  <th>{mt.fieldHeuresFaites}</th>
                  <th>{mt.fieldHeuresSupplementaires}</th>
                  <th>{mt.fieldHeuresSousEmployees}</th>
                </tr>
              </thead>
              <tbody>
                {staffHoursRows.map((r, index) => (
                  <tr key={r.staffFullName + index}>
                    <td>{index + 1}</td>
                    <td>{r.staffFullName}</td>
                    <td>{r.dues}</td>
                    <td>{r.faites}</td>
                    <td>{r.supplementaires}</td>
                    <td className={r.sousEmployees > 0 ? "text-error font-semibold" : ""}>
                      {r.sousEmployees}
                    </td>
                  </tr>
                ))}
                {staffHoursRows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <p className="empty-state">{t.staffEmptyState}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline btn-error btn-sm gap-2"
              disabled={staffHoursRows.length === 0 || isExportingTimetable}
              onClick={handleExportStaffHoursPdf}
            >
              <FileText className="w-4 h-4" />
              {t.exportPdfBtn}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-success btn-sm gap-2"
              disabled={staffHoursRows.length === 0 || isExportingTimetable}
              onClick={handleExportStaffHoursExcel}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t.exportExcelBtn}
            </button>
          </div>

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={closeStaffHoursDialog}>
              {t.closeBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default TimetableHub;
