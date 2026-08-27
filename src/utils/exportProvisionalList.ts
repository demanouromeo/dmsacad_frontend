import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "./exportHeader";
import { saveOrShareBlob } from "./nativeFileSave";

// One block = one next-year classe's roster - the basculement toolbox's "Liste provisoire" print.
// Same cover-page-then-one-page-per-block pattern as exportAllMarksReportToPdf (drawPdfLetterhead
// once, one addPage()+autoTable per block, drawPdfSignature/drawPdfFooters once at the very end).
export interface ProvisionalListBlock {
  classeName: string;
  rows: { matricule: string; name: string; surname: string; sexe: string; repeatingLabel: string }[];
  garcons: number;
  filles: number;
}

export const exportProvisionalListToPdf = async (
  nextYear: string,
  blocks: ProvisionalListBlock[],
  schoolHeader: SchoolHeader,
  filename: string,
  columnHeaders: { matricule: string; name: string; surname: string; sexe: string; repeating: string },
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
  doc.text(`Liste provisoire ${nextYear}`, centerX, coverY + 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Année Scolaire: ${nextYear}`, centerX, coverY + 32, { align: "center" });

  blocks.forEach((block) => {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Classe: ${block.classeName}`, 14, 16);
    doc.text(
      `G: ${block.garcons}  F: ${block.filles}  T: ${block.garcons + block.filles}`,
      pageWidth - 14,
      16,
      { align: "right" },
    );
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      startY: 20,
      head: [
        [
          "No",
          columnHeaders.matricule,
          columnHeaders.name,
          columnHeaders.surname,
          columnHeaders.sexe,
          columnHeaders.repeating,
        ],
      ],
      body: block.rows.map((row, index) => [
        index + 1,
        row.matricule,
        row.name,
        row.surname,
        row.sexe,
        row.repeatingLabel,
      ]),
      // Body text defaults to the "striped" theme's dark gray otherwise - force pure black, and
      // keep the head row's white text explicit too (a bare `styles.textColor` merges in after
      // the theme's own head color and would flip it to black-on-blue - see exportData.ts's
      // exportRowsToPdf for the same fix).
      styles: { fontSize: 9, textColor: [0, 0, 0] },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255] },
    });
  });

  if (blocks.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    drawPdfSignature(doc, schoolHeader, finalY);
  }
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
