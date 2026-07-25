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
import {
  buildAggregateRow,
  buildHonorRollRow,
  buildStatGroupeesBilanRow,
  buildStatGroupeesRow,
  groupByCycle,
  groupByNiveau,
  type HonorRollRow,
  type LeveledClasseRow,
} from "../../../utils/syntheseResultats/syntheseResultatsCompute";
import {
  exportSyntheseResultatsAnnualToPdf,
  exportSyntheseResultatsTermToPdf,
  STAT_GROUPEES_TERM_ORDINAL,
} from "../../../utils/syntheseResultats/exportSyntheseResultatsPdf";
import { exportSyntheseResultatsToXlsx } from "../../../utils/syntheseResultats/exportSyntheseResultatsWorkbook";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay, { type LoadingOverlayProgress } from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const TERMS = [1, 2, 3];

interface BuiltRows {
  leveled: LeveledClasseRow[];
  honor: HonorRollRow[];
}

// "Synthèse des résultats" - a 4-page whole-section report reverse-engineered from 4 sample PDFs:
// the exact same per-classe columns as "Statistiques Groupées" (StatGroupeesRow, reused wholesale),
// rolled up by Cycle, by Niveau, and by Classe (3 tables), plus a 4th gender-split Honor Roll table.
// See src/utils/syntheseResultats/syntheseResultatsCompute.ts for the row-building logic and its
// notes on the two judgment calls this report needed beyond straight reuse: the Honor Roll's
// cumulative (not exclusive-band) tier counts, and computing a genuine max/min for every BILAN row
// rather than replicating the sample PDFs' own Cycle/Niveau BILAN max/min bug.
const SyntheseResultatsManager = () => {
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

  const buildTermRows = async (thParam: ThParam | null): Promise<BuiltRows> => {
    const leveled: LeveledClasseRow[] = [];
    const honor: HonorRollRow[] = [];
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
      const row = buildStatGroupeesRow(
        classe.classe_name,
        data.students.map((s) => ({ sexe: s.sexe, moy: s.moyenneTrim })),
        data.classeStats,
      );
      leveled.push({ level: classe.level, row });
      honor.push(
        buildHonorRollRow(
          classe.classe_name,
          data.students.map((s) => ({
            sexe: s.sexe,
            moy: s.moyenneTrim,
            isClassified: s.isClassified,
            absNonJust: s.discipline.absNonJust,
          })),
          thParam,
        ),
      );
    }
    return { leveled, honor };
  };

  const buildAnnualRows = async (thParam: ThParam | null): Promise<BuiltRows> => {
    const leveled: LeveledClasseRow[] = [];
    const honor: HonorRollRow[] = [];
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
      const row = buildStatGroupeesRow(
        classe.classe_name,
        data.students.map((s) => ({ sexe: s.sexe, moy: s.avgAnnual })),
        data.classeStats,
      );
      leveled.push({ level: classe.level, row });
      honor.push(
        buildHonorRollRow(
          classe.classe_name,
          data.students.map((s) => ({
            sexe: s.sexe,
            moy: s.avgAnnual,
            isClassified: s.isClassifiedAnnual,
            absNonJust: s.disciplineAnnual.absNonJust,
          })),
          thParam,
        ),
      );
    }
    return { leveled, honor };
  };

  const buildSections = (leveled: LeveledClasseRow[]) => {
    const cycleRows = groupByCycle(leveled);
    const niveauRows = groupByNiveau(leveled);
    const classeRows = leveled.map((l) => l.row);
    return {
      cycleRows: cycleRows.map((c) => c.row),
      cycleBilan: buildAggregateRow(cycleRows.map((c) => c.row), "BILAN"),
      niveauRows: niveauRows.map((n) => n.row),
      niveauBilan: buildAggregateRow(niveauRows.map((n) => n.row), "BILAN"),
      classeRows,
      classeBilan: buildStatGroupeesBilanRow(classeRows),
    };
  };

  const handlePrintTerm = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const thParam = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      const { leveled, honor } = await buildTermRows(thParam);
      const s = buildSections(leveled);
      const filename = buildTimestampedFilename(
        `Synthese resultats - Trim ${selectedTerm}`,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportSyntheseResultatsTermToPdf(
        selectedTerm,
        s.cycleRows,
        s.cycleBilan,
        s.niveauRows,
        s.niveauBilan,
        s.classeRows,
        s.classeBilan,
        honor,
        schoolYear,
        schoolHeader,
        filename,
      );
      showToast("Synthèse des résultats générée avec succès.", { type: "info" });
    } catch (error) {
      console.error("SyntheseResultatsManager.handlePrintTerm(): Error", error);
      showToast("Échec de la génération de la synthèse des résultats.", { type: "danger" });
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
      const { leveled, honor } = await buildAnnualRows(thParam);
      const s = buildSections(leveled);
      const filename = buildTimestampedFilename(
        "Synthese resultats - Annuelle",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportSyntheseResultatsAnnualToPdf(
        s.cycleRows,
        s.cycleBilan,
        s.niveauRows,
        s.niveauBilan,
        s.classeRows,
        s.classeBilan,
        honor,
        schoolYear,
        schoolHeader,
        filename,
      );
      showToast("Synthèse annuelle des résultats générée avec succès.", { type: "info" });
    } catch (error) {
      console.error("SyntheseResultatsManager.handlePrintAnnual(): Error", error);
      showToast("Échec de la génération de la synthèse annuelle des résultats.", { type: "danger" });
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
      const { leveled, honor } = await buildTermRows(thParam);
      const s = buildSections(leveled);
      const filename = buildTimestampedFilename(
        `Synthese resultats - Trim ${selectedTerm}`,
        [`Section ${capitalizeSectionName(section)}`],
        "xlsx",
      );
      await exportSyntheseResultatsToXlsx(
        filename,
        s.cycleRows,
        s.cycleBilan,
        s.niveauRows,
        s.niveauBilan,
        s.classeRows,
        s.classeBilan,
        honor,
      );
    } catch (error) {
      console.error("SyntheseResultatsManager.handleExportExcelTerm(): Error", error);
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
      const { leveled, honor } = await buildAnnualRows(thParam);
      const s = buildSections(leveled);
      const filename = buildTimestampedFilename(
        "Synthese resultats - Annuelle",
        [`Section ${capitalizeSectionName(section)}`],
        "xlsx",
      );
      await exportSyntheseResultatsToXlsx(
        filename,
        s.cycleRows,
        s.cycleBilan,
        s.niveauRows,
        s.niveauBilan,
        s.classeRows,
        s.classeBilan,
        honor,
      );
    } catch (error) {
      console.error("SyntheseResultatsManager.handleExportExcelAnnual(): Error", error);
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
          <h1 className="page-title">Synthèse des résultats</h1>
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
          <p className="text-lg">
            Synthèse du{" "}
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

export default SyntheseResultatsManager;
