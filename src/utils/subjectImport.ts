export const VALID_SUBJECT_CHARS_REGEX =
  /^[a-zA-Z0-9 _\-àâçéèêîôùûÀÂÇÉÈÊÎÔŒÙÛ,/&.()'œ]*$/;

const INVALID_SUBJECT_CHARS_REGEX =
  /[^a-zA-Z0-9 _\-àâçéèêîôùûÀÂÇÉÈÊÎÔŒÙÛ,/&.()'œ]/g;

export const sanitizeSubjectTitle = (value: string): string =>
  value.replace(INVALID_SUBJECT_CHARS_REGEX, "");

export interface ImportedSubject {
  subject_title: string;
  // 1-based row number in the source file (header is row 1), for user-facing error messages.
  sourceRow: number;
}

export type SubjectImportError =
  | { type: "unsupportedExtension" }
  | { type: "emptyFile" }
  | { type: "badHeader" }
  | { type: "emptyName"; row: number };

export type SubjectImportParseResult =
  | { status: true; subjects: ImportedSubject[] }
  | { status: false; error: SubjectImportError };

// Column A is read but never used/validated (per spec, its content is irrelevant, whether empty or
// not), column B is the subject title (required, sanitized). The first structural violation aborts
// the whole import rather than skipping just that row - the caller is expected to fix the file and
// re-upload, not end up with a partially-imported list (mirrors classeImport.ts's convention).
const validateRows = (rows: string[][]): SubjectImportParseResult => {
  if (rows.length < 2) {
    return { status: false, error: { type: "emptyFile" } };
  }
  if (rows[0].length < 2) {
    return { status: false, error: { type: "badHeader" } };
  }

  const subjects: ImportedSubject[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sourceRow = i + 1;
    const title = sanitizeSubjectTitle((row[1] ?? "").trim());
    if (!title) {
      return { status: false, error: { type: "emptyName", row: sourceRow } };
    }
    subjects.push({ subject_title: title, sourceRow });
  }
  return { status: true, subjects };
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

export const parseSubjectImportFile = async (
  file: File,
): Promise<SubjectImportParseResult> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "xlsx") {
    return { status: false, error: { type: "unsupportedExtension" } };
  }
  const rows = await parseXlsxRows(file);
  return validateRows(rows);
};
