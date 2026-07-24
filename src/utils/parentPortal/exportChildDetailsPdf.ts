import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";

export interface ChildDetailsPdfSection {
  // e.g. "NOTES DU TRIMESTRE 1" or "BILAN ANNUEL".
  headerLine: string;
  tableHead: string[];
  tableBody: (string | number)[][];
  // e.g. "Moyenne du trimestre : 14.25/20".
  overallAverageLine: string;
  disciplineRows: { label: string; value: number }[];
}

// Bespoke PDF builder for the parent portal's "export child details" action - same
// drawPdfLetterhead/drawPdfSignature/drawPdfFooters convention as exportEffectifsToPdf/
// exportAllMarksReportToPdf, since the layout (marks table + discipline summary, not a flat single
// table) doesn't fit the generic exportRowsToPdf.
export const exportChildDetailsPdf = async (
  schoolHeader: SchoolHeader,
  childName: string,
  matricule: string,
  classeName: string,
  section: ChildDetailsPdfSection,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(section.headerLine, centerX, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${childName}  (${matricule})`, 14, y);
  y += 5;
  doc.text(classeName, 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [section.tableHead],
    body: section.tableBody,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(section.overallAverageLine, 14, y);
  y += 10;

  if (section.disciplineRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Discipline", ""]],
      body: section.disciplineRows.map((r) => [r.label, r.value]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  drawPdfSignature(doc, schoolHeader, y);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
