import { useEffect, useState } from "react";
import { BarChart3, Download, Printer, RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useLanguage } from "../../../i18n/useLanguage";
import { fillRateClassManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import { MarkReader } from "../../../dbmanger/MarkReader";
import { StaffReader } from "../../../dbmanger/StaffReader";
import type { CourseAssignment } from "../../../interfaces/CourseAssignment";
import { withCivility } from "../../../utils/staffName";
import type { Staff } from "../../../interfaces/Staff";
import type { Classe } from "../../../interfaces/Classe";
import type { SubjectClasseRow } from "../../../interfaces/SubjectClasseRow";
import { mergeToUnifiedCells, type FillRateCell } from "../../../utils/fillRateAggregation";
import {
  buildTimestampedFilename,
  exportLabeledTablesToPdf,
  exportRowsToPdf,
  type PdfRowGroup,
} from "../../../utils/exportData";
import { DEFAULT_REPORT_CONCURRENCY, mapWithConcurrency } from "../../../utils/concurrency";
import { useToast } from "../../../toast/useToast";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import CloseButton from "../../sharedcomp/CloseButton";
import FillRateChartDialog from "../marks/FillRateChartDialog";

const TERMS = [1, 2, 3];
const SEQUENCES = [1, 2];

// "Class visualization" submodule of the Fill rate module (see FillRateHub) - the same per-subject
// fill-rate list MarkEntryManager's own side panel already shows for whichever classe/subject/term
// is currently being edited there, but as a dedicated standalone screen: pick a classe, a term, and
// (for a non-APC classe) a sequence, and see every subject's fill rate at once. Unlike
// MarkEntryManager's panel (which fetches one subject's marks per network call, fine for a single
// already-open classe), this reuses the same whole-section aggregate endpoints/merge logic as
// FillRateGlobalManager (fillRateNonApc/fillRateApc + mergeToUnifiedCells) and simply filters down to
// the selected classe/term/sequence - one pair of network calls covers every classe switch.
// Teacher(s) a subject is assigned to in a classe, as "Civility Name Surname" (several teachers joined by
// " / "); "" when nobody is assigned. Surname comes from the staff list (the attribution row only
// carries staff.name).
const teachersOf = (
  attributions: CourseAssignment[],
  staffById: Map<number, Staff>,
  classeId: number,
  subjectId: number,
): string =>
  attributions
    .filter((a) => a.classe_id === classeId && a.subject_id === subjectId)
    .map((a) => {
      const staff = staffById.get(a.staff_id);
      if (!staff) {
        return a.name;
      }
      return [staff.civility?.trim(), staff.name, staff.surname?.trim()].filter(Boolean).join(" ");
    })
    .join(" / ");

const FillRateClassManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const [language] = useLanguage();
  const t = fillRateClassManagerTranslations[language];
  const schoolHeader = useSchoolHeader();
  const showToast = useToast();
  const [isPrintingAll, setIsPrintingAll] = useState(false);

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [cells, setCells] = useState<FillRateCell[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [subjects, setSubjects] = useState<SubjectClasseRow[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [selectedSequence, setSelectedSequence] = useState(SEQUENCES[0]);
  const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);

  const isLevelApc = (level: number): boolean => apcLevels.get(level) === true;
  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const isApc = selectedClasse ? isLevelApc(selectedClasse.level) : false;

  const load = async () => {
    setIsLoadingClasses(true);
    const [classeList, apcLevelList, nonApcRows, apcRows] = await Promise.all([
      ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
      ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      MarkReader.fetchFillRateNonApc(accessToken, connection, schoolYear, section),
      MarkReader.fetchFillRateApc(accessToken, connection, schoolYear, section),
    ]);
    const levelMap = new Map(apcLevelList.map((entry) => [entry.level, entry.activated]));
    setClasses(classeList);
    setApcLevels(levelMap);
    setCells(
      mergeToUnifiedCells(section, nonApcRows, apcRows, (level) => levelMap.get(level) === true),
    );
    setSelectedClasseId((prev) => {
      if (prev !== null && classeList.some((c) => c.classe_id === prev)) {
        return prev;
      }
      return classeList.length > 0 ? classeList[0].classe_id : null;
    });
    setIsLoadingClasses(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    const loadSubjects = async () => {
      if (selectedClasseId === null) {
        setSubjects([]);
        return;
      }
      setIsLoadingSubjects(true);
      const subjectList = await SubjectReader.fetchSubjectsOfClasse(
        accessToken,
        connection,
        schoolYear,
        section,
        selectedClasseId,
      );
      setSubjects(subjectList);
      setIsLoadingSubjects(false);
    };
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  // Every subject's rate for the selected classe/term(/sequence for non-APC) - a plain lookup over
  // the already-fetched `cells`, not a new network call per subject switch.
  const ratesBySubject = new Map<number, number | null>(
    cells
      .filter(
        (c) =>
          c.classe_id === selectedClasseId &&
          c.term === selectedTerm &&
          (isApc || c.sequence === selectedSequence),
      )
      .map((c) => [c.subject_id, c.rate]),
  );

  const handleExportPdf = async () => {
    const classeName = selectedClasse?.classe_name ?? "";
    const [attributions, staffList] = await Promise.all([
      StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
      StaffReader.fetchStaff(accessToken, connection, schoolYear),
    ]);
    const staffById = new Map(staffList.map((st) => [st.staff_id, st]));
    await exportRowsToPdf(
      t.pdfTitle(classeName),
      buildTimestampedFilename(t.pdfTitle(classeName), [], "pdf"),
      [
        { header: t.pdfColIndex, accessor: (_row: SubjectClasseRow, index: number) => index + 1 },
        { header: t.pdfColSubject, accessor: (row: SubjectClasseRow) => row.subject_title },
        {
          header: t.pdfColTeacher,
          accessor: (row: SubjectClasseRow) =>
            teachersOf(attributions, staffById, selectedClasseId ?? 0, row.subject_id),
        },
        {
          header: t.pdfColRate,
          accessor: (row: SubjectClasseRow) => {
            const rate = ratesBySubject.get(row.subject_id);
            return rate === null || rate === undefined ? "…" : rate.toFixed(1);
          },
        },
      ],
      subjects,
      schoolHeader,
    );
  };

  // "Imprimer tout" - same per-subject rates as the single-classe PDF, for every classe of the
  // section at once, for the selected term and sequence (APC classes ignore the sequence, like the
  // on-screen list). Rates come from the already-fetched whole-section `cells`; only each classe's
  // subject list needs fetching, with bounded concurrency (see CLAUDE.md on the remote DB limit).
  const handlePrintAll = async () => {
    setIsPrintingAll(true);
    const [attributions, staffList] = await Promise.all([
      StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
      StaffReader.fetchStaff(accessToken, connection, schoolYear),
    ]);
    const staffById = new Map(staffList.map((st) => [st.staff_id, st]));
    const subjectsPerClasse = await mapWithConcurrency(classes, DEFAULT_REPORT_CONCURRENCY, (classe) =>
      SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classe.classe_id),
    );
    interface PrintRow {
      subject: string;
      teacher: string;
      rate: string;
    }
    // One table per classe, each preceded by a "Classe: <name>" label.
    const groups: PdfRowGroup<PrintRow>[] = [];
    classes.forEach((classe, i) => {
      const apc = isLevelApc(classe.level);
      const rates = new Map<number, number | null>(
        cells
          .filter(
            (c) =>
              c.classe_id === classe.classe_id &&
              c.term === selectedTerm &&
              (apc || c.sequence === selectedSequence),
          )
          .map((c) => [c.subject_id, c.rate]),
      );
      const rows = subjectsPerClasse[i].map((subject) => {
        const rate = rates.get(subject.subject_id);
        return {
          subject: subject.subject_title,
          teacher: teachersOf(attributions, staffById, classe.classe_id, subject.subject_id),
          rate: rate === null || rate === undefined ? "…" : rate.toFixed(1),
        };
      });
      if (rows.length > 0) {
        const master = classe.classe_master_name
          ? withCivility(classe.classe_master_civility, classe.classe_master_name)
          : "";
        groups.push({
          title: `${t.pdfColClasse}: ${classe.classe_name}${master ? ` (Prof. P. ${master})` : ""}`,
          rows,
        });
      }
    });
    if (groups.length === 0) {
      setIsPrintingAll(false);
      showToast(t.printAllEmpty, { type: "warning" });
      return;
    }
    const title = t.printAllTitle(selectedTerm, selectedSequence);
    await exportLabeledTablesToPdf(
      title,
      buildTimestampedFilename(title, [], "pdf"),
      [
        { header: t.pdfColIndex, accessor: (_row: PrintRow, index: number) => index + 1 },
        { header: t.pdfColSubject, accessor: (row: PrintRow) => row.subject },
        { header: t.pdfColTeacher, accessor: (row: PrintRow) => row.teacher },
        { header: t.pdfColRate, accessor: (row: PrintRow) => row.rate },
      ],
      groups,
      schoolHeader,
    );
    setIsPrintingAll(false);
  };

  return (
    <div className="page-shell">
      {isPrintingAll && <LoadingOverlay />}
      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>

      {isLoadingClasses ? (
        <TableSkeleton rows={6} columns={2} showToolbar={false} />
      ) : classes.length === 0 ? (
        <p className="empty-state">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="surface-card p-4 flex flex-wrap items-center gap-2 mb-6">
            <label className="font-medium">{t.classeLabel}</label>
            <select
              className="select w-48"
              title={t.classeSelectTooltip}
              value={selectedClasseId ?? ""}
              onChange={(e) => setSelectedClasseId(Number(e.target.value))}
            >
              {classes.map((c) => (
                <option key={c.classe_id} value={c.classe_id}>
                  {c.classe_name}
                </option>
              ))}
            </select>

            <label className="font-medium ml-2">{t.termLabel}</label>
            <select
              className="select w-36"
              title={t.termSelectTooltip}
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(Number(e.target.value))}
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {t.term(term)}
                </option>
              ))}
            </select>

            {!isApc && (
              <>
                <label className="font-medium ml-2">{t.sequenceLabel}</label>
                <select
                  className="select w-36"
                  title={t.sequenceSelectTooltip}
                  value={selectedSequence}
                  onChange={(e) => setSelectedSequence(Number(e.target.value))}
                >
                  {SEQUENCES.map((seq) => (
                    <option key={seq} value={seq}>
                      {t.sequence(seq)}
                    </option>
                  ))}
                </select>
              </>
            )}

            <button type="button" className="btn btn-neutral btn-sm gap-2 ml-2" onClick={load}>
              <RefreshCw className="w-4 h-4" />
              {t.refreshBtn}
            </button>

            <div className="tooltip" data-tip={t.printAllTooltip}>
              <button type="button" className="btn btn-neutral btn-sm gap-2" onClick={handlePrintAll}>
                <Printer className="w-4 h-4" />
                {t.printAllBtn}
              </button>
            </div>
          </div>

          {!isLoadingSubjects && subjects.length === 0 && (
            <p className="empty-state">{t.emptySubjects}</p>
          )}

          {subjects.length > 0 && (
            <div className="max-w-xl surface-card p-4 md:p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-medium">{t.panelTitle(selectedClasse?.classe_name ?? "")}</h2>
                <div className="flex gap-1 shrink-0">
                  <div className="tooltip" data-tip={t.exportPdfTooltip}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle"
                      onClick={handleExportPdf}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="tooltip" data-tip={t.chartTooltip}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle"
                      onClick={() => setIsChartDialogOpen(true)}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              {isLoadingSubjects ? (
                <ul className="space-y-1" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <li key={i}>
                      <div className="skeleton h-4 w-full rounded"></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1">
                  {subjects.map((subject, index) => {
                    const rate = ratesBySubject.get(subject.subject_id);
                    return (
                      <li key={subject.subject_id} className="flex justify-between gap-2">
                        <span>
                          {index + 1} - {subject.subject_title}
                        </span>
                        <strong
                          className={rate !== null && rate !== undefined && rate < 100 ? "text-error" : ""}
                        >
                          {rate === null || rate === undefined ? "…" : rate.toFixed(1)}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <FillRateChartDialog
        isOpen={isChartDialogOpen}
        onClose={() => setIsChartDialogOpen(false)}
        title={t.chartTitle(selectedClasse?.classe_name ?? "")}
        entries={subjects.map((s) => ({
          id: s.subject_id,
          label: s.subject_title,
          rate: ratesBySubject.get(s.subject_id) ?? null,
        }))}
      />
    </div>
  );
};

export default FillRateClassManager;
