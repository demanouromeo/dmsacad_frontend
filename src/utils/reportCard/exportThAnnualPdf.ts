import type { jsPDF } from "jspdf";
import resolution100Img from "../../assets/compo/th/RESOLUTION100.png";
import resolution150Img from "../../assets/compo/th/RESOLUTION150.png";
import resolution200Img from "../../assets/compo/th/RESOLUTION200.png";
import tickImg from "../../assets/compo/th/tick.png";
import { drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import { formatRangText, formatRcNumber } from "./reportCardCompute";
import type { ThKind } from "./exportThPdf";

// Annual counterpart to exportThPdf.ts's whole-section Tableau d'Honneur batch - same "one page per
// deserving student, two separate PDFs (APC vs non-APC)" shape, but for the school-YEAR's annual
// average/rank/cote instead of one term's, and built from AnnualStudentData/AnnualStudentDataApc
// (ReportCardManager's loadAnnualReportCardDataForClasse/loadAnnualApcReportCardDataForClasse)
// rather than ReportCardData. Unlike the term certificate, APC and non-APC share the exact SAME
// background art here (RESOLUTION100/150/200.png, keyed off thparam.val1 same as term's
// sm/md/full - confirmed against two real sample annual TH PDFs from the live database, one per
// kind, both using this identical background) - only the filled-in COTE-vs-RANG value differs, same
// as how term TH already lets APC/non-APC share one field slot for that value. The certificate's
// "fin d'ANNEE" wording is baked into the background art itself (no term blank to fill), so there is
// no term/TERM_WORDS concept here at all.
export interface AnnualThPageData {
  name: string;
  surname: string;
  sexe: string;
  classeName: string;
  effectif: number;
  avgAnnual: number;
  // Non-APC only - null for APC pages (cote is shown instead, see AnnualThPageData.cote).
  rangAnnuel: number | null;
  // APC only - "" for non-APC pages.
  cote: string;
  encouragement: boolean;
  felicitation: boolean;
}

const loadStaticImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// thparam.val1 (1/2/3) picks the background's pixel resolution only, not its layout - same
// low/medium/high precedent as the term certificate's own TH1sm/md/full trio, just one single set
// of assets shared by both APC and non-APC kinds here instead of two.
const resolveBackground = (val1: number): string => {
  if (val1 === 1) return resolution100Img;
  if (val1 === 2) return resolution150Img;
  return resolution200Img;
};

// Coordinates (mm, A4 landscape 297x210) - hand-measured directly against the two real sample
// annual TH PDFs (src/assets/compo/th/TH Annuel - {APC,Non APC} - ...pdf) and the blank
// RESOLUTION200.png background's own underlines, the same calibration approach exportThPdf.ts's own
// coordinates went through. This is a genuinely different background asset from the term
// certificate's TH1/TH2, so its field positions were measured fresh rather than reused - may still
// need minor adjustment from user feedback like every other hand-tuned layout in this app.
const NAME_X = 142;
const NAME_Y = 110;
const NAME_FONT_SIZE = 15.5;
const CLASSE_X = 93;
const CLASSE_Y = 120;
const CLASSE_FONT_SIZE = 14.5;
const ROW_Y = 136.5; // Moyenne Obtenue and Cote/Rang share one row on the certificate.
const ROW_FONT_SIZE = 14.5;
const MOYENNE_CENTER_X = 129;
// APC's single COTE blank and non-APC's "Rang {ordinal}" blank sit in the same right-hand slot -
// kept as separate named constants only for readability at each call site, same precedent as
// exportThPdf.ts's own COTE_CENTER_X/RANG1_CENTER_X.
const COTE_CENTER_X = 191;
const RANG1_CENTER_X = 191;
const RANG2_CENTER_X = 222.5; // total-students-in-classe blank, non-APC only.
const CHECK_ENC_X = 51.5;
const CHECK_ENC_Y = 163.5;
const CHECK_FEL_X = 55.5;
const CHECK_FEL_Y = 172;
const TICK_SIZE = 6;
const SIGNATURE_X = 182;
const SIGNATURE_Y = 163;
const SIGNATURE_FONT_SIZE = 10;
const FIELD_COLOR: [number, number, number] = [103, 58, 183]; // deep purple #673AB7, same as term TH.
const BLACK: [number, number, number] = [0, 0, 0];

const drawPage = (
  doc: jsPDF,
  kind: ThKind,
  page: AnnualThPageData,
  schoolHeader: SchoolHeader,
  backgroundImage: HTMLImageElement,
  tickImage: HTMLImageElement | null,
  language: "fr" | "en",
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(backgroundImage, "PNG", 0, 0, pageWidth, pageHeight);

  drawPdfLetterhead(doc, schoolHeader, { includePhone: false, includeLine: false, startY: 37 });

  doc.setTextColor(...FIELD_COLOR);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(NAME_FONT_SIZE);
  doc.text(`${page.name} ${page.surname}`.trim(), NAME_X, NAME_Y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(CLASSE_FONT_SIZE);
  doc.text(page.classeName, CLASSE_X, CLASSE_Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(ROW_FONT_SIZE);
  doc.text(formatRcNumber(page.avgAnnual), MOYENNE_CENTER_X, ROW_Y, { align: "center" });
  if (kind === "apc") {
    doc.text(page.cote, COTE_CENTER_X, ROW_Y, { align: "center" });
  } else {
    doc.text(formatRangText(page.rangAnnuel, page.sexe, language), RANG1_CENTER_X, ROW_Y, {
      align: "center",
    });
    doc.text(String(page.effectif), RANG2_CENTER_X, ROW_Y, { align: "center" });
  }
  doc.setFont("helvetica", "normal");

  if (tickImage) {
    const half = TICK_SIZE / 2;
    if (page.encouragement) {
      doc.addImage(tickImage, "PNG", CHECK_ENC_X - half, CHECK_ENC_Y - half, TICK_SIZE, TICK_SIZE);
    }
    if (page.felicitation) {
      doc.addImage(tickImage, "PNG", CHECK_FEL_X - half, CHECK_FEL_Y - half, TICK_SIZE, TICK_SIZE);
    }
  }

  const config = schoolHeader.config;
  if (config && (config.lieu_signature || config.date_signature)) {
    const responsable = computeResponsable(config.type ?? "");
    const place = config.lieu_signature ?? "";
    const date = config.date_signature ? config.date_signature.slice(0, 10) : "";
    doc.setTextColor(...BLACK);
    doc.setFontSize(SIGNATURE_FONT_SIZE);
    doc.text(`Fait à ${place}, le ${date}`, SIGNATURE_X, SIGNATURE_Y);
    doc.setFont("helvetica", "bold");
    doc.text(`Le ${responsable.fr}`, SIGNATURE_X, SIGNATURE_Y + 8);
    doc.setFont("helvetica", "italic");
    doc.text(`The ${responsable.en}`, SIGNATURE_X, SIGNATURE_Y + 16);
    doc.setFont("helvetica", "normal");
  }

  doc.setTextColor(...BLACK);
  doc.setFontSize(12);
};

// One PDF per kind, one page per deserving student - same shape as exportThPdf, called once per
// kind by ReportCardManager's handlePrintAnnualTh. No drawPdfFooters/watermark call, same reasoning
// as the term certificate (the background bleeds to every page edge, no blank margin for it).
export const exportAnnualThPdf = async (
  kind: ThKind,
  pages: AnnualThPageData[],
  schoolHeader: SchoolHeader,
  val1: number,
  filename: string,
  language: "fr" | "en",
): Promise<void> => {
  const { default: JsPdfCtor } = await import("jspdf");
  const doc = new JsPdfCtor({ orientation: "landscape" });

  const [backgroundImage, tickImage] = await Promise.all([
    loadStaticImage(resolveBackground(val1)),
    loadStaticImage(tickImg),
  ]);
  if (!backgroundImage) {
    return;
  }

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawPage(doc, kind, page, schoolHeader, backgroundImage, tickImage, language);
  });

  doc.save(filename);
};
