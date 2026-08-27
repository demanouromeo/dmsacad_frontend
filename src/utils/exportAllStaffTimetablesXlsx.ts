import { buildUniqueSheetName } from "./exportMarksWorkbook";
import { saveOrShareBlob } from "./nativeFileSave";
import { writeStaffTimetableSheet } from "./exportMyTimetableXlsx";
import type { MyTimetablePdfLabels, StaffTimetableExportEntry } from "./exportMyTimetablePdf";
import type { TtConfig } from "../interfaces/Timetable";

// Bulk "every staff" counterpart to exportMyTimetableToXlsx - one workbook, one worksheet per staff
// member (sheet name deduped/sanitized via buildUniqueSheetName, the same helper
// exportTimetablesToXlsx/exportMarksWorkbookToXlsx already use for their own per-class/per-subject
// sheets), each sheet written by the exact same writeStaffTimetableSheet layout the single-staff
// export uses.
export const exportAllStaffTimetablesToXlsx = async (
  title: string,
  entries: StaffTimetableExportEntry[],
  ttConfig: TtConfig | null,
  labels: MyTimetablePdfLabels,
  filename: string,
): Promise<void> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set<string>();

  entries.forEach((entry) => {
    const worksheet = workbook.addWorksheet(buildUniqueSheetName(entry.header.staffFullName, usedNames));
    writeStaffTimetableSheet(worksheet, title, entry, ttConfig, labels);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await saveOrShareBlob(blob, filename);
};
