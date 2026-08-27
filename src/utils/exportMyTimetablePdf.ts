import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";
import { drawPdfLetterhead, drawPdfFooters, drawPdfSignature, type SchoolHeader } from "./exportHeader";
import { saveOrShareBlob } from "./nativeFileSave";
import type { StaffClasseHours, StaffHours, StaffWeeklyGridColumn, StaffWeeklyGridRow } from "./timetableGrid";
import type { TtConfig } from "../interfaces/Timetable";

// The HR/hours header block - already fully resolved to display strings/numbers by the caller
// (MyTimetableManager), which has the language-specific function-label lookup and the staff record
// in scope; this exporter only lays them out.
export interface StaffTimetableHeaderData {
  staffFullName: string;
  functionLabel: string;
  statut: string;
  diplome: string;
  grade: string;
  specialite: string;
  matiereEnseignee: string;
  anciennete: string;
  hours: StaffHours;
}

export interface MyTimetablePdfLabels {
  documentTitle: string;
  fieldStaffName: string;
  fieldFunction: string;
  fieldStatut: string;
  fieldDiplome: string;
  fieldGrade: string;
  fieldSpecialite: string;
  fieldMatiereEnseignee: string;
  fieldAnciennete: string;
  fieldHeuresDues: string;
  fieldHeuresFaites: string;
  fieldHeuresSupplementaires: string;
  fieldHeuresSousEmployees: string;
  summaryClasseHeader: string;
  summaryHoursRow: string;
  summaryTotalHeader: string;
  breakDurationSuffix: string;
  breakLabel: string;
}

// One staff member's already-resolved header + weekly grid + per-class summary, ready to be laid
// out as its own page/sheet - the shape both the single-staff exporters below and the bulk "every
// staff" exporters (exportAllStaffTimetablesPdf.ts/exportAllStaffTimetablesXlsx.ts) consume.
export interface StaffTimetableExportEntry {
  header: StaffTimetableHeaderData;
  columns: StaffWeeklyGridColumn[];
  rows: StaffWeeklyGridRow[];
  classeHours: StaffClasseHours[];
}

const BREAK_FILL: [number, number, number] = [229, 231, 235];

const breakDurationOf = (column: StaffWeeklyGridColumn, ttConfig: TtConfig | null): number => {
  if (!ttConfig || !column.which) {
    return 0;
  }
  return column.which === 1 ? ttConfig.duration_break1 : ttConfig.duration_break2;
};

// Draws one staff member's HR header + weekly grid + per-class summary onto the doc's *current*
// page (the letterhead included), returning the Y position the caller should place a
// signature/footer after. Factored out of exportMyTimetableToPdf so the bulk "every staff" exporter
// (exportAllStaffTimetablesPdf.ts) can call this once per page - both draw exactly the same page
// content, the bulk one just loops it and only signs/foots once at the very end. `autoTable` is
// passed in rather than imported at module scope so this file stays a plain dynamic-import-only
// consumer of jspdf-autotable, matching every other PDF exporter in the app.
export const drawStaffTimetablePage = (
  doc: jsPDF,
  autoTable: (d: jsPDF, options: UserOptions) => void,
  entry: StaffTimetableExportEntry,
  ttConfig: TtConfig | null,
  schoolHeader: SchoolHeader,
  labels: MyTimetablePdfLabels,
): number => {
  const { header, columns, rows, classeHours } = entry;
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(labels.documentTitle, centerX, y, { align: "center" });
  y += 9;

  const drawField = (x: number, fieldY: number, label: string, value: string): void => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const prefix = `${label} : `;
    doc.text(prefix, x, fieldY);
    // Measure the prefix's width in the same (bold) font it was just drawn in - measuring after
    // switching to "normal" below under-reports the width (bold glyphs are wider), so the value
    // would be drawn overlapping the tail of the label.
    const prefixWidth = doc.getTextWidth(prefix);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + prefixWidth, fieldY);
  };

  drawField(14, y, labels.fieldStaffName, header.staffFullName);
  drawField(pageWidth * 0.62, y, labels.fieldFunction, header.functionLabel);
  y += 6.5;
  drawField(14, y, labels.fieldStatut, header.statut);
  drawField(pageWidth * 0.3, y, labels.fieldDiplome, header.diplome);
  drawField(pageWidth * 0.53, y, labels.fieldGrade, header.grade);
  drawField(pageWidth * 0.76, y, labels.fieldSpecialite, header.specialite);
  y += 6.5;
  drawField(14, y, labels.fieldMatiereEnseignee, header.matiereEnseignee);
  drawField(pageWidth * 0.53, y, labels.fieldAnciennete, header.anciennete);
  y += 6.5;
  drawField(14, y, labels.fieldHeuresDues, String(header.hours.dues));
  drawField(pageWidth * 0.3, y, labels.fieldHeuresFaites, String(header.hours.faites));
  drawField(pageWidth * 0.53, y, labels.fieldHeuresSupplementaires, String(header.hours.supplementaires));
  drawField(pageWidth * 0.76, y, labels.fieldHeuresSousEmployees, String(header.hours.sousEmployees));
  y += 8;

  const breakColumnIndices = new Set(
    columns.map((c, i) => (c.kind === "break" ? i + 1 : -1)).filter((i) => i >= 0),
  );

  const headRow = [
    "",
    ...columns.map((col) =>
      col.kind === "break"
        ? `${labels.breakLabel.toUpperCase()} ${breakDurationOf(col, ttConfig)}${labels.breakDurationSuffix}`
        : `${col.start}-${col.end}`,
    ),
  ];
  const body = rows.map((row) => [row.dayLabel.toUpperCase(), ...row.cells.map((c) => c ?? "")]);

  autoTable(doc, {
    startY: y,
    head: [headRow],
    body,
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [0, 0, 0], halign: "center", valign: "middle" },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8 },
    didParseCell: (data) => {
      if (breakColumnIndices.has(data.column.index)) {
        data.cell.styles.fillColor = BREAK_FILL;
        data.cell.styles.textColor = [55, 65, 81];
      }
    },
  });

  const gridFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const totalHours = classeHours.reduce((sum, c) => sum + c.hours, 0);
  autoTable(doc, {
    startY: gridFinalY + 8,
    head: [[labels.summaryClasseHeader, ...classeHours.map((c) => c.classeName), labels.summaryTotalHeader]],
    body: [[labels.summaryHoursRow, ...classeHours.map((c) => String(c.hours)), String(totalHours)]],
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [0, 0, 0], halign: "center" },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    columnStyles: { [classeHours.length + 1]: { fontStyle: "bold" } },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
};

// Official single-page "individual time table" document (bilingual government letterhead, staff HR
// header, days-as-rows weekly grid, per-class weekly-hours summary, signature) - a distinct exporter
// from exportTimetablesToPdf's per-class grid, since that one is shared with TimetableHub's
// whole-school class-by-class export and must keep its own simpler layout unchanged. Its bulk
// "every staff" sibling (exportAllStaffTimetablesPdf.ts) reuses this same page layout via
// drawStaffTimetablePage above rather than duplicating it.
export const exportMyTimetableToPdf = async (
  header: StaffTimetableHeaderData,
  columns: StaffWeeklyGridColumn[],
  rows: StaffWeeklyGridRow[],
  classeHours: StaffClasseHours[],
  ttConfig: TtConfig | null,
  schoolHeader: SchoolHeader,
  labels: MyTimetablePdfLabels,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  const finalY = drawStaffTimetablePage(
    doc,
    autoTable,
    { header, columns, rows, classeHours },
    ttConfig,
    schoolHeader,
    labels,
  );
  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
