import type { ThParam } from "../../interfaces/ThParam";
import type { SyntheseGlobaleRow } from "./syntheseGlobaleCompute";
import { formatRcNumber } from "../reportCard/reportCardCompute";
import { STAT_GROUPEES_TERM_ORDINAL } from "../statGroupees/exportStatGroupeesPdf";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";

const CENTERED = { halign: "center" as const };

// Tableau d'honneur's 3 header labels embed the actual thparam.lb_default/lb/ub thresholds (see
// syntheseGlobaleCompute.ts's comment on why - the sample PDFs' literal bracket numbers match this
// school's own thparam values exactly). Falls back to a bracket-less label when no thparam has
// been saved yet for the year (computeThEligibility already returns 0 for every tier in that case,
// see buildSyntheseGlobaleRow), rather than showing an empty/misleading range.
const buildHonorHeaders = (thParam: ThParam | null): [string, string, string] => {
  if (!thParam) {
    return ["Tableau d'honneur", "Tableau H. & Encourag.", "Tableau d'honneur E. & F."];
  }
  const lbDefault = formatRcNumber(thParam.lb_default);
  const lb = formatRcNumber(thParam.lb);
  const ub = formatRcNumber(thParam.ub);
  return [
    `Tableau d'honneur\n(Moy. dans [${lbDefault}, ${lb}[)`,
    `Tableau H. & Encourag.\n(Moy. dans [${lb}, ${ub}[)`,
    `Tableau d'honneur E. & F.\n(Moy. dans [${ub}, 20])`,
  ];
};

const buildHead = (thParam: ThParam | null) => {
  const [honor1, honor2, honor3] = buildHonorHeaders(thParam);
  return [
    [
      { content: "No.", styles: CENTERED },
      "Classes",
      "Moyenne de la classe",
      "Moyenne du premier",
      "Moyenne du dernier",
      "Ecart type",
      "Nb. élèves ayant des\njours d'exclusions",
      honor1,
      honor2,
      honor3,
      "Effectif",
      "classés",
      "Non classés",
      "Nb. moyennes\n>= 10/20",
      "Nb. moyennes\n< 10/20",
      "Réussites\n(classés)",
      "Taux Réussites\n(classés)",
      "Nom du premier",
    ],
  ];
};

// Column indices kept left-aligned (classe name and the free-text top-student name) while every
// other column stays centered (see columnStyles below) - the rest of the table body is numeric/
// short text.
const CLASSE_COLUMN = 1;
const NOM_PREMIER_COLUMN = 17;

const buildBodyRow = (index: number, row: SyntheseGlobaleRow): (string | number)[] => [
  index + 1,
  row.classeName,
  formatRcNumber(row.moyenneClasse),
  formatRcNumber(row.moyenneDuPremier),
  formatRcNumber(row.moyenneDuDernier),
  formatRcNumber(row.ecartType),
  row.nbExclusion,
  row.tableauHonneur,
  row.tableauHEncourag,
  row.tableauHonneurEF,
  row.effectif,
  row.classes,
  row.nonClasses,
  row.nbSup10,
  row.nbInf10,
  row.reussitesText,
  `${formatRcNumber(row.tauxReussite)}%`,
  row.nomDuPremier,
];

// Bespoke jspdf-autotable builder (not exportRowsToPdf, same reasoning as exportStatGroupeesPdf.ts:
// the generic exporter only knows a single flat header row, and this report's 3 Tableau d'honneur
// columns need dynamic 2-line headers built from thParam). Landscape, since the reference PDFs
// pack 18 columns across the page - same precedent as Stat Groupées. No BILAN row - unlike Stat
// Groupées/Effectifs, none of the 4 sample PDFs end in a summary row, the table just stops after
// the last classe and the signature block follows directly.
const renderSyntheseGlobaleTable = async (
  title: string,
  rows: SyntheseGlobaleRow[],
  thParam: ThParam | null,
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, centerX, y, { align: "center" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Année scolaire: ${schoolYear}`, pageWidth - 14, y, { align: "right" });
  y += 4;

  autoTable(doc, {
    startY: y,
    head: buildHead(thParam),
    body: rows.map((row, index) => buildBodyRow(index, row)),
    styles: { fontSize: 6.5, halign: "center" },
    headStyles: { fillColor: [30, 64, 175], fontSize: 6 },
    columnStyles: {
      [CLASSE_COLUMN]: { halign: "left" },
      [NOM_PREMIER_COLUMN]: { halign: "left" },
    },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};

export const exportSyntheseGlobaleTermToPdf = (
  term: number,
  rows: SyntheseGlobaleRow[],
  thParam: ThParam | null,
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderSyntheseGlobaleTable(
    `SYNTHÈSE GLOBALE DES RÉSULTATS DU ${STAT_GROUPEES_TERM_ORDINAL[term] ?? term} TRIMESTRE`,
    rows,
    thParam,
    schoolYear,
    schoolHeader,
    filename,
  );

export const exportSyntheseGlobaleAnnualToPdf = (
  rows: SyntheseGlobaleRow[],
  thParam: ThParam | null,
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderSyntheseGlobaleTable(
    "SYNTHÈSE GLOBALE ANNUELLE DES RÉSULTATS",
    rows,
    thParam,
    schoolYear,
    schoolHeader,
    filename,
  );
