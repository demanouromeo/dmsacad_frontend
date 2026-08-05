import type { jsPDF } from "jspdf";
import type {
  StatParClasseClasseStats,
  StatParClasseData,
  StatParClasseDemographics,
} from "./statParClasseCompute";
import { formatRcNumber } from "../reportCard/reportCardCompute";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";
import { STAT_GROUPEES_TERM_ORDINAL } from "../statGroupees/exportStatGroupeesPdf";
import { saveOrShareBlob } from "../nativeFileSave";

// "SECOND"/"TROISIEME" wording confirmed via Term-2/Term-3 samples
// ("STATISTIQUES PAR CLASSE DU SECOND TRIMESTRE" / "... TROISIEME TRIMESTRE") - same wording as
// Stat Groupées/Classement, reused rather than redefined.
export { STAT_GROUPEES_TERM_ORDINAL as STAT_PAR_CLASSE_TERM_ORDINAL };

export interface StatParClasseBlock extends StatParClasseData {
  classeName: string;
  profPrincipal: string;
  isApc: boolean;
  demographics: StatParClasseDemographics;
}

const SUMMARY_ROW_STYLE = { fontStyle: "bold" as const, fillColor: [230, 230, 230] as [number, number, number] };

// Unlike every other Bilan PDF export (letterhead/title/signature drawn once for the whole
// document), the reference samples repeat the FULL letterhead, title, and "Fait à.../Le Proviseur"
// signature on every single classe's own page block - confirmed by reading page 1 (6ème A) vs page 4
// (6ème B) of the term-1 sample, each with its own complete letterhead, and each classe's own
// signature line at the end of its own table rather than deferred to the very end of the 46-page
// document. This mirrors the individual Report Card bulletin's own per-page convention (this report
// being the RC computation turned sideways) rather than the single-document Stat Groupées/Stat
// Matière/Classement precedent. Only the footer (page numbers, watermark) is drawn once at the very
// end via drawPdfFooters, which already iterates every page itself.
const drawClasseHeaderBlock = (
  doc: jsPDF,
  pageWidth: number,
  title: string,
  schoolYear: string,
  block: StatParClasseBlock,
  startY: number,
): number => {
  const centerX = pageWidth / 2;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, centerX, y, { align: "center" });
  y += 8;

  const { classeStats, demographics } = block;
  const leftX = 14;
  const col2X = pageWidth * 0.27;
  const col3X = pageWidth * 0.52;
  const col4X = pageWidth * 0.77;

  const leftLines: [string, string][] = [
    ["Année scolaire:", schoolYear],
    ["classe:", block.classeName],
    ["Prof. Principal:", block.profPrincipal],
    ["Nombre d'exclus:", "0"],
  ];
  const col2Lines: [string, string][] = [
    ["Effectif:", String(classeStats.effectif)],
    ["Nombre de garçons:", String(demographics.garcons)],
    ["Nombre de filles:", String(demographics.filles)],
    ["Nb. redoublants:", String(demographics.redoublants)],
    ["Presents:", String(classeStats.effectif)],
  ];
  const col3Lines: [string, string][] = [
    ["Moyenne générale:", formatRcNumber(classeStats.moyenneGenerale)],
    ["Nombre de réuissites:", String(classeStats.nombreMoyennes)],
    ["Moyenne du premier:", formatRcNumber(classeStats.minMax[1])],
    ["Moyenne du dernier:", formatRcNumber(classeStats.minMax[0])],
    ["Nombre total de matières:", String(demographics.nbMatieres)],
  ];
  const col4Lines: [string, string][] = [
    ["Taux de réuissite des garçons:", `${formatRcNumber(demographics.tauxGarcons)}%`],
    ["Taux de succès des filles:", `${formatRcNumber(demographics.tauxFilles)}%`],
    ["Taux réuissite redoublants:", `${formatRcNumber(demographics.tauxRedoublants)}%`],
    ["Pourcentage de réussite:", `${formatRcNumber(classeStats.tauxReussite)}%`],
    ["Ecart type:", formatRcNumber(classeStats.ecartType)],
  ];

  doc.setFontSize(8.5);
  const drawColumn = (x: number, lines: [string, string][]) => {
    let yy = y;
    lines.forEach(([label, value]) => {
      doc.setFont("helvetica", "normal");
      doc.text(label, x, yy);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + doc.getTextWidth(label) + 2, yy);
      yy += 4.5;
    });
  };
  drawColumn(leftX, leftLines);
  drawColumn(col2X, col2Lines);
  drawColumn(col3X, col3Lines);
  drawColumn(col4X, col4Lines);

  return y + 5 * 4.5 + 3;
};

const buildStudentRow = (
  index: number,
  row: StatParClasseData["rows"][number],
  subjects: StatParClasseData["subjects"],
): (string | number)[] => [
  index + 1,
  `${row.name} ${row.surname}`.trim(),
  ...subjects.map((subject) => {
    const moy = row.subjectMoys.get(subject.subjectId);
    return moy === null || moy === undefined ? "" : formatRcNumber(moy);
  }),
  formatRcNumber(row.totalGeneral),
  formatRcNumber(row.moyenne),
  row.coteOrRang,
  row.absences,
];

const renderStatParClasse = async (
  title: string,
  blocks: StatParClasseBlock[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  blocks.forEach((block, blockIndex) => {
    if (blockIndex > 0) {
      doc.addPage();
    }
    const headerY = drawPdfLetterhead(doc, schoolHeader);
    const tableY = drawClasseHeaderBlock(doc, pageWidth, title, schoolYear, block, headerY);

    const totalCoef = block.subjects.reduce((sum, s) => sum + s.coef, 0);
    const rangOrCoteHeader = block.isApc ? "Rang" : "COTE";

    const successRateRow = [
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "Taux de succès par matière (%)", styles: SUMMARY_ROW_STYLE },
      ...block.subjects.map((s) => ({
        content: `${formatRcNumber(block.demographics.subjectSuccessRates.get(s.subjectId) ?? 0)}%`,
        styles: SUMMARY_ROW_STYLE,
      })),
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "", styles: SUMMARY_ROW_STYLE },
    ];
    const coefficientRow = [
      { content: "No", styles: SUMMARY_ROW_STYLE },
      { content: `T. Coef.: ${formatRcNumber(totalCoef)}  Coefficients:`, styles: SUMMARY_ROW_STYLE },
      ...block.subjects.map((s) => ({ content: formatRcNumber(s.coef), styles: SUMMARY_ROW_STYLE })),
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "", styles: SUMMARY_ROW_STYLE },
      { content: "", styles: SUMMARY_ROW_STYLE },
    ];

    autoTable(doc, {
      startY: tableY,
      head: [["No.", "Nom", ...block.subjects.map((s) => s.subjectTitle), "TOTAL", "Moyenne", rangOrCoteHeader, "Total des absences"]],
      body: [
        successRateRow,
        coefficientRow,
        ...block.rows.map((row, index) => buildStudentRow(index, row, block.subjects)),
      ],
      styles: { fontSize: 6.5, halign: "center" },
      headStyles: { fillColor: [30, 64, 175], fontSize: 6.5 },
      bodyStyles: { textColor: [0, 0, 0] },
      columnStyles: { 1: { halign: "left" } },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    drawPdfSignature(doc, schoolHeader, finalY);
  });

  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};

export const exportStatParClasseTermToPdf = (
  term: number,
  blocks: StatParClasseBlock[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderStatParClasse(
    `STATISTIQUES PAR CLASSE DU ${STAT_GROUPEES_TERM_ORDINAL[term] ?? term} TRIMESTRE`,
    blocks,
    schoolYear,
    schoolHeader,
    filename,
  );

export const exportStatParClasseAnnualToPdf = (
  blocks: StatParClasseBlock[],
  schoolYear: string,
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> =>
  renderStatParClasse("STATISTIQUES ANNUELLES PAR CLASSE", blocks, schoolYear, schoolHeader, filename);

export type { StatParClasseClasseStats };
