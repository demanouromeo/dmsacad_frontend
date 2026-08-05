import { useEffect, useState, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { scholarshipManagerTranslations } from "../../../i18n/translations";
import { MyConstants } from "../../../dbmanger/MyConstants";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { formatRcNumber } from "../../../utils/reportCard/reportCardCompute";
import {
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../../../utils/reportCard/loadAnnualReportCardData";
import {
  exportRowsToCsv,
  exportRowsToPdf,
  buildTimestampedFilename,
  capitalizeSectionName,
  type ExportColumn,
} from "../../../utils/exportData";
import { DEFAULT_REPORT_CONCURRENCY, mapWithConcurrency } from "../../../utils/concurrency";
import type { Classe } from "../../../interfaces/Classe";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay, { type LoadingOverlayProgress } from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import ExportButtons from "../../sharedcomp/ExportButtons";

interface ScholarshipRow {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  sexe: string;
  classeName: string;
  avgAnnual: number;
}

const clampedStoredMinAvg = (): number => {
  const stored = Number(localStorage.getItem(MyConstants.SCHOLARSHIP_MIN_AVG_KEY));
  return Number.isFinite(stored) && stored > 0 && stored < 20
    ? stored
    : MyConstants.DEFAULT_SCHOLARSHIP_MIN_AVG;
};

// "Bourse" - whole-section report, no classe selector (unlike Basculement/Promotion/Insolvable):
// a boursier(ère) is any non-dismissed student of the current section whose annual average falls
// in [minAvg, 20]. Reuses the exact same annual-average/dismissal pipeline Basculement/Promotion
// already established (loadAnnualReportCardDataForClasse(Apc) + AnnualStudentData.decision.kind
// === "exclu" for "dismissed") rather than recomputing computeMustDismiss here - see
// annualReportCardCompute.ts. Loops sequentially over every classe of the section (same
// "avoid firing every request at once" precedent as BasculementManager's handleInit and
// exportAllMarksReportToPdf), since there's no lightweight backend aggregate for annual averages.
const ScholarshipManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = scholarshipManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [allRows, setAllRows] = useState<ScholarshipRow[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LoadingOverlayProgress | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [viewMode, setViewMode] = useState<"all" | "girls">("all");

  const [minAvg, setMinAvg] = useState<number>(clampedStoredMinAvg);
  const [minAvgInput, setMinAvgInput] = useState<string>(() => String(clampedStoredMinAvg()));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingData(true);
      setLoadProgress(null);
      const [classeList, apcLevelList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      ]);
      if (cancelled) return;
      setClasses(classeList);
      const apcLevelMap = new Map(apcLevelList.map((entry) => [entry.level, entry.activated]));

      const total = classeList.length;
      // Bounded concurrency (see src/utils/concurrency.ts) - each classe's fetch is independent
      // and rows are only committed to state once every classe has resolved, so overlapping
      // DEFAULT_REPORT_CONCURRENCY fetches is a pure wall-clock win over the previous
      // one-at-a-time loop. Unlike the old loop, `cancelled` is only checked once at the end
      // (fetches already in flight can't be aborted mid-flight either way) rather than after each
      // classe - a stale response is simply discarded instead of stopping early.
      const perClasse = await mapWithConcurrency(
        classeList,
        DEFAULT_REPORT_CONCURRENCY,
        async (classe): Promise<ScholarshipRow[]> => {
          const isApc = apcLevelMap.get(classe.level) === true;
          const params = {
            accessToken,
            connection,
            schoolYear,
            section,
            classes: classeList,
            schoolHeader,
            language,
            classeId: classe.classe_id,
          };
          const annualData = isApc
            ? await loadAnnualApcReportCardDataForClasse(params)
            : await loadAnnualReportCardDataForClasse(params);
          return annualData.students
            .filter((s) => s.decision.kind !== "exclu")
            .map((s) => ({
              studId: s.studId,
              matricule: s.matricule,
              name: s.name,
              surname: s.surname,
              sexe: s.sexe,
              classeName: classe.classe_name,
              avgAnnual: s.avgAnnual,
            }));
        },
        (classe, _index, completed) =>
          setLoadProgress({
            current: completed,
            total,
            label: t.loadingMessage,
            overall: t.progressClasse(completed, total, classe.classe_name),
          }),
      );
      const rows: ScholarshipRow[] = perClasse.flat();
      if (!cancelled) {
        setAllRows(rows);
        setIsLoadingData(false);
        setLoadProgress(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section, reloadToken]);

  const boursiers = useMemo(
    () =>
      allRows
        .filter((r) => r.avgAnnual >= minAvg && r.avgAnnual <= 20)
        .sort(
          (a, b) =>
            b.avgAnnual - a.avgAnnual ||
            `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "fr", {
              sensitivity: "base",
            }),
        ),
    [allRows, minAvg],
  );
  const boursieres = useMemo(() => boursiers.filter((r) => r.sexe === "F"), [boursiers]);
  const displayedRows = viewMode === "girls" ? boursieres : boursiers;

  const commitMinAvg = () => {
    const parsed = Number(minAvgInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 20) {
      showToast(t.minAvgInvalid, { type: "warning" });
      setMinAvgInput(String(minAvg));
      return;
    }
    setMinAvg(parsed);
    setMinAvgInput(String(parsed));
    localStorage.setItem(MyConstants.SCHOLARSHIP_MIN_AVG_KEY, String(parsed));
  };

  const exportColumns: ExportColumn<ScholarshipRow>[] = [
    { header: t.tableHeaderNo, accessor: (_row, index) => index + 1 },
    { header: t.tableHeaderMatricule, accessor: (row) => row.matricule },
    { header: t.tableHeaderName, accessor: (row) => `${row.name} ${row.surname}`.trim() },
    { header: t.tableHeaderClasse, accessor: (row) => row.classeName },
    { header: t.tableHeaderSexe, accessor: (row) => row.sexe },
    { header: t.tableHeaderMoyenne, accessor: (row) => formatRcNumber(row.avgAnnual) },
  ];

  const sectionSegment = [`Section ${capitalizeSectionName(section)}`];

  const handleExportBoursiersCsv = () => {
    const title = t.pdfTitleBoursiers(schoolYear);
    exportRowsToCsv(buildTimestampedFilename(title, sectionSegment, "csv"), exportColumns, boursiers);
  };

  const handleExportBoursiersPdf = async () => {
    const title = t.pdfTitleBoursiers(schoolYear);
    await exportRowsToPdf(
      title,
      buildTimestampedFilename(title, sectionSegment, "pdf"),
      exportColumns,
      boursiers,
      schoolHeader,
    );
  };

  const handleExportBoursieresCsv = () => {
    const title = t.pdfTitleBoursieres(schoolYear);
    exportRowsToCsv(buildTimestampedFilename(title, sectionSegment, "csv"), exportColumns, boursieres);
  };

  const handleExportBoursieresPdf = async () => {
    const title = t.pdfTitleBoursieres(schoolYear);
    await exportRowsToPdf(
      title,
      buildTimestampedFilename(title, sectionSegment, "pdf"),
      exportColumns,
      boursieres,
      schoolHeader,
    );
  };

  const nothingLoadedYet = isLoadingData && classes.length === 0 && allRows.length === 0;

  return (
    <div className="page-shell">
      {isLoadingData && <LoadingOverlay progress={loadProgress} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2"
            disabled={isLoadingData}
            onClick={() => setReloadToken((n) => n + 1)}
          >
            <RefreshCw className="w-4 h-4" />
            {t.refreshBtn}
          </button>
          <CloseButton />
        </div>
      </div>

      {nothingLoadedYet ? (
        <TableSkeleton rows={6} columns={6} showToolbar={false} />
      ) : classes.length === 0 ? (
        <p className="empty-state">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-lg flex-wrap">
              <span>{t.minAvgLabel}</span>
              <span className="font-semibold">[</span>
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                className="input input-sm input-bordered w-24 text-center"
                title={t.minAvgTooltip}
                value={minAvgInput}
                onChange={(e) => setMinAvgInput(e.target.value)}
                onBlur={commitMinAvg}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
              <span className="font-semibold">, 20]</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ExportButtons
                onExportExcel={handleExportBoursiersCsv}
                onExportPdf={handleExportBoursiersPdf}
                excelLabel={t.exportBtn}
                pdfLabel={t.pdfBoursiersLabel}
                disabled={boursiers.length === 0}
              />
              <ExportButtons
                onExportExcel={handleExportBoursieresCsv}
                onExportPdf={handleExportBoursieresPdf}
                excelLabel={t.fillesBoursieresBtn}
                pdfLabel={t.pdfBoursieresLabel}
                disabled={boursieres.length === 0}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary badge-outline">{t.statBoursiers(boursiers.length)}</span>
              <span className="badge badge-secondary badge-outline">
                {t.statBoursieres(boursieres.length)}
              </span>
            </div>
          </div>

          <div className="join mb-4">
            <button
              type="button"
              className={`btn btn-sm join-item ${viewMode === "all" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("all")}
            >
              {t.tabAll(boursiers.length)}
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${viewMode === "girls" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setViewMode("girls")}
            >
              {t.tabGirls(boursieres.length)}
            </button>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra data-table">
                <thead>
                  <tr>
                    <th>{t.tableHeaderNo}</th>
                    <th>{t.tableHeaderMatricule}</th>
                    <th>{t.tableHeaderName}</th>
                    <th>{t.tableHeaderClasse}</th>
                    <th>{t.tableHeaderSexe}</th>
                    <th>{t.tableHeaderMoyenne}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row, index) => (
                    <tr key={row.studId}>
                      <td>{index + 1}</td>
                      <td>{row.matricule}</td>
                      <td>
                        {row.name} {row.surname}
                      </td>
                      <td>{row.classeName}</td>
                      <td>{row.sexe}</td>
                      <td>{formatRcNumber(row.avgAnnual)}</td>
                    </tr>
                  ))}
                  {displayedRows.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <p className="empty-state">
                          {viewMode === "girls" ? t.emptyBoursieres : t.emptyBoursiers}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScholarshipManager;
