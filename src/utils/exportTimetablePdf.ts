import type { jsPDF } from "jspdf";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "./exportHeader";
import { saveOrShareBlob } from "./nativeFileSave";
import type { ClasseTimetableExport } from "./timetableGrid";

type AutoTableCell = string | { content: string; colSpan?: number; styles?: object };

const BREAK_ROW_STYLE = {
  fontStyle: "bold" as const,
  fillColor: [229, 231, 235] as [number, number, number],
  halign: "center" as const,
};

// Fixed, explicit column widths (rather than autoTable's default content-based "auto" sizing) so
// the truncation below can know exactly how much width each cell has to work with ahead of time.
const TABLE_MARGIN = 14;
const LABEL_COL_WIDTH = 32;
const CELL_FONT_SIZE = 11;
const CELL_PADDING = 2;

// Caps a single line of text to one visual line within maxWidth, cutting it short with "..." once
// it no longer fits - autoTable would otherwise wrap an overlong subject title or teacher name onto
// a 3rd/4th line, growing that row's height. With up to 7 periods/day, a class table only fits one
// landscape page when every period cell stays at exactly 2 lines (subject + teacher), so a wrapped
// cell here is what pushes a class onto a second page and breaks the one-page-per-class layout.
// doc's font/size must already match what the body cells render with (set below, before this is
// called) since jsPDF measures text width against whatever font is currently active.
const truncateToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }
  const ellipsis = "...";
  let end = text.length;
  while (end > 0 && doc.getTextWidth(text.slice(0, end) + ellipsis) > maxWidth) {
    end -= 1;
  }
  return end > 0 ? `${text.slice(0, end).trimEnd()}${ellipsis}` : ellipsis;
};

// Each period cell is "subject\nteacher" (see timetableGrid.ts's buildClasseTimetableRows) - the
// two lines are truncated independently so each still occupies exactly one line of its own.
const truncateCellText = (doc: jsPDF, cellText: string, maxWidth: number): string =>
  cellText
    .split("\n")
    .map((line) => truncateToWidth(doc, line, maxWidth))
    .join("\n");

// One page per class, each with its own copy of the shared letterhead (drawPdfLetterhead - the
// same one used for the student/staff list PDFs) since every page here is its own standalone
// document, unlike a single continuous table where the letterhead only needs to appear once at the
// top. drawPdfFooters still draws the app footer + watermark on every page in one pass at the end,
// same as every other PDF export in the app.
export const exportTimetablesToPdf = async (
  title: string,
  classeExports: ClasseTimetableExport[],
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

  classeExports.forEach((classe, index) => {
    if (index > 0) {
      doc.addPage();
    }
    const y = drawPdfLetterhead(doc, schoolHeader);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`${title} - ${classe.classeName}`, centerX, y, { align: "center" });

    const numDays = classe.dayLabels.length;
    const dayColWidth = (pageWidth - TABLE_MARGIN * 2 - LABEL_COL_WIDTH) / numDays;
    const maxCellTextWidth = dayColWidth - CELL_PADDING * 2;
    const columnStyles: Record<number, { cellWidth: number }> = { 0: { cellWidth: LABEL_COL_WIDTH } };
    for (let i = 1; i <= numDays; i++) {
      columnStyles[i] = { cellWidth: dayColWidth };
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(CELL_FONT_SIZE);
    const body: AutoTableCell[][] = classe.rows.map((row) =>
      row.kind === "break"
        ? [{ content: row.label, colSpan: numDays + 1, styles: BREAK_ROW_STYLE }]
        : [row.label, ...row.cells.map((cell) => truncateCellText(doc, cell, maxCellTextWidth))],
    );

    autoTable(doc, {
      startY: y + 6,
      margin: { left: TABLE_MARGIN, right: TABLE_MARGIN },
      head: [["", ...classe.dayLabels]],
      body,
      columnStyles,
      styles: { fontSize: CELL_FONT_SIZE, cellPadding: CELL_PADDING, textColor: [0, 0, 0] },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    });
  });

  if (classeExports.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    drawPdfSignature(doc, schoolHeader, finalY);
  }
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
