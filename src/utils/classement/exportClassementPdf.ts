import type { jsPDF } from "jspdf";
import type { RankedClassementRow, ClassementTroisPremiersGroup } from "./classementCompute";
import { fullName } from "./classementCompute";
import { formatRcNumber } from "../reportCard/reportCardCompute";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";
import { STAT_GROUPEES_TERM_ORDINAL } from "../statGroupees/exportStatGroupeesPdf";
import { saveOrShareBlob } from "../nativeFileSave";

// Tabular PDF builders for the "Classement" module (Liste des premiers / Liste des 3 premiers /
// Classement général), pattern-matched off exportPvPdf.ts/exportStatGroupeesPdf.ts - portrait (only
// 6 columns, unlike Stat Groupées/Stat Matière's wide G/F/T tables), letterhead drawn once per
// document per the user's explicit answer during planning (not repeated per classe/page), ending in
// the same drawPdfSignature + drawPdfFooters convention every PDF export in this app uses.

export { STAT_GROUPEES_TERM_ORDINAL as CLASSEMENT_TERM_ORDINAL };

const drawTitleBlock = (doc: jsPDF, pageWidth: number, title: string, schoolYear: string, y: number): number => {
  const centerX = pageWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, centerX, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Année scolaire: ${schoolYear}`, centerX, y, { align: "center" });
  return y + 8;
};

const finish = async (doc: jsPDF, schoolHeader: SchoolHeader, filename: string): Promise<void> => {
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};

// "Liste des premiers" - flat table, one row per classe's champion, re-ranked section-wide (see
// classementCompute.ts's buildPremiersList). Header text ("classe", lowercase singular) matches the
// sample PDF's own wording exactly.
export const exportPremiersListToPdf = async (
  title: string,
  rows: RankedClassementRow[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawPdfLetterhead(doc, schoolHeader);
  y = drawTitleBlock(doc, pageWidth, title, schoolYear, y);

  autoTable(doc, {
    startY: y,
    head: [["No.", "Nom", "Sexe", "classe", "Moy", "Rang"]],
    body: rows.map((r) => [r.no, fullName(r), r.sexe, r.classeName, formatRcNumber(r.moy), r.rangText]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
    bodyStyles: { textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: "left" }, 3: { halign: "left" } },
  });
  await finish(doc, schoolHeader, filename);
};

// "Classement général" - same flat shape as Liste des premiers but over every classified student of
// the section (see buildClassementGeneral). Header text ("Classes", capitalized plural) matches the
// sample PDF's own wording exactly - deliberately different from Liste des premiers' "classe".
export const exportClassementGeneralToPdf = async (
  title: string,
  rows: RankedClassementRow[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawPdfLetterhead(doc, schoolHeader);
  y = drawTitleBlock(doc, pageWidth, title, schoolYear, y);

  autoTable(doc, {
    startY: y,
    head: [["No.", "Nom", "Sexe", "Classes", "Moy.", "Rang"]],
    body: rows.map((r) => [r.no, fullName(r), r.sexe, r.classeName, formatRcNumber(r.moy), r.rangText]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
    bodyStyles: { textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: "left" }, 3: { halign: "left" } },
  });
  await finish(doc, schoolHeader, filename);
};

// "Liste des 3 premiers" - one table, classe groups sharing a merged No./Classes cell via
// jspdf-autotable's body-level rowSpan (no other exporter in this app needs body rowSpan - every
// existing rowSpan usage is head-only, see exportPvPdf.ts's annual table). A group's first row
// carries the {content, rowSpan} cells for both merged columns; every subsequent row of that group
// omits them entirely (autotable shifts the remaining cells into the merged columns' place).
export const exportTroisPremiersToPdf = async (
  title: string,
  groups: ClassementTroisPremiersGroup[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawPdfLetterhead(doc, schoolHeader);
  y = drawTitleBlock(doc, pageWidth, title, schoolYear, y);

  const body: (string | number | { content: string | number; rowSpan: number })[][] = [];
  groups.forEach((group) => {
    group.rows.forEach((row, index) => {
      const studentCells = [fullName(row), row.sexe, formatRcNumber(row.moy), row.rangText];
      if (index === 0) {
        body.push([
          { content: group.no, rowSpan: group.rows.length },
          { content: group.classeName, rowSpan: group.rows.length },
          ...studentCells,
        ]);
      } else {
        body.push(studentCells);
      }
    });
  });

  autoTable(doc, {
    startY: y,
    head: [["No.", "Classes", "Nom", "Sexe", "Moy.", "Rang"]],
    body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
    bodyStyles: { textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: "left" }, 2: { halign: "left" } },
  });
  await finish(doc, schoolHeader, filename);
};
