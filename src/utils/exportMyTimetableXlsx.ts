import { saveOrShareBlob } from "./nativeFileSave";
import type { StaffClasseHours, StaffWeeklyGridColumn, StaffWeeklyGridRow } from "./timetableGrid";
import type { TtConfig } from "../interfaces/Timetable";
import type { StaffTimetableHeaderData, MyTimetablePdfLabels } from "./exportMyTimetablePdf";

// Excel counterpart to exportMyTimetableToPdf - same HR header / weekly grid / per-class summary
// content, laid out as plain worksheet rows (one field per row for the header block - Excel isn't
// page-width constrained like the PDF, so there's no need for the PDF's multi-column packing) rather
// than mirroring the PDF's fixed x-position layout.
export const exportMyTimetableToXlsx = async (
  title: string,
  header: StaffTimetableHeaderData,
  columns: StaffWeeklyGridColumn[],
  rows: StaffWeeklyGridRow[],
  classeHours: StaffClasseHours[],
  ttConfig: TtConfig | null,
  labels: MyTimetablePdfLabels,
  filename: string,
): Promise<void> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title.slice(0, 31));

  const titleRow = worksheet.addRow([title]);
  titleRow.font = { bold: true, size: 14 };
  worksheet.addRow([]);

  const addField = (label: string, value: string | number): void => {
    const row = worksheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  };
  addField(labels.fieldStaffName, header.staffFullName);
  addField(labels.fieldFunction, header.functionLabel);
  addField(labels.fieldStatut, header.statut);
  addField(labels.fieldDiplome, header.diplome);
  addField(labels.fieldGrade, header.grade);
  addField(labels.fieldSpecialite, header.specialite);
  addField(labels.fieldMatiereEnseignee, header.matiereEnseignee);
  addField(labels.fieldAnciennete, header.anciennete);
  addField(labels.fieldHeuresDues, header.hours.dues);
  addField(labels.fieldHeuresFaites, header.hours.faites);
  addField(labels.fieldHeuresSupplementaires, header.hours.supplementaires);
  addField(labels.fieldHeuresSousEmployees, header.hours.sousEmployees);
  worksheet.addRow([]);

  const breakDurationOf = (column: StaffWeeklyGridColumn): number => {
    if (!ttConfig || !column.which) {
      return 0;
    }
    return column.which === 1 ? ttConfig.duration_break1 : ttConfig.duration_break2;
  };
  const gridHeaderRow = worksheet.addRow([
    "",
    ...columns.map((col) =>
      col.kind === "break"
        ? `${labels.breakLabel.toUpperCase()} ${breakDurationOf(col)}${labels.breakDurationSuffix}`
        : `${col.start}-${col.end}`,
    ),
  ]);
  gridHeaderRow.font = { bold: true };

  rows.forEach((row) => {
    const excelRow = worksheet.addRow([row.dayLabel.toUpperCase(), ...row.cells.map((c) => c ?? "")]);
    excelRow.alignment = { wrapText: true, vertical: "top" };
  });
  worksheet.addRow([]);

  const totalHours = classeHours.reduce((sum, c) => sum + c.hours, 0);
  const summaryHeaderRow = worksheet.addRow([
    labels.summaryClasseHeader,
    ...classeHours.map((c) => c.classeName),
    labels.summaryTotalHeader,
  ]);
  summaryHeaderRow.font = { bold: true };
  worksheet.addRow([labels.summaryHoursRow, ...classeHours.map((c) => c.hours), totalHours]);

  worksheet.getColumn(1).width = 22;
  for (let i = 2; i <= columns.length + 1; i++) {
    worksheet.getColumn(i).width = 20;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await saveOrShareBlob(blob, filename);
};
