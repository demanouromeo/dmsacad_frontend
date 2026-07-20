import type { jsPDF } from "jspdf";
import { drawPdfFooters, drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import {
  formatRcFixed2,
  formatRcMark,
  formatRcNumber,
  getCompComment,
} from "./reportCardCompute";
import type { ReportCardClasseStats, ReportCardStudentData } from "../../interfaces/ReportCard";

const TERM_ORDINALS_FR = ["PREMIER", "DEUXIEME", "TROISIEME"];

// Tailwind green-300 / pink-300, plus a red-600-ish text color - used to color-code the per-subject
// MOY cell and the MOYENNE TRIM cell based on the pass/fail threshold (10/20).
const COLOR_GREEN_300: [number, number, number] = [134, 239, 172];
const COLOR_PINK_300: [number, number, number] = [249, 168, 212];
const COLOR_RED_TEXT: [number, number, number] = [220, 38, 38];

export const buildReportCardTitle = (term: number): string =>
  `BULLETIN DE NOTES DU ${TERM_ORDINALS_FR[term - 1] ?? term} TRIMESTRE`;

// French ordinal for the RANG cell - "1er", "2ème", "3ème", ... matching every sample RC exactly.
const formatRang = (rang: number | null): string => {
  if (rang === null) {
    return "-";
  }
  return rang === 1 ? "1er" : `${rang}ème`;
};

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

const lineHeightMm = (doc: jsPDF, fontSize: number): number =>
  (fontSize * 1.15) / doc.internal.scaleFactor;

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

const truncateToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
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

const measureStudent = (
  doc: jsPDF,
  student: ReportCardStudentData,
  fontSize: number,
): StudentLayout => {
  doc.setFontSize(fontSize);
  const lh = lineHeightMm(doc, fontSize);
  const headerHeight = lh * 3 + 2;
  const competenceWidth = colWidth("competence") - 2;
  let tableHeight = 0;
  const subjectLayouts: SubjectLayout[] = student.subjects.map((subject) => {
    const compLines = subject.competences.map((c) =>
      wrapCompetenceText(doc, c.competenceText, competenceWidth, MAX_COMPETENCE_LINES),
    );
    const rowCount = Math.max(
      1,
      compLines.reduce((sum, lines) => sum + lines.length, 0),
    );
    const height = rowCount * lh;
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

const centerTextY = (top: number, height: number, fontSize: number): number =>
  top + height / 2 + fontSize * 0.12;

// Passport-photo-style box in the top-right corner of the student info block, matching every
// sample RC's layout. Draws the student's actual photo when one was loaded (see
// StudentReader.loadStudentPhotoImage), otherwise a hand-drawn grey silhouette - same "no icon
// asset in the bundle, draw it with jsPDF's own vector primitives" precedent as exportHeader.ts's
// drawMailIcon, since jsPDF can't embed an actual .svg without an extra plugin.
const PHOTO_WIDTH = 20;
const PHOTO_HEIGHT = 24;

const drawDefaultPersonIcon = (doc: jsPDF, x: number, y: number, w: number, h: number): void => {
  doc.setFillColor(225, 225, 225);
  doc.rect(x, y, w, h, "F");
  doc.setFillColor(175, 175, 175);
  const cx = x + w / 2;
  const headR = w * 0.22;
  const headCy = y + h * 0.34;
  doc.circle(cx, headCy, headR, "F");
  const shoulderRy = h * 0.2;
  const shoulderCy = y + h - shoulderRy;
  doc.ellipse(cx, shoulderCy, w * 0.4, shoulderRy, "F");
};

const drawStudentPhoto = (
  doc: jsPDF,
  photoImage: HTMLImageElement | null,
  x: number,
  y: number,
): void => {
  if (photoImage) {
    try {
      doc.addImage(photoImage, "JPEG", x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
    } catch (error) {
      // Same fallback precedent as drawPdfLetterhead's logo embed - a blocked/failed canvas read
      // shouldn't stop the export, just fall back to the default silhouette.
      console.error("drawStudentPhoto(): failed to embed student photo", error);
      drawDefaultPersonIcon(doc, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
    }
  } else {
    drawDefaultPersonIcon(doc, x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
  }
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, PHOTO_WIDTH, PHOTO_HEIGHT);
};

const drawLabelValue = (
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
): void => {
  doc.setFont("helvetica", "normal");
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + doc.getTextWidth(`${label} `), y);
  doc.setFont("helvetica", "normal");
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

  let y = infoY + infoLh + 3;

  const layout = chooseLayout(doc, student, y);
  const fontSize = layout.fontSize;
  doc.setFontSize(fontSize);
  const lh = layout.lh;

  // Table header - 3 physical text lines to accommodate the 2-line wrapped headers ("M x Coef",
  // "[Min-Max]", "Appr & visa de l'enseignant"), matching the reference RC's own wrapped header.
  const headerTop = y;
  doc.setFont("helvetica", "bold");
  doc.text("MATIÈRES", colCenter("matiere"), headerTop + lh, { align: "center" });
  doc.text("COMPÉTENCES ÉVALUÉES", colX("competence") + 1, headerTop + lh);
  doc.text("N/20", colCenter("n20"), headerTop + lh, { align: "center" });
  doc.text("MOY", colCenter("moy"), headerTop + lh, { align: "center" });
  doc.text("Coef", colCenter("coef"), headerTop + lh, { align: "center" });
  const mCoefLines = doc.splitTextToSize("M x Coef", colWidth("mcoef") - 1);
  mCoefLines.forEach((line: string, i: number) =>
    doc.text(line, colCenter("mcoef"), headerTop + lh * (i + 1), { align: "center" }),
  );
  doc.text("COTE", colCenter("cote"), headerTop + lh, { align: "center" });
  doc.text("[Min-Max]", colCenter("minmax"), headerTop + lh, { align: "center" });
  const apprLines = doc.splitTextToSize("Appr & visa de l'enseign.", colWidth("appr") - 1);
  apprLines.forEach((line: string, i: number) =>
    doc.text(line, colCenter("appr"), headerTop + lh * (i + 1), { align: "center" }),
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

    // MATIÈRES cell: subject title (bold) + staff label (normal), vertically centered.
    doc.setFont("helvetica", "bold");
    const titleText = truncateToWidth(doc, subject.subjectTitle, colWidth("matiere") - 2);
    doc.setFont("helvetica", "normal");
    const staffText = subject.staffLabel
      ? truncateToWidth(doc, subject.staffLabel, colWidth("matiere") - 2)
      : "";
    const matiereMidY = centerTextY(blockTop, blockHeight, fontSize);
    doc.setFont("helvetica", "bold");
    doc.text(titleText, colCenter("matiere"), staffText ? matiereMidY - lh / 2 : matiereMidY, {
      align: "center",
    });
    if (staffText) {
      doc.setFont("helvetica", "normal");
      doc.text(staffText, colCenter("matiere"), matiereMidY + lh / 2, { align: "center" });
    }

    // COMPÉTENCES ÉVALUÉES + N/20 - one sub-row per competence, wrapped text handled by
    // subjectLayout.compLines (already measured/truncated for this exact font size).
    let rowY = blockTop;
    subject.competences.forEach((comp, compIndex) => {
      const lines = subjectLayout.compLines[compIndex];
      lines.forEach((line, lineIdx) => {
        doc.text(line, colX("competence") + 1, rowY + lh * (lineIdx + 1));
      });
      const rowHeight = lines.length * lh;
      const markText = comp.mark !== null ? formatRcMark(comp.mark) : "";
      if (markText) {
        doc.text(markText, colCenter("n20"), centerTextY(rowY, rowHeight, fontSize), {
          align: "center",
        });
      }
      rowY += rowHeight;
    });

    // Subject-level MOY/Coef/M x Coef/COTE/[Min-Max]/Appr - single values, vertically centered
    // across the whole block (matching every sample RC's rowspan-style layout).
    const midY = centerTextY(blockTop, blockHeight, fontSize);
    if (subject.moy !== null && subject.mCoef !== null) {
      const moyPass = subject.moy >= 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize + 2);
      if (!moyPass) {
        doc.setTextColor(...COLOR_RED_TEXT);
      }
      doc.text(formatRcNumber(subject.moy), colCenter("moy"), midY, { align: "center" });
      doc.setFontSize(fontSize);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.text(String(subject.coef.toFixed(1)), colCenter("coef"), midY, { align: "center" });
      doc.text(formatRcFixed2(subject.mCoef), colCenter("mcoef"), midY, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(subject.cote, colCenter("cote"), midY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(subject.apprLabel, colCenter("appr"), midY, { align: "center" });
    } else {
      doc.text(String(subject.coef.toFixed(1)), colCenter("coef"), midY, { align: "center" });
    }
    // Single horizontal line, e.g. "[4.5 - 16]" - previously split across two stacked lines, which
    // overflowed into neighboring rows whenever a subject's block was only one row tall.
    const minMaxText = `[${formatRcNumber(subject.subjectMin)} - ${formatRcNumber(subject.subjectMax)}]`;
    doc.text(truncateToWidth(doc, minMaxText, colWidth("minmax") - 2), colCenter("minmax"), midY, {
      align: "center",
    });

    y = blockTop + blockHeight;
    doc.setLineWidth(0.15);
    doc.line(LEFT_X, y, RIGHT_X, y);
  });

  // Vertical column separators for the whole table, drawn once the table's total height is known.
  doc.setLineWidth(0.3);
  doc.line(LEFT_X, tableTop, LEFT_X, y);
  doc.line(RIGHT_X, tableTop, RIGHT_X, y);
  COL_BOUNDS.slice(1, -1).forEach((x) => {
    doc.setLineWidth(0.15);
    doc.line(x, tableTop, x, y);
  });

  y += MARKS_TO_RESULTS_GAP;

  // Footer results grid: DISCIPLINE | TRAVAIL DE L'ÉLÈVE | PROFIL DE LA CLASSE - a fully bordered
  // table spanning the same LEFT_X..RIGHT_X width as the marks table above, matching the reference
  // RC layout: a filled header row, 6 body rows, and one taller row for the visa/signature/effort
  // line block. "APPRECIATIONS" occupies the Appr column's own header slot on the first body row
  // (merged with its checkbox column, the one merge in the whole grid), which is why its 5-item
  // checklist (CTBA..CNA) sits one row lower than the Travail section's own 5 label rows below it.
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
  disciplineRows.forEach(([l1, v1, l2, v2], i) => {
    const ry = footerRowTop(i) + footerRowH / 2 + 1;
    drawLabelValue(doc, l1, v1, fcx(0) + 1, ry);
    drawLabelValue(doc, l2, v2, fcx(2) + 1, ry);
  });

  const apprLabels = ["CTBA", "CBA", "CA", "CMA", "CNA"];
  const studentApprLabel = getCompComment(student.moyenneTrim);
  const travailRows: [string, string][] = [
    ["Total général:", formatRcNumber(student.totalGeneral)],
    ["COEF:", student.coefSum.toFixed(1)],
    ["MOYENNE TRIM:", formatRcNumber(student.moyenneTrim)],
    ["COTE:", student.cote],
    ["RANG:", formatRang(student.rang)],
  ];
  travailRows.forEach(([label, value], i) => {
    drawLabelValue(doc, label, value, fcx(4) + 1, footerRowTop(i) + footerRowH / 2 + 1);
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
  profilRows.forEach(([label, value], i) => {
    drawLabelValue(doc, label, value, fcx(8) + 1, footerRowTop(i) + footerRowH / 2 + 1);
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
  [gridTop, ...Array.from({ length: footerRowCount + 1 }, (_, i) => footerRowTop(i)), footerSigTop, footerBottom].forEach(
    (rowY) => doc.line(fcx(0), rowY, fcx(10), rowY),
  );
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
    );
  });

  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
