import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { insolvableManagerTranslations } from "../../../i18n/translations";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import type { Classe } from "../../../interfaces/Classe";
import {
  buildTimestampedFilename,
  exportRowsToCsv,
  exportRowsToPdf,
  type ExportColumn,
} from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import SearchInput from "../../sharedcomp/SearchInput";
import ExportButtons from "../../sharedcomp/ExportButtons";

interface InsolvableRow {
  stud_id: number;
  matricule: string | null;
  name: string;
  surname: string | null;
  // Raw student_classe.solvable1 - 0 means insolvable (hasn't paid), 1/null means solvable (paid,
  // or never marked yet - fail-open to "solvable" same as every other missing-row-means-default
  // convention in this app, e.g. classifiedparam's "no row = classify everyone").
  solvable1: number | null;
}

// "Insolvables" - toggles student_classe.solvable1 per student of a classe. Despite the column
// name, the UI (and the reference design this was built from) is framed as the *inverse*
// "Insolvable" status: solvable1=0 -> Insolvable=OUI (hasn't paid), solvable1=1/null ->
// Insolvable=NON (paid, or never marked). Classe-scoped like DisciplineManager, reusing the same
// StudentController::allStudentsOfClasse + allStudClassOfAClasse merge StudentManager/
// DisciplineManager already do (allStudentsOfClasse alone doesn't carry solvable1). Unlike
// DisciplineManager's deferred "one global Save" for its multi-field form, a single boolean status
// toggle saves immediately on change/bulk-action - same precedent as ClasseManager's per-row APC
// select (StudentController::updateSolvable already existed, unused by any screen until this one).
const InsolvableManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = insolvableManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [roster, setRoster] = useState<InsolvableRow[]>([]);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const filteredRoster = roster.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      s.name.toLowerCase().includes(q) ||
      (s.surname ?? "").toLowerCase().includes(q) ||
      (s.matricule ?? "").toLowerCase().includes(q)
    );
  });
  const insolvableCount = roster.filter((s) => s.solvable1 === 0).length;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const classeList = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(classeList);
      setSelectedClasseId((prev) => {
        if (prev !== null && classeList.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return classeList.length > 0 ? classeList[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    setSearchQuery("");
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null) {
        setRoster([]);
        return;
      }
      setIsLoadingRoster(true);
      setSelectedIds(new Set());
      const [seedRows, pivotRows] = await Promise.all([
        StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, selectedClasseId),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, selectedClasseId),
      ]);
      const pivotByStudId = new Map(pivotRows.map((p) => [p.stud_id, p]));
      setRoster(
        seedRows.map((s) => ({
          stud_id: s.stud_id,
          matricule: s.matricule,
          name: s.name,
          surname: s.surname,
          solvable1: pivotByStudId.get(s.stud_id)?.solvable1 ?? null,
        })),
      );
      setIsLoadingRoster(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId]);

  const toggleSelect = (studId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studId)) {
        next.delete(studId);
      } else {
        next.add(studId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = filteredRoster.map((s) => s.stud_id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  // Persists solvable1 for the given students immediately, then reflects it in local state on
  // success - matches ClasseManager's per-row APC select precedent (no deferred/dirty tracking for
  // a simple status toggle).
  const persistSolvable = async (studIds: number[], solvable1: number) => {
    if (selectedClasseId === null || studIds.length === 0) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.updateSolvable(
      accessToken,
      connection,
      schoolYear,
      studIds.map((stud_id) => ({ stud_id, classe_id: selectedClasseId, solvable1 })),
    );
    setIsSaving(false);
    if (result.status) {
      const studIdSet = new Set(studIds);
      setRoster((prev) =>
        prev.map((s) => (studIdSet.has(s.stud_id) ? { ...s, solvable1 } : s)),
      );
      showToast(t.updateSuccess, { type: "info" });
    } else {
      showToast(t.updateFailure, { type: "danger" });
    }
  };

  const handleRowChange = (studId: number, insolvable: boolean) => {
    persistSolvable([studId], insolvable ? 0 : 1);
  };

  const handleMarkSelected = (insolvable: boolean) => {
    if (selectedIds.size === 0) {
      showToast(t.noSelectionWarning, { type: "warning" });
      return;
    }
    persistSolvable(Array.from(selectedIds), insolvable ? 0 : 1);
  };

  const exportColumns: ExportColumn<InsolvableRow>[] = [
    { header: t.tableHeaderIndex, accessor: (_row, index) => index + 1 },
    { header: t.tableHeaderName, accessor: (row) => `${row.name} ${row.surname ?? ""}`.trim() },
    { header: t.tableHeaderMatricule, accessor: (row) => row.matricule ?? "" },
    {
      header: t.tableHeaderInsolvable,
      accessor: (row) => (row.solvable1 === 0 ? t.insolvableYes : t.insolvableNo),
    },
  ];

  const handleExportExcel = () => {
    const title = t.pdfTitle(selectedClasse?.classe_name ?? "");
    exportRowsToCsv(buildTimestampedFilename(title, [], "csv"), exportColumns, roster);
  };

  const handleExportPdf = async () => {
    const title = t.pdfTitle(selectedClasse?.classe_name ?? "");
    await exportRowsToPdf(
      title,
      buildTimestampedFilename(title, [], "pdf"),
      exportColumns,
      roster,
      schoolHeader,
    );
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay />}
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
          <div className="surface-card p-4 md:p-6 mb-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
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
              </div>

              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t.searchPlaceholder}
                className="w-64"
              />

              <ExportButtons
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPdf}
                excelLabel={t.exportExcelLabel}
                pdfLabel={t.exportPdfLabel}
                disabled={roster.length === 0}
              />
            </div>

            <p className="text-center italic opacity-70">{t.effectifTotal(roster.length)}</p>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-base-200/50 rounded-xl px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-error btn-sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => handleMarkSelected(true)}
                >
                  {t.markSelectedInsolvableBtn}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-success btn-sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => handleMarkSelected(false)}
                >
                  {t.markSelectedSolvableBtn}
                </button>
              </div>
              <span className="badge badge-error badge-outline gap-1">
                {t.statInsolvables(insolvableCount)}
              </span>
            </div>
          </div>

          {isLoadingRoster ? (
            <div className="surface-card flex justify-center py-20">
              <Loading />
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-zebra data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={
                            filteredRoster.length > 0 &&
                            filteredRoster.every((s) => selectedIds.has(s.stud_id))
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>{t.tableHeaderIndex}</th>
                      <th>{t.tableHeaderName}</th>
                      <th>{t.tableHeaderInsolvable}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.map((student, index) => (
                      <tr key={student.stud_id}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={selectedIds.has(student.stud_id)}
                            onChange={() => toggleSelect(student.stud_id)}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>
                          {student.name} {student.surname ?? ""}
                        </td>
                        <td>
                          <select
                            className="select select-sm w-24"
                            value={student.solvable1 === 0 ? "1" : "0"}
                            onChange={(e) => handleRowChange(student.stud_id, e.target.value === "1")}
                          >
                            <option value="0">{t.insolvableNo}</option>
                            <option value="1">{t.insolvableYes}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {roster.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <p className="empty-state">{t.emptyRoster}</p>
                        </td>
                      </tr>
                    )}
                    {roster.length > 0 && filteredRoster.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <p className="empty-state">{t.noSearchResults}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InsolvableManager;
