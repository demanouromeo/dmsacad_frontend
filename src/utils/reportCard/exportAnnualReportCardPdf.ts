import type { jsPDF } from "jspdf";
import goodProgressImg from "../../assets/compo/rc/good.png";
import badProgressImg from "../../assets/compo/rc/bad.png";
import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import {
  computeGroupSubtotal,
  formatRangText,
  formatRcMoyDisplay,
  formatRcNumber,
} from "./reportCardCompute";
import {
  centerTextY,
  disciplineCell,
  drawAnnualDecisionBlock,
  drawLabelValue,
  drawStudentPhoto,
  fitImageInBox,
  groupSubjects,
  lineHeightMm,
  loadStaticImage,
  PHOTO_WIDTH,
  truncateToWidth,
} from "./reportCardPdfShared";
import type {
  AnnualClasseStats,
  AnnualStudentData,
  AnnualSubjectRow,
} from "../../interfaces/AnnualReportCard";

// Non-APC annual bulletin ("Bulletin Annuel") - a distinct layout from the term one
// (exportReportCardNonApcPdf.ts): a 6-note-column marks table (one per dbsequence across the
// whole year), a 3-block "TRAVAIL DE L'ÉLÈVE / PROFIL DE LA CLASSE / RÉCAPITULATIF DES MOYENNES"
// row, and a 3-block "CONDUITE ANNUELLE / DÉCISION DU CONSEIL DE FIN D'ANNÉE / VISA DU CHEF
// D'ÉTABLISSEMENT" row - reconstructed and hand-verified against src/assets/SAMPLE_RC/NON APC
// ANNUAL. See the plan's "Key findings from verification" for the specific decisions made where
// nonAPCannual.md was silent, buggy, or ambiguous.

const COLOR_GREEN_300: [number, number, number] = [134, 239, 172];
const COLOR_PINK_300: [number, number, number] = [249, 168, 212];
const HEADER_FILL: [number, number, number] = [219, 234, 254];

const LEFT_X = 14;
const RIGHT_X = 196;

// Marks table: 10 logical columns summing to the 182mm content width used everywhere in the app.
const COLS = {
  matiere: 36,
  n1: 8,
  n2: 8,
  n3: 8,
  n4: 8,
  n5: 8,
  n6: 8,
  moy: 12,
  coef: 9,
  mcoef: 13,
  rang: 11,
  appr: 53,
};
const COL_KEYS = [
  "matiere",
  "n1",
  "n2",
  "n3",
  "n4",
  "n5",
  "n6",
  "moy",
  "coef",
  "mcoef",
  "rang",
  "appr",
] as const;
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
const NOTE_KEYS = ["n1", "n2", "n3", "n4", "n5", "n6"] as const;

const FONT_SIZE_CANDIDATES = [8, 7.5, 7, 6.5, 6, 5.5, 5];
const SUBJECT_ROW_LINES = 2;
const MARKS_TO_ROW2_GAP = 6;
// Row 2 (TRAVAIL/PROFIL/RÉCAPITULATIF) and Row 3 (CONDUITE/DÉCISION/VISA) are both fixed-height,
// only the subject-marks table above them scales with content - same "only the top table scales"
// precedent as the term layout's FIXED_BLOCKS_HEIGHT.
const ROW2_HEIGHT = 34;
const ROW3_HEIGHT = 34;
const FIXED_BLOCKS_HEIGHT = MARKS_TO_ROW2_GAP + ROW2_HEIGHT + ROW3_HEIGHT;
const BOTTOM_MARGIN = 20;

interface TableLayout {
  fontSize: number;
  lh: number;
  headerHeight: number;
  groups: ReturnType<typeof groupSubjects<AnnualSubjectRow>>;
  tableHeight: number;
}

const measureTable = (
  doc: jsPDF,
  groups: ReturnType<typeof groupSubjects<AnnualSubjectRow>>,
  fontSize: number,
): TableLayout => {
  doc.setFontSize(fontSize);
  const lh = lineHeightMm(doc, fontSize);
  const headerHeight = lh + 3;
  const lineCount = groups.reduce((sum, g) => sum + g.rows.length * SUBJECT_ROW_LINES + 1, 0);
  return { fontSize, lh, headerHeight, groups, tableHeight: headerHeight + lineCount * lh };
};

const chooseTableLayout = (
  doc: jsPDF,
  groups: ReturnType<typeof groupSubjects<AnnualSubjectRow>>,
  letterheadY: number,
): TableLayout => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const available = pageHeight - letterheadY - FIXED_BLOCKS_HEIGHT - BOTTOM_MARGIN;
  let best: TableLayout | null = null;
  for (const fontSize of FONT_SIZE_CANDIDATES) {
    const layout = measureTable(doc, groups, fontSize);
    best = layout;
    if (layout.tableHeight <= available) {
      return layout;
    }
  }
  return best as TableLayout;
};

const drawMarksTable = (
  doc: jsPDF,
  student: AnnualStudentData,
  startY: number,
): number => {
  const groups = groupSubjects(student.subjects);
  const layout = chooseTableLayout(doc, groups, startY);
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
  NOTE_KEYS.forEach((key, i) => {
    doc.text(`Note${i + 1}`, colCenter(key), headerMidY, { align: "center" });
  });
  doc.text("M./20", colCenter("moy"), headerMidY, { align: "center" });
  doc.text("Coef.", colCenter("coef"), headerMidY, { align: "center" });
  doc.text("M.xC.", colCenter("mcoef"), headerMidY, { align: "center" });
  doc.text("Rang", colCenter("rang"), headerMidY, { align: "center" });
  doc.text("Appréciation", colCenter("appr"), headerMidY, { align: "center" });
  doc.setFont("helvetica", "normal");
  y = tableTop + layout.headerHeight;
  doc.line(LEFT_X, y, RIGHT_X, y);

  const rowHeight = lh * SUBJECT_ROW_LINES;
  const subtotalRanges: { top: number; bottom: number }[] = [];
  const groupNameCellCenter = (LEFT_X + colX("coef")) / 2;
  const groupNameCellWidth = colX("coef") - LEFT_X - 2;

  groups.forEach((group) => {
    group.rows.forEach((row) => {
      const rowTop = y;
      const midY = centerTextY(rowTop, rowHeight, fontSize);
      if (row.moy !== null && row.moy >= 10) {
        doc.setFillColor(...COLOR_GREEN_300);
        doc.rect(colX("moy"), rowTop, colWidth("moy"), rowHeight, "F");
      } else if (row.moy !== null) {
        doc.setFillColor(...COLOR_PINK_300);
        doc.rect(colX("moy"), rowTop, colWidth("moy"), rowHeight, "F");
      }

      const staffText = row.staffLabel
        ? truncateToWidth(doc, `(${row.staffLabel})`, colWidth("matiere") - 2)
        : "";
      const titleText = truncateToWidth(doc, row.subjectTitle, colWidth("matiere") - 2);
      doc.setFont("helvetica", "bold");
      doc.text(titleText, colX("matiere") + 1, staffText ? midY - lh / 2 : midY);
      if (staffText) {
        doc.setFont("helvetica", "italic");
        doc.text(staffText, colX("matiere") + 1, midY + lh / 2);
      }
      doc.setFont("helvetica", "normal");

      doc.text(formatRangText(row.rang, student.sexe, "fr"), colCenter("rang"), midY, {
        align: "center",
      });

      if (row.moy !== null && row.mCoef !== null) {
        NOTE_KEYS.forEach((key, i) => {
          const note = row.notes[i];
          if (note !== null) {
            doc.text(formatRcMoyDisplay(note), colCenter(key), midY, { align: "center" });
          }
        });
        doc.setFont("helvetica", "bold");
        doc.text(formatRcMoyDisplay(row.moy), colCenter("moy"), midY, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(row.coef.toFixed(1), colCenter("coef"), midY, { align: "center" });
        doc.text(formatRcNumber(row.mCoef), colCenter("mcoef"), midY, { align: "center" });
        const apprText = truncateToWidth(doc, row.appr, colWidth("appr") - 2);
        doc.text(apprText, colX("appr") + 1, midY);
      }

      y = rowTop + rowHeight;
      doc.setLineWidth(0.1);
      doc.line(LEFT_X, y, RIGHT_X, y);
    });

    const subtotal = computeGroupSubtotal(group.rows);
    const subtotalTop = y;
    subtotalRanges.push({ top: subtotalTop, bottom: subtotalTop + lh });
    const subtotalMidY = centerTextY(subtotalTop, lh, fontSize);
    doc.setFont("helvetica", "bold");
    doc.text(
      truncateToWidth(doc, group.groupeName, groupNameCellWidth),
      groupNameCellCenter,
      subtotalMidY,
      { align: "center" },
    );
    doc.text(subtotal.coefSum.toFixed(1), colCenter("coef"), subtotalMidY, { align: "center" });
    doc.text(formatRcNumber(subtotal.mCoefSum), colCenter("mcoef"), subtotalMidY, {
      align: "center",
    });
    doc.text(
      `Moyenne du groupe: ${formatRcNumber(subtotal.moyenneGroupe)}/20`,
      RIGHT_X - 1,
      subtotalMidY,
      { align: "right" },
    );
    doc.setFont("helvetica", "normal");
    y = subtotalTop + lh;
    doc.setLineWidth(0.2);
    doc.line(LEFT_X, y, RIGHT_X, y);
  });

  doc.setLineWidth(0.3);
  doc.line(LEFT_X, tableTop, LEFT_X, y);
  doc.line(RIGHT_X, tableTop, RIGHT_X, y);
  const mergedOnSubtotalRow = new Set(
    [...NOTE_KEYS, "moy" as const, "appr" as const].map((k) => colX(k)),
  );
  COL_BOUNDS.slice(1, -1).forEach((x) => {
    doc.setLineWidth(0.15);
    if (mergedOnSubtotalRow.has(x)) {
      let segStart = tableTop;
      subtotalRanges.forEach(({ top, bottom }) => {
        if (segStart < top) doc.line(x, segStart, x, top);
        segStart = bottom;
      });
      if (segStart < y) doc.line(x, segStart, x, y);
    } else {
      doc.line(x, tableTop, x, y);
    }
  });

  doc.setFont("helvetica", "normal");
  return y;
};

// Row 2: TRAVAIL DE L'ÉLÈVE | PROFIL DE LA CLASSE | RÉCAPITULATIF DES MOYENNES.
const drawRow2 = (
  doc: jsPDF,
  student: AnnualStudentData,
  classeStats: AnnualClasseStats,
  top: number,
  progressImages: { good: HTMLImageElement | null; bad: HTMLImageElement | null },
): void => {
  const travailW = 50;
  const profilW = 50;
  const recapW = RIGHT_X - LEFT_X - travailW - profilW;
  const travailX = LEFT_X;
  const profilX = travailX + travailW;
  const recapX = profilX + profilW;
  const headerH = 6;

  doc.setFillColor(...HEADER_FILL);
  doc.rect(travailX, top, RIGHT_X - travailX, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("TRAVAIL DE L'ÉLÈVE", travailX + travailW / 2, top + headerH - 1.5, { align: "center" });
  doc.text("PROFIL DE LA CLASSE", profilX + profilW / 2, top + headerH - 1.5, { align: "center" });
  doc.text("RÉCAPITULATIF DES MOYENNES", recapX + recapW / 2, top + headerH - 1.5, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");

  const contentY = top + headerH;
  const contentH = ROW2_HEIGHT - headerH;

  // TRAVAIL DE L'ÉLÈVE
  doc.setFontSize(7);
  let ty = contentY + 3.5;
  doc.text("MOYENNE ANNUELLE", travailX + 1, ty);
  doc.setFont("helvetica", "bold");
  doc.text(formatRcNumber(student.avgAnnual), travailX + travailW - 1, ty, { align: "right" });
  doc.setFont("helvetica", "normal");
  ty += 4.5;
  doc.text("RANG ANNUELLE:", travailX + 1, ty);
  doc.setFont("helvetica", "bold");
  doc.text(
    formatRangText(student.rangAnnuel, student.sexe, "fr"),
    travailX + travailW - 1,
    ty,
    { align: "right" },
  );
  doc.setFont("helvetica", "normal");
  ty += 5;
  doc.setFont("helvetica", "italic");
  doc.text("APPRÉCIATION DU TRAVAIL", travailX + 1, ty);
  doc.setFont("helvetica", "normal");
  ty += 4;
  const apprLines = doc.splitTextToSize(student.apprAnnuelle, travailW - 10);
  apprLines.slice(0, 2).forEach((line: string, i: number) => {
    doc.text(line, travailX + 1, ty + i * 3.2);
  });
  const pass = student.avgAnnual >= 10;
  const progressImage = pass ? progressImages.good : progressImages.bad;
  if (progressImage) {
    const { w, h } = fitImageInBox(progressImage, 7, 7);
    try {
      doc.addImage(progressImage, "PNG", travailX + travailW - w - 1, ty - 2, w, h);
    } catch (error) {
      console.error("drawRow2(): failed to embed progress icon", error);
    }
  }

  // PROFIL DE LA CLASSE
  const profRows: [string, string][] = [
    ["Moy. géné. de la classe:", formatRcNumber(classeStats.moyenneGenerale)],
    ["Taux de réussite:", `${formatRcNumber(classeStats.tauxReussite)}%`],
    ["Écart type:", formatRcNumber(classeStats.ecartType)],
    ["Moyenne du premier:", formatRcNumber(classeStats.minMax[1])],
    ["Moyenne du dernier:", formatRcNumber(classeStats.minMax[0])],
  ];
  let py = contentY + 3.5;
  profRows.forEach(([label, value]) => {
    doc.text(label, profilX + 1, py);
    doc.setFont("helvetica", "bold");
    doc.text(value, profilX + profilW - 1, py, { align: "right" });
    doc.setFont("helvetica", "normal");
    py += (contentH - 3) / profRows.length;
  });

  // RÉCAPITULATIF DES MOYENNES
  const recapLabelW = 16;
  const recapColW = (recapW - recapLabelW) / 6;
  const recapColX = (i: number) => recapX + recapLabelW + i * recapColW;
  doc.setFontSize(6);
  const evalHeaderY = contentY + 3;
  for (let i = 0; i < 6; i++) {
    doc.text(`Eval${i + 1}`, recapColX(i) + recapColW / 2, evalHeaderY, { align: "center" });
  }
  const moyRowY = evalHeaderY + 3.5;
  doc.text("Moy./20", recapX + 1, moyRowY);
  student.termSummaries.forEach((term, idx) => {
    term.seqAverages.forEach((v, seqIdx) => {
      doc.text(formatRcNumber(v), recapColX(idx * 2 + seqIdx) + recapColW / 2, moyRowY, {
        align: "center",
      });
    });
  });

  const recapRows: { label: string; get: (t: (typeof student.termSummaries)[number]) => string }[] = [
    { label: "Bilan trim.", get: (t) => formatRcNumber(t.bilanTrim) },
    { label: "Rang trim.", get: (t) => formatRangText(t.rangTrim, student.sexe, "fr") },
    { label: "Moy. Gén.", get: (t) => formatRcNumber(t.moyGenTrim) },
  ];
  let ry = moyRowY + 4;
  recapRows.forEach(({ label, get }) => {
    doc.text(label, recapX + 1, ry);
    doc.setFont("helvetica", "bold");
    student.termSummaries.forEach((term, idx) => {
      const cx = recapColX(idx * 2) + recapColW;
      doc.text(get(term), cx, ry, { align: "center" });
    });
    doc.setFont("helvetica", "normal");
    ry += 3.6;
  });

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(travailX, top, RIGHT_X - travailX, ROW2_HEIGHT);
  doc.line(profilX, top, profilX, top + ROW2_HEIGHT);
  doc.line(recapX, top, recapX, top + ROW2_HEIGHT);
  doc.setLineWidth(0.15);
  doc.line(travailX, contentY, RIGHT_X, contentY);

  doc.setFontSize(9);
};

// Row 3: CONDUITE ANNUELLE | DÉCISION DU CONSEIL DE FIN D'ANNÉE | VISA DU CHEF D'ÉTABLISSEMENT.
const drawRow3 = (
  doc: jsPDF,
  student: AnnualStudentData,
  schoolHeader: SchoolHeader,
  top: number,
): void => {
  const conduiteW = 70;
  const decisionW = 70;
  const visaW = RIGHT_X - LEFT_X - conduiteW - decisionW;
  const conduiteX = LEFT_X;
  const decisionX = conduiteX + conduiteW;
  const visaX = decisionX + decisionW;
  const headerH = 6;

  // CONDUITE ANNUELLE
  doc.setFillColor(...HEADER_FILL);
  doc.rect(conduiteX, top, conduiteW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CONDUITE ANNUELLE", conduiteX + conduiteW / 2, top + headerH - 1.5, { align: "center" });
  doc.setFont("helvetica", "normal");

  const labelW = 34;
  const dataColW = (conduiteW - labelW) / 4;
  const conduiteContentY = top + headerH;
  const subHeaderH = 4.5;
  doc.setFontSize(6);
  ["TRIM1", "TRIM2", "TRIM3", "ANN"].forEach((label, i) => {
    doc.text(label, conduiteX + labelW + i * dataColW + dataColW / 2, conduiteContentY + 3, {
      align: "center",
    });
  });

  const conduiteRows: [string, (d: typeof student.disciplineByTerm[number]) => number][] = [
    ["Absences non justifiées", (d) => d.absNonJust],
    ["Absences justifiées", (d) => d.absJust],
    ["Nb. Jours d'exclusion", (d) => d.exclusionJours],
    ["Blâme", (d) => d.blame],
    ["Avertissement", (d) => d.avertissement],
  ];
  const rowsTop = conduiteContentY + subHeaderH;
  const rowH = (ROW3_HEIGHT - headerH - subHeaderH) / conduiteRows.length;
  conduiteRows.forEach(([label, get], i) => {
    const ry = rowsTop + i * rowH + rowH / 2 + 1.2;
    doc.text(truncateToWidth(doc, label, labelW - 2), conduiteX + 1, ry);
    [get(student.disciplineByTerm[0]), get(student.disciplineByTerm[1]), get(student.disciplineByTerm[2]), get(student.disciplineAnnual)].forEach(
      (v, ci) => {
        const cell = disciplineCell(v);
        if (cell) {
          doc.text(cell, conduiteX + labelW + ci * dataColW + dataColW / 2, ry, {
            align: "center",
          });
        }
      },
    );
  });

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(conduiteX, top, conduiteW, ROW3_HEIGHT);
  doc.setLineWidth(0.15);
  doc.line(conduiteX, conduiteContentY, conduiteX + conduiteW, conduiteContentY);
  doc.line(
    conduiteX,
    conduiteContentY + subHeaderH,
    conduiteX + conduiteW,
    conduiteContentY + subHeaderH,
  );
  for (let i = 0; i < 4; i++) {
    const lx = conduiteX + labelW + i * dataColW;
    doc.line(lx, conduiteContentY, lx, top + ROW3_HEIGHT);
  }
  for (let i = 1; i < conduiteRows.length; i++) {
    doc.line(conduiteX, rowsTop + i * rowH, conduiteX + conduiteW, rowsTop + i * rowH);
  }

  // DÉCISION DU CONSEIL DE FIN D'ANNÉE
  drawAnnualDecisionBlock(doc, student.decision, student.sexe, decisionX, top, decisionW, ROW3_HEIGHT);

  // VISA DU CHEF D'ÉTABLISSEMENT
  doc.setFillColor(...HEADER_FILL);
  doc.rect(visaX, top, visaW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("VISA DU CHEF D'ÉTABLISSEMENT", visaX + visaW / 2, top + headerH - 1.5, {
    align: "center",
    maxWidth: visaW - 2,
  });
  doc.setFont("helvetica", "normal");

  const config = schoolHeader.config;
  if (config && (config.lieu_signature || config.date_signature)) {
    const responsable = computeResponsable(config.type ?? "");
    const place = config.lieu_signature ?? "";
    const date = config.date_signature ? config.date_signature.slice(0, 10) : "";
    doc.setFontSize(7);
    doc.text(`Fait à ${place}, le ${date}`, visaX + 1, top + headerH + 5);
    doc.setFont("helvetica", "bold");
    doc.text(`Le ${responsable.fr}`, visaX + 1, top + headerH + 10);
    doc.setFont("helvetica", "italic");
    doc.text(`The ${responsable.en}`, visaX + 1, top + headerH + 15);
    doc.setFont("helvetica", "normal");
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(visaX, top, visaW, ROW3_HEIGHT);
  doc.setLineWidth(0.15);
  doc.line(visaX, top + headerH, visaX + visaW, top + headerH);

  doc.setFontSize(9);
};

const drawStudentPage = (
  doc: jsPDF,
  student: AnnualStudentData,
  classe: { classe_name: string; classe_master_name: string | null },
  classeStats: AnnualClasseStats,
  year: string,
  schoolHeader: SchoolHeader,
  photoImage: HTMLImageElement | null,
  progressImages: { good: HTMLImageElement | null; bad: HTMLImageElement | null },
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
  drawLabelValue(
    doc,
    "Nom(s) et prénom(s):",
    `${student.name} ${student.surname}`.trim(),
    leftColX,
    infoY,
  );
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

  const tableTop = infoY + infoLh + 3;
  const tableBottom = drawMarksTable(doc, student, tableTop);

  const row2Top = tableBottom + MARKS_TO_ROW2_GAP;
  drawRow2(doc, student, classeStats, row2Top, progressImages);

  const row3Top = row2Top + ROW2_HEIGHT;
  drawRow3(doc, student, schoolHeader, row3Top);
};

// One page per student (already sorted classified-desc-by-avgAnnual then NC-desc-by-avgAnnual by
// buildAnnualReportCardData - see annualReportCardCompute.ts).
export const exportAnnualReportCardsToPdf = async (
  students: AnnualStudentData[],
  classeStats: AnnualClasseStats,
  classe: { classe_name: string; classe_master_name: string | null },
  year: string,
  schoolHeader: SchoolHeader,
  filename: string,
  photosByStudId: Map<number, HTMLImageElement | null>,
): Promise<void> => {
  const { default: JsPdfCtor } = await import("jspdf");
  const doc = new JsPdfCtor();

  const [goodImage, badImage] = await Promise.all([
    loadStaticImage(goodProgressImg),
    loadStaticImage(badProgressImg),
  ]);
  const progressImages = { good: goodImage, bad: badImage };

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
      progressImages,
    );
  });

  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
