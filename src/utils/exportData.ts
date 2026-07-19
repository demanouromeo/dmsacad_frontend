import {
  drawPdfFooters,
  drawPdfLetterhead,
  drawPdfSignature,
  type SchoolHeader,
} from "./exportHeader";

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T, index: number) => string | number;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

// Only characters that are actually invalid in a Windows/Mac/Linux filename - deliberately keeps
// spaces, dashes and accented letters, since the requested "<Title> - <segment> - ... -
// yyyy mm dd hh mm ss" format relies on them.
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

// Capitalizes a literal section value ("francophone"/"anglophone") for display in a filename -
// every other place in the app shows the raw lowercase value (see e.g. FiliereManager's
// sectionHint), but a printed/downloaded document's filename reads better title-cased.
export const capitalizeSectionName = (section: string): string =>
  section.charAt(0).toUpperCase() + section.slice(1);

// Builds every export filename in the app (CSV/Excel, PDF, and any other exported document) in the
// single "<Title> - <extra segment> - ... - yyyy mm dd hh mm ss.<ext>" format used across every
// admin screen - e.g. buildTimestampedFilename("Liste de classes", ["Section Francophone"], "pdf")
// -> "Liste de classes - Section Francophone - 2026 07 18 14 30 05.pdf". `extraSegments` entries
// are already-labeled strings (e.g. `Section ${capitalizeSectionName(section)}`,
// `Classe ${classe_name}`) joined in the given order; pass [] for screens whose export isn't scoped
// to anything beyond its title (e.g. Staff, which isn't section-scoped).
export const buildTimestampedFilename = (
  title: string,
  extraSegments: string[],
  extension: string,
): string => {
  const now = new Date();
  const datePart = `${now.getFullYear()} ${pad2(now.getMonth() + 1)} ${pad2(now.getDate())}`;
  const timePart = `${pad2(now.getHours())} ${pad2(now.getMinutes())} ${pad2(now.getSeconds())}`;
  const segments = [title, ...extraSegments, `${datePart} ${timePart}`];
  // Invalid characters are replaced by a literal space (not stripped/underscored) - e.g.
  // "4e ALL/4e ARA'B" -> "4e ALL 4e ARA'B" - per explicit request, so a run of them still reads as
  // separate words rather than colliding together.
  return `${segments.join(" - ")}.${extension}`.replace(INVALID_FILENAME_CHARS, " ");
};

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
  // Every export through this generic table builder gets the "Fait à ..." signature block by
  // default - callers exporting a report card/bulletin/livret (which use their own print layout,
  // not this function) would pass false, but no such caller exists yet in this codebase.
  includeSignature = true,
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
  if (includeSignature && schoolHeader) {
    // jspdf-autotable patches the doc instance with `lastAutoTable` at runtime (see its own
    // source, jspdf.plugin.autotable.js) - its published types don't expose this on the plain
    // jsPDF type this project imports, hence the cast.
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY;
    drawPdfSignature(doc, schoolHeader, finalY);
  }
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
