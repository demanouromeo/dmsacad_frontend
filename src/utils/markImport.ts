import type { Student } from "../interfaces/Student";
import { isMarkInRange } from "./textValidation";

export interface ImportedMark {
  stud_id: number;
  mark: number;
  isEmpty: number;
  // 1-based row number in the source file, for user-facing error messages.
  sourceRow: number;
}

export type MarkImportError =
  | { type: "unsupportedExtension" }
  | { type: "emptyFile" }
  | { type: "unknownMatricule"; row: number; matricule: string }
  | { type: "invalidMark"; row: number; matricule: string };

export type MarkImportParseResult =
  | { status: true; marks: ImportedMark[] }
  | { status: false; error: MarkImportError };

// Same hand-rolled CSV parser as classeImport.ts/studentImport.ts (double-quote escaping etc.) -
// kept as its own copy per this app's self-contained-per-feature import-util convention.
const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field || row.length > 0) {
    pushRow();
  }
  return rows
    .filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "")
    .map((r) => r.map((cell) => cell.trim()));
};

const parseXlsxRows = async (file: File): Promise<unknown[][]> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  worksheet?.eachRow((row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.value);
    });
    rows.push(cells);
  });
  return rows;
};

// Columns: A=# (ignored), B=stud_id (ignored - never trusted back from a file, only used to help a
// teacher read the export; matricule is the real join key), C=matricule, D=Name (ignored),
// E=Mark/20. Row 1 is the header, data starts at row 2 - matches the export shape this reuses (see
// MarkEntryManager's handleExportMarks). Aborts on the first invalid row rather than accumulating
// every error, same precedent as studentImport.ts/classeImport.ts.
const validateRows = (rows: unknown[][], roster: Student[]): MarkImportParseResult => {
  const stringRows = rows.map((row) =>
    row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)).trim()),
  );
  const dataRows = stringRows.slice(1);
  if (dataRows.every((row) => row.every((cell) => cell === ""))) {
    return { status: false, error: { type: "emptyFile" } };
  }

  const studIdByMatricule = new Map(
    roster.filter((s) => s.matricule).map((s) => [s.matricule as string, s.stud_id]),
  );

  const marks: ImportedMark[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.every((cell) => cell === "")) {
      continue;
    }
    const sourceRow = i + 2;
    const matricule = row[2] ?? "";
    const rawMark = row[4] ?? "";
    const studId = studIdByMatricule.get(matricule);
    if (studId === undefined) {
      return { status: false, error: { type: "unknownMatricule", row: sourceRow, matricule } };
    }
    if (!isMarkInRange(rawMark)) {
      return { status: false, error: { type: "invalidMark", row: sourceRow, matricule } };
    }
    const isEmpty = rawMark.trim() === "";
    marks.push({
      stud_id: studId,
      mark: isEmpty ? 0 : Number(rawMark),
      isEmpty: isEmpty ? 1 : 0,
      sourceRow,
    });
  }
  return { status: true, marks };
};

// .xls (legacy binary Excel) is deliberately not supported - ExcelJS (already used by every other
// *Import.ts in this app) only reads .xlsx, and pulling in the full xlsx/SheetJS package to cover
// that one extra format would reintroduce the unpatched advisories exportRowsToCsv's own comment
// already explains this app avoids it for.
export const parseMarkImportFile = async (
  file: File,
  roster: Student[],
): Promise<MarkImportParseResult> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: unknown[][];
  if (extension === "csv") {
    rows = parseCsvRows(await file.text());
  } else if (extension === "xlsx") {
    rows = await parseXlsxRows(file);
  } else {
    return { status: false, error: { type: "unsupportedExtension" } };
  }
  return validateRows(rows, roster);
};
