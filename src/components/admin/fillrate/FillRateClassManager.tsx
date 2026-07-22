import { useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useLanguage } from "../../../i18n/useLanguage";
import { fillRateClassManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import { MarkReader } from "../../../dbmanger/MarkReader";
import type { Classe } from "../../../interfaces/Classe";
import type { SubjectClasseRow } from "../../../interfaces/SubjectClasseRow";
import { mergeToUnifiedCells, type FillRateCell } from "../../../utils/fillRateAggregation";
import { buildTimestampedFilename, exportRowsToPdf } from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import Loading from "../../sharedcomp/Loading";
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
const FillRateClassManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const [language] = useLanguage();
  const t = fillRateClassManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

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
    await exportRowsToPdf(
      t.pdfTitle(classeName),
      buildTimestampedFilename(t.pdfTitle(classeName), [], "pdf"),
      [
        { header: t.pdfColIndex, accessor: (_row: SubjectClasseRow, index: number) => index + 1 },
        { header: t.pdfColSubject, accessor: (row: SubjectClasseRow) => row.subject_title },
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

  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
      </div>

      {isLoadingClasses ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="surface-card p-4 flex flex-wrap items-center gap-2 mb-6">
            <label className="font-medium">{t.classeLabel}</label>
            <select
              className="select w-48"
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
                <Loading />
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
