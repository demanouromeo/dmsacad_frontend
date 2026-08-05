import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import type { Classe } from "../../../interfaces/Classe";
import {
  loadReportCardDataForClasse,
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../../../utils/reportCard/loadAnnualReportCardData";
import { formatRcNumber } from "../../../utils/reportCard/reportCardCompute";
import {
  buildStatGroupeesBilanRow,
  buildStatGroupeesRow,
  type StatGroupeesRow,
} from "../../../utils/statGroupees/statGroupeesCompute";
import {
  exportStatGroupeesAnnualToPdf,
  exportStatGroupeesTermToPdf,
  STAT_GROUPEES_TERM_ORDINAL,
} from "../../../utils/statGroupees/exportStatGroupeesPdf";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  type ExportColumn,
} from "../../../utils/exportData";
import { DEFAULT_REPORT_CONCURRENCY, mapWithConcurrency } from "../../../utils/concurrency";
import PickerSkeleton from "../../sharedcomp/skeletons/PickerSkeleton";
import LoadingOverlay, { type LoadingOverlayProgress } from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const TERMS = [1, 2, 3];

const csvColumns: ExportColumn<StatGroupeesRow>[] = [
  { header: "Classe", accessor: (r) => r.classeName },
  { header: "Moy. Géné.", accessor: (r) => formatRcNumber(r.moyGene) },
  { header: "Effectif Garçons", accessor: (r) => r.effectifG },
  { header: "Effectif Filles", accessor: (r) => r.effectifF },
  { header: "Effectif Total", accessor: (r) => r.effectifT },
  { header: "Présents Garçons", accessor: (r) => r.presentsG },
  { header: "Présents Filles", accessor: (r) => r.presentsF },
  { header: "Présents Total", accessor: (r) => r.presentsT },
  { header: "% Participation Garçons", accessor: (r) => `${formatRcNumber(r.participationG)}%` },
  { header: "% Participation Filles", accessor: (r) => `${formatRcNumber(r.participationF)}%` },
  { header: "% Participation Total", accessor: (r) => `${formatRcNumber(r.participationT)}%` },
  { header: "Moy. >= 10 Garçons", accessor: (r) => r.sup10G },
  { header: "Moy. >= 10 Filles", accessor: (r) => r.sup10F },
  { header: "Moy. >= 10 Total", accessor: (r) => r.sup10T },
  { header: "% Réussite Garçons", accessor: (r) => `${formatRcNumber(r.reussiteG)}%` },
  { header: "% Réussite Filles", accessor: (r) => `${formatRcNumber(r.reussiteF)}%` },
  { header: "% Réussite Total", accessor: (r) => `${formatRcNumber(r.reussiteT)}%` },
  { header: "Moy. Max.", accessor: (r) => formatRcNumber(r.moyMax) },
  { header: "Moy. Min.", accessor: (r) => formatRcNumber(r.moyMin) },
  { header: "Appréciation", accessor: (r) => r.appreciation },
];

// "Statistiques Groupées" - a whole-section report (every classe of the current section, no classe
// selector - unlike PvManager, matching the reference mockup which has no classe picker at all),
// term or annual, export-only like PvManager (no on-screen preview table - see PvManager's own
// comment on why a PV-shaped report skips the table). Row computation lives in
// src/utils/statGroupees/statGroupeesCompute.ts (reverse-engineered from 4 sample PDFs), reusing
// the report-card module's own loaders wholesale (loadReportCardDataForClasse/
// loadAnnualReportCardDataForClasse/loadAnnualApcReportCardDataForClasse) rather than a new fetch
// path, same precedent as PvManager/ScholarshipManager.
const StatGroupeesManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);

  const [isSaving, setIsSaving] = useState(false);
  const [printProgress, setPrintProgress] = useState<LoadingOverlayProgress | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, apcLevelList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      ]);
      setClasses(classeList);
      setApcLevels(new Map(apcLevelList.map((entry) => [entry.level, entry.activated])));
      setIsLoadingClasses(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  // Bounded concurrency (see src/utils/concurrency.ts) - each classe's fetch is independent and
  // rows are only assembled into the final PDF/CSV after every classe resolves, so overlapping
  // DEFAULT_REPORT_CONCURRENCY fetches is a pure wall-clock win over the previous one-at-a-time loop.
  const buildTermRows = async (): Promise<StatGroupeesRow[]> => {
    const total = classes.length;
    return mapWithConcurrency(
      classes,
      DEFAULT_REPORT_CONCURRENCY,
      async (classe) => {
        const isApc = apcLevels.get(classe.level) === true;
        const data = await loadReportCardDataForClasse({
          accessToken,
          connection,
          schoolYear,
          section,
          language: "fr",
          classeId: classe.classe_id,
          term: selectedTerm,
          isApc,
        });
        return buildStatGroupeesRow(
          classe.classe_name,
          data.students.map((s) => ({ sexe: s.sexe, moy: s.moyenneTrim })),
          data.classeStats,
        );
      },
      (classe, _index, completed) =>
        setPrintProgress({
          current: completed,
          total,
          label: "Chargement des données",
          overall: `Classe ${completed}/${total}: ${classe.classe_name}`,
        }),
    );
  };

  const buildAnnualRows = async (): Promise<StatGroupeesRow[]> => {
    const total = classes.length;
    return mapWithConcurrency(
      classes,
      DEFAULT_REPORT_CONCURRENCY,
      async (classe) => {
        const isApc = apcLevels.get(classe.level) === true;
        const params = { accessToken, connection, schoolYear, section, classes, schoolHeader, language: "fr" as const, classeId: classe.classe_id };
        const data = isApc
          ? await loadAnnualApcReportCardDataForClasse(params)
          : await loadAnnualReportCardDataForClasse(params);
        return buildStatGroupeesRow(
          classe.classe_name,
          data.students.map((s) => ({ sexe: s.sexe, moy: s.avgAnnual })),
          data.classeStats,
        );
      },
      (classe, _index, completed) =>
        setPrintProgress({
          current: completed,
          total,
          label: "Chargement des données",
          overall: `Classe ${completed}/${total}: ${classe.classe_name}`,
        }),
    );
  };

  const handlePrintTerm = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildTermRows();
      const bilanRow = buildStatGroupeesBilanRow(rows);
      const filename = buildTimestampedFilename(
        `Stat groupees - Trim ${selectedTerm}`,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportStatGroupeesTermToPdf(selectedTerm, rows, bilanRow, schoolHeader, filename);
      showToast("Statistiques groupées générées avec succès.", { type: "info" });
    } catch (error) {
      console.error("StatGroupeesManager.handlePrintTerm(): Error", error);
      showToast("Échec de la génération des statistiques groupées.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handlePrintAnnual = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildAnnualRows();
      const bilanRow = buildStatGroupeesBilanRow(rows);
      const filename = buildTimestampedFilename(
        "Stat groupees - Annuelles",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportStatGroupeesAnnualToPdf(rows, bilanRow, schoolHeader, filename);
      showToast("Statistiques groupées annuelles générées avec succès.", { type: "info" });
    } catch (error) {
      console.error("StatGroupeesManager.handlePrintAnnual(): Error", error);
      showToast("Échec de la génération des statistiques groupées annuelles.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handleExportExcelTerm = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildTermRows();
      rows.push(buildStatGroupeesBilanRow(rows));
      exportRowsToCsv(
        buildTimestampedFilename(
          `Stat groupees - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        rows,
      );
    } catch (error) {
      console.error("StatGroupeesManager.handleExportExcelTerm(): Error", error);
      showToast("Échec de l'export Excel.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handleExportExcelAnnual = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildAnnualRows();
      rows.push(buildStatGroupeesBilanRow(rows));
      exportRowsToCsv(
        buildTimestampedFilename(
          "Stat groupees - Annuelles",
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        rows,
      );
    } catch (error) {
      console.error("StatGroupeesManager.handleExportExcelAnnual(): Error", error);
      showToast("Échec de l'export Excel.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay progress={printProgress} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Statistiques Groupées</h1>
          <p className="page-subtitle">Année Scolaire: {schoolYear}</p>
        </div>
        <CloseButton />
      </div>

      {isLoadingClasses ? (
        <PickerSkeleton buttons={4} />
      ) : classes.length === 0 ? (
        <p className="empty-state">Aucune classe trouvée pour cette année.</p>
      ) : (
        <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-5">
          <p className="text-lg">
            Imprimer les statistiques groupées du{" "}
            <span className="font-semibold text-primary">
              {STAT_GROUPEES_TERM_ORDINAL[selectedTerm]} TRIMESTRE
            </span>
          </p>

          <div className="flex items-center gap-2">
            <select
              className="select w-40"
              title="Trimestres (1, 2, 3)"
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(Number(e.target.value))}
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary gap-2" disabled={isSaving} onClick={handlePrintTerm}>
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button type="button" className="btn btn-secondary gap-2" disabled={isSaving} onClick={handlePrintAnnual}>
              <Printer className="w-4 h-4" />
              Stat. annuelle
            </button>
            <button
              type="button"
              className="btn btn-success gap-2"
              disabled={isSaving}
              onClick={handleExportExcelTerm}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              type="button"
              className="btn btn-success gap-2"
              disabled={isSaving}
              onClick={handleExportExcelAnnual}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel annuel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatGroupeesManager;
