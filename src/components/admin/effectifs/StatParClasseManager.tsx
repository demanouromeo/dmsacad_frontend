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
import {
  adaptAnnualApcData,
  adaptAnnualData,
  adaptTermData,
  computeStatParClasseDemographics,
} from "../../../utils/statParClasse/statParClasseCompute";
import {
  exportStatParClasseAnnualToPdf,
  exportStatParClasseTermToPdf,
  STAT_PAR_CLASSE_TERM_ORDINAL,
  type StatParClasseBlock,
} from "../../../utils/statParClasse/exportStatParClassePdf";
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

interface StatParClasseCsvRow {
  classeName: string;
  no: number;
  fullName: string;
  sexe: string;
  repeating: boolean;
  subjectTitle: string;
  coef: number;
  subjectMoy: number | null;
  totalGeneral: number;
  moyenne: number;
  coteOrRang: string;
  absences: number;
}

// Tidy/long CSV shape (one row per classe+student+subject) rather than mirroring the PDF's wide
// per-subject-column layout - different classes have different subject sets, so a single flat CSV
// table can't have one static column per subject the way the PDF's per-classe table does. Same
// "CSV doesn't need to mirror the PDF's layout" precedent as EffectifsManager/StatMatiere's own CSV
// flattening.
const csvColumns: ExportColumn<StatParClasseCsvRow>[] = [
  { header: "Classe", accessor: (r) => r.classeName },
  { header: "No.", accessor: (r) => r.no },
  { header: "Nom", accessor: (r) => r.fullName },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "Redoublant", accessor: (r) => (r.repeating ? "Oui" : "Non") },
  { header: "Matière", accessor: (r) => r.subjectTitle },
  { header: "Coef.", accessor: (r) => r.coef },
  { header: "Moyenne matière", accessor: (r) => (r.subjectMoy === null ? "" : r.subjectMoy) },
  { header: "TOTAL", accessor: (r) => r.totalGeneral },
  { header: "Moyenne", accessor: (r) => r.moyenne },
  { header: "COTE / Rang", accessor: (r) => r.coteOrRang },
  { header: "Total des absences", accessor: (r) => r.absences },
];

const flattenForCsv = (blocks: StatParClasseBlock[]): StatParClasseCsvRow[] =>
  blocks.flatMap((block) =>
    block.rows.flatMap((row, index) =>
      block.subjects.map((subject) => ({
        classeName: block.classeName,
        no: index + 1,
        fullName: `${row.name} ${row.surname}`.trim(),
        sexe: row.sexe,
        repeating: row.repeating,
        subjectTitle: subject.subjectTitle,
        coef: subject.coef,
        subjectMoy: row.subjectMoys.get(subject.subjectId) ?? null,
        totalGeneral: row.totalGeneral,
        moyenne: row.moyenne,
        coteOrRang: row.coteOrRang,
        absences: row.absences,
      })),
    ),
  );

// "Statistiques par classe" - a fourth whole-section report family under Bilan, alongside PV/Stat
// Groupées/Stat Matière/Classement: no classe/subject select, just a Term select + Print/Stat.
// annuelles/Excel/Excel annuel action row (Excel pair added per the user's explicit confirmation,
// matching every other Bilan sub-module's convention even though the mockup only showed Print/Stat.
// annuelles). Reuses the report card module's own per-classe computation wholesale
// (loadReportCardDataForClasse/loadAnnualReportCardDataForClasse/loadAnnualApcReportCardDataForClasse,
// same precedent as PV/Stat Groupées/Classement) - this report is numerically the RC's own
// TOTAL/Moyenne/COTE/Rang turned into a class-list table instead of one page per student; see
// statParClasseCompute.ts for the (term/annual/APC) → common shape adaptation, which never
// re-derives an average or a coefficient.
const StatParClasseManager = () => {
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

  const buildClasseBlocks = async (isAnnual: boolean): Promise<StatParClasseBlock[]> => {
    const blocks: StatParClasseBlock[] = [];
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
      const data = isAnnual
        ? isApc
          ? adaptAnnualApcData(
              await loadAnnualApcReportCardDataForClasse({
                accessToken,
                connection,
                schoolYear,
                section,
                classes,
                schoolHeader,
                language: "fr",
                classeId: classe.classe_id,
              }),
            )
          : adaptAnnualData(
              await loadAnnualReportCardDataForClasse({
                accessToken,
                connection,
                schoolYear,
                section,
                classes,
                schoolHeader,
                language: "fr",
                classeId: classe.classe_id,
              }),
            )
        : adaptTermData(
            await loadReportCardDataForClasse({
              accessToken,
              connection,
              schoolYear,
              section,
              language: "fr",
              classeId: classe.classe_id,
              term: selectedTerm,
              isApc,
            }),
            isApc,
          );
      blocks.push({
        ...data,
        classeName: classe.classe_name,
        profPrincipal: classe.classe_master_name ?? "",
        isApc,
        demographics: computeStatParClasseDemographics(data.rows, data.subjects),
      });
    }
    return blocks;
  };

  const runPrint = async (isAnnual: boolean) => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const blocks = await buildClasseBlocks(isAnnual);
      const filename = buildTimestampedFilename(
        isAnnual ? "Statistiques par classe - Annuelle" : `Statistiques par classe - Trim ${selectedTerm}`,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      if (isAnnual) {
        await exportStatParClasseAnnualToPdf(blocks, schoolYear, schoolHeader, filename);
      } else {
        await exportStatParClasseTermToPdf(selectedTerm, blocks, schoolYear, schoolHeader, filename);
      }
      showToast("Document généré avec succès.", { type: "info" });
    } catch (error) {
      console.error("StatParClasseManager.runPrint(): Error", error);
      showToast("Échec de la génération du document.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const runExportExcel = async (isAnnual: boolean) => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const blocks = await buildClasseBlocks(isAnnual);
      exportRowsToCsv(
        buildTimestampedFilename(
          isAnnual ? "Statistiques par classe - Annuelle" : `Statistiques par classe - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "csv",
        ),
        csvColumns,
        flattenForCsv(blocks),
      );
    } catch (error) {
      console.error("StatParClasseManager.runExportExcel(): Error", error);
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
          <h1 className="page-title">Statistiques par classe</h1>
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
            Statistiques par classe{" "}
            <span className="font-semibold text-primary">
              ({STAT_PAR_CLASSE_TERM_ORDINAL[selectedTerm]} TRIMESTRE)
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
            <button
              type="button"
              className="btn btn-primary gap-2"
              disabled={isSaving}
              onClick={() => runPrint(false)}
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              className="btn btn-secondary gap-2"
              disabled={isSaving}
              onClick={() => runPrint(true)}
            >
              <Printer className="w-4 h-4" />
              Stat. annuelles
            </button>
            <button
              type="button"
              className="btn btn-success gap-2"
              disabled={isSaving}
              onClick={() => runExportExcel(false)}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              type="button"
              className="btn btn-success gap-2"
              disabled={isSaving}
              onClick={() => runExportExcel(true)}
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

export default StatParClasseManager;
