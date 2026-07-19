import type { Mark } from "../interfaces/Mark";
import type { Student } from "../interfaces/Student";

export interface MarksSheet {
  sheetName: string;
  marksByStudId: Map<number, Mark>;
}

export interface MarksSheetHeaders {
  index: string;
  studId: string;
  matricule: string;
  name: string;
  mark: string;
}

const INVALID_SHEET_NAME_CHARS = /[\\/*?:[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

// Excel worksheet names must be <=31 chars, unique within the workbook, and can't contain the
// \ / * ? : [ ] characters - dedupes by appending " (2)", " (3)", ... (re-truncated to stay under
// the 31-char limit) when two subjects/competences would otherwise sanitize to the same name.
export const buildUniqueSheetName = (rawName: string, usedNames: Set<string>): string => {
  const base =
    rawName.replace(INVALID_SHEET_NAME_CHARS, " ").trim().slice(0, MAX_SHEET_NAME_LENGTH) ||
    "Sheet";
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    const suffixText = ` (${suffix})`;
    candidate = `${base.slice(0, MAX_SHEET_NAME_LENGTH - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

// Builds a multi-sheet .xlsx workbook - one worksheet per entry in `sheets`, each formatted exactly
// like MarkEntryManager's single-subject CSV export (# / stud_id / matricule / Name / Mark/20).
// Uses ExcelJS (already a dependency in this app, backing every *Import.ts reader) rather than the
// npm `xlsx`/SheetJS package this app's CLAUDE.md documents deliberately avoiding for its unpatched
// advisories - ExcelJS is a separate, already-trusted library, and a real multi-sheet workbook
// (unlike CSV, which has no concept of sheets) needs a genuine .xlsx writer.
export const exportMarksWorkbookToXlsx = async (
  filename: string,
  roster: Student[],
  sheets: MarksSheet[],
  headers: MarksSheetHeaders,
): Promise<void> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.sheetName);
    worksheet.addRow([headers.index, headers.studId, headers.matricule, headers.name, headers.mark]);
    roster.forEach((student, index) => {
      const row = sheet.marksByStudId.get(student.stud_id);
      const isEmpty = !row || row.isEmpty === 1;
      worksheet.addRow([
        index + 1,
        student.stud_id,
        student.matricule ?? "",
        `${student.name} ${student.surname ?? ""}`.trim(),
        isEmpty ? "" : Number(row!.mark),
      ]);
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
