import { sanitizeFiliereOrSpecialityName } from "./textValidation";

export interface ImportedClasse {
  classe_name: string;
  level: number;
  // 1-based row number in the source file (header is row 1), for user-facing error messages.
  sourceRow: number;
}

export type ImportError =
  | { type: "unsupportedExtension" }
  | { type: "emptyFile" }
  | { type: "badHeader" }
  | { type: "emptyName"; row: number }
  | { type: "invalidLevel"; row: number };

export type ImportParseResult =
  | { status: true; classes: ImportedClasse[] }
  | { status: false; error: ImportError };

const LEVEL_REGEX = /^\d+$/;

// Column A is read but never used/validated (per spec, its content is irrelevant), column B is the
// classe name (required, sanitized), column C is the level (optional, defaults to 1). The first
// structural violation aborts the whole import rather than skipping just that row - the caller is
// expected to fix the file and re-upload, not end up with a partially-imported list.
const validateRows = (rows: string[][]): ImportParseResult => {
  if (rows.length < 2) {
    return { status: false, error: { type: "emptyFile" } };
  }
  if (rows[0].length < 3) {
    return { status: false, error: { type: "badHeader" } };
  }

  const classes: ImportedClasse[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = i + 1;
    console.log(`classeImport: row ${sourceRow} data`, row);
    const name = sanitizeFiliereOrSpecialityName((row[1] ?? "").trim());
    if (!name) {
      return { status: false, error: { type: "emptyName", row: sourceRow } };
    }
    const levelRaw = (row[2] ?? "").trim();
    let level = 1;
    if (levelRaw) {
      if (!LEVEL_REGEX.test(levelRaw)) {
        return {
          status: false,
          error: { type: "invalidLevel", row: sourceRow },
        };
      }
      level = Number(levelRaw);
    }
    classes.push({ classe_name: name, level, sourceRow });
  }
  return { status: true, classes };
};

// Hand-rolled rather than a library - the read-side counterpart of exportData.ts's csvEscape.
// Handles double-quote-escaped fields (including embedded commas/newlines inside quotes).
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

const parseXlsxRows = async (file: File): Promise<string[][]> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  // exceljs's TS types declare `load` as taking a Node Buffer (whose type isn't even available here,
  // this project has no @types/node), but its documented/actual runtime behavior (browser build)
  // accepts a plain ArrayBuffer - `any` bridges that typing gap without pulling in Node's types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  const rows: string[][] = [];
  worksheet?.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      cells.push(value === null || value === undefined ? "" : String(value).trim());
    });
    rows.push(cells);
  });
  return rows;
};

export const parseImportFile = async (
  file: File,
): Promise<ImportParseResult> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: string[][];
  if (extension === "csv") {
    rows = parseCsvRows(await file.text());
  } else if (extension === "xlsx") {
    rows = await parseXlsxRows(file);
  } else {
    return { status: false, error: { type: "unsupportedExtension" } };
  }
  return validateRows(rows);
};
