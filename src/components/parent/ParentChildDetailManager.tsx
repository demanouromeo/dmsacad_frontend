import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { parentPortalTranslations } from "../../i18n/translations";
import { useSchoolHeader } from "../../hooks/useSchoolHeader";
import { StudParentReader } from "../../dbmanger/StudParentReader";
import { ClasseReader } from "../../dbmanger/ClasseReader";
import type { ParentChild } from "../../interfaces/StudParent";
import type { ReportCardDiscipline } from "../../interfaces/ReportCard";
import {
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../../utils/reportCard/loadAnnualReportCardData";
import { buildTimestampedFilename } from "../../utils/exportData";
import { exportChildDetailsPdf } from "../../utils/parentPortal/exportChildDetailsPdf";
import Loading from "../sharedcomp/Loading";
import MarksChartDialog, { type MarksChartEntry } from "./MarksChartDialog";

const TERMS = [1, 2, 3];

type Tab = "term" | "annual";

// A common, lightweight per-subject shape derived from either AnnualStudentData (non-APC, `notes`
// has 6 entries - one per dbsequence) or AnnualStudentDataApc (`notes` has 3 entries - one per
// term average, already computed) - keeps the table/chart/PDF export working off one shape instead
// of branching APC/non-APC in three places.
interface SubjectRow {
  subjectId: number;
  subjectTitle: string;
  coef: number;
  notes: (number | null)[];
  annualAvg: number | null;
}

interface LoadedChild {
  isApc: boolean;
  avgAnnual: number;
  isAnnualAvgEmpty: boolean;
  rangAnnuel: number | null;
  disciplineAnnual: ReportCardDiscipline;
  // Only meaningful for non-APC (per-term breakdown) - null for APC, which exposes no per-term
  // discipline split, only the annual total.
  disciplineByTerm: (ReportCardDiscipline | null)[];
  subjects: SubjectRow[];
}

const computeWeightedAverage = (rows: { coef: number; note: number | null }[]): number | null => {
  let weighted = 0;
  let coefSum = 0;
  rows.forEach(({ coef, note }) => {
    if (note !== null) {
      weighted += note * coef;
      coefSum += coef;
    }
  });
  return coefSum > 0 ? weighted / coefSum : null;
};

const disciplineRows = (
  d: ReportCardDiscipline,
  t: (typeof parentPortalTranslations)["fr"],
): { label: string; value: number }[] => [
  { label: t.disciplineAbsNonJust, value: d.absNonJust },
  { label: t.disciplineAbsJust, value: d.absJust },
  { label: t.disciplineLateness, value: d.lateness },
  { label: t.disciplineConsigne, value: d.consigne },
  { label: t.disciplineAvertissement, value: d.avertissement },
  { label: t.disciplineBlame, value: d.blame },
  { label: t.disciplineExclusionJours, value: d.exclusionJours },
  { label: t.disciplineExclusionDefinitive, value: d.exclusionDefinitive },
];

// Read-only detail screen for one of the connected parent's children - term/annual marks (tabular +
// graphical) and discipline, plus a PDF export. Reuses the exact same annual report-card compute
// pipeline (loadAnnualReportCardDataForClasse/Apc) that already powers ADMIN's report-card printing
// and the Promotion module, filtered down to this one student - no new marks/discipline aggregation
// endpoint. Strictly no save/edit control anywhere: parents cannot edit student details or marks.
const ParentChildDetailManager = () => {
  const { studId } = useParams<{ studId: string }>();
  const { connection, schoolYear, accessToken, authPayload } = useAuth();
  const [language] = useLanguage();
  const t = parentPortalTranslations[language];
  const schoolHeader = useSchoolHeader();
  const navigate = useNavigate();

  const [child, setChild] = useState<ParentChild | null>(null);
  const [loadedChild, setLoadedChild] = useState<LoadedChild | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("term");
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);
  const [isChartOpen, setIsChartOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!authPayload || !studId) {
        return;
      }
      setIsLoading(true);
      setLoadedChild(null);
      const children = await StudParentReader.fetchChildrenOfParent(
        accessToken,
        connection,
        schoolYear,
        authPayload.user_id,
      );
      const found = children.find((c) => c.stud_id === Number(studId)) ?? null;
      setChild(found);
      if (!found) {
        setIsLoading(false);
        return;
      }
      const [classes, apcLevels] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, found.section_name),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, found.section_name),
      ]);
      const isApc = apcLevels.some((l) => l.level === found.level && l.activated);

      if (isApc) {
        const data = await loadAnnualApcReportCardDataForClasse({
          accessToken,
          connection,
          schoolYear,
          section: found.section_name,
          classes,
          schoolHeader,
          language,
          classeId: found.classe_id,
        });
        const row = data.students.find((s) => s.studId === found.stud_id);
        setLoadedChild(
          row
            ? {
                isApc: true,
                avgAnnual: row.avgAnnual,
                isAnnualAvgEmpty: row.isAnnualAvgEmpty,
                rangAnnuel: row.rangAnnuel,
                disciplineAnnual: row.disciplineAnnual,
                disciplineByTerm: [null, null, null],
                subjects: row.subjects.map((s) => ({
                  subjectId: s.subjectId,
                  subjectTitle: s.subjectTitle,
                  coef: s.coef,
                  notes: s.notes,
                  annualAvg: s.moy,
                })),
              }
            : null,
        );
      } else {
        const data = await loadAnnualReportCardDataForClasse({
          accessToken,
          connection,
          schoolYear,
          section: found.section_name,
          classes,
          schoolHeader,
          language,
          classeId: found.classe_id,
        });
        const row = data.students.find((s) => s.studId === found.stud_id);
        setLoadedChild(
          row
            ? {
                isApc: false,
                avgAnnual: row.avgAnnual,
                isAnnualAvgEmpty: row.isAnnualAvgEmpty,
                rangAnnuel: row.rangAnnuel,
                disciplineAnnual: row.disciplineAnnual,
                disciplineByTerm: row.disciplineByTerm,
                subjects: row.subjects.map((s) => ({
                  subjectId: s.subjectId,
                  subjectTitle: s.subjectTitle,
                  coef: s.coef,
                  notes: s.notes,
                  annualAvg: s.moy,
                })),
              }
            : null,
        );
      }
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, authPayload, studId]);

  const childName = child ? `${child.name} ${child.surname ?? ""}`.trim() : t.detailTitleFallback;

  // Term tab: non-APC slices the term's 2 sequences out of the 6-entry `notes` and averages them;
  // APC's `notes[term-1]` is already the per-term subject average, used directly. Annual tab uses
  // `annualAvg` regardless of kind.
  const subjectRowsForTab = useMemo(() => {
    if (!loadedChild) {
      return [] as { id: number; label: string; coef: number; seq1: number | null; seq2: number | null; value: number | null }[];
    }
    return loadedChild.subjects.map((s) => {
      if (tab === "annual") {
        return { id: s.subjectId, label: s.subjectTitle, coef: s.coef, seq1: null, seq2: null, value: s.annualAvg };
      }
      if (loadedChild.isApc) {
        return {
          id: s.subjectId,
          label: s.subjectTitle,
          coef: s.coef,
          seq1: null,
          seq2: null,
          value: s.notes[selectedTerm - 1] ?? null,
        };
      }
      const seq1 = s.notes[(selectedTerm - 1) * 2] ?? null;
      const seq2 = s.notes[(selectedTerm - 1) * 2 + 1] ?? null;
      const values = [seq1, seq2].filter((v): v is number => v !== null);
      const value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return { id: s.subjectId, label: s.subjectTitle, coef: s.coef, seq1, seq2, value };
    });
  }, [loadedChild, tab, selectedTerm]);

  const chartEntries: MarksChartEntry[] = useMemo(
    () => subjectRowsForTab.map((s) => ({ id: s.id, label: s.label, mark: s.value })),
    [subjectRowsForTab],
  );

  const termOverallAverage = useMemo(
    () => computeWeightedAverage(subjectRowsForTab.map((s) => ({ coef: s.coef, note: s.value }))),
    [subjectRowsForTab],
  );

  const activeDiscipline: ReportCardDiscipline | null = !loadedChild
    ? null
    : tab === "annual"
      ? loadedChild.disciplineAnnual
      : loadedChild.disciplineByTerm[selectedTerm - 1];

  const handleExportPdf = async () => {
    if (!child || !loadedChild) {
      return;
    }
    if (tab === "term") {
      const tableHead = loadedChild.isApc
        ? [t.subjectHeader, t.subjectAvgHeader]
        : [t.subjectHeader, t.sequence1Header, t.sequence2Header, t.subjectAvgHeader];
      const tableBody = subjectRowsForTab.map((s) =>
        loadedChild.isApc
          ? [s.label, s.value === null ? "" : s.value.toFixed(2)]
          : [
              s.label,
              s.seq1 === null ? "" : s.seq1.toFixed(2),
              s.seq2 === null ? "" : s.seq2.toFixed(2),
              s.value === null ? "" : s.value.toFixed(2),
            ],
      );
      await exportChildDetailsPdf(
        schoolHeader,
        childName,
        child.matricule,
        child.classe_name,
        {
          headerLine: t.term(selectedTerm).toUpperCase(),
          tableHead,
          tableBody,
          overallAverageLine: `${t.termAvgLabel} ${
            termOverallAverage === null ? "-" : termOverallAverage.toFixed(2)
          }/20`,
          disciplineRows: activeDiscipline ? disciplineRows(activeDiscipline, t) : [],
        },
        buildTimestampedFilename(`${childName} - ${t.term(selectedTerm)}`, [], "pdf"),
      );
    } else {
      const tableBody = subjectRowsForTab.map((s) => [s.label, s.value === null ? "" : s.value.toFixed(2)]);
      await exportChildDetailsPdf(
        schoolHeader,
        childName,
        child.matricule,
        child.classe_name,
        {
          headerLine: t.tabAnnual.toUpperCase(),
          tableHead: [t.subjectHeader, t.annualSubjectAvgHeader],
          tableBody,
          overallAverageLine: `${t.annualAvgLabel} ${
            loadedChild.isAnnualAvgEmpty ? "-" : loadedChild.avgAnnual.toFixed(2)
          }/20`,
          disciplineRows: disciplineRows(loadedChild.disciplineAnnual, t),
        },
        buildTimestampedFilename(`${childName} - ${t.tabAnnual}`, [], "pdf"),
      );
    }
  };

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-2"
          onClick={() => navigate("/parent/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" />
          {t.backBtn}
        </button>
        <h1 className="page-title">{childName}</h1>
      </div>

      {isLoading ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : !child ? (
        <div className="surface-card py-16">
          <p className="empty-state">{t.dashboardEmpty}</p>
        </div>
      ) : (
        <>
          <p className="opacity-60 mb-4">
            {t.classeLabel} {child.classe_name}
          </p>

          <div className="join mb-4">
            <button
              type="button"
              className={`btn btn-sm join-item ${tab === "term" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setTab("term")}
            >
              {t.tabTerm}
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${tab === "annual" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setTab("annual")}
            >
              {t.tabAnnual}
            </button>
          </div>

          {!loadedChild ? (
            <div className="surface-card py-16">
              <p className="empty-state">{t.emptyMarks}</p>
            </div>
          ) : (
            <div className="surface-card p-4 md:p-5 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                {tab === "term" && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="parentTermSelect">{t.termSelectorLabel}</label>
                    <select
                      id="parentTermSelect"
                      className="select select-sm"
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(Number(e.target.value))}
                    >
                      {TERMS.map((term) => (
                        <option key={term} value={term}>
                          {t.term(term)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-2"
                    onClick={() => setIsChartOpen(true)}
                  >
                    <BarChart3 className="w-4 h-4" />
                    {t.graphBtn}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm gap-2" onClick={handleExportPdf}>
                    <Download className="w-4 h-4" />
                    {t.exportPdfBtn}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>{t.subjectHeader}</th>
                      {tab === "term" && !loadedChild.isApc && (
                        <>
                          <th>{t.sequence1Header}</th>
                          <th>{t.sequence2Header}</th>
                        </>
                      )}
                      <th>{tab === "term" ? t.subjectAvgHeader : t.annualSubjectAvgHeader}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectRowsForTab.map((s) => (
                      <tr key={s.id}>
                        <td>{s.label}</td>
                        {tab === "term" && !loadedChild.isApc && (
                          <>
                            <td>{s.seq1 === null ? "" : s.seq1.toFixed(2)}</td>
                            <td>{s.seq2 === null ? "" : s.seq2.toFixed(2)}</td>
                          </>
                        )}
                        <td>{s.value === null ? "" : s.value.toFixed(2)}</td>
                      </tr>
                    ))}
                    {subjectRowsForTab.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <p className="empty-state">{t.emptyMarks}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="font-semibold mt-4">
                {tab === "term"
                  ? `${t.termAvgLabel} ${
                      termOverallAverage === null ? "-" : termOverallAverage.toFixed(2)
                    }/20`
                  : `${t.annualAvgLabel} ${
                      loadedChild.isAnnualAvgEmpty ? "-" : loadedChild.avgAnnual.toFixed(2)
                    }/20`}
                {tab === "annual" && (
                  <>
                    {" "}
                    — {t.rankLabel}{" "}
                    {loadedChild.rangAnnuel === null ? t.rankUnclassified : loadedChild.rangAnnuel}
                  </>
                )}
              </p>

              <h3 className="font-semibold mt-6 mb-2">{t.disciplineTitle}</h3>
              {!activeDiscipline ? (
                <p className="opacity-60 text-sm">{t.emptyMarks}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra table-sm">
                    <tbody>
                      {disciplineRows(activeDiscipline, t).map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td className="text-right">{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <MarksChartDialog
            isOpen={isChartOpen}
            onClose={() => setIsChartOpen(false)}
            title={t.chartTitle}
            entries={chartEntries}
          />
        </>
      )}
    </div>
  );
};

export default ParentChildDetailManager;
