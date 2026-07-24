import type { jsPDF } from "jspdf";
import type { AnnualDecision } from "../../interfaces/AnnualReportCard";

// Layout-agnostic drawing helpers shared by both the APC (exportReportCardPdf.ts) and non-APC
// (exportReportCardNonApcPdf.ts) bulletin builders - extracted here so the two table/footer
// layouts (which genuinely differ) don't each duplicate the student photo box, label/value
// helper, text truncation, or title text.

const TERM_ORDINALS_FR = ["PREMIER", "DEUXIEME", "TROISIEME"];

export const buildReportCardTitle = (term: number): string =>
  `BULLETIN DE NOTES DU ${TERM_ORDINALS_FR[term - 1] ?? term} TRIMESTRE`;

export const lineHeightMm = (doc: jsPDF, fontSize: number): number =>
  (fontSize * 1.15) / doc.internal.scaleFactor;

export const centerTextY = (top: number, height: number, fontSize: number): number =>
  top + height / 2 + fontSize * 0.12;

export const truncateToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }
  let truncated = text;
  while (truncated.length > 1 && doc.getTextWidth(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
};

export const drawLabelValue = (
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

// Passport-photo-style box in the top-right corner of the student info block, matching every
// sample RC's layout. Draws the student's actual photo when one was loaded (see
// StudentReader.loadStudentPhotoImage), otherwise a hand-drawn grey silhouette - same "no icon
// asset in the bundle, draw it with jsPDF's own vector primitives" precedent as exportHeader.ts's
// drawMailIcon, since jsPDF can't embed an actual .svg without an extra plugin.
export const PHOTO_WIDTH = 24;
export const PHOTO_HEIGHT = 24;

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

export const drawStudentPhoto = (
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

// groupSubjects() - groups a student's subjects by groupeId (ascending, matching each group's own
// id order rather than a hardcoded Scientifiques/Littéraires/Autres label list), subjects already
// alphabetical within a classe from ReportCardManager's subjectsSorted. Generic over both the term
// layout's ReportCardSubjectRow and the annual layout's AnnualSubjectRow - both carry the same
// groupeId/groupeName fields.
export interface GroupedSubjects<T> {
  groupeId: number;
  groupeName: string;
  rows: T[];
}

export const groupSubjects = <T extends { groupeId: number; groupeName: string }>(
  subjects: T[],
): GroupedSubjects<T>[] => {
  const byGroupe = new Map<number, GroupedSubjects<T>>();
  subjects.forEach((row) => {
    const existing = byGroupe.get(row.groupeId);
    if (existing) {
      existing.rows.push(row);
    } else {
      byGroupe.set(row.groupeId, { groupeId: row.groupeId, groupeName: row.groupeName, rows: [row] });
    }
  });
  return Array.from(byGroupe.values()).sort((a, b) => a.groupeId - b.groupeId);
};

// value===0 renders blank rather than "0" - matches every sample RC (a discipline field with no
// recorded incidents is left empty, not stamped with a literal zero).
export const disciplineCell = (value: number): string => (value === 0 ? "" : String(value));

// good.png/bad.png/baisse.png are bundled static assets (same origin as the app), unlike the
// school logo/student photo which are fetched from the backend - no crossOrigin/canvas-CORS
// concern here, just a plain onload/onerror probe.
export const loadStaticImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// Scales an image down to fit within maxW x maxH (never up), preserving its aspect ratio, so a
// progress icon never gets stretched or overflows its cell.
export const fitImageInBox = (
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
): { w: number; h: number } => {
  const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
};

// drawAnnualDecisionBlock() - the "DÉCISION DU CONSEIL DE FIN D'ANNÉE" box shared by both the
// non-APC (exportAnnualReportCardPdf.ts) and APC (exportAnnualReportCardApcPdf.ts) annual
// bulletins - per apcAnnual.md, "Decision bloc is build similarly as we did for non APC RC", so
// this is the exact same drawing code for both, parameterized over just the already-computed
// AnnualDecision + sexe (not a whole student record) so both callers' differently-shaped student
// data can share it. Hand-drawn with jsPDF vector primitives rather than embedded images - the
// reference mockups (promu_en.png, redouble.png, etc.) are throwaway design references, not
// bundled assets, same "no icon asset, draw it" precedent as drawDefaultPersonIcon above.
const DECISION_HEADER_FR = "DÉCISION DU CONSEIL DE FIN D'ANNÉE";
const EXCLUSION_OPTIONS: { code: number; label: string }[] = [
  { code: 1, label: "ÂGE" },
  { code: 4, label: "Ne peut trippler" },
  { code: 2, label: "Conduite" },
  { code: 5, label: "Abandon" },
  { code: 3, label: "Travail" },
  { code: 6, label: "Insolvable" },
];

export const drawAnnualDecisionBlock = (
  doc: jsPDF,
  decision: AnnualDecision,
  sexe: string,
  x: number,
  top: number,
  w: number,
  h: number,
): void => {
  const headerH = 6;
  doc.setFillColor(219, 234, 254);
  doc.rect(x, top, w, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(DECISION_HEADER_FR, x + w / 2, top + headerH - 1.5, { align: "center" });

  const contentY = top + headerH;
  const contentH = h - headerH;

  if (decision.kind === "promu") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const label = sexe.toLowerCase() === "f" ? "PROMUE EN:" : "PROMU EN:";
    const text = decision.promuEnClasseName ?? "";
    doc.text(`${label} ${text || "___________"}`, x + w / 2, contentY + contentH / 2, {
      align: "center",
      maxWidth: w - 4,
    });
  } else if (decision.kind === "redouble") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Redouble", x + w / 2, contentY + contentH / 2, { align: "center" });
  } else if (decision.kind === "redoubleSiEchec") {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(decision.redoubleSiEchecText ?? "", x + w / 2, contentY + contentH / 2, {
      align: "center",
      maxWidth: w - 4,
    });
  } else if (decision.kind === "nc") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("NC", x + w / 2, contentY + contentH / 2, { align: "center" });
  } else {
    // exclu
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const label = sexe.toLowerCase() === "f" ? "EXCLUE POUR:" : "EXCLU POUR:";
    doc.text(label, x + w / 2, contentY + 3.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const colW = w / 2;
    const rowH = (contentH - 5) / 3;
    EXCLUSION_OPTIONS.forEach((opt, i) => {
      const col = Math.floor(i / 3);
      const row = i % 3;
      const cx = x + col * colW + 4;
      const cy = contentY + 6 + row * rowH;
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.circle(cx, cy, 1);
      if (opt.code === decision.exclusionCode) {
        doc.setFillColor(0, 0, 0);
        doc.circle(cx, cy, 0.5, "F");
      }
      doc.text(opt.label, cx + 2.5, cy + 1);
    });
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, top, w, h);
  doc.setLineWidth(0.15);
  doc.line(x, contentY, x + w, contentY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
};
