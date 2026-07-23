import type { jsPDF } from "jspdf";
import goodProgressImg from "../../assets/compo/rc/good.png";
import badProgressImg from "../../assets/compo/rc/bad.png";
import baisseProgressImg from "../../assets/compo/rc/baisse.png";
import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import {
  computeGroupSubtotal,
  formatRangText,
  formatRcMarkDisplay,
  formatRcMoyDisplay,
  formatRcNumber,
  getNonApcComment,
} from "./reportCardCompute";
import {
  buildReportCardTitle,
  centerTextY,
  disciplineCell,
  drawLabelValue,
  drawStudentPhoto,
  fitImageInBox,
  groupSubjects,
  lineHeightMm,
  loadStaticImage,
  PHOTO_WIDTH,
  truncateToWidth,
  type GroupedSubjects,
} from "./reportCardPdfShared";
import type {
  ReportCardClasseStats,
  ReportCardStudentData,
  ReportCardSubjectRow,
} from "../../interfaces/ReportCard";

// Non-APC term bulletin - a visually distinct legacy layout from the APC one in
// exportReportCardPdf.ts (Note1/Note2/Moy/Coef/M.xC/Rang/Appréciation table grouped into subject
// "Groupes" with per-group subtotals, an Eval/Exam split, and a 3-part footer), reconstructed and
// hand-verified against real sample bulletins in src/assets/SAMPLE_RC/NON APC TRIM - see the
// plan's Context section for the specific field-by-field checks. Reuses the same shared PDF
// helpers (letterhead, student photo, label/value, title) and the same buildReportCardData output
// shape as the APC layout - only the drawing/layout code differs.

const COLOR_GREEN_300: [number, number, number] = [134, 239, 172];
const COLOR_PINK_300: [number, number, number] = [249, 168, 212];

// 8 logical table columns, widths in mm, summing to the 182mm content width used everywhere else
// in the app (14mm margins on an A4/210mm page).
const COLS = {
  matiere: 44,
  note1: 13,
  note2: 13,
  moy: 15,
  coef: 13,
  mcoef: 16,
  rang: 16,
  appr: 52,
};
const LEFT_X = 14;
const COL_KEYS = ["matiere", "note1", "note2", "moy", "coef", "mcoef", "rang", "appr"] as const;
const COL_BOUNDS: number[] = (() => {
  let x = LEFT_X;
  const bounds = [x];
  COL_KEYS.forEach((key) => {
    x += COLS[key];
    bounds.push(x);
  });
  return bounds;
})();
const RIGHT_X = COL_BOUNDS[COL_BOUNDS.length - 1];
const colX = (key: (typeof COL_KEYS)[number]): number => COL_BOUNDS[COL_KEYS.indexOf(key)];
const colWidth = (key: (typeof COL_KEYS)[number]): number => COLS[key];
const colCenter = (key: (typeof COL_KEYS)[number]): number => colX(key) + colWidth(key) / 2;

const FONT_SIZE_CANDIDATES = [8, 7.5, 7, 6.5, 6, 5.5, 5];
const MARKS_TO_RESULTS_GAP = 8;
// Blocks A/B/C butt directly against each other (no gap) so they read as one continuous table,
// matching the sample RC's own layout - only MARKS_TO_RESULTS_GAP separates the subject-marks
// table above from this merged block. MARKS_TO_RESULTS_GAP + Block A (6 header + 10 content) +
// Block B (6 header + 5*5 rows) + Block C (6 header + 20 content) - estimated once, same "only the
// subject table body scales with content" precedent as the APC layout's FIXED_BLOCKS_HEIGHT.
const FIXED_BLOCKS_HEIGHT = MARKS_TO_RESULTS_GAP + (6 + 10) + (6 + 25) + (6 + 20);
const BOTTOM_MARGIN = 20;

interface TableLayout {
  fontSize: number;
  lh: number;
  headerHeight: number;
  groups: GroupedSubjects<ReportCardSubjectRow>[];
  tableHeight: number;
}

// Every subject row draws the subject title and its "(Mr X)" staff label as two stacked lines in
// the MATIÈRES cell (see drawStudentPage), so each subject row must be allocated 2 line-heights,
// not 1 - a group subtotal row is always a single line. Getting this wrong makes consecutive rows
// overlap (the staff-label line bleeds into the next row) and, cascading from that, eats the gap
// between the marks table and the footer blocks below it.
const SUBJECT_ROW_LINES = 2;

const measureTable = (
  doc: jsPDF,
  groups: GroupedSubjects<ReportCardSubjectRow>[],
  fontSize: number,
): TableLayout => {
  doc.setFontSize(fontSize);
  const lh = lineHeightMm(doc, fontSize);
  const headerHeight = lh + 3;
  const lineCount = groups.reduce(
    (sum, g) => sum + g.rows.length * SUBJECT_ROW_LINES + 1, // +1 line for the group subtotal row
    0,
  );
  return { fontSize, lh, headerHeight, groups, tableHeight: headerHeight + lineCount * lh };
};

const chooseTableLayout = (
  doc: jsPDF,
  groups: GroupedSubjects<ReportCardSubjectRow>[],
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

const noteText = (row: ReportCardSubjectRow, subjectCompetenceId: number): string => {
  const comp = row.competences.find((c) => c.subjectCompetenceId === subjectCompetenceId);
  return comp && comp.mark !== null ? formatRcMarkDisplay(comp.mark) : "";
};

const drawStudentPage = (
  doc: jsPDF,
  student: ReportCardStudentData,
  classe: { classe_name: string; classe_master_name: string | null },
  classeStats: ReportCardClasseStats,
  term: number,
  year: string,
  schoolHeader: SchoolHeader,
  photoImage: HTMLImageElement | null,
  language: "fr" | "en",
  progressImages: {
    good: HTMLImageElement | null;
    baisse: HTMLImageElement | null;
    bad: HTMLImageElement | null;
  },
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  const letterheadY = drawPdfLetterhead(doc, schoolHeader, { includePhone: false });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(buildReportCardTitle(term), centerX, letterheadY + 4, { align: "center" });

  drawStudentPhoto(doc, photoImage, RIGHT_X - PHOTO_WIDTH, letterheadY + 6);

  // Student info block - 2 columns, matching every sample RC's field order exactly.
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

  let y = infoY + infoLh + 3;

  const groups = groupSubjects(student.subjects);
  const layout = chooseTableLayout(doc, groups, y);
  const fontSize = layout.fontSize;
  doc.setFontSize(fontSize);
  const lh = layout.lh;

  // Table header - a bordered row in the same grid as the body below it (not floating text above
  // an unbordered table), matching the sample RC's own boxed header. tableTop starts at the
  // header's own top edge (not below it) so the outer border/vertical separators drawn once the
  // table's full height is known (see below) also enclose the header row.
  const headerTop = y;
  const tableTop = headerTop;
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, headerTop, RIGHT_X, headerTop);
  doc.setFont("helvetica", "bold");
  const headerMidY = centerTextY(headerTop, layout.headerHeight, fontSize);
  doc.text("MATIÈRES", colCenter("matiere"), headerMidY, { align: "center" });
  doc.text("Note1", colCenter("note1"), headerMidY, { align: "center" });
  doc.text("Note2", colCenter("note2"), headerMidY, { align: "center" });
  doc.text("Moy.", colCenter("moy"), headerMidY, { align: "center" });
  doc.text("Coef.", colCenter("coef"), headerMidY, { align: "center" });
  doc.text("M.xC.", colCenter("mcoef"), headerMidY, { align: "center" });
  doc.text("Rang", colCenter("rang"), headerMidY, { align: "center" });
  doc.text("Appréciation", colCenter("appr"), headerMidY, { align: "center" });
  doc.setFont("helvetica", "normal");
  y = headerTop + layout.headerHeight;
  doc.line(LEFT_X, y, RIGHT_X, y);

  const rowHeight = lh * SUBJECT_ROW_LINES;
  // Each group's subtotal row merges Matières+Note1+Note2 into one centered cell (the group name)
  // and Rang+Appréciation into one left-aligned cell ("Moyenne du groupe: X/20") - tracked here so
  // the vertical separator loop below can skip those dividers specifically across these row ranges.
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

      // Subject title + "(Mr X)" staff label are two stacked lines, centered as a block within
      // the row (same matiereMidY +/- lh/2 split the APC layout's MATIÈRES cell already uses).
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

      // Rang is always shown (even with zero marks, ranking treats a missing average as 0 - see
      // computeSubjectRank) - every other cell on the row stays blank when moy===null, matching
      // every sample RC exactly.
      doc.text(
        formatRangText(row.rang, student.sexe, language),
        colCenter("rang"),
        midY,
        { align: "center" },
      );

      if (row.moy !== null && row.mCoef !== null) {
        doc.text(noteText(row, -1), colCenter("note1"), midY, { align: "center" });
        doc.text(noteText(row, -2), colCenter("note2"), midY, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.text(formatRcMoyDisplay(row.moy), colCenter("moy"), midY, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(row.coef.toFixed(1), colCenter("coef"), midY, { align: "center" });
        doc.text(formatRcNumber(row.mCoef), colCenter("mcoef"), midY, { align: "center" });
        const apprText = truncateToWidth(
          doc,
          getNonApcComment(row.moy, language),
          colWidth("appr") - 2,
        );
        doc.text(apprText, colX("appr") + 1, midY);
      }

      y = rowTop + rowHeight;
      doc.setLineWidth(0.1);
      doc.line(LEFT_X, y, RIGHT_X, y);
    });

    // Group subtotal row - bold. The group name spans and centers across the merged
    // Matières+Note1+Note2+Moy columns; "Moyenne du groupe: X/20" spans and right-aligns across the
    // merged Rang+Appréciation columns.
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

  // Vertical column separators for the whole table, drawn once the table's total height is known.
  // Matières|Note1, Note1|Note2, Note2|Moy, and Rang|Appréciation dividers are each skipped across
  // every subtotal row's height so those columns read as merged cells there (group name centered
  // across Matières+Note1+Note2+Moy, "Moyenne du groupe" left-aligned across Rang+Appréciation).
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, tableTop, LEFT_X, y);
  doc.line(RIGHT_X, tableTop, RIGHT_X, y);
  const mergedOnSubtotalRow = new Set([colX("note1"), colX("note2"), colX("moy"), colX("appr")]);
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

  y += MARKS_TO_RESULTS_GAP;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Block A: APPRÉCIATION DU TRAVAIL (comment/Eval/[progress icon]/Exam/Moy.Trimestre/Rang) + VISA
  // DU PARENT. The progress-icon column (index 2-3) sits between Eval and Exam and, like the Visa
  // du parent column at the far end, merges the header+content rows into one bordered cell (no
  // horizontal divider, no header label) so the icon can be centered across the full cell height.
  const blockAW = RIGHT_X - LEFT_X;
  const aBounds = [0, 0.34, 0.44, 0.5, 0.6, 0.75, 0.85, 1].map((f) => LEFT_X + f * blockAW);
  const aTop = y;
  const aHeaderH = 6;
  const aRowH = 10;
  const aFullH = aHeaderH + aRowH;
  doc.setFillColor(219, 234, 254);
  doc.rect(aBounds[0], aTop, aBounds[7] - aBounds[0], aHeaderH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("APPRÉCIATION DU TRAVAIL", (aBounds[0] + aBounds[1]) / 2, aTop + aHeaderH - 1.5, {
    align: "center",
  });
  doc.text("Eval", (aBounds[1] + aBounds[2]) / 2, aTop + aHeaderH - 1.5, { align: "center" });
  doc.text("EXAM", (aBounds[3] + aBounds[4]) / 2, aTop + aHeaderH - 1.5, { align: "center" });
  doc.text("Moy.Trimestre/20", (aBounds[4] + aBounds[5]) / 2, aTop + aHeaderH - 1.5, {
    align: "center",
  });
  doc.text("Rang", (aBounds[5] + aBounds[6]) / 2, aTop + aHeaderH - 1.5, { align: "center" });
  doc.text("Visa du parent", (aBounds[6] + aBounds[7]) / 2, aTop + aHeaderH - 1.5, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");

  const aContentY = aTop + aHeaderH;
  const aContentMidY = centerTextY(aContentY, aRowH, 8);
  doc.setFontSize(7.5);
  const commentLines = doc.splitTextToSize(
    getNonApcComment(student.moyenneTrim, language),
    aBounds[1] - aBounds[0] - 2,
  );
  // thText ("Tableau d'honneur", possibly suffixed "+Encouragements"/"& F.") prints on the next
  // available line right under the comment, sharing the same 2-line budget - "" (doesn't deserve
  // Honor Roll this term) adds nothing, same as every sample RC.
  const thLines = student.thText
    ? doc.splitTextToSize(student.thText, aBounds[1] - aBounds[0] - 2)
    : [];
  [...commentLines, ...thLines].slice(0, 2).forEach((line: string, i: number) => {
    doc.text(line, aBounds[0] + 1, aContentY + 4 + i * 4);
  });
  doc.setFontSize(9);
  doc.text(formatRcNumber(student.evalAvg), (aBounds[1] + aBounds[2]) / 2, aContentMidY, {
    align: "center",
  });
  doc.text(formatRcNumber(student.examAvg), (aBounds[3] + aBounds[4]) / 2, aContentMidY, {
    align: "center",
  });
  const trimPass = student.moyenneTrim >= 10;
  doc.setFillColor(...(trimPass ? COLOR_GREEN_300 : COLOR_PINK_300));
  doc.rect(aBounds[4], aContentY, aBounds[5] - aBounds[4], aRowH, "F");
  doc.setFont("helvetica", "bold");
  doc.text(formatRcNumber(student.moyenneTrim), (aBounds[4] + aBounds[5]) / 2, aContentMidY, {
    align: "center",
  });
  doc.text(
    formatRangText(student.rang, student.sexe, language),
    (aBounds[5] + aBounds[6]) / 2,
    aContentMidY,
    { align: "center" },
  );
  doc.setFont("helvetica", "normal");

  // Progress icon, scaled to fit and centered both horizontally and vertically in its merged
  // cell: passing the term (moyenneTrim >= 10) with eval<=exam is good.png, passing but with
  // eval>exam (a decline despite still passing) is baisse.png, anything else (failing the term)
  // is bad.png.
  const progressImage = !trimPass
    ? progressImages.bad
    : student.evalAvg <= student.examAvg
      ? progressImages.good
      : progressImages.baisse;
  if (progressImage) {
    const cellW = aBounds[3] - aBounds[2];
    const cellCx = (aBounds[2] + aBounds[3]) / 2;
    const cellCy = aTop + aFullH / 2;
    const { w: imgW, h: imgH } = fitImageInBox(progressImage, cellW - 2, aFullH - 2);
    try {
      doc.addImage(progressImage, "PNG", cellCx - imgW / 2, cellCy - imgH / 2, imgW, imgH);
    } catch (error) {
      console.error("drawStudentPage(): failed to embed progress icon", error);
    }
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(aBounds[0], aTop, aBounds[7] - aBounds[0], aFullH);
  doc.setLineWidth(0.15);
  aBounds.slice(1, -1).forEach((x) => doc.line(x, aTop, x, aTop + aFullH));
  doc.line(aBounds[0], aContentY, aBounds[2], aContentY);
  doc.line(aBounds[3], aContentY, aBounds[6], aContentY);

  y = aTop + aFullH;

  // Block B: DISCIPLINE (Eval/Exam duplicate columns, matching every sample) + PROFIL DE LA CLASSE.
  const bTop = y;
  const bHeaderH = 6;
  const bRowH = 5;
  const bRowCount = 5;
  const halfW = (RIGHT_X - LEFT_X) / 2;
  const discX = LEFT_X;
  const profX = LEFT_X + halfW;
  const discBounds = [discX, discX + halfW * 0.55, discX + halfW * 0.775, discX + halfW];
  const profBounds = [profX, profX + halfW * 0.6, profX + halfW];

  doc.setFillColor(219, 234, 254);
  doc.rect(discX, bTop, halfW, bHeaderH, "F");
  doc.rect(profX, bTop, halfW, bHeaderH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DISCIPLINE", discX + halfW / 2, bTop + bHeaderH - 1.5, { align: "center" });
  doc.text("PROFIL DE LA CLASSE", profX + halfW / 2, bTop + bHeaderH - 1.5, { align: "center" });
  doc.setFont("helvetica", "normal");

  const disc = student.discipline;
  const discRows: [string, string, string][] = [
    ["Absence(s) non justifié(s)", disciplineCell(disc.absNonJust), disciplineCell(disc.absNonJust)],
    ["Avertissement conduite", disciplineCell(disc.avertissement), ""],
    ["Blâme conduite", disciplineCell(disc.blame), ""],
    ["Exclusion temporaire (en jour(s))", disciplineCell(disc.exclusionJours), ""],
  ];
  const bRowTop = (i: number): number => bTop + bHeaderH + bRowH * i;
  doc.setFontSize(7.5);
  discRows.forEach(([label, evalVal, examVal], i) => {
    const ry = bRowTop(i) + bRowH / 2 + 1;
    doc.text(truncateToWidth(doc, label, discBounds[1] - discBounds[0] - 2), discBounds[0] + 1, ry);
    if (evalVal) doc.text(evalVal, (discBounds[1] + discBounds[2]) / 2, ry, { align: "center" });
    if (examVal) doc.text(examVal, (discBounds[2] + discBounds[3]) / 2, ry, { align: "center" });
  });

  const profRows: [string, string][] = [
    ["Ecart type", formatRcNumber(classeStats.ecartType)],
    ["Taux de réussite", `${formatRcNumber(classeStats.tauxReussite)}%`],
    ["Moyenne de la classe", formatRcMarkDisplay(classeStats.moyenneGenerale)],
    ["Moyenne du premier", formatRcMarkDisplay(classeStats.minMax[1])],
    ["Moyenne du dernier", formatRcMarkDisplay(classeStats.minMax[0])],
  ];
  profRows.forEach(([label, value], i) => {
    const ry = bRowTop(i) + bRowH / 2 + 1;
    doc.text(label, profBounds[0] + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(value, profBounds[1] + 1, ry);
    doc.setFont("helvetica", "normal");
  });

  const bBottom = bRowTop(bRowCount);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(discX, bTop, RIGHT_X - discX, bBottom - bTop);
  doc.line(profX, bTop, profX, bBottom);
  doc.setLineWidth(0.15);
  doc.line(discX, bTop + bHeaderH, RIGHT_X, bTop + bHeaderH);
  [discBounds[1], discBounds[2]].forEach((x) => doc.line(x, bTop + bHeaderH, x, bBottom));
  doc.line(profBounds[1], bTop + bHeaderH, profBounds[1], bBottom);
  for (let i = 1; i < bRowCount; i++) {
    doc.line(discX, bRowTop(i), RIGHT_X, bRowTop(i));
  }

  y = bBottom;

  // Block C: DÉCISION DU CONSEIL DE CLASSE | OBSERVATIONS GENERALES | VISA DU CHEF D'ÉTABLISSEMENT.
  const cTop = y;
  const cHeaderH = 6;
  const cContentH = 20;
  const thirdW = (RIGHT_X - LEFT_X) / 3;
  const cBounds = [LEFT_X, LEFT_X + thirdW, LEFT_X + thirdW * 2, RIGHT_X];
  doc.setFillColor(219, 234, 254);
  doc.rect(cBounds[0], cTop, cBounds[3] - cBounds[0], cHeaderH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DÉCISION DU CONSEIL DE CLASSE", (cBounds[0] + cBounds[1]) / 2, cTop + cHeaderH - 1.5, {
    align: "center",
  });
  doc.text("OBSERVATIONS GENERALES", (cBounds[1] + cBounds[2]) / 2, cTop + cHeaderH - 1.5, {
    align: "center",
  });
  doc.text("VISA DU CHEF D'ÉTABLISSEMENT", (cBounds[2] + cBounds[3]) / 2, cTop + cHeaderH - 1.5, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");

  const cContentY = cTop + cHeaderH;
  const obsLines = doc.splitTextToSize(student.effortLine, thirdW - 2);
  obsLines.slice(0, 4).forEach((line: string, i: number) => {
    doc.text(line, cBounds[1] + 1, cContentY + 4 + i * 4);
  });

  const config = schoolHeader.config;
  if (config && (config.lieu_signature || config.date_signature)) {
    const responsable = computeResponsable(config.type ?? "");
    const place = config.lieu_signature ?? "";
    const date = config.date_signature ? config.date_signature.slice(0, 10) : "";
    doc.text(`Fait à ${place}, le ${date}`, cBounds[2] + 1, cContentY + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`Le ${responsable.fr}`, cBounds[2] + 1, cContentY + 10);
    doc.setFont("helvetica", "italic");
    doc.text(`The ${responsable.en}`, cBounds[2] + 1, cContentY + 16);
    doc.setFont("helvetica", "normal");
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(cBounds[0], cTop, cBounds[3] - cBounds[0], cHeaderH + cContentH);
  doc.line(cBounds[1], cTop, cBounds[1], cTop + cHeaderH + cContentH);
  doc.line(cBounds[2], cTop, cBounds[2], cTop + cHeaderH + cContentH);
  doc.line(cBounds[0], cContentY, cBounds[3], cContentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
};

// One page per student (already sorted classified-desc-by-moyenneTrim then NC-desc-by-moyenneTrim
// by buildReportCardData) - see reportCardCompute.ts for how students/classeStats are assembled.
export const exportNonApcReportCardsToPdf = async (
  students: ReportCardStudentData[],
  classeStats: ReportCardClasseStats,
  classe: { classe_name: string; classe_master_name: string | null },
  term: number,
  year: string,
  schoolHeader: SchoolHeader,
  filename: string,
  photosByStudId: Map<number, HTMLImageElement | null>,
  language: "fr" | "en",
): Promise<void> => {
  const { default: JsPdfCtor } = await import("jspdf");
  const doc = new JsPdfCtor();

  // Same icons for every student on every page - loaded once up front rather than per page.
  const [goodImage, baisseImage, badImage] = await Promise.all([
    loadStaticImage(goodProgressImg),
    loadStaticImage(baisseProgressImg),
    loadStaticImage(badProgressImg),
  ]);
  const progressImages = { good: goodImage, baisse: baisseImage, bad: badImage };

  students.forEach((student, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawStudentPage(
      doc,
      student,
      classe,
      classeStats,
      term,
      year,
      schoolHeader,
      photosByStudId.get(student.studId) ?? null,
      language,
      progressImages,
    );
  });

  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
