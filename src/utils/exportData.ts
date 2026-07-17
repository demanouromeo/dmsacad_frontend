export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
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

const csvEscape = (value: string | number): string => {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Plain CSV rather than a real .xlsx workbook: the npm-registry build of the `xlsx` (SheetJS)
// package carries open, unpatched high-severity advisories (prototype pollution, ReDoS), and our
// export data has no formatting/multi-sheet needs that would justify pulling it in. Excel opens
// .csv natively; the UTF-8 BOM keeps accented characters (Filière, Spécialité...) intact.
export const exportRowsToCsv = <T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
): void => {
  const lines = [
    columns.map((c) => csvEscape(c.header)).join(","),
    ...rows.map((row) =>
      columns.map((c) => csvEscape(c.accessor(row))).join(","),
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
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 15);
  autoTable(doc, {
    startY: 20,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.accessor(row)))),
  });
  doc.save(filename);
};
