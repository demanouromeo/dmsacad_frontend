import type { jsPDF } from "jspdf";
import type { SchoolHeaderConfig } from "../interfaces/SchoolHeaderConfig";
import { computeResponsable } from "./schoolTypes";

// Bundles the two pieces useSchoolHeader() resolves in parallel - the identity/address fields
// (from allSchoolConfigOfYear) and the logo, already loaded as an <img> element (crossOrigin
// "anonymous", see SchoolInfoReader.loadLogoImage) so it's ready to embed into a PDF canvas
// without a second network round trip at export time.
export interface SchoolHeader {
  config: SchoolHeaderConfig | null;
  logoImage: HTMLImageElement | null;
}

// This mirrors the fixed bilingual layout of Cameroonian administrative letterheads - both
// languages are always shown side by side here, independent of the app's own FR/EN UI toggle.
const REPUBLIC_FR = "REPUBLIQUE DU CAMEROUN";
const MOTTO_FR = "Paix - Travail - Patrie";
const REPUBLIC_EN = "REPUBLIC OF CAMEROON";
const MOTTO_EN = "Peace - Work - Fatherland";

const formatPhone = (phone: SchoolHeaderConfig["phone1"] | undefined): string =>
  phone !== null && phone !== undefined && phone !== "" ? String(phone) : "";

export interface DrawPdfLetterheadOptions {
  // Report cards/bulletins omit the phone line - every other export keeps it (default true).
  includePhone?: boolean;
  // Skips the horizontal separator rule normally drawn below the letterhead (default true, i.e.
  // draw it) - the Honor Roll certificate (exportThPdf.ts) draws its header directly over a
  // pre-designed background image that already provides its own visual framing, so the rule would
  // be a stray line with nothing for it to separate.
  includeLine?: boolean;
  // Y (mm) the letterhead's first line starts at, and the logo is anchored 2mm above (default 14,
  // matching the fixed 14mm top margin every other export uses). The Honor Roll certificate's
  // background reserves a taller blank strip inside its own decorative corner border, so its
  // letterhead needs to start lower to clear it.
  startY?: number;
}

// Draws the letterhead (both language columns, centered logo + matricule, separator rule) at the
// top of the PDF and returns the Y coordinate the caller should start the title/table from. If
// there's no config and no logo yet (still loading, or nothing configured for this school), this
// draws nothing and returns a plain top margin so exports still work without a header.
export const drawPdfLetterhead = (
  doc: jsPDF,
  header: SchoolHeader,
  options?: DrawPdfLetterheadOptions,
): number => {
  const includePhone = options?.includePhone ?? true;
  const includeLine = options?.includeLine ?? true;
  const startY = options?.startY ?? 14;
  const { config, logoImage } = header;
  if (!config && !logoImage) {
    return 15;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftX = 14;
  const rightX = pageWidth - 14;
  const centerX = pageWidth / 2;
  // Each corner is its own text block, centered on its own midpoint - not left/right-aligned
  // against the page margins, which left the lines within a block ragged against each other.
  const leftBlockCenterX = pageWidth * 0.25;
  const rightBlockCenterX = pageWidth * 0.75;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(REPUBLIC_FR, leftBlockCenterX, y, { align: "center" });
  doc.text(REPUBLIC_EN, rightBlockCenterX, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "italic");
  doc.text(MOTTO_FR, leftBlockCenterX, y, { align: "center" });
  doc.text(MOTTO_EN, rightBlockCenterX, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  if (config?.del_regionale_fr) {
    doc.text(config.del_regionale_fr, leftBlockCenterX, y, { align: "center" });
  }
  if (config?.del_regionale_en) {
    doc.text(config.del_regionale_en, rightBlockCenterX, y, { align: "center" });
  }

  y += 5;
  if (config?.del_dept_fr) {
    doc.text(config.del_dept_fr, leftBlockCenterX, y, { align: "center" });
  }
  if (config?.del_dept_en) {
    doc.text(config.del_dept_en, rightBlockCenterX, y, { align: "center" });
  }

  y += 5;
  doc.setFont("helvetica", "bold");
  if (config?.name_fr) {
    doc.text(config.name_fr, leftBlockCenterX, y, { align: "center" });
  }
  if (config?.name_en) {
    doc.text(config.name_en, rightBlockCenterX, y, { align: "center" });
  }

  // Report cards omit the phone line entirely (includePhone: false) - skip reserving its 5mm row
  // too, rather than leaving a blank gap above the separator rule, to keep the RC's own header
  // compact. Every other export keeps the reserved row so its layout is unaffected.
  if (includePhone) {
    y += 5;
    doc.setFont("helvetica", "normal");
    const phone = formatPhone(config?.phone1);
    if (phone) {
      doc.text(`Tel.: ${phone}`, leftBlockCenterX, y, { align: "center" });
      doc.text(`Phone: ${phone}`, rightBlockCenterX, y, { align: "center" });
    }
  }

  const logoSize = 18;
  const logoY = startY - 2;
  if (logoImage) {
    try {
      // jsPDF re-encodes any HTMLImageElement it's given as a PNG internally (via canvas), so
      // "PNG" here is correct regardless of the source file's actual extension (png/jpg/jpeg).
      doc.addImage(
        logoImage,
        "PNG",
        centerX - logoSize / 2,
        logoY,
        logoSize,
        logoSize,
      );
    } catch (error) {
      // Falls back to a header with no logo rather than failing the whole export - most likely
      // cause is a cross-origin canvas read blocked by the browser (missing/misconfigured CORS
      // on the images host), which shouldn't block getting the rest of the document out.
      console.error("drawPdfLetterhead(): failed to embed logo image", error);
    }
  }
  if (config?.school_matricule) {
    doc.setFontSize(9);
    doc.text(config.school_matricule, centerX, logoY + logoSize + 4, {
      align: "center",
    });
  }

  y += 4;
  if (includeLine) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(leftX, y, rightX, y);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  // Report cards sit closer under the separator rule than every other export (which uses the
  // full 8mm gap below) - saves vertical space on a document that must fit one student per page.
  return y + (includePhone ? 8 : 4);
};

// Every exported PDF except report cards/bulletins/livrets (built directly against
// basic_school_config's own print layout, not this generic table exporter) ends with this
// signature block - the school's configured signature place/date, and the "Le X / The Y" title
// pair computed from the school type (see schoolTypes.ts's computeResponsable, mirroring the
// mobile app). Placed on the right half of the page, below the last content block. Draws nothing
// (returns currentY unchanged) if there's no config at all, or the config carries neither a
// signature place nor date - same "nothing configured yet" fallback as drawPdfLetterhead.
const SIGNATURE_BLOCK_X_RATIO = 0.55;

export const drawPdfSignature = (
  doc: jsPDF,
  header: SchoolHeader,
  currentY: number,
): number => {
  const { config } = header;
  if (!config || (!config.lieu_signature && !config.date_signature)) {
    return currentY;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const blockX = pageWidth * SIGNATURE_BLOCK_X_RATIO;
  let y = currentY + 14;
  // Footer rule sits at pageHeight - 16 (see drawPdfFooters) - push to a new page rather than
  // overlapping it if the last content block ran close to the bottom.
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  const responsable = computeResponsable(config.type ?? "");
  const place = config.lieu_signature ?? "";
  const date = config.date_signature ? config.date_signature.slice(0, 10) : "";

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  let x = blockX;
  doc.text("Fait à ", x, y);
  x += doc.getTextWidth("Fait à ");
  doc.setFont("helvetica", "bold");
  doc.text(place, x, y);
  x += doc.getTextWidth(place);
  doc.setFont("helvetica", "normal");
  doc.text(", le ", x, y);
  x += doc.getTextWidth(", le ");
  doc.setFont("helvetica", "bold");
  doc.text(date, x, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text(`Le ${responsable.fr}`, blockX, y);

  y += 6;
  doc.setFont("helvetica", "italic");
  doc.text(`The ${responsable.en}`, blockX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  return y;
};

// Faint, centered, full-page logo watermark - drawn on every page of every PDF export (see
// drawPdfFooters below, which is the one call every export already makes on every page). Sized
// off the page width rather than a fixed size so it reads the same on both the letterhead's own
// small corner logo and this much larger background mark; height is derived from the logo's own
// natural aspect ratio so a non-square logo doesn't get stretched.
const WATERMARK_OPACITY = 0.08;
const WATERMARK_WIDTH_RATIO = 0.6;

const drawPdfWatermark = (doc: jsPDF, header: SchoolHeader): void => {
  const { logoImage } = header;
  if (!logoImage) {
    return;
  }
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth * WATERMARK_WIDTH_RATIO;
  const aspect =
    logoImage.naturalWidth && logoImage.naturalHeight
      ? logoImage.naturalHeight / logoImage.naturalWidth
      : 1;
  const height = width * aspect;
  const x = (pageWidth - width) / 2;
  const y = (pageHeight - height) / 2;
  try {
    doc.saveGraphicsState();
    doc.setGState(doc.GState({ opacity: WATERMARK_OPACITY }));
    doc.addImage(logoImage, "PNG", x, y, width, height);
    doc.restoreGraphicsState();
  } catch (error) {
    // Same fallback as drawPdfLetterhead's own addImage call - most likely a cross-origin canvas
    // read blocked by the browser; a missing watermark shouldn't block the rest of the export.
    console.error("drawPdfWatermark(): failed to embed watermark image", error);
  }
};

// App-level branding, not school-specific data - same on every export regardless of connection.
const APP_NAME = "DMS_ACAD";
const APP_EMAIL = "dmsschoolmanager@gmail.com";
const LINK_COLOR: [number, number, number] = [37, 99, 235];

// No raster mail icon asset is loaded into the bundle for this, so the small black/white envelope
// badge is hand-drawn with jsPDF's own vector primitives (filled rounded square + a white
// outline/flap) rather than pulling in an icon library just for one footer glyph.
const drawMailIcon = (doc: jsPDF, x: number, y: number, size: number): void => {
  doc.setFillColor(0, 0, 0);
  doc.roundedRect(x, y, size, size, 0.6, 0.6, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.rect(x + 0.8, y + 1.3, size - 1.6, size - 2.6);
  doc.line(x + 0.8, y + 1.3, x + size / 2, y + size / 2);
  doc.line(x + size - 0.8, y + 1.3, x + size / 2, y + size / 2);
};

// Draws the footer (separator rule, app identity/contact, copyright, page number) on every page
// of the document, plus the logo watermark (see drawPdfWatermark above). Must run after autoTable
// has finished paginating the body - the final page count isn't known until then - so this is a
// separate pass rather than part of the letterhead. This is the one call every PDF export in the
// app already makes exactly once, at the very end, regardless of how many pages it produced
// (including pages jspdf-autotable adds internally on overflow, which no other part of this app
// has a hook into) - piggybacking the watermark on this same per-page loop is what puts it on
// every page of every export without having to touch each export's own page-creation logic.
// `header` is optional only because exportRowsToPdf's own `schoolHeader` param is optional (a
// caller with no header at all still gets the plain footer, just no watermark).
export const drawPdfFooters = (doc: jsPDF, header?: SchoolHeader): void => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftX = 14;
  const rightX = pageWidth - 14;
  const lineY = pageHeight - 16;
  const textY = pageHeight - 9;
  const iconSize = 4;

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    if (header) {
      drawPdfWatermark(doc, header);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(leftX, lineY, rightX, lineY);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(APP_NAME, leftX, textY);

    const iconX = leftX + doc.getTextWidth(APP_NAME) + 4;
    drawMailIcon(doc, iconX, textY - iconSize + 1, iconSize);

    doc.setFont("helvetica", "italic");
    doc.setTextColor(...LINK_COLOR);
    doc.textWithLink(APP_EMAIL, iconX + iconSize + 2, textY, {
      url: `mailto:${APP_EMAIL}`,
    });

    doc.setFont("helvetica", "italic");
    doc.setTextColor(0, 0, 0);
    doc.text(`@Copy Right ${new Date().getFullYear()}`, rightX - 30, textY, {
      align: "right",
    });

    doc.setFont("helvetica", "normal");
    doc.text(`Page ${page}/${pageCount}`, rightX, textY, { align: "right" });
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
};

// CSV has no room for the logo or the side-by-side layout, so this reduces the same fields to a
// handful of plain text rows prepended above the column headers - same information, no image.
export const buildCsvLetterheadLines = (header: SchoolHeader): string[] => {
  const { config } = header;
  if (!config) {
    return [];
  }
  const lines: string[] = [`${REPUBLIC_FR} / ${REPUBLIC_EN}`, `${MOTTO_FR} / ${MOTTO_EN}`];

  const region = [config.del_regionale_fr, config.del_regionale_en]
    .filter(Boolean)
    .join(" / ");
  if (region) {
    lines.push(region);
  }
  const dept = [config.del_dept_fr, config.del_dept_en].filter(Boolean).join(" / ");
  if (dept) {
    lines.push(dept);
  }
  const name = [config.name_fr, config.name_en].filter(Boolean).join(" / ");
  if (name) {
    lines.push(name);
  }
  const phone = formatPhone(config.phone1);
  if (phone) {
    lines.push(`Tel./Phone: ${phone}`);
  }
  if (config.school_matricule) {
    lines.push(config.school_matricule);
  }
  lines.push("");
  return lines;
};
