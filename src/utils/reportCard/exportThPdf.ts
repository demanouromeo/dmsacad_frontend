import type { jsPDF } from "jspdf";
import th1smImg from "../../assets/compo/th/TH1sm.png";
import th1mdImg from "../../assets/compo/th/TH1md.png";
import th1Img from "../../assets/compo/th/TH1.png";
import th2smImg from "../../assets/compo/th/TH2sm.png";
import th2mdImg from "../../assets/compo/th/TH2md.png";
import th2Img from "../../assets/compo/th/TH2.png";
import tickImg from "../../assets/compo/th/tick.png";
import { drawPdfLetterhead, type SchoolHeader } from "../exportHeader";
import { computeResponsable } from "../schoolTypes";
import { formatRangText, formatRcNumber, getCote } from "./reportCardCompute";
import type { ReportCardStudentData } from "../../interfaces/ReportCard";

// Whole-section "Tableau d'Honneur" (Honor Roll) certificate batch - a visually distinct one-page-
// per-STUDENT (not one-page-per-student-of-every-classe like the term RC, since only students who
// actually deserve it get a page) certificate, printed on a pre-designed background image rather
// than a drawn table. Two DISTINCT designs/backgrounds depending on the classe's own APC-ness (see
// ReportCardManager's handlePrintTh, which calls exportThPdf once per kind, producing two separate
// downloaded PDFs rather than one combined document): APC classes show the student's COTE (letter
// grade), never a numeric class rank; non-APC classes show the student's actual class RANG (ordinal
// + effectif of the classe), never a cote. Both confirmed directly by the user, and each layout
// hand-reconstructed/coordinate-calibrated against a real sample TH PDF generated from this same
// database (src/assets/compo/th/{APC,NON APC} TH - Section francophone - ....pdf) - see the plan
// discussion for how the field positions were derived (a coordinate grid overlaid on the TH1md.png/
// TH2md.png backgrounds, cross-checked against each sample's own extracted text/values). Every
// other field (letterhead, term word, name, classe, checkboxes, signature) shares the exact same
// tuned position/size/color between the two kinds, since both backgrounds use the same template
// apart from that one differing field.
export type ThKind = "apc" | "nonApc";

// One deserving student's worth of data for one certificate page - assembled by the caller
// (ReportCardManager) from buildReportCardData's output across every classe of the section,
// filtered to computeThEligibility(...).deserves===true students only. effectif is only rendered
// on non-APC pages (the classe's Rang blank needs it); harmless/unused on APC pages.
export interface ThPageData {
  student: ReportCardStudentData;
  classeName: string;
  effectif: number;
  encouragement: boolean;
  felicitation: boolean;
}

// Same bundled-asset-probe pattern as exportReportCardNonApcPdf.ts's loadStaticImage - these are
// same-origin bundled assets (not backend-fetched), so a plain onload/onerror probe is enough,
// no CORS/canvas concern.
const loadStaticImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// thparam.val1 (1/2/3, see ThParamManager's "resolution" radio group) picks the background's
// pixel resolution, not its layout - TH1sm/TH1md/TH1 (APC) and TH2sm/TH2md/TH2 (non-APC) are each
// the same certificate design at three different raster resolutions (same A4-landscape aspect
// ratio, confirmed), so every mm coordinate below applies unchanged regardless of which one is
// chosen. TH1.png/TH2.png (val1===3) are the full/original resolution assets - "file may be heavy,
// but best quality" per ThParamManager's own radio label.
const resolveBackground = (kind: ThKind, val1: number): string => {
  if (kind === "apc") {
    if (val1 === 1) return th1smImg;
    if (val1 === 2) return th1mdImg;
    return th1Img;
  }
  if (val1 === 1) return th2smImg;
  if (val1 === 2) return th2mdImg;
  return th2Img;
};

// French/English ordinal term words for the certificate's "...fin du {mot} Trimestre" blank.
const TERM_WORDS: Record<"fr" | "en", string[]> = {
  fr: ["PREMIER", "DEUXIÈME", "TROISIÈME"],
  en: ["FIRST", "SECOND", "THIRD"],
};

// Coordinates (mm, A4 landscape 297x210). Calibrated by hand against the background image - may
// need minor adjustment from user feedback, same as every other hand-tuned PDF layout in this app
// (the non-APC RC's own block layout went through several such rounds).
const TERM_X = 165;
const TERM_Y = 98;
const TERM_FONT_SIZE = 14.5;
const NAME_X = 148;
const NAME_Y = 108;
const NAME_FONT_SIZE = 15.5;
const CLASSE_X = 98;
const CLASSE_Y = 119;
const CLASSE_FONT_SIZE = 14.5;
const ROW_Y = 136.5; // Moyenne Obtenue and Cote/Rang share one row on the certificate.
const MOYENNE_CENTER_X = 127;
const ROW_FONT_SIZE = 14.5;
// APC's single COTE blank and non-APC's two-part "Rang {ordinal}/{effectif}" blanks sit in the
// same right-hand slot of the row - COTE_CENTER_X and RANG1_CENTER_X are therefore the same value,
// kept as separate named constants only for readability at each call site.
const COTE_CENTER_X = 190;
const RANG1_CENTER_X = 190;
const RANG2_CENTER_X = 225; // total-students-in-classe blank, non-APC only.
const CHECK_X = 51;
// Encouragement/felicitation ticks have each drifted from the shared CHECK_X baseline over several
// rounds of feedback - encouragement 2mm left (both kinds); felicitation 4mm right on APC, 14mm
// right on non-APC (non-APC's 10mm one-off plus the 4mm applied to both kinds since).
const CHECK_ENC_X = CHECK_X - 2;
const CHECK_FEL_X = CHECK_X + 4;
const CHECK_FEL_X_NON_APC = CHECK_X + 14;
const CHECK_ENC_Y = 164;
const CHECK_FEL_Y = 172;
const NAME_Y_NON_APC = NAME_Y + 0.5;
const TICK_SIZE = 6;
const SIGNATURE_X = 198;
const SIGNATURE_Y = 164;
const SIGNATURE_FONT_SIZE = 10;
// Every filled-in field except the letterhead and signature block uses this deep purple, rather
// than the plain black every other PDF export in this app uses for its filled content.
const FIELD_COLOR: [number, number, number] = [103, 58, 183]; // deep purple #673AB7
const BLACK: [number, number, number] = [0, 0, 0];

const drawPage = (
  doc: jsPDF,
  kind: ThKind,
  page: ThPageData,
  term: number,
  schoolHeader: SchoolHeader,
  backgroundImage: HTMLImageElement,
  tickImage: HTMLImageElement | null,
  language: "fr" | "en",
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(backgroundImage, "PNG", 0, 0, pageWidth, pageHeight);

  // Same shared letterhead every other export uses, phone line omitted (includePhone: false) -
  // same precedent as the term RC, and matches every sample TH certificate (no Tel./Phone line).
  // Unlike every other export, the separator rule is skipped (includeLine: false) and the whole
  // block starts lower (startY: 37 vs. the usual 14) - the certificate background's own decorative
  // corner border already frames this area, so a floating rule would look stray, and the border
  // itself needs the extra top clearance.
  drawPdfLetterhead(doc, schoolHeader, { includePhone: false, includeLine: false, startY: 37 });

  const { student } = page;

  doc.setTextColor(...FIELD_COLOR);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(TERM_FONT_SIZE);
  doc.text(TERM_WORDS[language][term - 1] ?? "", TERM_X, TERM_Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(NAME_FONT_SIZE);
  doc.text(
    `${student.name} ${student.surname}`.trim(),
    NAME_X,
    kind === "nonApc" ? NAME_Y_NON_APC : NAME_Y,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(CLASSE_FONT_SIZE);
  doc.text(page.classeName, CLASSE_X, CLASSE_Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(ROW_FONT_SIZE);
  doc.text(formatRcNumber(student.moyenneTrim), MOYENNE_CENTER_X, ROW_Y, { align: "center" });
  if (kind === "apc") {
    doc.text(getCote(student.moyenneTrim), COTE_CENTER_X, ROW_Y, { align: "center" });
  } else {
    doc.text(formatRangText(student.rang, student.sexe, language), RANG1_CENTER_X, ROW_Y, {
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
      const felicitationX = kind === "nonApc" ? CHECK_FEL_X_NON_APC : CHECK_FEL_X;
      doc.addImage(tickImage, "PNG", felicitationX - half, CHECK_FEL_Y - half, TICK_SIZE, TICK_SIZE);
    }
  }

  // "Pour le conseil de classe / For the Class Council" is already baked into the background -
  // only the filled-in signature content is drawn here, same text/fields as drawPdfSignature but
  // positioned to sit under that header instead of at the page bottom (this certificate's border
  // bleeds to the page edge, there is no bottom margin to place it in).
  const config = schoolHeader.config;
  if (config && (config.lieu_signature || config.date_signature)) {
    const responsable = computeResponsable(config.type ?? "");
    const place = config.lieu_signature ?? "";
    const date = config.date_signature ? config.date_signature.slice(0, 10) : "";
    doc.setTextColor(...BLACK);
    doc.setFontSize(SIGNATURE_FONT_SIZE);
    doc.text(`Fait à ${place}, le ${date}`, SIGNATURE_X, SIGNATURE_Y);
    doc.setFont("helvetica", "bold");
    doc.text(`Le ${responsable.fr}`, SIGNATURE_X, SIGNATURE_Y + 7);
    doc.setFont("helvetica", "italic");
    doc.text(`The ${responsable.en}`, SIGNATURE_X, SIGNATURE_Y + 13);
    doc.setFont("helvetica", "normal");
  }

  doc.setTextColor(...BLACK);
  doc.setFontSize(12);
};

// One PDF for the whole batch (one A4-landscape page per deserving student, across however many
// classes of the given kind handlePrintTh looped over) - same "one document, addPage() per entry"
// shape as exportReportCardsToPdf/exportNonApcReportCardsToPdf, just keyed on eligible students
// instead of a single classe's full roster. Called once per kind by handlePrintTh, producing two
// separate downloaded files when a section has both APC and non-APC honor-roll students. No
// drawPdfFooters/watermark call here, deliberately unlike every other PDF export in this app - the
// certificate background already bleeds to every page edge, so there is no blank margin for the
// standard footer bar without clashing with the certificate's own border design (matches every
// real sample TH PDF, which carries no app-branding footer either).
export const exportThPdf = async (
  kind: ThKind,
  pages: ThPageData[],
  term: number,
  schoolHeader: SchoolHeader,
  val1: number,
  filename: string,
  language: "fr" | "en",
): Promise<void> => {
  const { default: JsPdfCtor } = await import("jspdf");
  const doc = new JsPdfCtor({ orientation: "landscape" });

  const [backgroundImage, tickImage] = await Promise.all([
    loadStaticImage(resolveBackground(kind, val1)),
    loadStaticImage(tickImg),
  ]);
  if (!backgroundImage) {
    return;
  }

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawPage(doc, kind, page, term, schoolHeader, backgroundImage, tickImage, language);
  });

  doc.save(filename);
};
