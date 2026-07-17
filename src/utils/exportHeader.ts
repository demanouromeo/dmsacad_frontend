import type { jsPDF } from "jspdf";
import type { SchoolHeaderConfig } from "../interfaces/SchoolHeaderConfig";

// Bundles the two pieces useSchoolHeader() resolves in parallel - the identity/address fields
// (from allSchoolConfigOfYear) and the logo, already loaded as an <img> element (crossOrigin
// "anonymous", see SchoolInfoReader.fetchLogoImage) so it's ready to embed into a PDF canvas
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

// Draws the letterhead (both language columns, centered logo + matricule, separator rule) at the
// top of the PDF and returns the Y coordinate the caller should start the title/table from. If
// there's no config and no logo yet (still loading, or nothing configured for this school), this
// draws nothing and returns a plain top margin so exports still work without a header.
export const drawPdfLetterhead = (doc: jsPDF, header: SchoolHeader): number => {
  const { config, logoImage } = header;
  if (!config && !logoImage) {
    return 15;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftX = 14;
  const rightX = pageWidth - 14;
  const centerX = pageWidth / 2;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(REPUBLIC_FR, leftX, y);
  doc.text(REPUBLIC_EN, rightX, y, { align: "right" });

  y += 5;
  doc.setFont("helvetica", "italic");
  doc.text(MOTTO_FR, leftX, y);
  doc.text(MOTTO_EN, rightX, y, { align: "right" });

  y += 5;
  doc.setFont("helvetica", "normal");
  if (config?.del_regionale_fr) {
    doc.text(config.del_regionale_fr, leftX, y);
  }
  if (config?.del_regionale_en) {
    doc.text(config.del_regionale_en, rightX, y, { align: "right" });
  }

  y += 5;
  if (config?.del_dept_fr) {
    doc.text(config.del_dept_fr, leftX, y);
  }
  if (config?.del_dept_en) {
    doc.text(config.del_dept_en, rightX, y, { align: "right" });
  }

  y += 5;
  doc.setFont("helvetica", "bold");
  if (config?.name_fr) {
    doc.text(config.name_fr, leftX, y);
  }
  if (config?.name_en) {
    doc.text(config.name_en, rightX, y, { align: "right" });
  }

  y += 5;
  doc.setFont("helvetica", "normal");
  const phone = formatPhone(config?.phone1);
  if (phone) {
    doc.text(`Tel.: ${phone}`, leftX, y);
    doc.text(`Phone: ${phone}`, rightX, y, { align: "right" });
  }

  const logoSize = 18;
  const logoY = 12;
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
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(leftX, y, rightX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  return y + 8;
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
