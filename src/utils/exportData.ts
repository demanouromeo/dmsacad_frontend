import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "./exportHeader";

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T, index: number) => string | number;
}

const sanitizeFilenamePart = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]+/g, "_");

export const buildExportFilename = (
  parts: string[],
  extension: string,
): string => `${parts.map(sanitizeFilenamePart).join("_")}.${extension}`;

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Accessors are typed as string | number, but real row data (straight from the API) can still
// carry a null/undefined DB field through at runtime - render that as an empty cell, not "null".
const formatCellValue = (value: string | number): string =>
  value === null || value === undefined ? "" : String(value);

const csvEscape = (value: string | number): string => {
  const str = formatCellValue(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Plain CSV rather than a real .xlsx workbook: the npm-registry build of the `xlsx` (SheetJS)
// package carries open, unpatched high-severity advisories (prototype pollution, ReDoS), and our
// export data has no formatting/multi-sheet needs that would justify pulling it in. Excel opens
// .csv natively; the UTF-8 BOM keeps accented characters (Filière, Spécialité...) intact.
// Unlike exportRowsToPdf, this never prepends the school letterhead - CSV/Excel is treated as raw
// tabular data for further processing, not a document to be printed as-is.
export const exportRowsToCsv = <T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
): void => {
  const lines = [
    columns.map((c) => csvEscape(c.header)).join(","),
    ...rows.map((row, index) =>
      columns.map((c) => csvEscape(c.accessor(row, index))).join(","),
    ),
  ];
  const BOM = "﻿";
  const blob = new Blob([BOM + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  downloadBlob(blob, filename);
};

export const exportRowsToPdf = async <T>(
  title: string,
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  schoolHeader?: SchoolHeader,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const y = schoolHeader ? drawPdfLetterhead(doc, schoolHeader) : 15;
  doc.setFontSize(14);
  doc.text(title, 14, y);
  autoTable(doc, {
    startY: y + 5,
    head: [columns.map((c) => c.header)],
    body: rows.map((row, index) =>
      columns.map((c) => formatCellValue(c.accessor(row, index))),
    ),
  });
  drawPdfFooters(doc);
  doc.save(filename);
};
