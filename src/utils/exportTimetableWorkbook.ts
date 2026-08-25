import { buildUniqueSheetName } from "./exportMarksWorkbook";
import { saveOrShareBlob } from "./nativeFileSave";
import type { ClasseTimetableExport } from "./timetableGrid";

// One worksheet per class (name deduped/sanitized via buildUniqueSheetName, the same helper
// exportMarksWorkbookToXlsx already uses for per-subject sheet names) - a plain grid matching the
// on-screen TimetableGridView layout: period/time in column A, one column per school day, a merged
// bold row for each break.
export const exportTimetablesToXlsx = async (
  filename: string,
  classeExports: ClasseTimetableExport[],
): Promise<void> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  classeExports.forEach((classe) => {
    const worksheet = workbook.addWorksheet(buildUniqueSheetName(classe.classeName, usedNames));
    const headerRow = worksheet.addRow(["", ...classe.dayLabels]);
    headerRow.font = { bold: true };

    classe.rows.forEach((row) => {
      if (row.kind === "break") {
        const excelRow = worksheet.addRow([row.label]);
        worksheet.mergeCells(excelRow.number, 1, excelRow.number, classe.dayLabels.length + 1);
        excelRow.font = { bold: true };
        excelRow.alignment = { horizontal: "center" };
      } else {
        const excelRow = worksheet.addRow([row.label, ...row.cells]);
        excelRow.alignment = { wrapText: true, vertical: "top" };
      }
    });

    worksheet.getColumn(1).width = 16;
    for (let i = 2; i <= classe.dayLabels.length + 1; i++) {
      worksheet.getColumn(i).width = 24;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await saveOrShareBlob(blob, filename);
};
