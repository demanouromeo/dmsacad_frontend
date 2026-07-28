import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import type { Classe } from "../../../interfaces/Classe";
import type { AnnualReportCardData, AnnualReportCardDataApc } from "../../../interfaces/AnnualReportCard";
import { loadPvAnnualData, loadPvTermData } from "../../../utils/pv/loadPvData";
import {
  buildPvAnnualRowsApc,
  buildPvAnnualRowsNonApc,
  buildPvTermRows,
  formatPvNumber,
  formatPvTermRang,
  sortPvRows,
  type PvAnnualRow,
  type PvSortMode,
  type PvTermRow,
} from "../../../utils/pv/pvCompute";
import { exportPvAnnualToPdf, exportPvTermToPdf } from "../../../utils/pv/exportPvPdf";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  type ExportColumn,
} from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay, { type LoadingOverlayProgress } from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const TERMS = [1, 2, 3];

const fullName = (row: { name: string; surname: string }): string =>
  `${row.name} ${row.surname}`.trim();

const termCsvColumnsNonApc: ExportColumn<PvTermRow>[] = [
  { header: "N°", accessor: (r) => r.no },
  { header: "Matricule", accessor: (r) => r.matricule },
  { header: "Noms et Prénoms", accessor: (r) => fullName(r) },
  { header: "Date Naiss.", accessor: (r) => r.bday },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "Satut", accessor: (r) => (r.repeating ? "OUI" : "NON") },
  { header: "Abs.1", accessor: () => "" },
  { header: "Abs.2", accessor: (r) => r.absUnjust ?? "" },
  { header: "T Abs.", accessor: (r) => r.absUnjust ?? "" },
  { header: "M Eval1", accessor: (r) => formatPvNumber(r.eval1) },
  { header: "M Eval2", accessor: (r) => formatPvNumber(r.eval2) },
  { header: "Moy", accessor: (r) => formatPvNumber(r.moy) },
  { header: "Rang", accessor: (r) => formatPvTermRang(r.rang) },
  { header: "Observations", accessor: (r) => r.observation },
];

const termCsvColumnsApc: ExportColumn<PvTermRow>[] = [
  { header: "N°", accessor: (r) => r.no },
  { header: "Matricule", accessor: (r) => r.matricule },
  { header: "Noms et Prénoms", accessor: (r) => fullName(r) },
  { header: "Date Naiss.", accessor: (r) => r.bday },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "Satut", accessor: (r) => (r.repeating ? "OUI" : "NON") },
  { header: "Abs.1", accessor: () => "" },
  { header: "Abs.2", accessor: (r) => r.absUnjust ?? "" },
  { header: "T Abs.", accessor: (r) => r.absUnjust ?? "" },
  { header: "Moy", accessor: (r) => formatPvNumber(r.moy) },
  { header: "Cote", accessor: (r) => r.cote ?? "" },
  { header: "Observations", accessor: (r) => r.observation },
];

const annualCsvColumns: ExportColumn<PvAnnualRow>[] = [
  { header: "N°", accessor: (r) => r.no },
  { header: "Matricule", accessor: (r) => r.matricule },
  { header: "Noms et Prénoms", accessor: (r) => fullName(r) },
  { header: "Date Naiss.", accessor: (r) => r.bday },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "Satut", accessor: (r) => (r.repeating ? "OUI" : "NON") },
  { header: "Discipline Trim1", accessor: (r) => r.absByTerm[0] ?? "" },
  { header: "Discipline Trim2", accessor: (r) => r.absByTerm[1] ?? "" },
  { header: "Discipline Trim3", accessor: (r) => r.absByTerm[2] ?? "" },
  { header: "T Abs.", accessor: (r) => r.absTotal ?? "" },
  { header: "Travail Trim1", accessor: (r) => formatPvNumber(r.travailByTerm[0]) },
  { header: "Travail Trim2", accessor: (r) => formatPvNumber(r.travailByTerm[1]) },
  { header: "Travail Trim3", accessor: (r) => formatPvNumber(r.travailByTerm[2]) },
  { header: "Moy.", accessor: (r) => formatPvNumber(r.moy) },
  { header: "Rang", accessor: (r) => r.rangText },
  { header: "Décision du c.", accessor: (r) => r.decisionText },
];

// "Procès Verbaux" (PV) - a per-classe class-list export (term or annual, sorted alphabetically or
// by merit) for the official conseil de classe minutes. Unlike ReportCardManager, this screen has no
// on-screen preview table - every action loads data on demand and exports straight to PDF/CSV, since
// a PV is purely a printed/exported document (see PvManager's reference mockup). Reuses the report
// card module's own computation/loaders wholesale (src/utils/pv/loadPvData.ts, pvCompute.ts) rather
// than re-deriving averages/ranks/classification/decision.
const PvManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [sortMode, setSortMode] = useState<PvSortMode>("alpha");

  const [isSaving, setIsSaving] = useState(false);
  const [printProgress, setPrintProgress] = useState<LoadingOverlayProgress | null>(null);

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const isSelectedClasseApc = selectedClasse ? apcLevels.get(selectedClasse.level) === true : false;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, apcLevelList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      ]);
      const levelMap = new Map(apcLevelList.map((entry) => [entry.level, entry.activated]));
      setClasses(classeList);
      setApcLevels(levelMap);
      setSelectedClasseId((prev) => {
        if (prev !== null && classeList.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return classeList.length > 0 ? classeList[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const buildTermRowsForClasse = useCallback(
    async (classeId: number, isApc: boolean): Promise<PvTermRow[]> => {
      const { reportCardData, disciplineByStudId } = await loadPvTermData({
        accessToken,
        connection,
        schoolYear,
        section,
        classeId,
        term: selectedTerm,
        isApc,
      });
      return sortPvRows(buildPvTermRows(reportCardData, disciplineByStudId, isApc), sortMode);
    },
    [accessToken, connection, schoolYear, section, selectedTerm, sortMode],
  );

  const buildAnnualRowsForClasse = useCallback(
    async (classeId: number, isApc: boolean): Promise<PvAnnualRow[]> => {
      const { annualData, disciplineByTerm } = await loadPvAnnualData({
        accessToken,
        connection,
        schoolYear,
        section,
        classes,
        schoolHeader,
        classeId,
        isApc,
      });
      const rows = isApc
        ? buildPvAnnualRowsApc(annualData as AnnualReportCardDataApc, disciplineByTerm)
        : buildPvAnnualRowsNonApc(annualData as AnnualReportCardData, disciplineByTerm);
      return sortPvRows(rows, sortMode);
    },
    [accessToken, connection, schoolYear, section, classes, schoolHeader, sortMode],
  );

  const handlePrint = async () => {
    if (!selectedClasse) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildTermRowsForClasse(selectedClasse.classe_id, isSelectedClasseApc);
      if (rows.length === 0) {
        showToast("Aucun élève dans cette classe.", { type: "warning" });
      } else {
        const filename = buildTimestampedFilename(
          `PV ${selectedClasse.classe_name} TRIM${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        await exportPvTermToPdf(
          selectedTerm,
          selectedClasse.classe_name,
          schoolYear,
          isSelectedClasseApc,
          rows,
          schoolHeader,
          filename,
        );
        showToast("PV généré avec succès.", { type: "info" });
      }
    } catch (error) {
      console.error("PvManager.handlePrint(): Error", error);
      showToast("Échec de la génération du PV.", { type: "danger" });
    }
    setIsSaving(false);
  };

  // Sequential loop over every classe of the section - same shape as
  // ReportCardManager.handlePrintAllClasses, one PDF `doc.save()` per classe.
  const handlePrintAll = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    let anyPrinted = false;
    try {
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
        const rows = await buildTermRowsForClasse(classe.classe_id, isApc);
        if (rows.length === 0) {
          continue;
        }
        anyPrinted = true;
        const filename = buildTimestampedFilename(
          `PV ${classe.classe_name} TRIM${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        await exportPvTermToPdf(selectedTerm, classe.classe_name, schoolYear, isApc, rows, schoolHeader, filename);
      }
      showToast(
        anyPrinted ? "PV générés avec succès." : "Aucune classe avec des élèves cette année.",
        { type: anyPrinted ? "info" : "warning" },
      );
    } catch (error) {
      console.error("PvManager.handlePrintAll(): Error", error);
      showToast("Échec de la génération des PV.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handlePrintAnnual = async () => {
    if (!selectedClasse) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildAnnualRowsForClasse(selectedClasse.classe_id, isSelectedClasseApc);
      if (rows.length === 0) {
        showToast("Aucun élève dans cette classe.", { type: "warning" });
      } else {
        const filename = buildTimestampedFilename(
          `PV Annuel ${selectedClasse.classe_name}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        await exportPvAnnualToPdf(selectedClasse.classe_name, schoolYear, rows, schoolHeader, filename);
        showToast("PV annuel généré avec succès.", { type: "info" });
      }
    } catch (error) {
      console.error("PvManager.handlePrintAnnual(): Error", error);
      showToast("Échec de la génération du PV annuel.", { type: "danger" });
    }
    setIsSaving(false);
  };

  const handleExportExcel = async () => {
    if (!selectedClasse) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildTermRowsForClasse(selectedClasse.classe_id, isSelectedClasseApc);
      const columns = isSelectedClasseApc ? termCsvColumnsApc : termCsvColumnsNonApc;
      exportRowsToCsv(
        buildTimestampedFilename(
          `PV ${selectedClasse.classe_name} TRIM${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        columns,
        rows,
      );
    } catch (error) {
      console.error("PvManager.handleExportExcel(): Error", error);
      showToast("Échec de l'export Excel.", { type: "danger" });
    }
    setIsSaving(false);
  };

  const handleExportExcelAnnual = async () => {
    if (!selectedClasse) {
      return;
    }
    setIsSaving(true);
    try {
      const rows = await buildAnnualRowsForClasse(selectedClasse.classe_id, isSelectedClasseApc);
      exportRowsToCsv(
        buildTimestampedFilename(
          `PV Annuel ${selectedClasse.classe_name}`,
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        annualCsvColumns,
        rows,
      );
    } catch (error) {
      console.error("PvManager.handleExportExcelAnnual(): Error", error);
      showToast("Échec de l'export Excel.", { type: "danger" });
    }
    setIsSaving(false);
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay progress={printProgress} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Procès Verbaux</h1>
          <p className="page-subtitle">Année Scolaire: {schoolYear}</p>
        </div>
        <CloseButton />
      </div>

      {isLoadingClasses ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">Aucune classe trouvée pour cette année.</p>
      ) : (
        <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-2">
              <label className="font-medium">Classe</label>
              <select
                className="select w-56"
                title="Classe dont on génère le PV"
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
              <label className="font-medium">Trimestre</label>
              <select
                className="select w-40"
                title="Trimestres (1, 2, 3)"
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(Number(e.target.value))}
              >
                {TERMS.map((term) => (
                  <option key={term} value={term}>
                    Trimestre {term}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="pvSortMode"
                className="radio radio-sm"
                checked={sortMode === "alpha"}
                onChange={() => setSortMode("alpha")}
              />
              <span className="label-text">Par ordre alphabétique</span>
            </label>
            <label className="label cursor-pointer gap-2">
              <input
                type="radio"
                name="pvSortMode"
                className="radio radio-sm"
                checked={sortMode === "merit"}
                onChange={() => setSortMode("merit")}
              />
              <span className="label-text">Par ordre de mérite</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary gap-2"
              disabled={isSaving || !selectedClasse}
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
            <button
              type="button"
              className="btn btn-secondary gap-2"
              disabled={isSaving || classes.length === 0}
              onClick={handlePrintAll}
            >
              <Printer className="w-4 h-4" />
              Imprimer tout
            </button>
            <button
              type="button"
              className="btn btn-outline gap-2"
              disabled={isSaving || !selectedClasse}
              onClick={handlePrintAnnual}
            >
              <Printer className="w-4 h-4" />
              PV annuel
            </button>
            <button
              type="button"
              className="btn btn-success gap-2"
              disabled={isSaving || !selectedClasse}
              onClick={handleExportExcelAnnual}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel annuel
            </button>
            <button
              type="button"
              className="btn btn-success gap-2"
              disabled={isSaving || !selectedClasse}
              onClick={handleExportExcel}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PvManager;
