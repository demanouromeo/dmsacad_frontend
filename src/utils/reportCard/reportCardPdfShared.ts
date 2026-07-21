import type { jsPDF } from "jspdf";

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
export const PHOTO_WIDTH = 25;
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
