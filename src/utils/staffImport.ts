// Same allowed charset as sanitizeSchoolInfoText (src/utils/textValidation.ts) - kept as its own
// copy here (matching classeImport.ts/subjectImport.ts's self-contained-per-feature convention)
// rather than importing that one, since its name ties it to the school-info form.
export const VALID_STAFF_CHARS_REGEX =
  /^[a-zA-Z0-9 _\-àâçéèêîôùûÀÂÇÉÈÊÎÔŒÙÛ,/&.()'œ]*$/;

const INVALID_STAFF_CHARS_REGEX =
  /[^a-zA-Z0-9 _\-àâçéèêîôùûÀÂÇÉÈÊÎÔŒÙÛ,/&.()'œ]/g;

export const sanitizeStaffText = (value: string): string =>
  value.replace(INVALID_STAFF_CHARS_REGEX, "");

export interface ImportedStaff {
  civility: string;
  name: string;
  surname: string;
  function: number;
  phone1: string;
  // 1-based row number in the source file (header is row 1), for user-facing error messages.
  sourceRow: number;
}

export type StaffImportError =
  | { type: "unsupportedExtension" }
  | { type: "emptyFile" }
  | { type: "badHeader" }
  | { type: "emptyName"; row: number };

export type StaffImportParseResult =
  | { status: true; staff: ImportedStaff[] }
  | { status: false; error: StaffImportError };

const MAX_PHONE_DIGITS = 15;

// Every synonym the backend/spec recognizes per function code, matched case/accent-insensitively.
// Empty or unrecognized -> 0 (enseignant/teacher), the documented default.
const FUNCTION_SYNONYMS: { code: number; synonyms: string[] }[] = [
  { code: 0, synonyms: ["enseignant", "teacher"] },
  {
    code: 1,
    synonyms: ["sg", "dm", "discipline master", "surveillant general"],
  },
  { code: 2, synonyms: ["censeur", "vp", "vice principal"] },
  { code: 3, synonyms: ["proviseur", "principal"] },
  { code: 4, synonyms: ["intendant", "bursar", "econome"] },
  { code: 5, synonyms: ["director", "directeur"] },
  { code: 6, synonyms: ["chef de travaux", "chief of work"] },
];

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .trim()
    .toLowerCase();

const parseFunction = (raw: string): number => {
  const normalized = normalize(raw);
  if (!normalized) {
    return 0;
  }
  const match = FUNCTION_SYNONYMS.find((entry) =>
    entry.synonyms.includes(normalized),
  );
  return match ? match.code : 0;
};

// Blank/null-safe, and deliberately lenient: an invalid phone number just becomes "" rather than
// aborting the import (per spec, "the validity of phone number should not disrupt importation").
const parsePhone = (raw: string): string => {
  const withoutSpaces = raw.replace(/\s+/g, "");
  if (!withoutSpaces) {
    return "";
  }
  if (
    !/^[0-9]+$/.test(withoutSpaces) ||
    withoutSpaces.length > MAX_PHONE_DIGITS
  ) {
    return "";
  }
  return withoutSpaces;
};

// Column A is read but never used/validated, column B is civility, C is name (required, sanitized),
// D is surname (optional, sanitized), E is function (mapped via FUNCTION_SYNONYMS, defaults to 0),
// F is phone (lenient, see parsePhone). The first structural violation (bad header, or an empty
// name) aborts the whole import - mirrors classeImport.ts/subjectImport.ts's convention of expecting
// the caller to fix the file and re-upload rather than ending up with a partial list.
const validateRows = (rows: string[][]): StaffImportParseResult => {
  if (rows.length < 2) {
    return { status: false, error: { type: "emptyFile" } };
  }
  if (rows[0].length < 6) {
    return { status: false, error: { type: "badHeader" } };
  }

  const staff: ImportedStaff[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = i + 1;
    const civility = sanitizeStaffText((row[1] ?? "").trim());
    const name = sanitizeStaffText((row[2] ?? "").trim());
    if (!name) {
      return { status: false, error: { type: "emptyName", row: sourceRow } };
    }
    const surname = sanitizeStaffText((row[3] ?? "").trim());
    const staffFunction = parseFunction((row[4] ?? "").trim());
    const phone1 = parsePhone((row[5] ?? "").trim());
    staff.push({ civility, name, surname, function: staffFunction, phone1, sourceRow });
  }
  return { status: true, staff };
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

const parseXlsxRows = async (file: File): Promise<string[][]> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  // See classeImport.ts's parseXlsxRows for why `as any` is needed here - exceljs's TS types
  // declare `load` as taking a Node Buffer (unavailable, this project has no @types/node), but its
  // browser build accepts a plain ArrayBuffer at runtime.
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

export const parseStaffImportFile = async (
  file: File,
): Promise<StaffImportParseResult> => {
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

const LOGIN_CHARS_REGEX = /[^a-z0-9]/g;

// The import file has no login/password columns, but every staff record needs a linked Account and
// login/pwd are NOT NULL server-side (see StaffReader.saveStaff's comment) - generates a placeholder
// login/password from the row's name so the account can be created at all. Admins are expected to
// review/rotate these afterward via the existing Modifier flow (which already supports leaving pwd
// blank to keep it unchanged, so only the login needs a look).
export const generateImportCredentials = (
  name: string,
  surname: string,
  sourceRow: number,
): { login: string; pwd: string } => {
  const base = `${name}${surname}`
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .replace(LOGIN_CHARS_REGEX, "");
  const suffix = `${sourceRow}${Math.floor(1000 + Math.random() * 9000)}`;
  const login = `${base.slice(0, 12)}${suffix}`;
  const pwd = (Math.random().toString(36) + Math.random().toString(36))
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  return { login, pwd };
};
