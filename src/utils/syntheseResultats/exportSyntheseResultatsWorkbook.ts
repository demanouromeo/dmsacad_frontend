import type { StatGroupeesRow } from "../statGroupees/statGroupeesCompute";
import type { HonorRollRow } from "./syntheseResultatsCompute";
import { formatRcNumber } from "../reportCard/reportCardCompute";
import { saveOrShareBlob } from "../nativeFileSave";

// A genuine multi-sheet .xlsx (ExcelJS, same precedent as exportMarksWorkbook.ts) rather than a
// single flat CSV - unlike Stat Groupées, this report is inherently 4 differently-shaped tables
// (Par Cycle/Par Niveau/Par Classe/Tableau d'Honneur), which a flat CSV can't represent as cleanly
// as the PDF's own 4 sections.

const STAT_HEADERS = [
  "Classe",
  "Moy. Géné.",
  "Effectif Garçons",
  "Effectif Filles",
  "Effectif Total",
  "Présents Garçons",
  "Présents Filles",
  "Présents Total",
  "% Participation Garçons",
  "% Participation Filles",
  "% Participation Total",
  "Moy. >= 10 Garçons",
  "Moy. >= 10 Filles",
  "Moy. >= 10 Total",
  "% Réussite Garçons",
  "% Réussite Filles",
  "% Réussite Total",
  "Moy. Max.",
  "Moy. Min.",
  "Appréciation",
];

const statRow = (r: StatGroupeesRow): (string | number)[] => [
  r.classeName,
  formatRcNumber(r.moyGene),
  r.effectifG,
  r.effectifF,
  r.effectifT,
  r.presentsG,
  r.presentsF,
  r.presentsT,
  `${formatRcNumber(r.participationG)}%`,
  `${formatRcNumber(r.participationF)}%`,
  `${formatRcNumber(r.participationT)}%`,
  r.sup10G,
  r.sup10F,
  r.sup10T,
  `${formatRcNumber(r.reussiteG)}%`,
  `${formatRcNumber(r.reussiteF)}%`,
  `${formatRcNumber(r.reussiteT)}%`,
  formatRcNumber(r.moyMax),
  formatRcNumber(r.moyMin),
  r.appreciation,
];

const HONOR_HEADERS = [
  "Classe",
  "Effectif Garçons",
  "Effectif Filles",
  "Effectif Total",
  "Tableau d'Honneur Garçons",
  "Tableau d'Honneur Filles",
  "Tableau d'Honneur Total",
  "Encouragements Garçons",
  "Encouragements Filles",
  "Encouragements Total",
  "Félicitations Garçons",
  "Félicitations Filles",
  "Félicitations Total",
];

const honorRow = (r: HonorRollRow): (string | number)[] => [
  r.classeName,
  r.effectifG,
  r.effectifF,
  r.effectifT,
  r.thG,
  r.thF,
  r.thT,
  r.encG,
  r.encF,
  r.encT,
  r.felG,
  r.felF,
  r.felT,
];

export const exportSyntheseResultatsToXlsx = async (
  filename: string,
  cycleRows: StatGroupeesRow[],
  cycleBilan: StatGroupeesRow,
  niveauRows: StatGroupeesRow[],
  niveauBilan: StatGroupeesRow,
  classeRows: StatGroupeesRow[],
  classeBilan: StatGroupeesRow,
  honorRows: HonorRollRow[],
): Promise<void> => {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const addStatSheet = (name: string, rows: StatGroupeesRow[], bilan: StatGroupeesRow) => {
    const worksheet = workbook.addWorksheet(name);
    worksheet.addRow(STAT_HEADERS);
    rows.forEach((r) => worksheet.addRow(statRow(r)));
    worksheet.addRow(statRow(bilan));
  };

  addStatSheet("Par Cycle", cycleRows, cycleBilan);
  addStatSheet("Par Niveau", niveauRows, niveauBilan);
  addStatSheet("Par Classe", classeRows, classeBilan);

  const honorSheet = workbook.addWorksheet("Tableau d'Honneur");
  honorSheet.addRow(HONOR_HEADERS);
  honorRows.forEach((r) => honorSheet.addRow(honorRow(r)));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await saveOrShareBlob(blob, filename);
};
