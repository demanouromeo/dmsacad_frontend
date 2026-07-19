// "Fiches de report de notes" - one blank paper form per classe, meant to be printed and handed to
// each teacher to write marks on by hand (a separate, offline-collection workflow from the digital
// mark-entry screen) - not a report of marks already in the database, so no mark data is fetched or
// shown here at all, only the roster's names. Deliberately has no letterhead, signature block, or
// footer (unlike every other PDF export in this app - see exportHeader.ts) per explicit request:
// this is a working paper meant to be filled in and later transcribed, not an official document.
export interface MarkSheetStudent {
  name: string;
  surname: string | null;
}

export interface MarkSheetClasse {
  classeName: string;
  isApc: boolean;
  students: MarkSheetStudent[];
}

// APC classes get 3 generic competency columns (comp1/comp2/comp3) regardless of how many
// competences are actually defined for whichever subject ends up being written on this sheet by
// hand - the sheet is subject-agnostic (MATIERE is a blank field for hand-fill), so it can't know
// the real competence count/text ahead of time. Non-APC classes get 6 columns (Note1..Note6),
// covering all 3 terms x 2 sequences that could be written on the same sheet across the year.
const APC_COLUMNS = ["comp1", "comp2", "comp3"];
const NON_APC_COLUMNS = ["Note1", "Note2", "Note3", "Note4", "Note5", "Note6"];

// Vertical space (mm) reserved above the table on a classe's first page for the title/classe/
// trimestre/enseignant/matiere/coef block + separator rule, versus a continuation page of the same
// classe which only needs room for the small "Page X/Y" indicator before the table (whose own
// column-header row repeats automatically on every page via autoTable's `head` option).
const FIRST_PAGE_TABLE_TOP = 40;
const CONTINUATION_PAGE_TABLE_TOP = 16;

export const exportMarkSheetsToPdf = async (
  classes: MarkSheetClasse[],
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  classes.forEach((classe, classeIndex) => {
    if (classeIndex > 0) {
      doc.addPage();
    }
    const startPage = doc.getNumberOfPages();
    const columns = classe.isApc ? APC_COLUMNS : NON_APC_COLUMNS;

    autoTable(doc, {
      startY: FIRST_PAGE_TABLE_TOP,
      margin: { top: CONTINUATION_PAGE_TABLE_TOP },
      head: [["No.", "Nom", ...columns]],
      body: classe.students.map((student, index) => [
        index + 1,
        `${student.name} ${student.surname ?? ""}`.trim(),
        ...columns.map(() => ""),
      ]),
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineWidth: 0.1, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
      headStyles: { fillColor: [219, 234, 254], textColor: 0, lineWidth: 0.1, lineColor: [0, 0, 0] },
    });

    // The final page count for this classe is only known once its table has finished paginating -
    // revisit every page it occupied to draw the "Page X/Y" indicator (every page) and the
    // title/classe/trimestre/enseignant/matiere/coef block (first page only, above the table).
    const endPage = doc.getNumberOfPages();
    const totalPages = endPage - startPage + 1;
    for (let page = startPage; page <= endPage; page++) {
      doc.setPage(page);
      const relativePage = page - startPage + 1;

      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(`Page ${relativePage}/${totalPages}`, pageWidth - 14, 10, { align: "right" });

      if (relativePage === 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("FICHE DE REPORT DE NOTES", 14, 16);
        doc.text(`Classe: ${classe.classeName}`, pageWidth / 2, 16, { align: "center" });
        doc.text("Trimestre: _______", pageWidth - 14, 16, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("ENSEIGNANT: ______________________________", 14, 24);
        doc.text("MATIERE: ___________________________________", pageWidth / 2, 24, {
          align: "center",
        });
        doc.setFont("helvetica", "italic");
        doc.text("Coef.: _____", pageWidth - 14, 24, { align: "right" });

        doc.setLineWidth(0.3);
        doc.line(14, 28, pageWidth - 14, 28);
      }
    }
  });

  doc.save(filename);
};
