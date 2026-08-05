import type { StatGroupeesRow } from "../statGroupees/statGroupeesCompute";
import type { StatMatiereSubjectBlock } from "./statMatiereCompute";
import { formatRcNumber } from "../reportCard/reportCardCompute";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";
import { saveOrShareBlob } from "../nativeFileSave";

// Same wording as the sibling "Stat Groupées" module's own STAT_GROUPEES_TERM_ORDINAL (confirmed by
// the user to be the same reference document family) - "SECOND"/"TROISIEME", not PV's/
// exportAllMarksReport's "DEUXIÈME"/"TROISIÈME".
export const STAT_MATIERE_TERM_ORDINAL: Record<number, string> = {
  1: "PREMIER",
  2: "SECOND",
  3: "TROISIEME",
};

type CellStyle = { fontStyle: "bold"; fillColor?: [number, number, number]; textColor?: number };

// Bold, no fill - the "Bilan du niv. N" level-subtotal row.
const NIV_BILAN_ROW_STYLE: CellStyle = { fontStyle: "bold" };
// Bold black fill/white text - the final "Bilan {matière}" row, same styling as Stat Groupées' own
// BILAN row.
const SUBJECT_BILAN_ROW_STYLE: CellStyle = { fontStyle: "bold", fillColor: [0, 0, 0], textColor: 255 };

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

const buildStyledBodyRow = (
  row: StatGroupeesRow,
  styles: CellStyle,
): { content: string | number; styles: CellStyle }[] =>
  buildBodyRow(row).map((content) => ({ content, styles }));

// Draws one subject's "MATIÈRE: X" sub-header line + its table (classe rows interleaved with each
// level's bilan row, ending in the subject's own bilan row when non-null - an empty `levels` array
// renders just the header with no rows, matching the samples' own empty-subject pages). Returns the
// finalY of the table that was just drawn.
const renderSubjectBlock = (
  doc: import("jspdf").jsPDF,
  autoTable: typeof import("jspdf-autotable").default,
  block: StatMatiereSubjectBlock,
  schoolYear: string,
  startY: number,
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`MATIÈRE: ${block.subjectTitle}`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Année scolaire: ${schoolYear}`, pageWidth - 14, y, { align: "right" });
  y += 6;

  const body: (string | number | { content: string | number; styles: CellStyle })[][] = [];
  block.levels.forEach((level) => {
    level.classeRows.forEach((row) => body.push(buildBodyRow(row)));
    body.push(buildStyledBodyRow(level.bilanRow, NIV_BILAN_ROW_STYLE));
  });
  if (block.subjectBilanRow) {
    body.push(buildStyledBodyRow(block.subjectBilanRow, SUBJECT_BILAN_ROW_STYLE));
  }

  autoTable(doc, {
    startY: y,
    head: HEAD,
    body,
    styles: { fontSize: 6.5, halign: "center" },
    headStyles: { fillColor: [30, 64, 175], fontSize: 6.5 },
    bodyStyles: { textColor: [0, 0, 0] },
    columnStyles: { 0: { halign: "left" }, [APPRECIATION_COLUMN]: { halign: "left" } },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
};

// Landscape, letterhead drawn ONCE at the very top of the whole document (not repeated per subject
// page - confirmed with the user; matches this app's own convention and the sibling Stat Groupées
// exporter, even though the raw reference PDFs reprint it on every page). Every subject after the
// first starts on a fresh page via doc.addPage(); a subject with no classes still gets its own page
// with just the header and an empty table. Signature + footers drawn once at the very end, using the
// last subject's table finalY.
const renderStatMatiereDocument = async (
  title: string,
  blocks: StatMatiereSubjectBlock[],
  schoolHeader: SchoolHeader,
  schoolYear: string,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 8;

  let finalY = y;
  blocks.forEach((block, index) => {
    if (index > 0) {
      doc.addPage();
      y = 20;
    }
    finalY = renderSubjectBlock(doc, autoTable, block, schoolYear, y);
  });

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};

export const exportStatMatiereTermToPdf = (
  term: number,
  blocks: StatMatiereSubjectBlock[],
  schoolHeader: SchoolHeader,
  schoolYear: string,
  filename: string,
): Promise<void> =>
  renderStatMatiereDocument(
    `STATISTIQUES PAR MATIERE DU ${STAT_MATIERE_TERM_ORDINAL[term] ?? term} TRIMESTRE`,
    blocks,
    schoolHeader,
    schoolYear,
    filename,
  );

export const exportStatMatiereAnnualToPdf = (
  blocks: StatMatiereSubjectBlock[],
  schoolHeader: SchoolHeader,
  schoolYear: string,
  filename: string,
): Promise<void> =>
  renderStatMatiereDocument("STATISTIQUES ANNUELLES PAR MATIÈRE", blocks, schoolHeader, schoolYear, filename);
