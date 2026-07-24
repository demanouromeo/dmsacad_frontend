import type { jsPDF } from "jspdf";
import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import {
  formatRangText,
  formatRcFixed2,
  formatRcMoyDisplay,
  formatRcNumber,
  getCompComment,
} from "./reportCardCompute";
import {
  centerTextY,
  disciplineCell,
  drawAnnualDecisionBlock,
  drawLabelValue,
  drawStudentPhoto,
  lineHeightMm,
  PHOTO_WIDTH,
  truncateToWidth,
} from "./reportCardPdfShared";
import type { AnnualClasseStats, AnnualStudentDataApc } from "../../interfaces/AnnualReportCard";

// APC annual bulletin ("Bulletin Annuel") - a genuinely different layout from the non-APC annual
// one (exportAnnualReportCardPdf.ts): the marks table is one row per SUBJECT (Trim1/2/3 = that
// subject's own per-term average, no group subtotals, no per-subject Rang - COTE/[Min-Max] take
// its place), and the footer is a near-verbatim reuse of the term APC layout's own
// DISCIPLINE|TRAVAIL DE L'ÉLÈVE|PROFIL DE LA CLASSE grid (exportReportCardPdf.ts) rather than the
// non-APC annual's bespoke CONDUITE ANNUELLE/RÉCAPITULATIF DES MOYENNES boxes - see apcAnnual.md
// and the plan's findings for why (the spec explicitly reuses the non-APC annual's classification/
// decision algorithms, but the printed layout mirrors the term APC RC instead).

const COLOR_GREEN_300: [number, number, number] = [134, 239, 172];
const COLOR_PINK_300: [number, number, number] = [249, 168, 212];
const HEADER_FILL: [number, number, number] = [219, 234, 254];

const LEFT_X = 14;
const RIGHT_X = 196;

const COLS = {
  matiere: 40,
  n1: 14,
  n2: 14,
  n3: 14,
  moy: 14,
  coef: 10,
  mcoef: 16,
  cote: 12,
  minmax: 20,
  appr: 28,
};
const COL_KEYS = ["matiere", "n1", "n2", "n3", "moy", "coef", "mcoef", "cote", "minmax", "appr"] as const;
const COL_BOUNDS: number[] = (() => {
  let x = LEFT_X;
  const bounds = [x];
  COL_KEYS.forEach((key) => {
    x += COLS[key];
    bounds.push(x);
  });
  return bounds;
})();
const colX = (key: (typeof COL_KEYS)[number]): number => COL_BOUNDS[COL_KEYS.indexOf(key)];
const colWidth = (key: (typeof COL_KEYS)[number]): number => COLS[key];
const colCenter = (key: (typeof COL_KEYS)[number]): number => colX(key) + colWidth(key) / 2;
const NOTE_KEYS = ["n1", "n2", "n3"] as const;

const FONT_SIZE_CANDIDATES = [8, 7.5, 7, 6.5, 6, 5.5, 5];
const SUBJECT_ROW_LINES = 2;
const MARKS_TO_FOOTER_GAP = 3;

// Footer grid: DISCIPLINE | TRAVAIL DE L'ÉLÈVE (+APPRECIATIONS checklist) | PROFIL DE LA CLASSE,
// ported from the term APC layout (exportReportCardPdf.ts) - same 6-row body + header, but a
// taller signature row (DECISION_SIG_H instead of the term layout's 18mm) so the "DÉCISION DU
// CONSEIL DE FIN D'ANNÉE" block (which needs room for the 2x3 exclusion-reason grid on an "exclu"
// decision) fits uniformly regardless of decision kind - same "fixed height regardless of content"
// precedent the non-APC annual layout's ROW2_HEIGHT/ROW3_HEIGHT already use.
const FOOTER_HEADER_H = 6;
const FOOTER_ROW_H = 6;
const FOOTER_ROW_COUNT = 6;
const DECISION_SIG_H = 28;
const FOOTER_GRID_HEIGHT = FOOTER_HEADER_H + FOOTER_ROW_H * FOOTER_ROW_COUNT + DECISION_SIG_H;
const FIXED_BLOCKS_HEIGHT = MARKS_TO_FOOTER_GAP + FOOTER_GRID_HEIGHT;
const BOTTOM_MARGIN = 20;

interface TableLayout {
  fontSize: number;
  lh: number;
  headerHeight: number;
  rowHeight: number;
  tableHeight: number;
}

const measureTable = (
  doc: jsPDF,
  subjectCount: number,
  fontSize: number,
): TableLayout => {
  doc.setFontSize(fontSize);
  const lh = lineHeightMm(doc, fontSize);
  const headerHeight = lh + 3;
  const rowHeight = lh * SUBJECT_ROW_LINES;
  const totalRowHeight = lh + 2;
  return {
    fontSize,
    lh,
    headerHeight,
    rowHeight,
    tableHeight: headerHeight + subjectCount * rowHeight + totalRowHeight,
  };
};

const chooseTableLayout = (
  doc: jsPDF,
  subjectCount: number,
  letterheadY: number,
): TableLayout => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const available = pageHeight - letterheadY - FIXED_BLOCKS_HEIGHT - BOTTOM_MARGIN;
  let best: TableLayout | null = null;
  for (const fontSize of FONT_SIZE_CANDIDATES) {
    const layout = measureTable(doc, subjectCount, fontSize);
    best = layout;
    if (layout.tableHeight <= available) {
      return layout;
    }
  }
  return best as TableLayout;
};

const drawMarksTable = (doc: jsPDF, student: AnnualStudentDataApc, startY: number): number => {
  const layout = chooseTableLayout(doc, student.subjects.length, startY);
  const fontSize = layout.fontSize;
  doc.setFontSize(fontSize);
  const lh = layout.lh;

  const tableTop = startY;
  let y = tableTop;
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, tableTop, RIGHT_X, tableTop);
  doc.setFont("helvetica", "bold");
  const headerMidY = centerTextY(tableTop, layout.headerHeight, fontSize);
  doc.text("MATIÈRES", colCenter("matiere"), headerMidY, { align: "center" });
  ["Trim1", "Trim2", "Trim3"].forEach((label, i) => {
    doc.text(label, colCenter(NOTE_KEYS[i]), headerMidY, { align: "center" });
  });
  doc.text("MOY", colCenter("moy"), headerMidY, { align: "center" });
  doc.text("COEF", colCenter("coef"), headerMidY, { align: "center" });
  doc.text("M.xC", colCenter("mcoef"), headerMidY, { align: "center" });
  doc.text("COTE", colCenter("cote"), headerMidY, { align: "center" });
  doc.text("[Min-Max]", colCenter("minmax"), headerMidY, { align: "center" });
  doc.setFontSize(fontSize - 1);
  doc.text(
    "Appr & visa de l'ensei.",
    colCenter("appr"),
    headerMidY,
    { align: "center", maxWidth: colWidth("appr") - 1 },
  );
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  y = tableTop + layout.headerHeight;
  doc.line(LEFT_X, y, RIGHT_X, y);

  const rowHeight = layout.rowHeight;
  student.subjects.forEach((subject) => {
    const rowTop = y;
    const midY = centerTextY(rowTop, rowHeight, fontSize);
    if (subject.moy !== null && subject.moy >= 10) {
      doc.setFillColor(...COLOR_GREEN_300);
      doc.rect(colX("moy"), rowTop, colWidth("moy"), rowHeight, "F");
    } else if (subject.moy !== null) {
      doc.setFillColor(...COLOR_PINK_300);
      doc.rect(colX("moy"), rowTop, colWidth("moy"), rowHeight, "F");
    }

    const staffText = subject.staffLabel
      ? truncateToWidth(doc, `(${subject.staffLabel})`, colWidth("matiere") - 2)
      : "";
    const titleText = truncateToWidth(doc, subject.subjectTitle, colWidth("matiere") - 2);
    doc.setFont("helvetica", "bold");
    doc.text(titleText, colX("matiere") + 1, staffText ? midY - lh / 2 : midY);
    if (staffText) {
      doc.setFont("helvetica", "italic");
      doc.text(staffText, colX("matiere") + 1, midY + lh / 2);
    }
    doc.setFont("helvetica", "normal");

    doc.setFontSize(fontSize + 1);
    NOTE_KEYS.forEach((key, i) => {
      const note = subject.notes[i];
      if (note !== null) {
        doc.text(formatRcMoyDisplay(note), colCenter(key), midY, { align: "center" });
      }
    });

    if (subject.moy !== null && subject.mCoef !== null) {
      doc.setFont("helvetica", "bold");
      doc.text(formatRcMoyDisplay(subject.moy), colCenter("moy"), midY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(subject.coef.toFixed(1), colCenter("coef"), midY, { align: "center" });
      doc.text(formatRcFixed2(subject.mCoef), colCenter("mcoef"), midY, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(subject.cote, colCenter("cote"), midY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      const minMaxText = `[${formatRcNumber(subject.subjectMin)} - ${formatRcNumber(subject.subjectMax)}]`;
      doc.text(truncateToWidth(doc, minMaxText, colWidth("minmax") - 2), colCenter("minmax"), midY, {
        align: "center",
      });
      const apprText = truncateToWidth(doc, subject.appr, colWidth("appr") - 2);
      doc.text(apprText, colCenter("appr"), midY, { align: "center" });
    } else {
      doc.text(subject.coef.toFixed(1), colCenter("coef"), midY, { align: "center" });
      doc.setFontSize(fontSize);
    }

    y = rowTop + rowHeight;
    doc.setLineWidth(0.1);
    doc.line(LEFT_X, y, RIGHT_X, y);
  });

  // TOTAL row: COEF/M.xC sums, plus "Moyenne: X" text (same annual average shown in the TRAVAIL
  // box's MOYENNE ANNUELLE - matches every sample RC showing the identical value in both places).
  const totalTop = y;
  const totalMidY = centerTextY(totalTop, lh + 2, fontSize);
  doc.setFontSize(fontSize + 1.5);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", (LEFT_X + colX("moy")) / 2, totalMidY, { align: "center" });
  doc.text(student.coefSum.toFixed(1), colCenter("coef"), totalMidY, { align: "center" });
  doc.text(formatRcNumber(student.totalGeneral), colCenter("mcoef"), totalMidY, { align: "center" });
  doc.text(`Moyenne: ${formatRcNumber(student.avgAnnual)}`, colX("cote") + 1, totalMidY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  y = totalTop + lh + 2;
  doc.setLineWidth(0.2);
  doc.line(LEFT_X, y, RIGHT_X, y);

  doc.setLineWidth(0.3);
  doc.line(LEFT_X, tableTop, LEFT_X, y);
  doc.line(RIGHT_X, tableTop, RIGHT_X, y);
  COL_BOUNDS.slice(1, -1).forEach((x) => {
    doc.setLineWidth(0.15);
    doc.line(x, tableTop, x, totalTop);
  });

  doc.setFont("helvetica", "normal");
  return y;
};

// Footer grid: DISCIPLINE | TRAVAIL DE L'ÉLÈVE (+APPRECIATIONS checklist) | PROFIL DE LA CLASSE,
// ported from exportReportCardPdf.ts's drawStudentPage - same column-bounds/fill/checklist shape,
// annual-scoped values, and the bottom-left cell repurposed for the decision block (finding #4).
const drawFooterGrid = (
  doc: jsPDF,
  student: AnnualStudentDataApc,
  classeStats: AnnualClasseStats,
  schoolHeader: SchoolHeader,
  gridTop: number,
): void => {
  const gridColWidth = (RIGHT_X - LEFT_X) / 3;
  const COL_WIDTH_SHIFT = 6;
  const travailWidth = gridColWidth + COL_WIDTH_SHIFT;
  const profilWidth = gridColWidth - COL_WIDTH_SHIFT;
  const disciplineX = LEFT_X;
  const travailX = LEFT_X + gridColWidth;
  const profilX = travailX + travailWidth;

  const fc = [
    disciplineX,
    disciplineX + gridColWidth * 0.42,
    disciplineX + gridColWidth * 0.52,
    disciplineX + gridColWidth * 0.9,
    travailX,
    travailX + travailWidth * 0.4,
    travailX + travailWidth * 0.6,
    travailX + travailWidth * 0.84,
    profilX,
    profilX + profilWidth * 0.55,
    RIGHT_X,
  ];
  const fcx = (i: number): number => fc[i];
  const fcCenter = (i: number, j: number): number => (fcx(i) + fcx(j)) / 2;

  const footerRowTop = (i: number): number => gridTop + FOOTER_HEADER_H + FOOTER_ROW_H * i;
  const sigTop = footerRowTop(FOOTER_ROW_COUNT);
  const footerBottom = sigTop + DECISION_SIG_H;

  doc.setFillColor(...HEADER_FILL);
  doc.rect(fcx(0), gridTop, fcx(4) - fcx(0), FOOTER_HEADER_H, "F");
  doc.rect(fcx(4), gridTop, fcx(8) - fcx(4), FOOTER_HEADER_H, "F");
  doc.rect(fcx(8), gridTop, fcx(10) - fcx(8), FOOTER_HEADER_H, "F");

  const moyenneRowIndex = 2;
  const pass = student.avgAnnual >= 10;
  doc.setFillColor(...(pass ? COLOR_GREEN_300 : COLOR_PINK_300));
  doc.rect(fcx(4), footerRowTop(moyenneRowIndex), fcx(6) - fcx(4), FOOTER_ROW_H, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const headerTextY = gridTop + FOOTER_HEADER_H - 1.5;
  doc.text("DISCIPLINE", fcCenter(0, 4), headerTextY, { align: "center" });
  doc.text("TRAVAIL DE L'ÉLÈVE", fcCenter(4, 8), headerTextY, { align: "center" });
  doc.text("PROFIL DE LA CLASSE", fcCenter(8, 10), headerTextY, { align: "center" });
  doc.setFont("helvetica", "normal");

  const disc = student.disciplineAnnual;
  const disciplineRows: [string, string, string, string][] = [
    ["Abs non just(h):", disciplineCell(disc.absNonJust), "Avert.:", disciplineCell(disc.avertissement)],
    ["Abs just(h):", disciplineCell(disc.absJust), "Blâme:", disciplineCell(disc.blame)],
    ["Retards:", disciplineCell(disc.lateness), "Excl(j):", disciplineCell(disc.exclusionJours)],
    ["Consignes(h):", disciplineCell(disc.consigne), "Excl déf.:", disciplineCell(disc.exclusionDefinitive)],
  ];
  disciplineRows.forEach(([l1, v1, l2, v2], i) => {
    const ry = footerRowTop(i) + FOOTER_ROW_H / 2 + 1;
    doc.setFont("helvetica", "normal");
    doc.text(l1, fcx(0) + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(v1, fcx(1) + 1, ry);
    doc.setFont("helvetica", "normal");
    doc.text(l2, fcx(2) + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(v2, fcx(3) + 1, ry);
    doc.setFont("helvetica", "normal");
  });

  const apprLabels = ["CTBA", "CBA", "CA", "CMA", "CNA"];
  const travailRows: [string, string][] = [
    ["Total général:", formatRcNumber(student.totalGeneral)],
    ["COEF:", student.coefSum.toFixed(1)],
    ["MOYENNE ANNUELLE:", formatRcNumber(student.avgAnnual)],
    ["COTE:", student.cote],
    ["RANG:", formatRangText(student.rangAnnuel, student.sexe, "fr")],
  ];
  travailRows.forEach(([label, value], i) => {
    const ry = footerRowTop(i) + FOOTER_ROW_H / 2 + 1;
    doc.setFont("helvetica", "normal");
    doc.text(label, fcx(4) + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(value, fcx(5) + 1, ry);
    doc.setFont("helvetica", "normal");
  });

  doc.setFont("helvetica", "bold");
  doc.text("APPRECIATIONS", fcCenter(6, 8), footerRowTop(0) + FOOTER_ROW_H / 2 + 1, { align: "center" });
  doc.setFont("helvetica", "normal");
  apprLabels.forEach((apprLabel, i) => {
    const ry = footerRowTop(i + 1) + FOOTER_ROW_H / 2 + 1;
    const checked = apprLabel === getCompComment(student.avgAnnual);
    doc.text(apprLabel, fcx(6) + 1, ry);
    doc.rect(fcx(7) + 2, ry - 3, 3, 3, "S");
    if (checked) {
      doc.setFont("helvetica", "bold");
      doc.text("X", fcx(7) + 2.5, ry - 0.6);
      doc.setFont("helvetica", "normal");
    }
  });

  const profilRows: [string, string][] = [
    ["Moyenne Générale:", formatRcNumber(classeStats.moyenneGenerale)],
    [
      "[MIN-MAX]:",
      `[${formatRcNumber(classeStats.minMax[0])} - ${formatRcNumber(classeStats.minMax[1])}]`,
    ],
    ["Nombre de moyennes:", String(classeStats.nombreMoyennes)],
    ["Taux de réussite:", `${formatRcNumber(classeStats.tauxReussite)}%`],
  ];
  profilRows.forEach(([label, value], i) => {
    const ry = footerRowTop(i) + FOOTER_ROW_H / 2 + 1;
    doc.setFont("helvetica", "normal");
    doc.text(label, fcx(8) + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(value, fcx(9) + 1, ry);
    doc.setFont("helvetica", "normal");
  });

  // Bottom row: DÉCISION DU CONSEIL DE FIN D'ANNÉE | Visa parent | Nom et visa prof principal |
  // Fait à.../Le X - same 4-cell shape as the term layout's signature row, first cell repurposed.
  drawAnnualDecisionBlock(doc, student.decision, student.sexe, fcx(0), sigTop, fcx(4) - fcx(0), DECISION_SIG_H);

  const sigTextTop = sigTop + 4;
  doc.text("Visa du parent / Tuteur", fcx(4) + 1, sigTextTop);
  const profWrapped: string[] = doc.splitTextToSize(
    "Nom et visa du professeur principal",
    fcx(8) - fcx(6) - 2,
  );
  profWrapped.forEach((line, i) => {
    doc.text(line, fcx(6) + 1, sigTextTop + i * 4);
  });
  const config = schoolHeader.config;
  if (config && (config.lieu_signature || config.date_signature)) {
    const responsable = computeResponsable(config.type ?? "");
    const place = config.lieu_signature ?? "";
    const date = config.date_signature ? config.date_signature.slice(0, 10) : "";
    doc.text(`Fait à ${place}, le ${date}`, fcx(8) + 1, sigTextTop);
    doc.setFont("helvetica", "bold");
    doc.text(`Le ${responsable.fr}`, fcx(8) + 1, sigTextTop + 5);
    doc.setFont("helvetica", "italic");
    doc.text(`The ${responsable.en}`, fcx(8) + 1, sigTextTop + 10);
    doc.setFont("helvetica", "normal");
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  const apprMergeRowY = footerRowTop(1);
  [
    gridTop,
    ...Array.from({ length: FOOTER_ROW_COUNT + 1 }, (_, i) => footerRowTop(i)),
    sigTop,
    footerBottom,
  ].forEach((rowY) => {
    if (rowY === apprMergeRowY) {
      doc.line(fcx(0), rowY, fcx(6), rowY);
      doc.line(fcx(8), rowY, fcx(10), rowY);
      return;
    }
    // The decision block/Visa cells draw their own borders (drawAnnualDecisionBlock rects itself,
    // and there's no fill under Visa/Nom et visa/Fait à) - skip the generic full-width line at the
    // sig row boundaries so it doesn't double up with drawAnnualDecisionBlock's own rect.
    if (rowY === sigTop || rowY === footerBottom) {
      doc.line(fcx(4), rowY, fcx(10), rowY);
      return;
    }
    doc.line(fcx(0), rowY, fcx(10), rowY);
  });
  [0, 4, 8, 10].forEach((i) => doc.line(fcx(i), gridTop, fcx(i), footerBottom));
  doc.setLineWidth(0.15);
  const innerColIndices = [1, 2, 3, 5, 6, 7, 9];
  for (let rowIndex = 0; rowIndex < FOOTER_ROW_COUNT; rowIndex++) {
    const rowT = footerRowTop(rowIndex);
    const rowB = footerRowTop(rowIndex + 1);
    innerColIndices.forEach((colIdx) => {
      if (rowIndex === 0 && colIdx === 7) {
        return;
      }
      doc.line(fcx(colIdx), rowT, fcx(colIdx), rowB);
    });
  }
  [6, 8].forEach((colIdx) => doc.line(fcx(colIdx), sigTop, fcx(colIdx), footerBottom));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
};

const drawStudentPage = (
  doc: jsPDF,
  student: AnnualStudentDataApc,
  classe: { classe_name: string; classe_master_name: string | null },
  classeStats: AnnualClasseStats,
  year: string,
  schoolHeader: SchoolHeader,
  photoImage: HTMLImageElement | null,
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const letterheadY = drawPdfLetterhead(doc, schoolHeader, { includePhone: false });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("BULLETIN DE NOTES ANNUEL", centerX, letterheadY + 4, { align: "center" });

  drawStudentPhoto(doc, photoImage, RIGHT_X - PHOTO_WIDTH, letterheadY + 6);

  let infoY = letterheadY + 13;
  const infoLh = 5.5;
  doc.setFontSize(9);
  const leftColX = LEFT_X;
  const rightColX = centerX + 6;
  drawLabelValue(doc, "Nom(s) et prénom(s):", `${student.name} ${student.surname}`.trim(), leftColX, infoY);
  drawLabelValue(doc, "Classe:", classe.classe_name, rightColX, infoY);
  infoY += infoLh;
  drawLabelValue(doc, "Matricule:", student.matricule, leftColX, infoY);
  drawLabelValue(doc, "Effectif de la classe:", String(classeStats.effectif), rightColX, infoY);
  infoY += infoLh;
  drawLabelValue(
    doc,
    "Date & lieu de naissance:",
    `${student.bday} à ${student.bplace}`,
    leftColX,
    infoY,
  );
  drawLabelValue(doc, "Année scolaire:", year, rightColX, infoY);
  infoY += infoLh;
  drawLabelValue(doc, "Professeur Principal:", classe.classe_master_name ?? "", leftColX, infoY);
  drawLabelValue(
    doc,
    "Sexe:",
    `${student.sexe}   Redouble: ${student.repeating ? "Oui" : "Non"}`,
    rightColX,
    infoY,
  );

  const tableTop = infoY + infoLh - 1;
  const tableBottom = drawMarksTable(doc, student, tableTop);

  const gridTop = tableBottom + MARKS_TO_FOOTER_GAP;
  drawFooterGrid(doc, student, classeStats, schoolHeader, gridTop);
};

// One page per student (already sorted classified-desc-by-avgAnnual then NC-desc-by-avgAnnual by
// buildAnnualReportCardDataApc - see annualReportCardCompute.ts).
export const exportAnnualReportCardsApcToPdf = async (
  students: AnnualStudentDataApc[],
  classeStats: AnnualClasseStats,
  classe: { classe_name: string; classe_master_name: string | null },
  year: string,
  schoolHeader: SchoolHeader,
  filename: string,
  photosByStudId: Map<number, HTMLImageElement | null>,
): Promise<void> => {
  const { default: JsPdfCtor } = await import("jspdf");
  const doc = new JsPdfCtor();

  students.forEach((student, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawStudentPage(
      doc,
      student,
      classe,
      classeStats,
      year,
      schoolHeader,
      photosByStudId.get(student.studId) ?? null,
    );
  });

  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
