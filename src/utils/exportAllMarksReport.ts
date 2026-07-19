import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "./exportHeader";

export interface AllMarksReportRow {
  studId: number;
  name: string;
  // One value per report column (see AllMarksReportBlock.columnHeaders) - "" for an empty/unset
  // mark, formatted exactly as it should appear in the cell (no rounding/re-parsing here).
  values: string[];
}

// One printable block = one (classe, subject) table. For a non-APC classe this is always the two
// literal "NOTE1"/"NOTE2" columns (the term's two sequences); for an APC classe this is one
// "Comp. N" column per competence defined for that subject+term - the competence's own text is
// deliberately not used as the header (it can be long/paragraph-length), matching this report's own
// mockup, which labels APC columns "Comp. 1"/"Comp. 2"/... rather than the competence wording.
export interface AllMarksReportBlock {
  classeName: string;
  subjectTitle: string;
  columnHeaders: string[];
  rows: AllMarksReportRow[];
}

const TERM_ORDINALS_FR = ["PREMIER", "DEUXIEME", "TROISIEME"];

export const buildAllMarksReportTitle = (term: number): string =>
  `NOTES DU ${TERM_ORDINALS_FR[term - 1] ?? term} TRIMESTRE`;

// Builds the "Notes trim N" report - a title-only cover page (letterhead + report title + school
// year, mirroring exportEffectifsToPdf's cover block) followed by one autoTable per (classe,
// subject) block, each starting on its own page. Matches the reference report's own pagination
// (a new "Classe: X Matière: Y" page begins after the previous subject's table, even when that
// table's own rows would still have fit on the same page) rather than the effectifs report's
// continuous-flow-with-y-tracking layout.
export const exportAllMarksReportToPdf = async (
  schoolYear: string,
  term: number,
  blocks: AllMarksReportBlock[],
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const coverY = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(buildAllMarksReportTitle(term), centerX, coverY + 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Année Scolaire: ${schoolYear}`, centerX, coverY + 32, { align: "center" });

  blocks.forEach((block) => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Classe: ${block.classeName}`, 14, 16);
    doc.text(`Matière: ${block.subjectTitle}`, pageWidth - 14, 16, { align: "right" });
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: 20,
      head: [["NO.", "NOM ET PRÉNOM", ...block.columnHeaders]],
      body: block.rows.map((row, index) => [index + 1, row.name, ...row.values]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });
  });

  if (blocks.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    drawPdfSignature(doc, schoolHeader, finalY);
  }
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
