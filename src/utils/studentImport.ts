// Same allowed charset as the backend's saveAStudent regex for name/surname
// (^[a-zA-ZÀ-ÿ\s\-]+$) - letters (incl. accented), spaces, and hyphens only. No digits, no
// apostrophes - stricter than sanitizeSubjectTitle/sanitizeStaffText, so kept as its own copy per
// this app's self-contained-per-feature import-util convention.
const INVALID_STUDENT_NAME_CHARS_REGEX = /[^a-zA-ZÀ-ÿ\s-]/g;

export const sanitizeStudentName = (value: string): string =>
  value.replace(INVALID_STUDENT_NAME_CHARS_REGEX, "");

export interface ImportedStudent {
  name: string;
  surname: string;
  matricule: string;
  sexe: "M" | "F";
  bday: string;
  bplace: string;
  repeating: boolean;
  // 1-based row number in the source file, for user-facing error messages.
  sourceRow: number;
}

export type StudentImportError =
  | { type: "unsupportedExtension" }
  | { type: "emptyFile" }
  | { type: "badHeader" }
  | { type: "emptyName"; row: number };

export type StudentImportParseResult =
  | { status: true; students: ImportedStudent[] }
  | { status: false; error: StudentImportError };

const DIACRITICS_REGEX = /[̀-ͯ]/g;

const normalize = (value: string): string =>
  value.normalize("NFD").replace(DIACRITICS_REGEX, "").trim().toUpperCase();

const parseSexe = (raw: string): "M" | "F" => (normalize(raw) === "F" ? "F" : "M");

// Lenient on purpose, same philosophy as staffImport's parsePhone - only "R"/"OUI"/"O"/"YES"/"1"
// count as repeating, everything else (including blank) is treated as not-repeating rather than
// aborting the import.
const REPEATING_VALUES = new Set(["R", "OUI", "O", "YES", "1", "TRUE"]);
const parseRepeating = (raw: string): boolean => REPEATING_VALUES.has(normalize(raw));

const pad2 = (n: number): string => String(n).padStart(2, "0");

// exceljs returns a native JS Date for genuinely date-formatted cells; anything else falls back to
// a best-effort parse of common spreadsheet date strings ("M/D/YYYY", "D-M-YYYY", already-ISO), and
// finally to the raw trimmed string if nothing matches - bday has no backend format validation
// (`nullable|String`), so an unparsed string still saves fine, it just won't populate a
// `<input type="date">` cleanly until re-entered.
const cellToBday = (value: unknown): string => {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, d, m, y] = dashMatch;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  return raw;
};

// The sample file has a title row above the real header (e.g. "6e B" in column A), not the header
// itself - scan the first few rows for the one whose column B reads "NOM" (case/accent-insensitive)
// rather than assuming row 1 is always the header like classeImport.ts/staffImport.ts do.
const findHeaderRowIndex = (rows: string[][]): number => {
  const scanLimit = Math.min(rows.length, 5);
  for (let i = 0; i < scanLimit; i++) {
    if (normalize(rows[i]?.[1] ?? "") === "NOM") {
      return i;
    }
  }
  return -1;
};

// Columns: A=NO (ignored), B=NOM->name (required), C=PRENOM->surname, D=MATRICULE->matricule,
// E=SEXE->sexe, F=DATE NAIS.->bday, G=LIEU NAIS.->bplace, H=REDOUBLE->repeating.
const validateRows = (rows: unknown[][]): StudentImportParseResult => {
  const stringRows = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const headerIndex = findHeaderRowIndex(stringRows);
  if (headerIndex === -1 || stringRows[headerIndex].length < 8) {
    return { status: false, error: { type: "badHeader" } };
  }
  if (rows.length <= headerIndex + 1) {
    return { status: false, error: { type: "emptyFile" } };
  }

  const students: ImportedStudent[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = i + 1;
    const name = sanitizeStudentName(String(row[1] ?? "").trim());
    if (!name) {
      return { status: false, error: { type: "emptyName", row: sourceRow } };
    }
    const surname = sanitizeStudentName(String(row[2] ?? "").trim());
    const matricule = String(row[3] ?? "").trim();
    const sexe = parseSexe(String(row[4] ?? "").trim());
    const bday = cellToBday(row[5]);
    const bplace = sanitizeStudentName(String(row[6] ?? "").trim());
    const repeating = parseRepeating(String(row[7] ?? "").trim());
    students.push({ name, surname, matricule, sexe, bday, bplace, repeating, sourceRow });
  }
  return { status: true, students };
};

// Hand-rolled rather than a library - see classeImport.ts's identical parseCsvRows for the
// double-quote-escaping details.
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

// Unlike the other *Import.ts files, this keeps each cell's raw value (not immediately
// stringified) so cellToBday can special-case genuine Date objects from date-formatted cells.
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

export const parseStudentImportFile = async (
  file: File,
): Promise<StudentImportParseResult> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: unknown[][];
  if (extension === "csv") {
    rows = await parseCsvRows(await file.text());
  } else if (extension === "xlsx") {
    rows = await parseXlsxRows(file);
  } else {
    return { status: false, error: { type: "unsupportedExtension" } };
  }
  return validateRows(rows);
};
