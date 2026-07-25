import { useEffect, useState } from "react";
import { FileSpreadsheet, ListOrdered, Printer, Trophy } from "lucide-react";
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
  buildClassementGeneral,
  buildPremiersList,
  buildTroisPremiersGroups,
  fullName,
  type ClassementRow,
  type ClassementTroisPremiersGroup,
  type RankedClassementRow,
} from "../../../utils/classement/classementCompute";
import {
  exportClassementGeneralToPdf,
  exportPremiersListToPdf,
  exportTroisPremiersToPdf,
  CLASSEMENT_TERM_ORDINAL,
} from "../../../utils/classement/exportClassementPdf";
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

type ClassementTab = "premiers" | "trois" | "general";

interface ClasseRows {
  classeName: string;
  rows: ClassementRow[];
}

const premiersCsvColumns: ExportColumn<RankedClassementRow>[] = [
  { header: "No.", accessor: (r) => r.no },
  { header: "Nom", accessor: (r) => fullName(r) },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "classe", accessor: (r) => r.classeName },
  { header: "Moy", accessor: (r) => formatRcNumber(r.moy) },
  { header: "Rang", accessor: (r) => r.rangText },
];

const generalCsvColumns: ExportColumn<RankedClassementRow>[] = [
  { header: "No.", accessor: (r) => r.no },
  { header: "Nom", accessor: (r) => fullName(r) },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "Classes", accessor: (r) => r.classeName },
  { header: "Moy.", accessor: (r) => formatRcNumber(r.moy) },
  { header: "Rang", accessor: (r) => r.rangText },
];

interface TroisPremiersCsvRow extends RankedClassementRow {
  groupNo: number;
}

const flattenTroisPremiers = (groups: ClassementTroisPremiersGroup[]): TroisPremiersCsvRow[] =>
  groups.flatMap((g) => g.rows.map((r) => ({ ...r, groupNo: g.no })));

const troisPremiersCsvColumns: ExportColumn<TroisPremiersCsvRow>[] = [
  { header: "No.", accessor: (r) => r.groupNo },
  { header: "Classes", accessor: (r) => r.classeName },
  { header: "Nom", accessor: (r) => fullName(r) },
  { header: "Sexe", accessor: (r) => r.sexe },
  { header: "Moy.", accessor: (r) => formatRcNumber(r.moy) },
  { header: "Rang", accessor: (r) => r.rangText },
];

const TABS: { key: ClassementTab; badge: string; label: string }[] = [
  { key: "premiers", badge: "1", label: "Liste des premiers" },
  { key: "trois", badge: "3", label: "Liste des trois premiers" },
  { key: "general", badge: "", label: "Classement général" },
];

// "Classement" - a third whole-section report family under Bilan, alongside Effectifs/PV/Stat
// Groupées/Stat Matière: one screen with 3 internal tabs (matching the reference mockup exactly,
// not 3 separate hub tiles) sharing the same term select + Print/Stat.annuelle/Excel/Excel annuel
// action row. Each tab reuses the report card module's own already-computed per-classe
// moyenneTrim/rang (term) or avgAnnual/rangAnnuel (annual) wholesale (loadReportCardDataForClasse/
// loadAnnualReportCardDataForClasse/loadAnnualApcReportCardDataForClasse, same precedent as
// PvManager/StatGroupeesManager) - src/utils/classement/classementCompute.ts only aggregates/
// re-ranks those results across the whole section, it never re-derives an average or a per-classe
// rank. `ClasseReader.fetchClasses` is already ORDER BY level, classe_name ASC server-side
// (confirmed in ClasseController::allClasse1), so no client-side re-sort is needed for the "Trois
// premiers" table's classe group order.
const ClassementManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [activeTab, setActiveTab] = useState<ClassementTab>("premiers");

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

  // Fetches every classe's report card data once (term or annual) and flattens it into this
  // module's own minimal ClassementRow shape - shared by all 3 tabs, which each just aggregate/
  // filter/re-rank this same underlying data differently (see classementCompute.ts).
  const buildClasseRows = async (isAnnual: boolean): Promise<ClasseRows[]> => {
    const result: ClasseRows[] = [];
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
      const students = isAnnual
        ? (
            await (isApc
              ? loadAnnualApcReportCardDataForClasse({
                  accessToken,
                  connection,
                  schoolYear,
                  section,
                  classes,
                  schoolHeader,
                  language: "fr",
                  classeId: classe.classe_id,
                })
              : loadAnnualReportCardDataForClasse({
                  accessToken,
                  connection,
                  schoolYear,
                  section,
                  classes,
                  schoolHeader,
                  language: "fr",
                  classeId: classe.classe_id,
                }))
          ).students.map((s) => ({
            studId: s.studId,
            name: s.name,
            surname: s.surname,
            sexe: s.sexe,
            moy: s.avgAnnual,
            classeRang: s.rangAnnuel,
          }))
        : (
            await loadReportCardDataForClasse({
              accessToken,
              connection,
              schoolYear,
              section,
              language: "fr",
              classeId: classe.classe_id,
              term: selectedTerm,
              isApc,
            })
          ).students.map((s) => ({
            studId: s.studId,
            name: s.name,
            surname: s.surname,
            sexe: s.sexe,
            moy: s.moyenneTrim,
            classeRang: s.rang,
          }));
      const rows: ClassementRow[] = students.map((s) => ({ ...s, classeName: classe.classe_name }));
      result.push({ classeName: classe.classe_name, rows });
    }
    return result;
  };

  const termTitle = (base: string): string =>
    `${base} DU '${CLASSEMENT_TERM_ORDINAL[selectedTerm] ?? selectedTerm} TRIMESTRE'`;

  const runPrint = async (isAnnual: boolean) => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const classeRows = await buildClasseRows(isAnnual);
      const flatRows = classeRows.flatMap((c) => c.rows);
      if (activeTab === "premiers") {
        const rows = buildPremiersList(flatRows);
        const title = isAnnual ? "LISTE ANNUELLE DES PREMIERS" : termTitle("LISTE DES PREMIERS");
        const filename = buildTimestampedFilename(
          isAnnual ? "Liste des premiers - Annuelle" : `Liste des premiers - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        await exportPremiersListToPdf(title, rows, schoolYear, schoolHeader, filename);
      } else if (activeTab === "trois") {
        const groups = buildTroisPremiersGroups(classeRows);
        const title = isAnnual ? "LISTE ANNUELLE DES 3 PREMIERS" : termTitle("LISTE DES 3 PREMIERS");
        const filename = buildTimestampedFilename(
          isAnnual ? "Liste des 3 premiers - Annuelle" : `Liste des 3 premiers - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        await exportTroisPremiersToPdf(title, groups, schoolYear, schoolHeader, filename);
      } else {
        const rows = buildClassementGeneral(flatRows);
        const title = isAnnual ? "CLASSEMENT ANNUEL GÉNÉRAL" : termTitle("CLASSEMENT GÉNÉRAL");
        const filename = buildTimestampedFilename(
          isAnnual ? "Classement general - Annuel" : `Classement general - Trim ${selectedTerm}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        await exportClassementGeneralToPdf(title, rows, schoolYear, schoolHeader, filename);
      }
      showToast("Document généré avec succès.", { type: "info" });
    } catch (error) {
      console.error("ClassementManager.runPrint(): Error", error);
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
      const classeRows = await buildClasseRows(isAnnual);
      const flatRows = classeRows.flatMap((c) => c.rows);
      if (activeTab === "premiers") {
        exportRowsToCsv(
          buildTimestampedFilename(
            isAnnual ? "Liste des premiers - Annuelle" : `Liste des premiers - Trim ${selectedTerm}`,
            [`Section ${capitalizeSectionName(section)}`],
            "csv",
          ),
          premiersCsvColumns,
          buildPremiersList(flatRows),
        );
      } else if (activeTab === "trois") {
        exportRowsToCsv(
          buildTimestampedFilename(
            isAnnual ? "Liste des 3 premiers - Annuelle" : `Liste des 3 premiers - Trim ${selectedTerm}`,
            [`Section ${capitalizeSectionName(section)}`],
            "csv",
          ),
          troisPremiersCsvColumns,
          flattenTroisPremiers(buildTroisPremiersGroups(classeRows)),
        );
      } else {
        exportRowsToCsv(
          buildTimestampedFilename(
            isAnnual ? "Classement general - Annuel" : `Classement general - Trim ${selectedTerm}`,
            [`Section ${capitalizeSectionName(section)}`],
            "csv",
          ),
          generalCsvColumns,
          buildClassementGeneral(flatRows),
        );
      }
    } catch (error) {
      console.error("ClassementManager.runExportExcel(): Error", error);
      showToast("Échec de l'export Excel.", { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const activeLabel = TABS.find((t) => t.key === activeTab)?.label ?? "";

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay progress={printProgress} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">Classement</h1>
          <p className="page-subtitle">Année Scolaire: {schoolYear}</p>
        </div>
        <CloseButton />
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn gap-2 ${activeTab === tab.key ? "btn-primary" : "btn-outline"}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.badge ? (
              <span className="badge badge-neutral">{tab.badge}</span>
            ) : (
              <ListOrdered className="w-4 h-4" />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {isLoadingClasses ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">Aucune classe trouvée pour cette année.</p>
      ) : (
        <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-5">
          <p className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            {activeLabel} du{" "}
            <span className="font-semibold text-primary">
              '{CLASSEMENT_TERM_ORDINAL[selectedTerm]} TRIMESTRE'
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
              Annuel
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

export default ClassementManager;
