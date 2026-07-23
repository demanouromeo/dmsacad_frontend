import type { jsPDF } from "jspdf";
import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import {
  formatRangText,
  formatRcFixed2,
  formatRcMarkDisplay,
  formatRcMoyDisplay,
  formatRcNumber,
  getCompComment,
} from "./reportCardCompute";
import {
  buildReportCardTitle,
  centerTextY,
  drawLabelValue,
  drawStudentPhoto,
  lineHeightMm,
  PHOTO_WIDTH,
  truncateToWidth,
} from "./reportCardPdfShared";
import type { ReportCardClasseStats, ReportCardStudentData } from "../../interfaces/ReportCard";

// Tailwind green-300 / pink-300, plus a red-600-ish text color - used to color-code the per-subject
// MOY cell and the MOYENNE TRIM cell based on the pass/fail threshold (10/20).
const COLOR_GREEN_300: [number, number, number] = [134, 239, 172];
const COLOR_PINK_300: [number, number, number] = [249, 168, 212];
const COLOR_RED_TEXT: [number, number, number] = [220, 38, 38];

// 9 logical table columns, widths in mm, summing to the 182mm content width used everywhere else
// in the app (14mm margins on an A4/210mm page).
const COLS = {
  matiere: 24,
  competence: 60,
  n20: 10,
  moy: 12,
  coef: 10,
  mcoef: 14,
  cote: 10,
  minmax: 18,
  appr: 24,
};
const LEFT_X = 14;
const COL_KEYS = [
  "matiere",
  "competence",
  "n20",
  "moy",
  "coef",
  "mcoef",
  "cote",
  "minmax",
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
const RIGHT_X = COL_BOUNDS[COL_BOUNDS.length - 1];
const colX = (key: (typeof COL_KEYS)[number]): number => COL_BOUNDS[COL_KEYS.indexOf(key)];
const colWidth = (key: (typeof COL_KEYS)[number]): number => COLS[key];
const colCenter = (key: (typeof COL_KEYS)[number]): number => colX(key) + colWidth(key) / 2;

// Wraps competence text to at most maxLines, ellipsizing the last line if it doesn't fit - bounds
// the worst-case height of any single competence row regardless of how long the text is, which is
// what makes the shrink-to-fit loop below guaranteed to terminate on a sane page count.
const wrapCompetenceText = (
  doc: jsPDF,
  text: string,
  width: number,
  maxLines: number,
): string[] => {
  const lines: string[] = doc.splitTextToSize(text || "-", width);
  if (lines.length <= maxLines) {
    return lines;
  }
  const truncated = lines.slice(0, maxLines);
  const last = truncated[maxLines - 1];
  truncated[maxLines - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : `${last}...`;
  return truncated;
};

interface SubjectLayout {
  subjectId: number;
  compLines: string[][];
  rowCount: number;
  height: number;
}

interface StudentLayout {
  fontSize: number;
  lh: number;
  headerHeight: number;
  subjectLayouts: SubjectLayout[];
  tableHeight: number;
}

const MAX_COMPETENCE_LINES = 3;

// Extra vertical breathing room around each competence's text block within the COMPÉTENCES
// ÉVALUÉES column, expressed as a fraction of the line-height (lh) rather than a fixed mm value so
// it scales with whichever font size the shrink-to-fit loop below picks for a given student.
const COMPETENCE_ROW_PADDING = 0.05;

const measureStudent = (
  doc: jsPDF,
  student: ReportCardStudentData,
  fontSize: number,
): StudentLayout => {
  doc.setFontSize(fontSize);
  const lh = lineHeightMm(doc, fontSize);
  // Header box no longer carries the old flat 2mm buffer on top of its 3 text lines - headers are
  // vertically centered (see drawCenteredHeaderLines below) so the extra room isn't needed.
  const headerHeight = lh * 3;
  // COMPÉTENCES ÉVALUÉES is drawn one point larger than the base font (see drawStudentPage) - wrap
  // and measure its row height at that same bumped size so the wrapped lines actually fit the
  // column width and don't visually overlap each other.
  const competenceFontSize = fontSize + 1;
  const competenceLh = lineHeightMm(doc, competenceFontSize);
  const competenceWidth = colWidth("competence") - 2;
  let tableHeight = 0;
  const subjectLayouts: SubjectLayout[] = student.subjects.map((subject) => {
    doc.setFontSize(competenceFontSize);
    const compLines = subject.competences.map((c) =>
      wrapCompetenceText(doc, c.competenceText, competenceWidth, MAX_COMPETENCE_LINES),
    );
    doc.setFontSize(fontSize);
    const rowCount = Math.max(
      1,
      compLines.reduce((sum, lines) => sum + lines.length, 0),
    );
    // Each real competence row gets top+bottom padding; the length-1 fallback row (a subject with
    // zero competences) doesn't, since no competence loop iteration runs for it below.
    const height =
      rowCount * competenceLh + subject.competences.length * 2 * COMPETENCE_ROW_PADDING * competenceLh;
    tableHeight += height;
    return { subjectId: subject.subjectId, compLines, rowCount, height };
  });
  return { fontSize, lh, headerHeight, subjectLayouts, tableHeight: headerHeight + tableHeight };
};

// Vertical breathing room between the end of the marks table and the DISCIPLINE/TRAVAIL/PROFIL
// footer grid below it - previously a bare 4mm, which read as almost no gap at all on the printed
// page; bumped to a clearly visible ~8mm (roughly 30px on screen, comfortably past the "at least
// 15px" ask).
const MARKS_TO_RESULTS_GAP = 8;

// Fixed-size blocks (title bar, student info, footer results grid - header + 6 rows + the taller
// signature row, 6+36+18=60mm) - these don't meaningfully grow with the number of subjects/
// competences, so they're estimated once rather than re-measured per font-size candidate; only the
// subject table body scales with content.
const FIXED_BLOCKS_HEIGHT = 8 + 24 + 60 + 6 + (MARKS_TO_RESULTS_GAP - 4);
const BOTTOM_MARGIN = 20;
const FONT_SIZE_CANDIDATES = [8, 7.5, 7, 6.5, 6, 5.5, 5];

const chooseLayout = (
  doc: jsPDF,
  student: ReportCardStudentData,
  letterheadY: number,
): StudentLayout => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const available = pageHeight - letterheadY - FIXED_BLOCKS_HEIGHT - BOTTOM_MARGIN;
  let best: StudentLayout | null = null;
  for (const fontSize of FONT_SIZE_CANDIDATES) {
    const layout = measureStudent(doc, student, fontSize);
    best = layout;
    if (layout.tableHeight <= available) {
      return layout;
    }
  }
  return best as StudentLayout;
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
  drawLabelValue(
    doc,
    "Effectif de la classe:",
    String(classeStats.effectif),
    rightColX,
    infoY,
  );
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
  drawLabelValue(
    doc,
    "Professeur Principal:",
    classe.classe_master_name ?? "",
    leftColX,
    infoY,
  );
  drawLabelValue(
    doc,
    "Sexe:",
    `${student.sexe}   Redouble: ${student.repeating ? "OUI" : "NON"}`,
    rightColX,
    infoY,
  );

  let y = infoY + infoLh;

  const layout = chooseLayout(doc, student, y);
  const fontSize = layout.fontSize;
  doc.setFontSize(fontSize);
  const lh = layout.lh;
  // Three size tiers for value cells, each one point above the tier below it (headers stay at the
  // base fontSize): valueFontSize for N/20 and COTE, valueFontSize2 for Coef/M x Coef/[Min-Max]/Appr
  // (already at valueFontSize, bumped one further), moyFontSize for MOY (already at fontSize+2,
  // bumped one further). MATIÈRES and COMPÉTENCES ÉVALUÉES get their own dedicated size/line-height
  // since, unlike the others, they wrap/truncate text whose measured width must match the size
  // actually drawn - see measureStudent's competenceFontSize for why.
  const valueFontSize = fontSize + 1;
  const valueFontSize2 = fontSize + 2;
  const moyFontSize = fontSize + 3;
  const matiereFontSize = fontSize + 1;
  const matiereLh = lineHeightMm(doc, matiereFontSize);
  const competenceFontSize = fontSize + 1;
  const competenceLh = lineHeightMm(doc, competenceFontSize);

  // Table header - 3 physical text lines to accommodate the 2-line wrapped headers ("M x Coef",
  // "[Min-Max]", "Appr & visa de l'enseignant"), matching the reference RC's own wrapped header.
  // Every header is centered both horizontally (align: "center" at each column's midpoint) and
  // vertically (as a 1- or 2-line block centered within the full header box height); the header
  // sits inside the same bordered grid as the body table below it rather than floating above it -
  // see the vertical separators drawn from headerTop (not tableTop) further down. Every header
  // except Appr is drawn two points larger (headerBumpFontSize) than the base font.
  const headerTop = y;
  const headerBumpFontSize = fontSize + 2;
  const headerBumpLh = lineHeightMm(doc, headerBumpFontSize);
  const headerMidY = centerTextY(headerTop, layout.headerHeight, headerBumpFontSize);
  const drawCenteredHeaderLines = (
    lines: string[],
    centerX: number,
    lineSpacing: number,
  ): void => {
    const blockTop = headerMidY - (lineSpacing * (lines.length - 1)) / 2;
    lines.forEach((line, i) =>
      doc.text(line, centerX, blockTop + lineSpacing * i, { align: "center" }),
    );
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(headerBumpFontSize);
  drawCenteredHeaderLines(["MATIÈRES"], colCenter("matiere"), headerBumpLh);
  drawCenteredHeaderLines(["COMPÉTENCES ÉVALUÉES"], colCenter("competence"), headerBumpLh);
  drawCenteredHeaderLines(["N/20"], colCenter("n20"), headerBumpLh);
  drawCenteredHeaderLines(["MOY"], colCenter("moy"), headerBumpLh);
  drawCenteredHeaderLines(["Coef"], colCenter("coef"), headerBumpLh);
  drawCenteredHeaderLines(
    doc.splitTextToSize("M x Coef", colWidth("mcoef") - 1),
    colCenter("mcoef"),
    headerBumpLh,
  );
  drawCenteredHeaderLines(["COTE"], colCenter("cote"), headerBumpLh);
  drawCenteredHeaderLines(["[Min-Max]"], colCenter("minmax"), headerBumpLh);
  doc.setFontSize(fontSize);
  drawCenteredHeaderLines(
    doc.splitTextToSize("Appr & visa de l'enseign.", colWidth("appr") - 1),
    colCenter("appr"),
    lh,
  );
  doc.setFont("helvetica", "normal");
  y = headerTop + layout.headerHeight;
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, y, RIGHT_X, y);

  const tableTop = y;

  // Paint the MOY cell's pass/fail background before the grid lines and text are drawn on top of
  // it (below), so the per-row separators stay crisp instead of being covered by the fill.
  let moyFillY = tableTop;
  student.subjects.forEach((subject, subjectIndex) => {
    const subjectLayout = layout.subjectLayouts[subjectIndex];
    if (subject.moy !== null && subject.moy >= 10) {
      doc.setFillColor(...COLOR_GREEN_300);
      doc.rect(colX("moy"), moyFillY, colWidth("moy"), subjectLayout.height, "F");
    }
    moyFillY += subjectLayout.height;
  });

  student.subjects.forEach((subject, subjectIndex) => {
    const subjectLayout = layout.subjectLayouts[subjectIndex];
    const blockTop = y;
    const blockHeight = subjectLayout.height;

    // MATIÈRES cell: subject title (bold) + staff label (normal), vertically centered, drawn at
    // matiereFontSize (one point above the base font) - truncation is measured at that same size so
    // the "..." cutoff still matches what's actually rendered.
    doc.setFontSize(matiereFontSize);
    doc.setFont("helvetica", "bold");
    const titleText = truncateToWidth(doc, subject.subjectTitle, colWidth("matiere") - 2);
    doc.setFont("helvetica", "normal");
    const staffText = subject.staffLabel
      ? truncateToWidth(doc, subject.staffLabel, colWidth("matiere") - 2)
      : "";
    const matiereMidY = centerTextY(blockTop, blockHeight, matiereFontSize);
    doc.setFont("helvetica", "bold");
    doc.text(
      titleText,
      colCenter("matiere"),
      staffText ? matiereMidY - matiereLh / 2 : matiereMidY,
      { align: "center" },
    );
    if (staffText) {
      doc.setFont("helvetica", "normal");
      doc.text(staffText, colCenter("matiere"), matiereMidY + matiereLh / 2, { align: "center" });
    }
    doc.setFontSize(fontSize);

    // COMPÉTENCES ÉVALUÉES + N/20 - one sub-row per competence, wrapped text handled by
    // subjectLayout.compLines (already measured/truncated at competenceFontSize, see
    // measureStudent). Each row gets COMPETENCE_ROW_PADDING*competenceLh of top/bottom padding.
    let rowY = blockTop;
    const competencePadding = COMPETENCE_ROW_PADDING * competenceLh;
    doc.setFontSize(competenceFontSize);
    subject.competences.forEach((comp, compIndex) => {
      const lines = subjectLayout.compLines[compIndex];
      const textTop = rowY + competencePadding;
      lines.forEach((line, lineIdx) => {
        doc.text(line, colX("competence") + 1, textTop + competenceLh * (lineIdx + 1));
      });
      const rowHeight = lines.length * competenceLh + 2 * competencePadding;
      const markText = comp.mark !== null ? formatRcMarkDisplay(comp.mark) : "";
      if (markText) {
        doc.setFontSize(valueFontSize);
        doc.text(markText, colCenter("n20"), centerTextY(rowY, rowHeight, valueFontSize), {
          align: "center",
        });
        doc.setFontSize(competenceFontSize);
      }
      rowY += rowHeight;
    });
    doc.setFontSize(fontSize);

    // Subject-level MOY/Coef/M x Coef/COTE/[Min-Max]/Appr - single values, vertically centered
    // across the whole block (matching every sample RC's rowspan-style layout). MOY is the largest
    // (moyFontSize), Coef/M x Coef/[Min-Max]/Appr are one tier down (valueFontSize2), and COTE is
    // one tier below that (valueFontSize) - see the tier comment above valueFontSize's declaration.
    const midY = centerTextY(blockTop, blockHeight, fontSize);
    if (subject.moy !== null && subject.mCoef !== null) {
      const moyPass = subject.moy >= 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(moyFontSize);
      if (!moyPass) {
        doc.setTextColor(...COLOR_RED_TEXT);
      }
      doc.text(formatRcMoyDisplay(subject.moy), colCenter("moy"), midY, {
        align: "center",
      });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize2);
      doc.text(String(subject.coef.toFixed(1)), colCenter("coef"), midY, { align: "center" });
      doc.text(formatRcFixed2(subject.mCoef), colCenter("mcoef"), midY, { align: "center" });
      doc.setFontSize(valueFontSize);
      doc.setFont("helvetica", "bold");
      doc.text(subject.cote, colCenter("cote"), midY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize2);
      doc.text(subject.apprLabel, colCenter("appr"), midY, { align: "center" });
      doc.setFontSize(fontSize);
    } else {
      doc.setFontSize(valueFontSize2);
      doc.text(String(subject.coef.toFixed(1)), colCenter("coef"), midY, { align: "center" });
      doc.setFontSize(fontSize);
    }
    // Single horizontal line, e.g. "[4.5 - 16]" - previously split across two stacked lines, which
    // overflowed into neighboring rows whenever a subject's block was only one row tall.
    doc.setFontSize(valueFontSize2);
    const minMaxText = `[${formatRcNumber(subject.subjectMin)} - ${formatRcNumber(subject.subjectMax)}]`;
    doc.text(truncateToWidth(doc, minMaxText, colWidth("minmax") - 2), colCenter("minmax"), midY, {
      align: "center",
    });
    doc.setFontSize(fontSize);

    y = blockTop + blockHeight;
    doc.setLineWidth(0.15);
    doc.line(LEFT_X, y, RIGHT_X, y);
  });

  // Vertical column separators spanning the whole table, header included, so the header row reads
  // as part of the same bordered grid as the body rather than floating above it - drawn from
  // headerTop (not tableTop) now that the header itself is column-divided. A matching top border
  // closes the box above the header.
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, headerTop, RIGHT_X, headerTop);
  doc.line(LEFT_X, headerTop, LEFT_X, y);
  doc.line(RIGHT_X, headerTop, RIGHT_X, y);
  COL_BOUNDS.slice(1, -1).forEach((x) => {
    doc.setLineWidth(0.15);
    doc.line(x, headerTop, x, y);
  });

  y += MARKS_TO_RESULTS_GAP;

  // Footer results grid: DISCIPLINE | TRAVAIL DE L'ÉLÈVE | PROFIL DE LA CLASSE - a fully bordered
  // table spanning the same LEFT_X..RIGHT_X width as the marks table above, matching the reference
  // RC layout: a filled header row, 6 body rows, and one taller row for the visa/signature/effort
  // line block. The Appr column's "APPRECIATIONS" label (row 0) and its first checklist item, CTBA
  // (row 1), share one visually merged, taller cell - the horizontal divider between rows 0 and 1 is
  // omitted under the Appr column's own width only (see the grid-line loop below), same rowspan
  // precedent as the label/checkbox divider already skipped on row 0. CBA/CA/CMA/CNA then occupy
  // rows 2-5, lining up with Travail's own COEF/MOYENNE TRIM/COTE/RANG rows exactly.
  const gridTop = y;
  const gridColWidth = (RIGHT_X - LEFT_X) / 3;
  const disciplineX = LEFT_X;
  const travailX = LEFT_X + gridColWidth;
  const profilX = LEFT_X + gridColWidth * 2;

  const footerColBounds = [
    disciplineX,
    disciplineX + gridColWidth * 0.42,
    disciplineX + gridColWidth * 0.52,
    disciplineX + gridColWidth * 0.9,
    travailX,
    travailX + gridColWidth * 0.4,
    travailX + gridColWidth * 0.6,
    travailX + gridColWidth * 0.84,
    profilX,
    profilX + gridColWidth * 0.55,
    RIGHT_X,
  ];
  const fcx = (i: number): number => footerColBounds[i];
  const fcCenter = (i: number, j: number): number => (fcx(i) + fcx(j)) / 2;

  const footerHeaderH = 6;
  const footerRowH = 6;
  const footerRowCount = 6;
  const footerSigH = 18;
  const footerRowTop = (i: number): number => gridTop + footerHeaderH + footerRowH * i;
  const footerSigTop = footerRowTop(footerRowCount);
  const footerBottom = footerSigTop + footerSigH;

  doc.setFillColor(219, 234, 254);
  doc.rect(fcx(0), gridTop, fcx(4) - fcx(0), footerHeaderH, "F");
  doc.rect(fcx(4), gridTop, fcx(8) - fcx(4), footerHeaderH, "F");
  doc.rect(fcx(8), gridTop, fcx(10) - fcx(8), footerHeaderH, "F");

  const moyenneTrimRowIndex = 2;
  const trimPass = student.moyenneTrim >= 10;
  doc.setFillColor(...(trimPass ? COLOR_GREEN_300 : COLOR_PINK_300));
  doc.rect(
    fcx(4),
    footerRowTop(moyenneTrimRowIndex),
    fcx(6) - fcx(4),
    footerRowH,
    "F",
  );

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const headerTextY = gridTop + footerHeaderH - 1.5;
  doc.text("DISCIPLINE", fcCenter(0, 4), headerTextY, { align: "center" });
  doc.text("TRAVAIL DE L'ÉLÈVE", fcCenter(4, 8), headerTextY, { align: "center" });
  doc.text("PROFIL DE LA CLASSE", fcCenter(8, 10), headerTextY, { align: "center" });
  doc.setFont("helvetica", "normal");

  const disc = student.discipline;
  const disciplineRows: [string, string, string, string][] = [
    ["Abs non just(h):", String(disc.absNonJust), "Avert.:", String(disc.avertissement)],
    ["Abs just(h):", String(disc.absJust), "Blâme:", String(disc.blame)],
    ["Retards:", String(disc.lateness), "Excl(j):", String(disc.exclusionJours)],
    ["Consignes(h):", String(disc.consigne), "Excl déf.:", String(disc.exclusionDefinitive)],
  ];
  // Same fcx(N)/fcx(N+1) label|value split as Profil below - Discipline already has narrow
  // dedicated value sub-columns at fcx(1) and fcx(3) (matching the dividers drawn there), unused
  // until now since drawLabelValue was concatenating label+value into the label cell instead.
  disciplineRows.forEach(([l1, v1, l2, v2], i) => {
    const ry = footerRowTop(i) + footerRowH / 2 + 1;
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
  const studentApprLabel = getCompComment(student.moyenneTrim);
  const travailRows: [string, string][] = [
    ["Total général:", formatRcNumber(student.totalGeneral)],
    ["COEF:", student.coefSum.toFixed(1)],
    ["MOYENNE TRIM:", formatRcNumber(student.moyenneTrim)],
    ["COTE:", student.cote],
    ["RANG:", formatRangText(student.rang, student.sexe, language)],
  ];
  // Same fcx(N)/fcx(N+1) label|value split as Discipline/Profil - Travail's own value sub-column is
  // fcx(5)-fcx(6) (matching the divider already drawn there, right before the Appr section starts).
  travailRows.forEach(([label, value], i) => {
    const ry = footerRowTop(i) + footerRowH / 2 + 1;
    doc.setFont("helvetica", "normal");
    doc.text(label, fcx(4) + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(value, fcx(5) + 1, ry);
    doc.setFont("helvetica", "normal");
  });

  doc.setFont("helvetica", "bold");
  doc.text("APPRECIATIONS", fcCenter(6, 8), footerRowTop(0) + footerRowH / 2 + 1, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  apprLabels.forEach((apprLabel, i) => {
    const ry = footerRowTop(i + 1) + footerRowH / 2 + 1;
    const checked = apprLabel === studentApprLabel;
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
  // Unlike Discipline/Travail's inline "label value" pairs, Profil has its own dedicated value
  // sub-column (fcx(9)-fcx(10), matching the vertical divider already drawn there) - label and
  // value go in their own cells side by side rather than concatenated in the label cell.
  profilRows.forEach(([label, value], i) => {
    const ry = footerRowTop(i) + footerRowH / 2 + 1;
    doc.setFont("helvetica", "normal");
    doc.text(label, fcx(8) + 1, ry);
    doc.setFont("helvetica", "bold");
    doc.text(value, fcx(9) + 1, ry);
    doc.setFont("helvetica", "normal");
  });

  // Bottom signature row: effort line (Discipline section) | Visa parent (Travail label+value) |
  // Nom et visa prof. principal (Appr columns) | Fait à.../Le X/The Y (Profil section).
  const sigTextTop = footerSigTop + 4;
  const effortWrapped: string[] = doc.splitTextToSize(
    `Un effort s'impose ${student.effortLine.replace(/^Un effort s'impose\s*/i, "")}`,
    fcx(4) - fcx(0) - 2,
  );
  effortWrapped.slice(0, 3).forEach((line, i) => {
    doc.text(line, fcx(0) + 1, sigTextTop + i * 4);
  });

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

  // Grid lines drawn last so they stay crisp on top of the fills/text above rather than being
  // covered by them (same ordering precedent as the marks table and the MOY cell fill).
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  const apprMergeRowY = footerRowTop(1);
  [
    gridTop,
    ...Array.from({ length: footerRowCount + 1 }, (_, i) => footerRowTop(i)),
    footerSigTop,
    footerBottom,
  ].forEach((rowY) => {
    // Row 0/1 boundary is omitted under the Appr column only, so "APPRECIATIONS" (row 0) and CTBA
    // (row 1) read as one merged, taller cell - see the comment above this grid.
    if (rowY === apprMergeRowY) {
      doc.line(fcx(0), rowY, fcx(6), rowY);
      doc.line(fcx(8), rowY, fcx(10), rowY);
      return;
    }
    doc.line(fcx(0), rowY, fcx(10), rowY);
  });
  [0, 4, 8, 10].forEach((i) => doc.line(fcx(i), gridTop, fcx(i), footerBottom));
  doc.setLineWidth(0.15);
  const innerColIndices = [1, 2, 3, 5, 6, 7, 9];
  for (let rowIndex = 0; rowIndex < footerRowCount; rowIndex++) {
    const rowT = footerRowTop(rowIndex);
    const rowB = footerRowTop(rowIndex + 1);
    innerColIndices.forEach((colIdx) => {
      // Row 0's Appr column is the merged "APPRECIATIONS" header cell - skip the divider between
      // its label/checkbox sub-columns there only, so the line doesn't cut through the text.
      if (rowIndex === 0 && colIdx === 7) {
        return;
      }
      doc.line(fcx(colIdx), rowT, fcx(colIdx), rowB);
    });
  }

  y = footerBottom;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
};

// One page per student (already sorted classified-desc-by-moyenneTrim then NC-desc-by-moyenneTrim
// by buildReportCardData) - see reportCardCompute.ts for how students/classeStats are assembled.
export const exportReportCardsToPdf = async (
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
    );
  });

  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
