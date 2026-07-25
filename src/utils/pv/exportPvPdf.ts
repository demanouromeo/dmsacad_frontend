import type { jsPDF } from "jspdf";
import type { PvAnnualRow, PvTermRow } from "./pvCompute";
import { formatPvNumber, formatPvTermRang } from "./pvCompute";
import { drawPdfFooters, drawPdfLetterhead, drawPdfSignature, type SchoolHeader } from "../exportHeader";

// Tabular PV PDF builders, pattern-matched off exportEffectifs.ts (the app's only existing
// jspdf-autotable-based *tabular* PDF export - every report-card exporter is a per-student page
// layout, not a fit for a class-list table). Both end with the same drawPdfSignature +
// drawPdfFooters convention every PDF export in this app already uses.

const TERM_ORDINAL: Record<number, string> = { 1: "PREMIER", 2: "DEUXIÈME", 3: "TROISIÈME" };

const fullName = (row: { name: string; surname: string }): string =>
  `${row.name} ${row.surname}`.trim();

const drawClasseHeaderLine = (
  doc: jsPDF,
  pageWidth: number,
  y: number,
  classeName: string,
  schoolYear: string,
): number => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("CLASSE:", 20, y);
  doc.setFont("helvetica", "bold");
  doc.text(classeName, 20 + doc.getTextWidth("CLASSE: "), y);

  const anneeLabel = "ANNÉE SCOLAIRE:";
  const anneeX = pageWidth - 70;
  doc.setFont("helvetica", "normal");
  doc.text(anneeLabel, anneeX, y);
  doc.setFont("helvetica", "bold");
  doc.text(schoolYear, anneeX + doc.getTextWidth(`${anneeLabel} `), y);

  return y + 8;
};

export const exportPvTermToPdf = async (
  term: number,
  classeName: string,
  schoolYear: string,
  isApc: boolean,
  rows: PvTermRow[],
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`PROCÈS VERBAL DU ${TERM_ORDINAL[term] ?? term} TRIMESTRE`, centerX, y, { align: "center" });
  y += 8;
  y = drawClasseHeaderLine(doc, pageWidth, y, classeName, schoolYear);

  const head = isApc
    ? ["N°", "Matricule", "Noms et Prénoms", "Date Naiss.", "Sexe", "Satut", "Abs.1", "Abs.2", "T Abs.", "Moy", "Cote", "Observations"]
    : [
        "N°",
        "Matricule",
        "Noms et Prénoms",
        "Date Naiss.",
        "Sexe",
        "Satut",
        "Abs.1",
        "Abs.2",
        "T Abs.",
        "M Eval1",
        "M Eval2",
        "Moy",
        "Rang",
        "Observations",
      ];

  const body = rows.map((r) =>
    isApc
      ? [
          r.no,
          r.matricule,
          fullName(r),
          r.bday,
          r.sexe,
          r.repeating ? "OUI" : "NON",
          "",
          r.absUnjust ?? "",
          r.absUnjust ?? "",
          formatPvNumber(r.moy),
          r.cote ?? "",
          r.observation,
        ]
      : [
          r.no,
          r.matricule,
          fullName(r),
          r.bday,
          r.sexe,
          r.repeating ? "OUI" : "NON",
          "",
          r.absUnjust ?? "",
          r.absUnjust ?? "",
          formatPvNumber(r.eval1),
          formatPvNumber(r.eval2),
          formatPvNumber(r.moy),
          formatPvTermRang(r.rang),
          r.observation,
        ],
  );

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};

export const exportPvAnnualToPdf = async (
  classeName: string,
  schoolYear: string,
  rows: PvAnnualRow[],
  schoolHeader: SchoolHeader,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  let y = drawPdfLetterhead(doc, schoolHeader);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PROCÈS VERBAL ANNUEL", centerX, y, { align: "center" });
  y += 8;
  y = drawClasseHeaderLine(doc, pageWidth, y, classeName, schoolYear);

  const head = [
    [
      { content: "N°", rowSpan: 2 },
      { content: "Matricule", rowSpan: 2 },
      { content: "Noms et Prénoms", rowSpan: 2 },
      { content: "Date Naiss.", rowSpan: 2 },
      { content: "Sexe", rowSpan: 2 },
      { content: "Satut", rowSpan: 2 },
      { content: "Discipline", colSpan: 3, styles: { halign: "center" as const } },
      { content: "T Abs.", rowSpan: 2 },
      { content: "Travail", colSpan: 3, styles: { halign: "center" as const } },
      { content: "Moy.", rowSpan: 2 },
      { content: "Rang", rowSpan: 2 },
      { content: "Décision du c.", rowSpan: 2 },
    ],
    ["Trim1", "Trim2", "Trim3", "Trim1", "Trim2", "Trim3"],
  ];

  const body = rows.map((r) => [
    r.no,
    r.matricule,
    fullName(r),
    r.bday,
    r.sexe,
    r.repeating ? "OUI" : "NON",
    r.absByTerm[0] ?? "",
    r.absByTerm[1] ?? "",
    r.absByTerm[2] ?? "",
    r.absTotal ?? "",
    formatPvNumber(r.travailByTerm[0]),
    formatPvNumber(r.travailByTerm[1]),
    formatPvNumber(r.travailByTerm[2]),
    formatPvNumber(r.moy),
    r.rangText,
    r.decisionText,
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [30, 64, 175] },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  drawPdfSignature(doc, schoolHeader, finalY);
  drawPdfFooters(doc, schoolHeader);
  doc.save(filename);
};
