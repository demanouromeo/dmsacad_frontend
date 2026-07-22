import { useCallback, useEffect, useState } from "react";
import { Award, Printer } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { reportCardManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { SubjectReader } from "../../../dbmanger/SubjectReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { MarkReader } from "../../../dbmanger/MarkReader";
import { StaffReader } from "../../../dbmanger/StaffReader";
import { ClassifiedParamReader } from "../../../dbmanger/ClassifiedParamReader";
import { ThParamReader } from "../../../dbmanger/ThParamReader";
import { DisciplineReader } from "../../../dbmanger/DisciplineReader";
import { computeDbSequence } from "../../../utils/markSequence";
import type { Classe } from "../../../interfaces/Classe";
import type { Mark } from "../../../interfaces/Mark";
import type { Staff } from "../../../interfaces/Staff";
import type { ReportCardData } from "../../../interfaces/ReportCard";
import {
  buildReportCardData,
  computeThEligibility,
  formatRcNumber,
  type ReportCardRosterEntry,
  type ReportCardSubjectBundle,
} from "../../../utils/reportCard/reportCardCompute";
import { exportReportCardsToPdf } from "../../../utils/reportCard/exportReportCardPdf";
import { exportNonApcReportCardsToPdf } from "../../../utils/reportCard/exportReportCardNonApcPdf";
import { exportThPdf, type ThPageData } from "../../../utils/reportCard/exportThPdf";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import SearchInput from "../../sharedcomp/SearchInput";

const TERMS = [1, 2, 3];

const buildStaffLabel = (staff: Staff | undefined): string => {
  if (!staff) {
    return "";
  }
  const civility = staff.civility?.trim();
  const surname = staff.surname?.trim() || staff.name;
  return civility ? `${civility} ${surname}` : surname;
};

// "Bulletins" (Print report cards) - term RC only for this phase, both APC and non-APC classes (see
// the backend and frontend CLAUDE.md's "Classified / Not Classified (NC) parameter" section for the
// classification algorithm this reuses, and src/utils/reportCard/ for the compute + PDF layers this
// screen drives). Every classe is selectable; whether the selected classe's level is flagged APC
// (same isLevelApc/apcLevels pattern as SubjectCompetenceManager/MarkEntryManager) decides whether
// its subjects are fetched as competences (stud_comp_mark) or as the term's two sequences
// (student_subject, via MarkReader.fetchSeqMarks + computeDbSequence) - see
// ReportCardSubjectBundleApc/NonApc in reportCardCompute.ts. Annual RC is out of scope this phase
// (buttons render, disabled, "coming soon").
const ReportCardManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = reportCardManagerTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);
  const [selectedTerm, setSelectedTerm] = useState(TERMS[0]);

  const [reportCardData, setReportCardData] = useState<ReportCardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const isSelectedClasseApc = selectedClasse ? apcLevels.get(selectedClasse.level) === true : false;

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, apcLevelList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      ]);
      const levelMap = new Map(apcLevelList.map((entry) => [entry.level, entry.activated]));
      setClasses(classeList);
      setApcLevels(levelMap);
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

  // Fetches + assembles one classe's full ReportCardData for a given term - shared by the
  // single-classe load effect below and by handlePrintAllClasses, which just loops this over
  // every classe of the section instead of only the currently selected one.
  const loadReportCardDataForClasse = useCallback(
    async (classeId: number, term: number, isApc: boolean) => {
      const [
        studentsRaw,
        studentClasseRaw,
        subjectsRaw,
        attributions,
        staffList,
        classifiedParam,
        thParam,
        disciplineRows,
      ] = await Promise.all([
        StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
        SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
        StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
        StaffReader.fetchStaff(accessToken, connection, schoolYear),
        ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
        ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear),
        DisciplineReader.fetchDisciplineOfClasse(accessToken, connection, schoolYear, term, classeId),
      ]);

      const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      const roster: ReportCardRosterEntry[] = studentsRaw.map((s) => ({
        stud_id: s.stud_id,
        matricule: s.matricule,
        name: s.name,
        surname: s.surname,
        bday: s.bday,
        bplace: s.bplace,
        sexe: s.sexe,
        repeating: infoByStudId.get(s.stud_id)?.repeating ?? s.repeating,
      }));

      // Reference RCs list matières in ascending alphabetical order, not the classe-assignment
      // order fetchSubjectsOfClasse returns them in.
      const subjectsSorted = [...subjectsRaw].sort((a, b) =>
        a.subject_title.localeCompare(b.subject_title, "fr", { sensitivity: "base" }),
      );

      const staffById = new Map(staffList.map((s) => [s.staff_id, s]));
      const findStaffLabel = (subjectId: number) => {
        const attribution = attributions.find(
          (a) => a.subject_id === subjectId && a.classe_id === classeId,
        );
        return attribution ? buildStaffLabel(staffById.get(attribution.staff_id)) : "";
      };

      let subjectsData: ReportCardSubjectBundle[];
      if (isApc) {
        const withCompetences = await Promise.all(
          subjectsSorted.map(async (subject) => ({
            subject,
            competences: await SubjectReader.fetchCompetences(
              accessToken,
              connection,
              schoolYear,
              section,
              classeId,
              subject.subject_id,
              term,
            ),
          })),
        );
        // A subject with zero competences defined for this term is skipped entirely - same
        // "apcHasNoCompetence" precedent as MarkEntryManager's own whole-section export.
        subjectsData = await Promise.all(
          withCompetences
            .filter(({ competences }) => competences.length > 0)
            .map(async ({ subject, competences }) => {
              const marksByCompetence = new Map<number, Map<number, Mark>>();
              await Promise.all(
                competences.map(async (comp) => {
                  const marks = await MarkReader.fetchCompMarks(
                    accessToken,
                    connection,
                    schoolYear,
                    classeId,
                    subject.subject_id,
                    term,
                    comp.subject_competence_id,
                  );
                  marksByCompetence.set(
                    comp.subject_competence_id,
                    new Map(marks.map((m) => [m.stud_id, m])),
                  );
                }),
              );
              return {
                kind: "apc" as const,
                subject,
                competences,
                marksByCompetence,
                staffLabel: findStaffLabel(subject.subject_id),
              };
            }),
        );
      } else {
        // Non-APC: each subject's marks live in student_subject, keyed by dbsequence - both
        // sequences of the selected term feed the subject's MOY (see computeSeqAverage), same
        // dbsequence derivation Mark entry itself uses (computeDbSequence(term, seq)).
        subjectsData = await Promise.all(
          subjectsSorted.map(async (subject) => {
            const marksBySeq = new Map<number, Map<number, Mark>>();
            await Promise.all(
              [1, 2].map(async (seq) => {
                const marks = await MarkReader.fetchSeqMarks(
                  accessToken,
                  connection,
                  schoolYear,
                  classeId,
                  subject.subject_id,
                  computeDbSequence(term, seq),
                );
                marksBySeq.set(seq, new Map(marks.map((m) => [m.stud_id, m])));
              }),
            );
            return {
              kind: "nonApc" as const,
              subject,
              marksBySeq,
              staffLabel: findStaffLabel(subject.subject_id),
            };
          }),
        );
      }

      const disciplineByStudId = new Map(disciplineRows.map((r) => [r.stud_id, r]));

      return buildReportCardData({
        roster,
        subjectsData,
        classifiedParam,
        thParam,
        disciplineByStudId,
        language,
      });
    },
    [accessToken, connection, schoolYear, section, language],
  );

  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null) {
        setReportCardData(null);
        return;
      }
      setIsLoadingData(true);
      setSelectedIds(new Set());
      const data = await loadReportCardDataForClasse(selectedClasseId, selectedTerm, isSelectedClasseApc);
      setReportCardData(data);
      setIsLoadingData(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, selectedTerm, isSelectedClasseApc]);

  const students = reportCardData?.students ?? [];
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      s.name.toLowerCase().includes(q) ||
      s.surname.toLowerCase().includes(q) ||
      s.matricule.toLowerCase().includes(q)
    );
  });

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
    const ids = filteredStudents.map((s) => s.studId);
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

  // Generates + saves one classe's PDF (APC vs non-APC branch, same exporters either way) - shared
  // by handlePrint (current classe/current selection) and handlePrintAllClasses below, which just
  // calls this once per classe of the section instead of once for the selected classe.
  const exportClasseReportCards = async (
    classe: { classe_name: string; classe_master_name: string | null },
    isApc: boolean,
    term: number,
    classeStats: ReportCardData["classeStats"],
    subset: typeof students,
  ) => {
    const filename = buildTimestampedFilename(
      `Bulletin ${classe.classe_name} TRIM${term}`,
      [`Section ${capitalizeSectionName(section)}`],
      "pdf",
    );
    const photosByStudId = new Map<number, HTMLImageElement | null>(
      await Promise.all(
        subset.map(
          async (s): Promise<[number, HTMLImageElement | null]> => [
            s.studId,
            await StudentReader.loadStudentPhotoImage(accessToken, connection, s.studId),
          ],
        ),
      ),
    );
    const classeArg = {
      classe_name: classe.classe_name,
      classe_master_name: classe.classe_master_name,
    };
    if (isApc) {
      await exportReportCardsToPdf(
        subset,
        classeStats,
        classeArg,
        term,
        schoolYear,
        schoolHeader,
        filename,
        photosByStudId,
        language,
      );
    } else {
      await exportNonApcReportCardsToPdf(
        subset,
        classeStats,
        classeArg,
        term,
        schoolYear,
        schoolHeader,
        filename,
        photosByStudId,
        language,
      );
    }
  };

  const handlePrint = async (subset: typeof students) => {
    if (!reportCardData || !selectedClasse || subset.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      await exportClasseReportCards(
        selectedClasse,
        isSelectedClasseApc,
        selectedTerm,
        reportCardData.classeStats,
        subset,
      );
      showToast(t.printSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrint(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
  };

  // Prints one PDF per classe of the current section (same load-then-export pipeline as the
  // single-classe path above, just looped sequentially - matches MarkEntryManager's own
  // whole-section export precedent of fetching one classe at a time rather than firing every
  // request at once). Classes with an empty roster for the selected term are skipped entirely.
  const handlePrintAllClasses = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    let anyPrinted = false;
    try {
      for (const classe of classes) {
        const isApc = apcLevels.get(classe.level) === true;
        const data = await loadReportCardDataForClasse(classe.classe_id, selectedTerm, isApc);
        if (data.students.length === 0) {
          continue;
        }
        anyPrinted = true;
        await exportClasseReportCards(classe, isApc, selectedTerm, data.classeStats, data.students);
      }
      if (anyPrinted) {
        showToast(t.printSuccess, { type: "info" });
      } else {
        showToast(t.printAllClassesEmpty, { type: "warning" });
      }
    } catch (error) {
      console.error("ReportCardManager.handlePrintAllClasses(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
  };

  // Whole-section "Tableau d'Honneur" (Honor Roll) certificate batch - every classe of the section,
  // APC and non-APC alike. Same load-per-classe loop as handlePrintAllClasses, but instead of one
  // PDF per classe, every eligible student (computeThEligibility(...).deserves===true - same
  // eligibility rule already reused by the RC's own "APPRÉCIATION DU TRAVAIL" thText line) becomes
  // one page of a combined document - APC and non-APC students are collected into two SEPARATE
  // page lists and exported as two separate PDFs (exportThPdf called once per kind), since the two
  // kinds use different certificate designs/backgrounds entirely (COTE vs. numeric RANG).
  const handlePrintTh = async () => {
    if (classes.length === 0) {
      showToast(t.printThEmpty, { type: "warning" });
      return;
    }
    setIsSaving(true);
    try {
      const thParam = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      if (!thParam) {
        showToast(t.printThEmpty, { type: "warning" });
        setIsSaving(false);
        return;
      }
      const apcPages: ThPageData[] = [];
      const nonApcPages: ThPageData[] = [];
      for (const classe of classes) {
        const isApc = apcLevels.get(classe.level) === true;
        const data = await loadReportCardDataForClasse(classe.classe_id, selectedTerm, isApc);
        data.students.forEach((student) => {
          const eligibility = computeThEligibility(
            thParam,
            student.discipline.absNonJust,
            student.moyenneTrim,
            student.isClassified,
          );
          if (eligibility.deserves) {
            (isApc ? apcPages : nonApcPages).push({
              student,
              classeName: classe.classe_name,
              effectif: data.classeStats.effectif,
              encouragement: eligibility.encouragement,
              felicitation: eligibility.felicitation,
            });
          }
        });
      }
      if (apcPages.length === 0 && nonApcPages.length === 0) {
        showToast(t.printThEmpty, { type: "warning" });
        setIsSaving(false);
        return;
      }
      const sectionSegment = `Section ${capitalizeSectionName(section)}`;
      if (apcPages.length > 0) {
        const filename = buildTimestampedFilename("APC TH", [sectionSegment], "pdf");
        await exportThPdf("apc", apcPages, selectedTerm, schoolHeader, thParam.val1, filename, language);
      }
      if (nonApcPages.length > 0) {
        const filename = buildTimestampedFilename("NON APC TH", [sectionSegment], "pdf");
        await exportThPdf(
          "nonApc",
          nonApcPages,
          selectedTerm,
          schoolHeader,
          thParam.val1,
          filename,
          language,
        );
      }
      showToast(t.printSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrintTh(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
  };

  const handlePrintAll = () => handlePrint(students);
  const handlePrintSelection = () => {
    if (selectedIds.size === 0) {
      showToast(t.noSelectionWarning, { type: "warning" });
      return;
    }
    handlePrint(students.filter((s) => selectedIds.has(s.studId)));
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section)}</p>
        </div>
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
                  className="select w-56"
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

              <div className="flex items-center gap-2">
                <label className="font-medium">{t.termLabel}</label>
                <select
                  className="select w-40"
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
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary gap-2"
                disabled={isLoadingData || !reportCardData || students.length === 0}
                onClick={handlePrintAll}
              >
                <Printer className="w-4 h-4" />
                {t.printBtn}
              </button>
              <button
                type="button"
                className="btn btn-outline gap-2"
                disabled={isLoadingData || !reportCardData || selectedIds.size === 0}
                onClick={handlePrintSelection}
              >
                <Printer className="w-4 h-4" />
                {t.printSelectionBtn(selectedIds.size)}
              </button>
              <button
                type="button"
                className="btn btn-secondary gap-2"
                disabled={isLoadingClasses || classes.length === 0}
                onClick={handlePrintAllClasses}
              >
                <Printer className="w-4 h-4" />
                {t.printAllClassesBtn}
              </button>
              <button
                type="button"
                className="btn btn-accent gap-2"
                disabled={classes.length === 0}
                onClick={handlePrintTh}
              >
                <Award className="w-4 h-4" />
                {t.printThBtn}
              </button>
              <button type="button" className="btn btn-disabled" disabled title={t.comingSoonTooltip}>
                {t.printAnnualBtn}
              </button>
              <button type="button" className="btn btn-disabled" disabled title={t.comingSoonTooltip}>
                {t.printSelectionAnnualBtn}
              </button>
            </div>
          </div>

          {isLoadingData ? (
            <div className="surface-card flex justify-center py-20">
              <Loading />
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <div className="table-toolbar">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t.searchPlaceholder}
                  className="input-sm w-full max-w-xs"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="table table-zebra data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) => selectedIds.has(s.studId))
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>{t.tableHeaderRang}</th>
                      <th>{t.tableHeaderName}</th>
                      <th>{t.tableHeaderMatricule}</th>
                      <th>{t.tableHeaderMoyenne}</th>
                      <th>{t.tableHeaderClassified}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.studId}>
                        <td>
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={selectedIds.has(s.studId)}
                            onChange={() => toggleSelect(s.studId)}
                          />
                        </td>
                        <td>{s.rang ?? "-"}</td>
                        <td>
                          {s.name} {s.surname}
                        </td>
                        <td>{s.matricule}</td>
                        <td>{formatRcNumber(s.moyenneTrim)}</td>
                        <td>{s.isClassified ? t.classifiedYes : t.classifiedNo}</td>
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <p className="empty-state">{t.emptyStudents}</p>
                        </td>
                      </tr>
                    )}
                    {students.length > 0 && filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6}>
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

export default ReportCardManager;
