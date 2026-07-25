import { useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { formatRcNumber } from "../../../utils/reportCard/reportCardCompute";
import type { StatGroupeesRow } from "../../../utils/statGroupees/statGroupeesCompute";
import type { StatMatiereSubjectBlock } from "../../../utils/statMatiere/statMatiereCompute";
import { loadStatMatiereAnnualData, loadStatMatiereTermData } from "../../../utils/statMatiere/loadStatMatiereData";
import {
  exportStatMatiereAnnualToPdf,
  exportStatMatiereTermToPdf,
  STAT_MATIERE_TERM_ORDINAL,
} from "../../../utils/statMatiere/exportStatMatierePdf";
import {
  buildTimestampedFilename,
  capitalizeSectionName,
  exportRowsToCsv,
  type ExportColumn,
} from "../../../utils/exportData";
import LoadingOverlay, { type LoadingOverlayProgress } from "../../sharedcomp/LoadingOverlay";

const TERMS = [1, 2, 3];

interface StatMatiereCsvRow extends StatGroupeesRow {
  matiere: string;
  rowType: string;
}

// Flattens every subject block (classe rows + each level's bilan row + the subject's own bilan row)
// into one CSV table, adding Matière/Type columns so the grouped PDF structure survives the flatten
// - same "flatten the grouped hierarchy with extra identifying columns" precedent as EffectifsManager's
// own CSV export (Section/Cycle columns).
const flattenBlocksToCsvRows = (blocks: StatMatiereSubjectBlock[]): StatMatiereCsvRow[] => {
  const rows: StatMatiereCsvRow[] = [];
  blocks.forEach((block) => {
    block.levels.forEach((level) => {
      level.classeRows.forEach((row) => rows.push({ ...row, matiere: block.subjectTitle, rowType: "Classe" }));
      rows.push({ ...level.bilanRow, matiere: block.subjectTitle, rowType: "Bilan niveau" });
    });
    if (block.subjectBilanRow) {
      rows.push({ ...block.subjectBilanRow, matiere: block.subjectTitle, rowType: "Bilan matière" });
    }
  });
  return rows;
};

const csvColumns: ExportColumn<StatMatiereCsvRow>[] = [
  { header: "Matière", accessor: (r) => r.matiere },
  { header: "Type", accessor: (r) => r.rowType },
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

// "Statistiques par matière" - a whole-section report (every subject of the current section+year,
// no classe/subject selector - matching the reference mockup, same shape as the sibling "Stat
// Groupées" screen), term or annual, export-only (no on-screen preview - see PvManager's own comment
// on why a printed-document report skips the table). Row computation lives in
// src/utils/statMatiere/statMatiereCompute.ts, reusing Stat Groupées' own StatGroupeesRow shape,
// getAppreciation and buildStatGroupeesBilanRow (both confirmed identical against this report's own
// samples) rather than re-deriving them.
const StatMatiereManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const schoolHeader = useSchoolHeader();

  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [printProgress, setPrintProgress] = useState<LoadingOverlayProgress | null>(null);

  const onProgress = (current: number, total: number, subjectTitle: string) => {
    setPrintProgress({
      current,
      total,
      label: "Chargement des données",
      overall: `Matière ${current + 1}/${total}: ${subjectTitle}`,
    });
  };

  const handlePrintTerm = async () => {
    setIsSaving(true);
    try {
      const blocks = await loadStatMatiereTermData({
        accessToken,
        connection,
        schoolYear,
        section,
        term: selectedTerm,
        onProgress,
      });
      const filename = buildTimestampedFilename(
        `Stat par matiere - Trim ${selectedTerm}`,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportStatMatiereTermToPdf(selectedTerm, blocks, schoolHeader, schoolYear, filename);
      showToast("Statistiques par matière générées avec succès.", { type: "info" });
    } catch (error) {
      console.error("StatMatiereManager.handlePrintTerm(): Error", error);
      showToast("Échec de la génération des statistiques par matière.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handlePrintAnnual = async () => {
    setIsSaving(true);
    try {
      const blocks = await loadStatMatiereAnnualData({ accessToken, connection, schoolYear, section, onProgress });
      const filename = buildTimestampedFilename(
        "Stat par matiere - Annuelle",
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      await exportStatMatiereAnnualToPdf(blocks, schoolHeader, schoolYear, filename);
      showToast("Statistiques annuelles par matière générées avec succès.", { type: "info" });
    } catch (error) {
      console.error("StatMatiereManager.handlePrintAnnual(): Error", error);
      showToast("Échec de la génération des statistiques annuelles par matière.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handleExportExcelTerm = async () => {
    setIsSaving(true);
    try {
      const blocks = await loadStatMatiereTermData({
        accessToken,
        connection,
        schoolYear,
        section,
        term: selectedTerm,
        onProgress,
      });
      exportRowsToCsv(
        buildTimestampedFilename(
          `Stat par matiere - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        flattenBlocksToCsvRows(blocks),
      );
    } catch (error) {
      console.error("StatMatiereManager.handleExportExcelTerm(): Error", error);
      showToast("Échec de l'export Excel.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handleExportExcelAnnual = async () => {
    setIsSaving(true);
    try {
      const blocks = await loadStatMatiereAnnualData({ accessToken, connection, schoolYear, section, onProgress });
      exportRowsToCsv(
        buildTimestampedFilename(
          "Stat par matiere - Annuelle",
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        flattenBlocksToCsvRows(blocks),
      );
    } catch (error) {
      console.error("StatMatiereManager.handleExportExcelAnnual(): Error", error);
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
          <h1 className="page-title">Statistiques par matière</h1>
          <p className="page-subtitle">Année Scolaire: {schoolYear}</p>
        </div>
      </div>

      <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-5">
        <p className="text-lg">
          Statistiques par matière{" "}
          <span className="font-semibold text-primary">{STAT_MATIERE_TERM_ORDINAL[selectedTerm]} TRIMESTRE</span>
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
    </div>
  );
};

export default StatMatiereManager;
