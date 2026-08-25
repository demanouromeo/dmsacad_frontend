import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Settings2, Mail, FileSpreadsheet, FileText } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { timetableHubTranslations, timetableGridViewTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import type { Classe } from "../../../interfaces/Classe";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import { DEFAULT_REPORT_CONCURRENCY, mapWithConcurrency } from "../../../utils/concurrency";
import {
  buildTimetableTimeline,
  buildClasseTimetableRows,
  type ClasseTimetableExport,
} from "../../../utils/timetableGrid";
import { exportTimetablesToPdf } from "../../../utils/exportTimetablePdf";
import { exportTimetablesToXlsx } from "../../../utils/exportTimetableWorkbook";

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
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [isExportingTimetable, setIsExportingTimetable] = useState(false);

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

  // Shared by every export button below (the toolbar's whole-section pair and each row's own
  // per-class pair) - fetches the school days/time config once, then every requested class's own
  // cells (bounded concurrency, same DEFAULT_REPORT_CONCURRENCY convention as every other
  // whole-section export loop in this app - a single-class call just runs one worker), reducing each
  // into the same plain grid rows buildClasseTimetableRows already uses to back TimetableGridView's
  // on-screen table.
  const buildTimetableExportData = async (
    classesToExport: Classe[],
  ): Promise<ClasseTimetableExport[] | null> => {
    const [jourList, ttConfig] = await Promise.all([
      TimetableReader.fetchJours(accessToken, connection),
      TimetableReader.fetchTtConfig(accessToken, connection, schoolYear),
    ]);
    const jours = [...jourList].sort((a, b) => a.num - b.num);
    if (jours.length === 0) {
      showToast(t.exportNotConfiguredMessage, { type: "warning" });
      return null;
    }
    const timeline = buildTimetableTimeline(ttConfig, jours);
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

  return (
    <div className="page-shell flex flex-col items-center">
      {(isGenerating || isSendingEmails || isExportingTimetable) && <LoadingOverlay />}
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
    </div>
  );
};

export default TimetableHub;
