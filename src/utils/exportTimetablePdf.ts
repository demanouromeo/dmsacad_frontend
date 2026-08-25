import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "./exportHeader";
import { saveOrShareBlob } from "./nativeFileSave";
import type { ClasseTimetableExport } from "./timetableGrid";

type AutoTableCell = string | { content: string; colSpan?: number; styles?: object };

const BREAK_ROW_STYLE = {
  fontStyle: "bold" as const,
  fillColor: [229, 231, 235] as [number, number, number],
  halign: "center" as const,
};

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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  classeExports.forEach((classe, index) => {
    if (index > 0) {
      doc.addPage();
    }
    const y = drawPdfLetterhead(doc, schoolHeader);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${title} - ${classe.classeName}`, centerX, y, { align: "center" });

    const body: AutoTableCell[][] = classe.rows.map((row) =>
      row.kind === "break"
        ? [{ content: row.label, colSpan: classe.dayLabels.length + 1, styles: BREAK_ROW_STYLE }]
        : [row.label, ...row.cells],
    );

    autoTable(doc, {
      startY: y + 6,
      head: [["", ...classe.dayLabels]],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175] },
    });
  });

  if (classeExports.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    drawPdfSignature(doc, schoolHeader, finalY);
  }
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
