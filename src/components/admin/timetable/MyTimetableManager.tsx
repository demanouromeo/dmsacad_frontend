import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { myTimetableTranslations, timetableGridViewTranslations, staffFunctionLabels } from "../../../i18n/translations";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { buildTimestampedFilename } from "../../../utils/exportData";
import {
  buildTimetableTimeline,
  buildStaffWeeklyGrid,
  computeStaffClasseHours,
  computeStaffHours,
  displayOrDash,
} from "../../../utils/timetableGrid";
import { exportMyTimetableToPdf, type StaffTimetableHeaderData, type MyTimetablePdfLabels } from "../../../utils/exportMyTimetablePdf";
import { exportMyTimetableToXlsx } from "../../../utils/exportMyTimetableXlsx";
import type { Jour, TtConfig, StaffCell, StaffTimetableInfo } from "../../../interfaces/Timetable";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const cellKey = (jourId: number, periodNumber: number) => `${jourId}-${periodNumber}`;

// Read-only "My Timetable" - lets a TEACHER/SG/CENSEUR see their own individual weekly schedule
// across every class they teach (TimetableReader.fetchMyCells, backed by the new staff-scoped
// TimetableController::getMyCells) plus export it to Excel/PDF. Mirrors TimetableGridView's on-screen
// layout (hours as a dedicated second column, uppercase merged break rows) but with no click-to-edit
// affordance and no classe picker - there's exactly one grid to show, the caller's own.
const MyTimetableManager = () => {
  const { connection, schoolYear, accessToken, authPayload } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = myTimetableTranslations[language];
  const gridLabels = timetableGridViewTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [jours, setJours] = useState<Jour[]>([]);
  const [ttConfig, setTtConfig] = useState<TtConfig | null>(null);
  const [cells, setCells] = useState<StaffCell[]>([]);
  const [staffInfo, setStaffInfo] = useState<StaffTimetableInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [jourList, config, cellList, info] = await Promise.all([
        TimetableReader.fetchJours(accessToken, connection),
        TimetableReader.fetchTtConfig(accessToken, connection, schoolYear),
        TimetableReader.fetchMyCells(accessToken, connection, schoolYear),
        TimetableReader.fetchMyStaffInfo(accessToken, connection, schoolYear),
      ]);
      setJours([...jourList].sort((a, b) => a.num - b.num));
      setTtConfig(config);
      setCells(cellList);
      setStaffInfo(info);
      setIsLoading(false);
    };
    load();
  }, [connection, schoolYear, accessToken]);

  const timeline = useMemo(() => buildTimetableTimeline(ttConfig, jours), [ttConfig, jours]);
  const weeklyGrid = useMemo(() => buildStaffWeeklyGrid(jours, timeline, cells), [jours, timeline, cells]);
  const classeHours = useMemo(() => computeStaffClasseHours(cells), [cells]);

  const headerData: StaffTimetableHeaderData | null = useMemo(() => {
    if (!staffInfo) {
      return null;
    }
    const functionLabels = staffFunctionLabels[language];
    return {
      staffFullName: `${staffInfo.name} ${staffInfo.surname ?? ""}`.trim(),
      functionLabel:
        functionLabels[staffInfo.function as keyof typeof functionLabels] ?? String(staffInfo.function),
      statut: displayOrDash(staffInfo.status),
      diplome: displayOrDash(staffInfo.diplome),
      grade: displayOrDash(staffInfo.grade),
      specialite: displayOrDash(staffInfo.specilitee),
      matiereEnseignee: displayOrDash(staffInfo.matiereEnseignee),
      anciennete: displayOrDash(staffInfo.longivity),
      hours: computeStaffHours(cells, staffInfo.max_periods_per_week),
    };
  }, [staffInfo, cells, language]);

  const cellMap = useMemo(() => {
    const map = new Map<string, StaffCell>();
    cells.forEach((c) => map.set(cellKey(c.jour_id, c.period_number), c));
    return map;
  }, [cells]);

  const staffName = authPayload?.name ?? "";

  const handleExport = async (format: "pdf" | "xlsx") => {
    if (jours.length === 0) {
      showToast(t.exportNotConfiguredMessage, { type: "warning" });
      return;
    }
    if (!headerData) {
      showToast(t.staffInfoUnavailableMessage, { type: "warning" });
      return;
    }
    setIsExporting(true);
    const filename = buildTimestampedFilename(t.title, staffName ? [staffName] : [], format);
    const pdfLabels: MyTimetablePdfLabels = {
      documentTitle: t.documentTitle,
      fieldStaffName: t.fieldStaffName,
      fieldFunction: t.fieldFunction,
      fieldStatut: t.fieldStatut,
      fieldDiplome: t.fieldDiplome,
      fieldGrade: t.fieldGrade,
      fieldSpecialite: t.fieldSpecialite,
      fieldMatiereEnseignee: t.fieldMatiereEnseignee,
      fieldAnciennete: t.fieldAnciennete,
      fieldHeuresDues: t.fieldHeuresDues,
      fieldHeuresFaites: t.fieldHeuresFaites,
      fieldHeuresSupplementaires: t.fieldHeuresSupplementaires,
      fieldHeuresSousEmployees: t.fieldHeuresSousEmployees,
      summaryClasseHeader: t.summaryClasseHeader,
      summaryHoursRow: t.summaryHoursRow,
      summaryTotalHeader: t.summaryTotalHeader,
      breakDurationSuffix: t.breakDurationSuffix,
      breakLabel: gridLabels.breakLabel,
    };
    if (format === "pdf") {
      await exportMyTimetableToPdf(
        headerData,
        weeklyGrid.columns,
        weeklyGrid.rows,
        classeHours,
        ttConfig,
        schoolHeader,
        pdfLabels,
        filename,
      );
    } else {
      await exportMyTimetableToXlsx(
        t.documentTitle,
        headerData,
        weeklyGrid.columns,
        weeklyGrid.rows,
        classeHours,
        ttConfig,
        pdfLabels,
        filename,
      );
    }
    setIsExporting(false);
  };

  return (
    <div className="page-shell-wide flex flex-col items-center">
      {isExporting && <LoadingOverlay />}
      <div className="page-header w-full">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex items-center gap-2">
          <div className="tooltip" data-tip={t.exportExcelTooltip}>
            <button
              type="button"
              className="btn btn-outline btn-success btn-sm btn-square"
              disabled={isLoading || isExporting}
              onClick={() => handleExport("xlsx")}
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
          <div className="tooltip" data-tip={t.exportPdfTooltip}>
            <button
              type="button"
              className="btn btn-outline btn-error btn-sm btn-square"
              disabled={isLoading || isExporting}
              onClick={() => handleExport("pdf")}
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
          <CloseButton />
        </div>
      </div>

      {isLoading ? (
        <span className="loading loading-spinner loading-lg" />
      ) : jours.length === 0 ? (
        <p className="empty-state">{gridLabels.notConfiguredMessage}</p>
      ) : (
        <div className="w-full surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{gridLabels.hoursHeader}</th>
                  {jours.map((j) => (
                    <th key={j.jour_id}>{j.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((entry, idx) =>
                  entry.type === "break" ? (
                    <tr key={`break-${idx}`} className="bg-base-200">
                      <td colSpan={jours.length + 2} className="text-center font-semibold uppercase">
                        {gridLabels.breakLabel} {entry.start && `(${entry.start} - ${entry.end})`}
                      </td>
                    </tr>
                  ) : (
                    <tr key={`period-${entry.period_number}`}>
                      <td className="whitespace-nowrap font-semibold text-center">
                        {entry.period_number}
                      </td>
                      <td className="whitespace-nowrap text-sm opacity-70">
                        {entry.start && `${entry.start} - ${entry.end}`}
                      </td>
                      {jours.map((j) => {
                        if (entry.period_number > j.number_of_periods) {
                          return (
                            <td key={j.jour_id} className="opacity-40 text-center">
                              {gridLabels.freeSlotLabel}
                            </td>
                          );
                        }
                        const cell = cellMap.get(cellKey(j.jour_id, entry.period_number));
                        return (
                          <td key={j.jour_id}>
                            {cell ? (
                              <div>
                                <div className="font-semibold">{cell.classe_name}</div>
                                <div className="text-xs opacity-70">{cell.subject_title}</div>
                              </div>
                            ) : (
                              <span className="opacity-30">{gridLabels.freeSlotLabel}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTimetableManager;
