import type { StatGroupeesRow } from "./statGroupeesCompute";
import { formatRcNumber } from "../reportCard/reportCardCompute";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";

// "SECOND" (not "DEUXIÈME"/"DEUXIEME" as PV/exportAllMarksReport.ts use) - matches the sample
// "Statistiques Groupées" PDFs' own wording exactly ("STATISTIQUES GROUPÉES DU SECOND TRIMESTRE").
export const STAT_GROUPEES_TERM_ORDINAL: Record<number, string> = {
  1: "PREMIER",
  2: "SECOND",
  3: "TROISIEME",
};

const BILAN_ROW_STYLE = {
  fontStyle: "bold" as const,
  fillColor: [0, 0, 0] as [number, number, number],
  textColor: 255 as const,
};

const CENTERED = { halign: "center" as const };

const HEAD = [
  [
    { content: "CLASSES", rowSpan: 2 },
    { content: "MOY. GENE.", rowSpan: 2 },
    { content: "EFFECTIF", colSpan: 3, styles: CENTERED },
    { content: "PRÉSENTS", colSpan: 3, styles: CENTERED },
    { content: "% PARTICIPATIONS", colSpan: 3, styles: CENTERED },
    { content: "MOY. >= 10", colSpan: 3, styles: CENTERED },
    { content: "% RÉUSSITE", colSpan: 3, styles: CENTERED },
    { content: "MOY. MAX.", rowSpan: 2 },
    { content: "MOY. MIN.", rowSpan: 2 },
    { content: "APPRÉCIATION", rowSpan: 2 },
  ],
  ["G", "F", "T", "G", "F", "T", "G", "F", "T", "G", "F", "T", "G", "F", "T"],
];

// Column index of the free-text APPRÉCIATION cell - kept left-aligned while every numeric column
// stays centered (see columnStyles below).
const APPRECIATION_COLUMN = 19;

const buildBodyRow = (row: StatGroupeesRow): (string | number)[] => [
  row.classeName,
  formatRcNumber(row.moyGene),
  row.effectifG,
  row.effectifF,
  row.effectifT,
  row.presentsG,
  row.presentsF,
  row.presentsT,
  `${formatRcNumber(row.participationG)}%`,
  `${formatRcNumber(row.participationF)}%`,
  `${formatRcNumber(row.participationT)}%`,
  row.sup10G,
  row.sup10F,
  row.sup10T,
  `${formatRcNumber(row.reussiteG)}%`,
  `${formatRcNumber(row.reussiteF)}%`,
  `${formatRcNumber(row.reussiteT)}%`,
  formatRcNumber(row.moyMax),
  formatRcNumber(row.moyMin),
  row.appreciation,
];

const buildBilanBodyRow = (
  row: StatGroupeesRow,
): { content: string | number; styles: typeof BILAN_ROW_STYLE }[] =>
  buildBodyRow(row).map((content) => ({ content, styles: BILAN_ROW_STYLE }));

// Bespoke jspdf-autotable builder (not exportRowsToPdf - that generic exporter only renders one
// flat single-row header), pattern-matched off exportPvPdf.ts's annual PV table (same rowSpan/
// colSpan grouped-header shape). Landscape, since the reference PDFs pack 20 columns across the
// page - a portrait page can't fit CLASSES + 15 G/F/T triples + 4 more columns legibly.
const renderStatGroupeesTable = async (
  title: string,
  rows: StatGroupeesRow[],
  bilanRow: StatGroupeesRow,
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
  y += 8;

  autoTable(doc, {
    startY: y,
    head: HEAD,
    body: [...rows.map(buildBodyRow), buildBilanBodyRow(bilanRow)],
    styles: { fontSize: 6.5, halign: "center" },
    headStyles: { fillColor: [30, 64, 175], fontSize: 6.5 },
    columnStyles: { 0: { halign: "left" }, [APPRECIATION_COLUMN]: { halign: "left" } },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};

export const exportStatGroupeesTermToPdf = (
  term: number,
  rows: StatGroupeesRow[],
  bilanRow: StatGroupeesRow,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderStatGroupeesTable(
    `STATISTIQUES GROUPÉES DU ${STAT_GROUPEES_TERM_ORDINAL[term] ?? term} TRIMESTRE`,
    rows,
    bilanRow,
    schoolHeader,
    filename,
  );

export const exportStatGroupeesAnnualToPdf = (
  rows: StatGroupeesRow[],
  bilanRow: StatGroupeesRow,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderStatGroupeesTable("STATISTIQUES GROUPÉES ANNUELLES", rows, bilanRow, schoolHeader, filename);
