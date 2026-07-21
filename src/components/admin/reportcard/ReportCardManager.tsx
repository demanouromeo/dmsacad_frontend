import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
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
import { DisciplineReader } from "../../../dbmanger/DisciplineReader";
import { computeDbSequence } from "../../../utils/markSequence";
import type { Classe } from "../../../interfaces/Classe";
import type { Mark } from "../../../interfaces/Mark";
import type { Staff } from "../../../interfaces/Staff";
import type { ReportCardData } from "../../../interfaces/ReportCard";
import {
  buildReportCardData,
  formatRcNumber,
  type ReportCardRosterEntry,
  type ReportCardSubjectBundle,
} from "../../../utils/reportCard/reportCardCompute";
import { exportReportCardsToPdf } from "../../../utils/reportCard/exportReportCardPdf";
import { exportNonApcReportCardsToPdf } from "../../../utils/reportCard/exportReportCardNonApcPdf";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

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

  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null) {
        setReportCardData(null);
        return;
      }
      const classeId = selectedClasseId;
      const term = selectedTerm;
      const isApc = isSelectedClasseApc;
      setIsLoadingData(true);
      setSelectedIds(new Set());

      const [studentsRaw, studentClasseRaw, subjectsRaw, attributions, staffList, classifiedParam, disciplineRows] =
        await Promise.all([
          StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
          StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
          SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
          StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
          StaffReader.fetchStaff(accessToken, connection, schoolYear),
          ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
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

      setReportCardData(
        buildReportCardData({
          roster,
          subjectsData,
          classifiedParam,
          disciplineByStudId,
          language,
        }),
      );
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

  const handlePrint = async (subset: typeof students) => {
    if (!reportCardData || !selectedClasse || subset.length === 0) {
      return;
    }
    setIsSaving(true);
    const filename = buildTimestampedFilename(
      `Bulletin ${selectedClasse.classe_name} TRIM${selectedTerm}`,
      [`Section ${capitalizeSectionName(section)}`],
      "pdf",
    );
    try {
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
        classe_name: selectedClasse.classe_name,
        classe_master_name: selectedClasse.classe_master_name,
      };
      if (isSelectedClasseApc) {
        await exportReportCardsToPdf(
          subset,
          reportCardData.classeStats,
          classeArg,
          selectedTerm,
          schoolYear,
          schoolHeader,
          filename,
          photosByStudId,
          language,
        );
      } else {
        await exportNonApcReportCardsToPdf(
          subset,
          reportCardData.classeStats,
          classeArg,
          selectedTerm,
          schoolYear,
          schoolHeader,
          filename,
          photosByStudId,
          language,
        );
      }
      showToast(t.printSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrint(): Error", error);
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
    <div className="p-10 max-w-4xl mx-auto">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <p className="mb-4 opacity-70 text-sm">{t.sectionHint(section)}</p>

      {isLoadingClasses ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p className="opacity-60">{t.emptyClasses}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
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

            <label className="font-medium ml-4">{t.termLabel}</label>
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

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              className="btn btn-primary gap-2"
              disabled={!reportCardData || students.length === 0}
              onClick={handlePrintAll}
            >
              <Printer className="w-4 h-4" />
              {t.printBtn}
            </button>
            <button
              type="button"
              className="btn btn-outline gap-2"
              disabled={!reportCardData || selectedIds.size === 0}
              onClick={handlePrintSelection}
            >
              <Printer className="w-4 h-4" />
              {t.printSelectionBtn(selectedIds.size)}
            </button>
            <button type="button" className="btn btn-disabled" disabled title={t.comingSoonTooltip}>
              {t.printAnnualBtn}
            </button>
            <button type="button" className="btn btn-disabled" disabled title={t.comingSoonTooltip}>
              {t.printSelectionAnnualBtn}
            </button>
          </div>

          {isLoadingData ? (
            <Loading />
          ) : (
            <>
              <input
                type="text"
                className="input w-full max-w-2xl mb-4"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="overflow-x-auto w-full max-w-4xl mb-4">
                <table className="table w-full">
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
                        <td colSpan={6} className="text-center opacity-60">
                          {t.emptyStudents}
                        </td>
                      </tr>
                    )}
                    {students.length > 0 && filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center opacity-60">
                          {t.noSearchResults}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ReportCardManager;
