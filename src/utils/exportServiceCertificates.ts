import type { jsPDF } from "jspdf";
import type { Staff } from "../interfaces/Staff";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "./exportHeader";
import { computeResponsable } from "./schoolTypes";
import { saveOrShareBlob } from "./nativeFileSave";

// "Certificats de service" - three one-page-per-staff-member HR certificates (Prise de service,
// Reprise de service, Présence effective) printed from the Personnel module's toolbar. Modeled
// directly on real sample certificates from the product's paper form (see the request that added
// this feature) - same bilingual (FR/EN) letterhead/signature every other export in this app
// already uses (drawPdfLetterhead/drawPdfSignature/drawPdfFooters), plus a hand-drawn form body
// since this is a fixed fill-in-the-blank document, not tabular data (no autoTable here).
//
// Unlike every other bilingual UI element in this app (which toggles with the FR/EN language
// switch), the certificate BODY text is always bilingual FR+EN side by side, matching the sample
// forms - same convention drawPdfLetterhead itself already uses for REPUBLIC_FR/EN etc. Only the
// surrounding button/menu/toast text (in StaffManager) respects the app's language toggle.
export type ServiceCertificateKind = "reprise" | "prise" | "presence";

const TITLES: Record<ServiceCertificateKind, { fr: string; en: string }> = {
  reprise: { fr: "CERTIFICAT DE REPRISE DE SERVICE", en: "CERTIFICATE OF RESUMPTION OF SERVICE" },
  prise: { fr: "CERTIFICAT DE PRISE DE SERVICE", en: "CERTIFICATE OF ASSUMPTION OF SERVICE" },
  presence: {
    fr: "ATTESTATION DE PRESENCE EFFECTIVE AU POSTE",
    en: "ATTESTATION OF EFFECTIVE SERVICE",
  },
};

const SERVICE_DATE_LABEL: Record<ServiceCertificateKind, string> = {
  reprise: "A effectivement repris service le (Has effectively resumed service on)",
  prise: "A effectivement pris service le (Has effectively assumed service on)",
  presence: "En poste depuis le - date de sa reprise (In post since - date of resumption)",
};

const CLOSING_TEXT: Record<ServiceCertificateKind, { fr: string; en: string }> = {
  reprise: {
    fr: "En foi de quoi le présent certificat de reprise de service lui est délivré pour servir et valoir ce que de droit.",
    en: "In testimony whereof, this present certificate is issued for the purpose it deserves.",
  },
  prise: {
    fr: "En foi de quoi le présent certificat de prise de service lui est délivré pour servir et valoir ce que de droit.",
    en: "In testimony whereof, this present certificate is issued for the purpose it deserves.",
  },
  presence: {
    fr: "En foi de quoi la présente attestation de présence effective au poste lui est délivrée pour servir et valoir ce que de droit.",
    en: "In testimony whereof, this present attestation is issued for the purpose it deserves.",
  },
};

const LEFT_X = 14;
const BLANK = "_______________";

// Falls back to a blank fill-in line (rather than an empty string) when the staff record has no
// value for a field - most of these HR fields (grade, matricule, dob, pob, region...) have no UI
// to set them anywhere in the app yet besides StaffDetailsDialog's "more info" form, so leaving a
// visibly blank line (not just empty space) is what a paper form would show too.
const val = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || BLANK;
};

const fullName = (staff: Staff): string => `${staff.name} ${staff.surname ?? ""}`.trim();

interface FieldCell {
  label: string;
  value: string;
}

// One row of 1-3 fields, each rendered as a small bold caption above its value - reads like a
// real form's field/blank pairs without needing a two-line FR-then-EN stack per field (the
// caption text itself is already "FR (EN)" to stay bilingual in one line).
const drawFieldRow = (doc: jsPDF, y: number, contentWidth: number, fields: FieldCell[]): number => {
  const colWidth = contentWidth / fields.length;
  fields.forEach((f, i) => {
    const x = LEFT_X + i * colWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text(f.label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(f.value, x, y + 5.5);
  });
  return y + 13;
};

// A full sentence (FR normal, EN italic/smaller/gray below it) - used for the opening/certify/
// closing prose lines, as opposed to drawFieldRow's compact single-line field captions. Wraps
// long lines to the page's content width rather than overflowing the margin.
const drawSentence = (doc: jsPDF, y: number, contentWidth: number, fr: string, en: string): number => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const frLines = doc.splitTextToSize(fr, contentWidth) as string[];
  doc.text(frLines, LEFT_X, y);
  let nextY = y + frLines.length * 5.5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const enLines = doc.splitTextToSize(en, contentWidth) as string[];
  doc.text(enLines, LEFT_X, nextY);
  nextY += enLines.length * 4.5 + 3;

  doc.setTextColor(0, 0, 0);
  return nextY;
};

const drawCertificatePage = (
  doc: jsPDF,
  kind: ServiceCertificateKind,
  staff: Staff,
  functionLabel: (code: number) => string,
  schoolHeader: SchoolHeader,
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - LEFT_X * 2;
  const centerX = pageWidth / 2;
  const config = schoolHeader.config;
  const responsable = computeResponsable(config?.type ?? "");
  const title = TITLES[kind];

  let y = drawPdfLetterhead(doc, schoolHeader);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title.fr, centerX, y + 6, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(title.en, centerX, y + 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`N° ${BLANK}`, centerX, y + 20, { align: "center" });

  y += 30;
  y = drawSentence(
    doc,
    y,
    contentWidth,
    `Je soussigné(e), ${BLANK} ${responsable.fr} du ${config?.name_fr ?? BLANK}`,
    `I, the undersigned ${responsable.en} of ${config?.name_en ?? ""}`.trim(),
  );
  y = drawSentence(
    doc,
    y,
    contentWidth,
    `Certifie que M., Mme, Mlle ${fullName(staff)}`,
    "Certify that Mr, Mrs, Miss",
  );

  y += 2;
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "Grade (Rank)", value: val(staff.grade) },
    { label: "Matricule (Roll number)", value: val(staff.matricule) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "Né(e) le (Born on)", value: val(staff.dob) },
    { label: "à (at)", value: val(staff.pob) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "Région (Region)", value: val(staff.region) },
    { label: "Département (Division)", value: val(staff.department) },
    { label: "Arrondissement (Sub-Division)", value: val(staff.arrodissement) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "Numéro de l'acte de recrutement (Recruitment act n°)", value: val(staff.numeroRecrutement) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    {
      label: "Affecté(e), Nommé(e), Muté(e) par Arrêté, Note de Service, Décision n° (Posted, appointed, transferred by decision n°)",
      value: val(staff.posting_decision),
    },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "En provenance de (From)", value: val(staff.provenantDe) },
    { label: SERVICE_DATE_LABEL[kind], value: val(staff.dateReprise) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "En qualité de (As)", value: val(functionLabel(staff.function)) },
    { label: "Diplôme (Diploma)", value: val(staff.diplome) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    { label: "Spécialité (Speciality)", value: val(staff.specilitee) },
    { label: "Matière effectivement enseignée (Subject really taught)", value: val(staff.matiereEnseignee) },
  ]);
  y = drawFieldRow(doc, y, contentWidth, [
    {
      label: "Date d'entrée à la fonction publique (First assumption of duty in the public service)",
      value: val(staff.dateEntree),
    },
    {
      label: "Date de la 1ère prise de service dans l'établissement (First assumption of duty here)",
      value: val(staff.date1erePrise),
    },
  ]);

  y += 4;
  drawSentence(doc, y, contentWidth, CLOSING_TEXT[kind].fr, CLOSING_TEXT[kind].en);

  drawPdfSignature(doc, schoolHeader, y + 18);
};

// One PDF, one page per selected staff member (addPage() per entry) - same "single combined
// document" shape as exportThPdf's whole-batch certificate export, so printing several teachers'
// certificates at once is one download/one print job rather than one file per person.
export const exportServiceCertificatesToPdf = async (
  kind: ServiceCertificateKind,
  staffList: Staff[],
  functionLabel: (code: number) => string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  staffList.forEach((staff, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawCertificatePage(doc, kind, staff, functionLabel, schoolHeader);
  });

  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
