import { useEffect, useState } from "react";
import { BarChart3, RefreshCw, Table2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useLanguage } from "../../../i18n/useLanguage";
import { fillRateManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { MarkReader } from "../../../dbmanger/MarkReader";
import { StaffReader } from "../../../dbmanger/StaffReader";
import type { Staff } from "../../../interfaces/Staff";
import type { CourseAssignment } from "../../../interfaces/CourseAssignment";
import {
  mergeToUnifiedCells,
  pivotAnnual,
  pivotByClasse,
  pivotBySubject,
  pivotByTeacher,
  pivotByTerm,
  type FillRateCell,
  type FillRatePivotRow,
} from "../../../utils/fillRateAggregation";
import {
  buildTimestampedFilename,
  exportRowsToCsv,
  exportRowsToPdf,
  type ExportColumn,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import Loading from "../../sharedcomp/Loading";
import ExportButtons from "../../sharedcomp/ExportButtons";
import FillRateChartDialog from "../marks/FillRateChartDialog";

// Both sections are always fetched regardless of the admin's currently selected section - this is a
// whole-school report, not scoped to whichever section happens to be selected in TopBanner (same
// precedent as EffectifsManager).
const SECTIONS = ["francophone", "anglophone"];
const TERMS = [1, 2, 3];

type Axis = "classe" | "subject" | "term" | "annual" | "teacher";
type Mode = "table" | "chart";
type SectionFilter = "all" | "francophone" | "anglophone";
type TermFilter = number | "annual";

const rateColorClass = (rate: number | null): string => {
  if (rate === null) {
    return "";
  }
  if (rate >= 80) {
    return "text-success";
  }
  if (rate >= 50) {
    return "text-warning";
  }
  return "text-error";
};

// Ascending by rate (nulls last) so the most-incomplete classes/subjects/teachers surface first -
// that's this report's whole purpose. A row with no data at all (null) is a different signal than a
// row with some real, incomplete data, so it sorts after every numeric rate rather than as if it
// were 0%.
const sortByRateAscending = (rows: FillRatePivotRow[]): FillRatePivotRow[] =>
  [...rows].sort((a, b) => {
    if (a.rate === null && b.rate === null) return 0;
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    return a.rate - b.rate;
  });

// "Taux de remplissage des notes" - a whole-school, read-only report on how completely marks have
// been entered, distinct from MarkEntryManager's own small per-classe fill-rate side panel (which
// only ever looks at one classe at a time). Backed by two dedicated aggregation endpoints
// (StudentController::fillRateNonApc/fillRateApc) that return the whole section+year's roster/filled
// counts in one query each - looping the single-classe fetchSeqMarks/fetchCompMarks calls
// MarkEntryManager uses across every classe of the school would mean hundreds of sequential HTTP
// round trips. See utils/fillRateAggregation.ts for the pivoting logic shared across every axis.
const FillRateManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const [language] = useLanguage();
  const t = fillRateManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [isLoading, setIsLoading] = useState(false);
  const [hasAnyClasses, setHasAnyClasses] = useState(false);
  const [cells, setCells] = useState<FillRateCell[]>([]);
  const [attributionsBySection, setAttributionsBySection] = useState<
    Map<string, CourseAssignment[]>
  >(new Map());
  const [staffList, setStaffList] = useState<Staff[]>([]);

  const [axis, setAxis] = useState<Axis>("classe");
  const [mode, setMode] = useState<Mode>("table");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");
  const [termFilter, setTermFilter] = useState<TermFilter>("annual");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setIsLoading(true);
    const perSection = await Promise.all(
      SECTIONS.map(async (section) => {
        const [classes, apcLevels, nonApcRows, apcRows, attributions] = await Promise.all([
          ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
          ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
          MarkReader.fetchFillRateNonApc(accessToken, connection, schoolYear, section),
          MarkReader.fetchFillRateApc(accessToken, connection, schoolYear, section),
          StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
        ]);
        if (classes.length === 0) {
          return null;
        }
        const levelMap = new Map(apcLevels.map((entry) => [entry.level, entry.activated]));
        const isLevelApc = (level: number): boolean => levelMap.get(level) === true;
        return {
          section,
          attributions,
          cells: mergeToUnifiedCells(section, nonApcRows, apcRows, isLevelApc),
        };
      }),
    );
    const staff = await StaffReader.fetchStaff(accessToken, connection, schoolYear);
    setStaffList(staff);
    const usable = perSection.filter((s): s is NonNullable<typeof s> => s !== null);
    setHasAnyClasses(usable.length > 0);
    setCells(usable.flatMap((s) => s.cells));
    setAttributionsBySection(new Map(usable.map((s) => [s.section, s.attributions])));
    setIsLoading(false);
  };

  useEffect(() => {
    load();
    setAxis("classe");
    setMode("table");
    setSectionFilter("all");
    setTermFilter("annual");
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const sectionLabel = (section: string): string =>
    section === "anglophone" ? t.sectionFilterAnglophone : t.sectionFilterFrancophone;

  const formatStaffLabel = (staffId: number): string => {
    const staff = staffList.find((s) => s.staff_id === staffId);
    return staff ? `${staff.name}${staff.surname ? ` ${staff.surname}` : ""} (${staffId})` : String(staffId);
  };

  const sectionFilteredCells =
    sectionFilter === "all" ? cells : cells.filter((c) => c.section === sectionFilter);
  // "Par trimestre" and "Annuel" axes always span the whole year regardless of the term filter -
  // it's what makes those axes what they are.
  const axisIgnoresTermFilter = axis === "term" || axis === "annual";
  const termFilteredCells =
    axisIgnoresTermFilter || termFilter === "annual"
      ? sectionFilteredCells
      : sectionFilteredCells.filter((c) => c.term === termFilter);

  const pivotRows: FillRatePivotRow[] =
    axis === "classe"
      ? pivotByClasse(termFilteredCells, sectionLabel)
      : axis === "subject"
        ? pivotBySubject(termFilteredCells, sectionLabel)
        : axis === "term"
          ? pivotByTerm(sectionFilteredCells, t.term)
          : axis === "annual"
            ? pivotAnnual(sectionFilteredCells, t.annualLabel)
            : pivotByTeacher(termFilteredCells, attributionsBySection, formatStaffLabel);

  const sortedRows = sortByRateAscending(pivotRows);
  const filteredRows = sortedRows.filter((r) =>
    r.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const exportColumns: ExportColumn<FillRatePivotRow>[] = [
    { header: t.tableHeaderIndex, accessor: (_row, index) => index + 1 },
    { header: t.tableHeaderLabel, accessor: (row) => row.label },
    { header: t.tableHeaderRate, accessor: (row) => (row.rate === null ? "" : row.rate.toFixed(1)) },
  ];

  const axisLabel = (a: Axis): string =>
    a === "classe"
      ? t.axisByClasse
      : a === "subject"
        ? t.axisBySubject
        : a === "term"
          ? t.axisByTerm
          : a === "annual"
            ? t.axisAnnual
            : t.axisByTeacher;

  const buildExportSegments = (): string[] => {
    const segments = [axisLabel(axis)];
    if (sectionFilter !== "all") {
      segments.push(sectionLabel(sectionFilter));
    }
    if (!axisIgnoresTermFilter) {
      segments.push(termFilter === "annual" ? t.termFilterAnnual : t.term(termFilter));
    }
    return segments;
  };

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildTimestampedFilename(t.title, buildExportSegments(), "csv"),
      exportColumns,
      sortedRows,
    );
  };

  const handleExportPdf = async () => {
    await exportRowsToPdf(
      t.exportPdfTitle,
      buildTimestampedFilename(t.title, buildExportSegments(), "pdf"),
      exportColumns,
      sortedRows,
      schoolHeader,
    );
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>

      {isLoading ? (
        <Loading />
      ) : !hasAnyClasses ? (
        <p className="opacity-60">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="font-medium">{t.axisLabel}</label>
            <select
              className="select w-44"
              value={axis}
              onChange={(e) => setAxis(e.target.value as Axis)}
            >
              <option value="classe">{t.axisByClasse}</option>
              <option value="subject">{t.axisBySubject}</option>
              <option value="term">{t.axisByTerm}</option>
              <option value="annual">{t.axisAnnual}</option>
              <option value="teacher">{t.axisByTeacher}</option>
            </select>

            <label className="font-medium ml-2">{t.sectionFilterLabel}</label>
            <select
              className="select w-40"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
            >
              <option value="all">{t.sectionFilterAll}</option>
              <option value="francophone">{t.sectionFilterFrancophone}</option>
              <option value="anglophone">{t.sectionFilterAnglophone}</option>
            </select>

            <label className="font-medium ml-2">{t.termFilterLabel}</label>
            <select
              className="select w-36"
              disabled={axisIgnoresTermFilter}
              value={termFilter}
              onChange={(e) =>
                setTermFilter(e.target.value === "annual" ? "annual" : Number(e.target.value))
              }
            >
              <option value="annual">{t.termFilterAnnual}</option>
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {t.term(term)}
                </option>
              ))}
            </select>

            <div className="join ml-2">
              <button
                type="button"
                className={`btn btn-sm join-item gap-2 ${mode === "table" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setMode("table")}
              >
                <Table2 className="w-4 h-4" />
                {t.modeTable}
              </button>
              <button
                type="button"
                className={`btn btn-sm join-item gap-2 ${mode === "chart" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setMode("chart")}
              >
                <BarChart3 className="w-4 h-4" />
                {t.modeChart}
              </button>
            </div>

            {mode === "table" && (
              <input
                type="text"
                className="input w-56 ml-2"
                placeholder={t.filterPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPdf}
                excelLabel={t.exportExcelLabel}
                pdfLabel={t.exportPdfLabel}
                disabled={pivotRows.length === 0}
              />
              <button type="button" className="btn btn-neutral btn-sm gap-2" onClick={load}>
                <RefreshCw className="w-4 h-4" />
                {t.refreshBtn}
              </button>
            </div>
          </div>

          {mode === "table" && (
            <table className="table w-full">
              <thead>
                <tr>
                  <th>{t.tableHeaderIndex}</th>
                  <th>{t.tableHeaderLabel}</th>
                  <th>{t.tableHeaderRate}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.key}>
                    <td>{index + 1}</td>
                    <td>{row.label}</td>
                    <td className={`font-semibold ${rateColorClass(row.rate)}`}>
                      {row.rate === null ? "…" : row.rate.toFixed(1)}
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center opacity-60">
                      {t.emptyClasses}
                    </td>
                  </tr>
                )}
                {sortedRows.length > 0 && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center opacity-60">
                      {t.noSearchResults}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      )}

      <FillRateChartDialog
        isOpen={mode === "chart"}
        onClose={() => setMode("table")}
        title={t.chartTitle}
        entries={sortedRows.map((row, index) => ({ id: index, label: row.label, rate: row.rate }))}
      />
    </div>
  );
};

export default FillRateManager;
