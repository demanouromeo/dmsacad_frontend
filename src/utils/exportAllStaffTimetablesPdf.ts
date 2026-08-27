import { drawPdfFooters, drawPdfSignature, type SchoolHeader } from "./exportHeader";
import { saveOrShareBlob } from "./nativeFileSave";
import {
  drawStaffTimetablePage,
  type MyTimetablePdfLabels,
  type StaffTimetableExportEntry,
} from "./exportMyTimetablePdf";
import type { TtConfig } from "../interfaces/Timetable";

// Bulk "every staff" counterpart to exportMyTimetableToPdf - one PDF, one page per staff member,
// each page drawn by the exact same drawStaffTimetablePage layout the single-staff (My Timetable)
// export uses, so ADMIN's bulk print produces pages identical to what a TEACHER/SG/CENSEUR would
// get exporting their own. Own letterhead per page (each page is its own standalone document),
// same precedent as exportTimetablesToPdf's per-class pages - only the final signature/footer pass
// runs once, after every page, matching that same exporter's behavior.
export const exportAllStaffTimetablesToPdf = async (
  entries: StaffTimetableExportEntry[],
  ttConfig: TtConfig | null,
  schoolHeader: SchoolHeader,
  labels: MyTimetablePdfLabels,
  filename: string,
): Promise<void> => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });

  let finalY = 0;
  entries.forEach((entry, index) => {
    if (index > 0) {
      doc.addPage();
    }
    finalY = drawStaffTimetablePage(doc, autoTable, entry, ttConfig, schoolHeader, labels);
  });

  if (entries.length > 0) {
    drawPdfSignature(doc, schoolHeader, finalY);
  }
  drawPdfFooters(doc, schoolHeader);
  await saveOrShareBlob(doc.output("blob"), filename);
};
