import type { SectionEffectif } from "./effectifs";
import { sumSections } from "./effectifs";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "./exportHeader";

const SUMMARY_ROW_STYLE = { fontStyle: "bold" as const, fillColor: [229, 231, 235] as [number, number, number] };
const BILAN_ROW_STYLE = {
  fontStyle: "bold" as const,
  fillColor: [0, 0, 0] as [number, number, number],
  textColor: 255 as const,
};

const HEAD = ["N°", "Classe", "Garçon", "Fille", "Nouv.", "Redoub.", "Total"];

const sectionLabel = (section: string): string =>
  section === "anglophone" ? "ANGLOPHONE" : "FRANCOPHONE";

// Builds the "EFFECTIFS PAR CLASSE" report - one table per section (Francophone then Anglophone),
// each grouping its classes by cycle with a bold "RÉSUMÉ DU CYCLE n" subtotal row and a black
// "Bilan section" row, followed by an overall "BILAN" row across every section. Mirrors the
// school's existing bilingual-letterhead + "Fait à.../Le X" signature convention (exportHeader.ts)
// used by every other admin screen's PDF export, rather than inventing a new document layout.
export const exportEffectifsToPdf = async (
  schoolYear: string,
  sections: SectionEffectif[],
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EFFECTIFS PAR CLASSE", centerX, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text(`Année Scolaire: ${schoolYear}`, centerX, y, { align: "center" });
  y += 6;

  let index = 0;
  sections.forEach((section) => {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`SECTION: ${sectionLabel(section.section)}`, 14, y);
    y += 4;

    const body: (string | number | { content: string | number; colSpan?: number; styles?: object })[][] = [];
    section.cycles.forEach((cycle) => {
      cycle.classes.forEach((classe) => {
        index += 1;
        body.push([
          index,
          classe.classe_name,
          classe.garcons,
          classe.filles,
          classe.nouveaux,
          classe.redoublants,
          classe.total,
        ]);
      });
      body.push([
        { content: `RÉSUMÉ DU CYCLE ${cycle.cycle}`, colSpan: 2, styles: SUMMARY_ROW_STYLE },
        { content: cycle.garcons, styles: SUMMARY_ROW_STYLE },
        { content: cycle.filles, styles: SUMMARY_ROW_STYLE },
        { content: cycle.nouveaux, styles: SUMMARY_ROW_STYLE },
        { content: cycle.redoublants, styles: SUMMARY_ROW_STYLE },
        { content: cycle.total, styles: SUMMARY_ROW_STYLE },
      ]);
    });
    body.push([
      { content: `Bilan section: ${section.section}`, colSpan: 2, styles: BILAN_ROW_STYLE },
      { content: section.garcons, styles: BILAN_ROW_STYLE },
      { content: section.filles, styles: BILAN_ROW_STYLE },
      { content: section.nouveaux, styles: BILAN_ROW_STYLE },
      { content: section.redoublants, styles: BILAN_ROW_STYLE },
      { content: section.total, styles: BILAN_ROW_STYLE },
    ]);

    autoTable(doc, {
      startY: y,
      head: [HEAD],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 64, 175] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });

  const grandTotal = sumSections(sections);
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }
  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "BILAN", colSpan: 2, styles: BILAN_ROW_STYLE },
        { content: grandTotal.garcons, styles: BILAN_ROW_STYLE },
        { content: grandTotal.filles, styles: BILAN_ROW_STYLE },
        { content: grandTotal.nouveaux, styles: BILAN_ROW_STYLE },
        { content: grandTotal.redoublants, styles: BILAN_ROW_STYLE },
        { content: grandTotal.total, styles: BILAN_ROW_STYLE },
      ],
    ],
    styles: { fontSize: 9 },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
