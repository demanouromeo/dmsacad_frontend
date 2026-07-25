import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { ThParamReader } from "../../../dbmanger/ThParamReader";
import type { Classe } from "../../../interfaces/Classe";
import type { ThParam } from "../../../interfaces/ThParam";
import {
  loadReportCardDataForClasse,
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../../../utils/reportCard/loadAnnualReportCardData";
import { formatRcNumber } from "../../../utils/reportCard/reportCardCompute";
import {
  buildSyntheseGlobaleRow,
  type SyntheseGlobaleRow,
} from "../../../utils/syntheseGlobale/syntheseGlobaleCompute";
import {
  exportSyntheseGlobaleAnnualToPdf,
  exportSyntheseGlobaleTermToPdf,
} from "../../../utils/syntheseGlobale/exportSyntheseGlobalePdf";
import { STAT_GROUPEES_TERM_ORDINAL } from "../../../utils/statGroupees/exportStatGroupeesPdf";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  type ExportColumn,
} from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay, { type LoadingOverlayProgress } from "../../sharedcomp/LoadingOverlay";

const TERMS = [1, 2, 3];

const csvColumns: ExportColumn<SyntheseGlobaleRow>[] = [
  { header: "Classe", accessor: (r) => r.classeName },
  { header: "Moyenne de la classe", accessor: (r) => formatRcNumber(r.moyenneClasse) },
  { header: "Moyenne du premier", accessor: (r) => formatRcNumber(r.moyenneDuPremier) },
  { header: "Moyenne du dernier", accessor: (r) => formatRcNumber(r.moyenneDuDernier) },
  { header: "Ecart type", accessor: (r) => formatRcNumber(r.ecartType) },
  { header: "Nb. élèves ayant des jours d'exclusions", accessor: (r) => r.nbExclusion },
  { header: "Tableau d'honneur", accessor: (r) => r.tableauHonneur },
  { header: "Tableau H. & Encourag.", accessor: (r) => r.tableauHEncourag },
  { header: "Tableau d'honneur E. & F.", accessor: (r) => r.tableauHonneurEF },
  { header: "Effectif", accessor: (r) => r.effectif },
  { header: "classés", accessor: (r) => r.classes },
  { header: "Non classés", accessor: (r) => r.nonClasses },
  { header: "Nb. moyennes >= 10/20", accessor: (r) => r.nbSup10 },
  { header: "Nb. moyennes < 10/20", accessor: (r) => r.nbInf10 },
  { header: "Réussites (classés)", accessor: (r) => r.reussitesText },
  { header: "Taux Réussites (classés)", accessor: (r) => `${formatRcNumber(r.tauxReussite)}%` },
  { header: "Nom du premier", accessor: (r) => r.nomDuPremier },
];

// "Synthèse Globale" - a whole-section report (every classe of the current section, no classe
// selector, term or annual), export-only like PvManager/StatGroupeesManager - no on-screen preview
// table. Row computation lives in src/utils/syntheseGlobale/syntheseGlobaleCompute.ts
// (reverse-engineered from 4 sample PDFs), reusing the report-card module's own loaders wholesale
// (loadReportCardDataForClasse/loadAnnualReportCardDataForClasse/
// loadAnnualApcReportCardDataForClasse) rather than a new fetch path - same precedent as
// StatGroupeesManager. Unlike StatGroupeesManager, this report also needs the school year's
// ThParam (Tableau d'honneur thresholds) - fetched once per print/export, outside the per-classe
// loop, same "fetch once, reuse across every classe" shape as ReportCardManager.handlePrintTh.
const SyntheseGlobaleManager = () => {
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

  const buildTermRows = async (thParam: ThParam | null): Promise<SyntheseGlobaleRow[]> => {
    const rows: SyntheseGlobaleRow[] = [];
    const total = classes.length;
    for (let i = 0; i < classes.length; i++) {
      const classe = classes[i];
      setPrintProgress({
        current: i,
        total,
        label: "Chargement des données",
        overall: `Classe ${i + 1}/${total}: ${classe.classe_name}`,
      });
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
      rows.push(
        buildSyntheseGlobaleRow(
          classe.classe_name,
          data.students.map((s) => ({
            name: s.name,
            surname: s.surname,
            moy: s.moyenneTrim,
            isClassified: s.isClassified,
            absNonJust: s.discipline.absNonJust,
            exclusionJours: s.discipline.exclusionJours,
          })),
          data.classeStats,
          thParam,
        ),
      );
    }
    return rows;
  };

  const buildAnnualRows = async (thParam: ThParam | null): Promise<SyntheseGlobaleRow[]> => {
    const rows: SyntheseGlobaleRow[] = [];
    const total = classes.length;
    for (let i = 0; i < classes.length; i++) {
      const classe = classes[i];
      setPrintProgress({
        current: i,
        total,
        label: "Chargement des données",
        overall: `Classe ${i + 1}/${total}: ${classe.classe_name}`,
      });
      const isApc = apcLevels.get(classe.level) === true;
      const params = {
        accessToken,
        connection,
        schoolYear,
        section,
        classes,
        schoolHeader,
        language: "fr" as const,
        classeId: classe.classe_id,
      };
      const data = isApc
        ? await loadAnnualApcReportCardDataForClasse(params)
        : await loadAnnualReportCardDataForClasse(params);
      rows.push(
        buildSyntheseGlobaleRow(
          classe.classe_name,
          data.students.map((s) => ({
            name: s.name,
            surname: s.surname,
            moy: s.avgAnnual,
            isClassified: s.isClassifiedAnnual,
            absNonJust: s.disciplineAnnual.absNonJust,
            exclusionJours: s.disciplineAnnual.exclusionJours,
          })),
          data.classeStats,
          thParam,
        ),
      );
    }
    return rows;
  };

  const handlePrintTerm = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const thParam = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      const rows = await buildTermRows(thParam);
      const filename = buildTimestampedFilename(
        `Synthese globale - Trim ${selectedTerm}`,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportSyntheseGlobaleTermToPdf(selectedTerm, rows, thParam, schoolYear, schoolHeader, filename);
      showToast("Synthèse globale générée avec succès.", { type: "info" });
    } catch (error) {
      console.error("SyntheseGlobaleManager.handlePrintTerm(): Error", error);
      showToast("Échec de la génération de la synthèse globale.", { type: "danger" });
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
      const thParam = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      const rows = await buildAnnualRows(thParam);
      const filename = buildTimestampedFilename(
        "Synthese globale - Annuelle",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportSyntheseGlobaleAnnualToPdf(rows, thParam, schoolYear, schoolHeader, filename);
      showToast("Synthèse globale annuelle générée avec succès.", { type: "info" });
    } catch (error) {
      console.error("SyntheseGlobaleManager.handlePrintAnnual(): Error", error);
      showToast("Échec de la génération de la synthèse globale annuelle.", { type: "danger" });
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
      const thParam = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      const rows = await buildTermRows(thParam);
      exportRowsToCsv(
        buildTimestampedFilename(
          `Synthese globale - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        rows,
      );
    } catch (error) {
      console.error("SyntheseGlobaleManager.handleExportExcelTerm(): Error", error);
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
      const thParam = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      const rows = await buildAnnualRows(thParam);
      exportRowsToCsv(
        buildTimestampedFilename(
          "Synthese globale - Annuelle",
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        rows,
      );
    } catch (error) {
      console.error("SyntheseGlobaleManager.handleExportExcelAnnual(): Error", error);
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
          <h1 className="page-title">Synthèse globale</h1>
          <p className="page-subtitle">Année Scolaire: {schoolYear}</p>
        </div>
      </div>

      {isLoadingClasses ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">Aucune classe trouvée pour cette année.</p>
      ) : (
        <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-5">
          <p className="text-lg">
            Synthèse Globale du{" "}
            <span className="font-semibold text-primary">
              '{STAT_GROUPEES_TERM_ORDINAL[selectedTerm]} TRIMESTRE'
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
              Annuel
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

export default SyntheseGlobaleManager;
