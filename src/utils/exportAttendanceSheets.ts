import { saveOrShareBlob } from "./nativeFileSave";
import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "./exportHeader";

// "Fiche de présence" - one blank weekly attendance paper form per classe (landscape A4), printed
// and filled in by hand: a row per student, and for each weekday (Lundi..Vendredi) 8 hour cells
// H1..H8, plus a trailing "Recap." column. Like exportMarkSheets.ts, no attendance data is fetched
// or shown - only the roster's names. Unlike it, this one carries the school letterhead (without the
// phone line, to save vertical space), the watermark and the page-numbered footer, but no signature.
export interface AttendanceSheetClasse {
  classeName: string;
  students: { name: string; surname: string | null }[];
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const HOURS_PER_DAY = 8;
const SIDE_MARGIN = 5;
const NO_COLUMN_WIDTH = 8;
const NAME_COLUMN_WIDTH = 52;
const RECAP_COLUMN_WIDTH = 18;
// Column index of each day's first hour cell (after No. and Noms) and of Recap. - a thick vertical
// rule is drawn on the left edge of each of these, separating the days like the reference sheet.
const DAY_START_COLUMNS = DAYS.map((_, i) => 2 + i * HOURS_PER_DAY);
const RECAP_COLUMN_INDEX = 2 + DAYS.length * HOURS_PER_DAY;
const THICK_RULE_COLUMNS = new Set([...DAY_START_COLUMNS, RECAP_COLUMN_INDEX]);

export const exportAttendanceSheetsToPdf = async (
  classes: AttendanceSheetClasse[],
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
  const hourColumnWidth =
    (pageWidth - 2 * SIDE_MARGIN - NO_COLUMN_WIDTH - NAME_COLUMN_WIDTH - RECAP_COLUMN_WIDTH) /
    (DAYS.length * HOURS_PER_DAY);

  const columnStyles: Record<number, { cellWidth: number; halign?: "left" | "center" | "right" }> = {
    0: { cellWidth: NO_COLUMN_WIDTH, halign: "right" },
    1: { cellWidth: NAME_COLUMN_WIDTH, halign: "left" },
    [RECAP_COLUMN_INDEX]: { cellWidth: RECAP_COLUMN_WIDTH },
  };
  for (let c = 2; c < RECAP_COLUMN_INDEX; c++) {
    columnStyles[c] = { cellWidth: hourColumnWidth, halign: "center" };
  }

  const hourHeaders = DAYS.flatMap(() =>
    Array.from({ length: HOURS_PER_DAY }, (_, h) => `H${h + 1}`),
  );

  classes.forEach((classe, classeIndex) => {
    if (classeIndex > 0) {
      doc.addPage();
    }
    let y = drawPdfLetterhead(doc, schoolHeader, { includePhone: false });

    // Title strip above the table: classe (left), sheet title (center), blank week dates to fill in
    // by hand (right).
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`Classe: ${classe.classeName}`, SIDE_MARGIN, y);
    doc.text(`/ FEUILLE DE PRESENCE: ${schoolYear} /`, pageWidth / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Semaine du Lundi        /        /2026 au Vendredi        /        /2026", pageWidth - SIDE_MARGIN, y, {
      align: "right",
    });
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { top: 14, bottom: 18, left: SIDE_MARGIN, right: SIDE_MARGIN },
      head: [
        [
          { content: "Jours", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } },
          ...DAYS.map((day) => ({
            content: day,
            colSpan: HOURS_PER_DAY,
            styles: { halign: "center" as const, fontStyle: "normal" as const },
          })),
          {
            content: "Recap.",
            rowSpan: 2,
            styles: { halign: "center" as const, valign: "middle" as const, fontStyle: "bold" as const },
          },
        ],
        [
          { content: "No.", styles: { halign: "center", fontStyle: "bold" } },
          { content: "Noms", styles: { halign: "center", fontStyle: "bold" } },
          ...hourHeaders,
        ],
      ],
      body: classe.students.map((student, index) => [
        index + 1,
        `${student.name} ${student.surname ?? ""}`.trim(),
        ...hourHeaders.map(() => ""),
        "",
      ]),
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: { top: 0.6, bottom: 0.4, left: 0.4, right: 0.4 },
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
        overflow: "ellipsize",
      },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontSize: 7.5, lineWidth: 0.1, lineColor: [0, 0, 0] },
      bodyStyles: { fillColor: [255, 255, 255] },
      columnStyles,
      didDrawCell: (data) => {
        if (!THICK_RULE_COLUMNS.has(data.column.index)) {
          return;
        }
        doc.setDrawColor(0);
        doc.setLineWidth(0.6);
        doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
      },
    });
  });

  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
