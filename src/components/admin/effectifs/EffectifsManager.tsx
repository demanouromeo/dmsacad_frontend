import { Fragment, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useLanguage } from "../../../i18n/useLanguage";
import { exportTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { buildSectionEffectif, sumSections, type SectionEffectif } from "../../../utils/effectifs";
import {
  buildTimestampedFilename,
  exportRowsToCsv,
  type ExportColumn,
} from "../../../utils/exportData";
import { exportEffectifsToPdf } from "../../../utils/exportEffectifs";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";

// Both sections are always fetched regardless of the admin's currently selected section (see
// useAuth().section elsewhere in this app) - this report is a whole-school statement, not scoped
// to whichever section happens to be selected in TopBanner.
const SECTIONS = ["francophone", "anglophone"];

const sectionDisplayName = (section: string): string =>
  section === "anglophone" ? "Anglophone" : "Francophone";

interface FlatEffectifRow {
  section: string;
  cycle: 1 | 2;
  index: number;
  classe_name: string;
  garcons: number;
  filles: number;
  nouveaux: number;
  redoublants: number;
  total: number;
}

const buildFlatRows = (sections: SectionEffectif[]): FlatEffectifRow[] => {
  let index = 0;
  const rows: FlatEffectifRow[] = [];
  sections.forEach((section) => {
    section.cycles.forEach((cycle) => {
      cycle.classes.forEach((classe) => {
        index += 1;
        rows.push({
          section: section.section,
          cycle: cycle.cycle,
          index,
          classe_name: classe.classe_name,
          garcons: classe.garcons,
          filles: classe.filles,
          nouveaux: classe.nouveaux,
          redoublants: classe.redoublants,
          total: classe.total,
        });
      });
    });
  });
  return rows;
};

const csvColumns: ExportColumn<FlatEffectifRow>[] = [
  { header: "N°", accessor: (r) => r.index },
  { header: "Section", accessor: (r) => sectionDisplayName(r.section) },
  { header: "Cycle", accessor: (r) => r.cycle },
  { header: "Classe", accessor: (r) => r.classe_name },
  { header: "Garçon", accessor: (r) => r.garcons },
  { header: "Fille", accessor: (r) => r.filles },
  { header: "Nouv.", accessor: (r) => r.nouveaux },
  { header: "Redoub.", accessor: (r) => r.redoublants },
  { header: "Total", accessor: (r) => r.total },
];

// "Effectifs par classe" - a whole-school report grouping every classe by cycle (1: niveaux 1-4,
// 2: niveaux 5-7) and section, with Garçon/Fille/Nouv./Redoub./Total tallies plus cycle/section/
// grand-total subtotals. Read-only (no CRUD, no edit-in-row), unlike the other admin Manager
// screens - its only actions are refreshing the preview and exporting it. Content is hardcoded
// French only (no per-file translation dictionary), matching the source document this replicates
// and the explicit "French only" scope given for this screen.
const EffectifsManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const [language] = useLanguage();
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [sections, setSections] = useState<SectionEffectif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Guards against StrictMode's double-invoked effect (or a stale in-flight "Actualiser" click)
  // applying an older request's result after a newer one has already resolved - same problem
  // useSchoolHeader's `cancelled` flag exists to prevent, just keyed by an incrementing id here
  // since this is also triggered manually, not only from the effect.
  const requestIdRef = useRef(0);

  const loadEffectifs = async () => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    const results = await Promise.all(
      SECTIONS.map(async (section) => {
        const [classes, summaryRows] = await Promise.all([
          ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
          StudentReader.fetchStudentsSummaryOfSection(
            accessToken,
            connection,
            schoolYear,
            section,
          ),
        ]);
        return { section, classes, summaryRows };
      }),
    );
    if (requestId !== requestIdRef.current) {
      return;
    }
    setSections(
      results
        .filter((r) => r.classes.length > 0)
        .map((r) => buildSectionEffectif(r.section, r.classes, r.summaryRows)),
    );
    setIsLoading(false);
  };

  useEffect(() => {
    loadEffectifs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const grandTotal = sumSections(sections);

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildTimestampedFilename("Effectifs par classe", [], "csv"),
      csvColumns,
      buildFlatRows(sections),
    );
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    await exportEffectifsToPdf(
      schoolYear,
      sections,
      schoolHeader,
      buildTimestampedFilename("Effectifs par classe", [], "pdf"),
    );
    setIsExporting(false);
  };

  return (
    <div className="p-10">
      {isExporting && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">Effectifs par classe</h1>
      <p className="mb-4 opacity-70 text-sm">Année Scolaire: {schoolYear}</p>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        <ExportButtons
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          excelLabel={et.excelBtn}
          pdfLabel={et.pdfBtn}
          disabled={isLoading || isExporting || sections.length === 0}
        />
        <button
          type="button"
          className="btn btn-neutral btn-sm gap-2"
          disabled={isLoading}
          onClick={loadEffectifs}
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {isLoading ? (
        <Loading />
      ) : sections.length === 0 ? (
        <p className="opacity-60">Aucune classe trouvée pour cette année.</p>
      ) : (
        <>
          {sections.map((section) => (
            <div key={section.section} className="mb-8">
              <h2 className="text-lg font-bold mb-2">
                Section: {sectionDisplayName(section.section)}
              </h2>
              <div className="overflow-x-auto w-full max-w-4xl">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Classe</th>
                      <th>Garçon</th>
                      <th>Fille</th>
                      <th>Nouv.</th>
                      <th>Redoub.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let index = 0;
                      return section.cycles.map((cycle) => (
                        <Fragment key={cycle.cycle}>
                          {cycle.classes.map((classe) => {
                            index += 1;
                            return (
                              <tr key={classe.classe_id}>
                                <td>{index}</td>
                                <td>{classe.classe_name}</td>
                                <td>{classe.garcons}</td>
                                <td>{classe.filles}</td>
                                <td>{classe.nouveaux}</td>
                                <td>{classe.redoublants}</td>
                                <td>{classe.total}</td>
                              </tr>
                            );
                          })}
                          <tr className="font-bold bg-base-200">
                            <td></td>
                            <td>RÉSUMÉ DU CYCLE {cycle.cycle}</td>
                            <td>{cycle.garcons}</td>
                            <td>{cycle.filles}</td>
                            <td>{cycle.nouveaux}</td>
                            <td>{cycle.redoublants}</td>
                            <td>{cycle.total}</td>
                          </tr>
                        </Fragment>
                      ));
                    })()}
                    <tr className="font-bold bg-neutral text-neutral-content">
                      <td></td>
                      <td>Bilan section: {section.section}</td>
                      <td>{section.garcons}</td>
                      <td>{section.filles}</td>
                      <td>{section.nouveaux}</td>
                      <td>{section.redoublants}</td>
                      <td>{section.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="overflow-x-auto w-full max-w-4xl">
            <table className="table w-full">
              <tbody>
                <tr className="font-bold bg-neutral text-neutral-content">
                  <td colSpan={2}>BILAN</td>
                  <td>{grandTotal.garcons}</td>
                  <td>{grandTotal.filles}</td>
                  <td>{grandTotal.nouveaux}</td>
                  <td>{grandTotal.redoublants}</td>
                  <td>{grandTotal.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default EffectifsManager;
