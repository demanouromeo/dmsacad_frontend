import type { StatGroupeesRow } from "../statGroupees/statGroupeesCompute";
import type { HonorRollRow } from "./syntheseResultatsCompute";
import {
  APPRECIATION_COLUMN,
  CENTERED,
  HEAD,
  STAT_GROUPEES_TERM_ORDINAL,
  buildBilanBodyRow,
  buildBodyRow,
} from "../statGroupees/exportStatGroupeesPdf";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";

export { STAT_GROUPEES_TERM_ORDINAL };

const HONOR_HEAD = [
  [
    { content: "CLASSES", rowSpan: 2 },
    { content: "EFFECTIF", colSpan: 3, styles: CENTERED },
    { content: "TABLEAUX D'HONNEUR", colSpan: 3, styles: CENTERED },
    { content: "ENCOURAGEMENTS", colSpan: 3, styles: CENTERED },
    { content: "FÉLICITATIONS", colSpan: 3, styles: CENTERED },
  ],
  ["G", "F", "T", "G", "F", "T", "G", "F", "T", "G", "F", "T"],
];

const buildHonorBodyRow = (row: HonorRollRow): (string | number)[] => [
  row.classeName,
  row.effectifG,
  row.effectifF,
  row.effectifT,
  row.thG,
  row.thF,
  row.thT,
  row.encG,
  row.encF,
  row.encT,
  row.felG,
  row.felF,
  row.felT,
];

type JsPdfDoc = InstanceType<typeof import("jspdf").default>;
type AutoTableFn = typeof import("jspdf-autotable").default;

// Renders one "SYNTÈSE DES RESULTATS PAR ..." section (Cycle/Niveau/Classe, identical 20-column
// StatGroupeesRow shape - reusing exportStatGroupeesPdf.ts's own HEAD/row-builders rather than
// duplicating them), starting at headingY, returning the table's finalY.
const renderStatGroupeesSection = (
  doc: JsPdfDoc,
  autoTable: AutoTableFn,
  heading: string,
  rows: StatGroupeesRow[],
  bilanRow: StatGroupeesRow,
  headingY: number,
): number => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(heading, 14, headingY);

  autoTable(doc, {
    startY: headingY + 4,
    head: HEAD,
    body: [...rows.map(buildBodyRow), buildBilanBodyRow(bilanRow)],
    styles: { fontSize: 6.5, halign: "center" },
    headStyles: { fillColor: [30, 64, 175], fontSize: 6.5 },
    columnStyles: { 0: { halign: "left" }, [APPRECIATION_COLUMN]: { halign: "left" } },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
};

const renderHonorRollSection = (doc: JsPdfDoc, autoTable: AutoTableFn, rows: HonorRollRow[]): number => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TABLEAU D'HONNEUR", 14, 20);

  autoTable(doc, {
    startY: 24,
    head: HONOR_HEAD,
    body: rows.map(buildHonorBodyRow),
    styles: { fontSize: 7, halign: "center" },
    headStyles: { fillColor: [30, 64, 175], fontSize: 7 },
    columnStyles: { 0: { halign: "left" } },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
};

const renderSyntheseResultats = async (
  title: string,
  cycleRows: StatGroupeesRow[],
  cycleBilan: StatGroupeesRow,
  niveauRows: StatGroupeesRow[],
  niveauBilan: StatGroupeesRow,
  classeRows: StatGroupeesRow[],
  classeBilan: StatGroupeesRow,
  honorRows: HonorRollRow[],
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

  // Letterhead + title are drawn once, on the cover page only - the same "single letterhead, one
  // fresh page per section" convention exportAllMarksReportToPdf already established, rather than
  // the sample PDFs' own inconsistent repeat-on-page-1-and-2-only layout.
  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, centerX, y, { align: "center" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Année scolaire: ${schoolYear}`, pageWidth - 14, y, { align: "right" });

  renderStatGroupeesSection(doc, autoTable, "SYNTÈSE DES RESULTATS PAR CYCLE", cycleRows, cycleBilan, y + 10);

  doc.addPage();
  renderStatGroupeesSection(doc, autoTable, "SYNTÈSE DES RESULTATS PAR NIVEAU", niveauRows, niveauBilan, 20);

  doc.addPage();
  renderStatGroupeesSection(doc, autoTable, "SYNTÈSE DES RESULTATS PAR CLASSE", classeRows, classeBilan, 20);

  doc.addPage();
  const finalY = renderHonorRollSection(doc, autoTable, honorRows);

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};

export const exportSyntheseResultatsTermToPdf = (
  term: number,
  cycleRows: StatGroupeesRow[],
  cycleBilan: StatGroupeesRow,
  niveauRows: StatGroupeesRow[],
  niveauBilan: StatGroupeesRow,
  classeRows: StatGroupeesRow[],
  classeBilan: StatGroupeesRow,
  honorRows: HonorRollRow[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderSyntheseResultats(
    `SYNTHÈSE DES RÉSULTATS DU ${STAT_GROUPEES_TERM_ORDINAL[term] ?? term} TRIMESTRE`,
    cycleRows,
    cycleBilan,
    niveauRows,
    niveauBilan,
    classeRows,
    classeBilan,
    honorRows,
    schoolYear,
    schoolHeader,
    filename,
  );

export const exportSyntheseResultatsAnnualToPdf = (
  cycleRows: StatGroupeesRow[],
  cycleBilan: StatGroupeesRow,
  niveauRows: StatGroupeesRow[],
  niveauBilan: StatGroupeesRow,
  classeRows: StatGroupeesRow[],
  classeBilan: StatGroupeesRow,
  honorRows: HonorRollRow[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderSyntheseResultats(
    "SYNTHÈSE ANNUELLE DES RÉSULTATS",
    cycleRows,
    cycleBilan,
    niveauRows,
    niveauBilan,
    classeRows,
    classeBilan,
    honorRows,
    schoolYear,
    schoolHeader,
    filename,
  );
