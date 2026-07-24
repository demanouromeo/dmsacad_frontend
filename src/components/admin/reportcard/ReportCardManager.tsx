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
import { SchoolInfoReader } from "../../../dbmanger/SchoolInfoReader";
import { computeDbSequence } from "../../../utils/markSequence";
import { computeIsTechnique } from "../../../utils/schoolTypes";
import type { Classe } from "../../../interfaces/Classe";
import type { Mark } from "../../../interfaces/Mark";
import type { Staff } from "../../../interfaces/Staff";
import type { ReportCardData } from "../../../interfaces/ReportCard";
import type { AnnualReportCardData, AnnualReportCardDataApc } from "../../../interfaces/AnnualReportCard";
import {
  buildReportCardData,
  computeThEligibility,
  formatRcNumber,
  type ReportCardRosterEntry,
  type ReportCardSubjectBundle,
} from "../../../utils/reportCard/reportCardCompute";
import {
  buildAnnualReportCardData,
  buildAnnualReportCardDataApc,
  type AnnualSubjectBundle,
  type AnnualSubjectBundleApc,
} from "../../../utils/reportCard/annualReportCardCompute";
import { exportReportCardsToPdf } from "../../../utils/reportCard/exportReportCardPdf";
import { exportNonApcReportCardsToPdf } from "../../../utils/reportCard/exportReportCardNonApcPdf";
import { exportAnnualReportCardsToPdf } from "../../../utils/reportCard/exportAnnualReportCardPdf";
import { exportAnnualReportCardsApcToPdf } from "../../../utils/reportCard/exportAnnualReportCardApcPdf";
import { exportThPdf, type ThPageData } from "../../../utils/reportCard/exportThPdf";
import { exportAnnualThPdf, type AnnualThPageData } from "../../../utils/reportCard/exportThAnnualPdf";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay, {
  type LoadingOverlayProgress,
} from "../../sharedcomp/LoadingOverlay";
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

// "Bulletins" (Print report cards) - both term and annual RC, both APC and non-APC classes (see
// the backend and frontend CLAUDE.md's "Classified / Not Classified (NC) parameter" section for the
// classification algorithm this reuses, and src/utils/reportCard/ for the compute + PDF layers this
// screen drives). Every classe is selectable; whether the selected classe's level is flagged APC
// (same isLevelApc/apcLevels pattern as SubjectCompetenceManager/MarkEntryManager) decides whether
// its subjects are fetched as competences (stud_comp_mark) or as the term's two sequences
// (student_subject, via MarkReader.fetchSeqMarks + computeDbSequence) - see
// ReportCardSubjectBundleApc/NonApc in reportCardCompute.ts, and, for the annual layout,
// buildAnnualReportCardDataApc/buildAnnualReportCardData in annualReportCardCompute.ts.
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
  const [printProgress, setPrintProgress] = useState<LoadingOverlayProgress | null>(null);

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

  // Non-APC annual RC ("Bulletin Annuel") - fetches all 6 dbsequences per subject in one pass
  // (rather than 3 separate term fetches), then reuses the existing buildReportCardData 3x (once
  // per term, slicing the matching 2 sequences out of the same already-fetched data) to get each
  // term's real moyenneTrim/isClassified/rang/moyenneGenerale - see annualReportCardCompute.ts and
  // the plan's "Key findings from verification" for why this reuses rather than duplicates the
  // term algorithm.
  const loadAnnualReportCardDataForClasse = useCallback(
    async (classeId: number): Promise<AnnualReportCardData> => {
      const classe = classes.find((c) => c.classe_id === classeId);
      const [
        studentsRaw,
        studentClasseRaw,
        subjectsRaw,
        attributions,
        staffList,
        classifiedParam,
        annualParams,
      ] = await Promise.all([
        StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
        SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
        StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
        StaffReader.fetchStaff(accessToken, connection, schoolYear),
        ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
        SchoolInfoReader.fetchAnnualReportCardParams(accessToken, connection, schoolYear),
      ]);

      const studentClasseByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      const roster: ReportCardRosterEntry[] = studentsRaw.map((s) => ({
        stud_id: s.stud_id,
        matricule: s.matricule,
        name: s.name,
        surname: s.surname,
        bday: s.bday,
        bplace: s.bplace,
        sexe: s.sexe,
        repeating: studentClasseByStudId.get(s.stud_id)?.repeating ?? s.repeating,
      }));

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

      // One subject's whole-year marks, all 6 dbsequences at once.
      const subjectsData: AnnualSubjectBundle[] = await Promise.all(
        subjectsSorted.map(async (subject) => {
          const marksBySeq = new Map<number, Map<number, Mark>>();
          await Promise.all(
            [1, 2, 3, 4, 5, 6].map(async (dbsequence) => {
              const marks = await MarkReader.fetchSeqMarks(
                accessToken,
                connection,
                schoolYear,
                classeId,
                subject.subject_id,
                dbsequence,
              );
              marksBySeq.set(dbsequence, new Map(marks.map((m) => [m.stud_id, m])));
            }),
          );
          return { subject, staffLabel: findStaffLabel(subject.subject_id), marksBySeq };
        }),
      );

      // Term 1/2/3 full ReportCardData - sliced from the already-fetched 6-sequence data (no
      // refetch), each term's own discipline fetched separately.
      const termsData = (await Promise.all(
        [1, 2, 3].map(async (term) => {
          const disciplineRows = await DisciplineReader.fetchDisciplineOfClasse(
            accessToken,
            connection,
            schoolYear,
            term,
            classeId,
          );
          const disciplineByStudId = new Map(disciplineRows.map((r) => [r.stud_id, r]));
          const bundlesForTerm: ReportCardSubjectBundle[] = subjectsData.map((bundle) => ({
            kind: "nonApc" as const,
            subject: bundle.subject,
            staffLabel: bundle.staffLabel,
            marksBySeq: new Map([
              [1, bundle.marksBySeq.get(computeDbSequence(term, 1)) ?? new Map()],
              [2, bundle.marksBySeq.get(computeDbSequence(term, 2)) ?? new Map()],
            ]),
          }));
          return buildReportCardData({
            roster,
            subjectsData: bundlesForTerm,
            classifiedParam,
            thParam: null,
            disciplineByStudId,
            language,
          });
        }),
      )) as [ReportCardData, ReportCardData, ReportCardData];

      const classeNameById = new Map(classes.map((c) => [c.classe_id, c.classe_name]));

      return buildAnnualReportCardData({
        roster,
        subjectsData,
        termsData,
        classifiedParam,
        studentClasseByStudId,
        classe: {
          level: classe?.level ?? 0,
          avgDismissalTh: classe?.avgDismissalTh ?? 7.5,
          repeatUB: classe?.repeatUB ?? 9,
          totalAbsTh: classe?.totalAbsTh ?? 40,
          totalExclusionTh: classe?.totalExclusionTh ?? 8,
        },
        isTechnique: computeIsTechnique(schoolHeader.config?.type ?? ""),
        computationMethod: annualParams?.computationMethod ?? null,
        affichagePromotion: annualParams?.affichagePromotion === 1,
        classeNameById,
        language,
      });
    },
    [accessToken, connection, schoolYear, section, classes, schoolHeader, language],
  );

  // APC annual RC ("Bulletin Annuel") - unlike non-APC's single 6-dbsequence bulk fetch, APC
  // competences are scoped per term_id with no equivalent linear numbering, so each subject's
  // competences/marks are fetched once per term (3x) - same per-subject Promise.all shape
  // loadReportCardDataForClasse's own APC branch already uses, just without its
  // zero-competence-this-term filter (see the plan's finding #6: a term missing competences for a
  // subject naturally yields a null term average via computeSubjectAverage, matching the spec's
  // own getStudCompTermAvg behavior, rather than dropping the subject from that term entirely).
  const loadAnnualApcReportCardDataForClasse = useCallback(
    async (classeId: number): Promise<AnnualReportCardDataApc> => {
      const classe = classes.find((c) => c.classe_id === classeId);
      const [
        studentsRaw,
        studentClasseRaw,
        subjectsRaw,
        attributions,
        staffList,
        classifiedParam,
        annualParams,
      ] = await Promise.all([
        StudentReader.fetchStudentsOfClasse(accessToken, connection, schoolYear, classeId),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classeId),
        SubjectReader.fetchSubjectsOfClasse(accessToken, connection, schoolYear, section, classeId),
        StaffReader.fetchAllAttributionsOfSection(accessToken, connection, schoolYear, section),
        StaffReader.fetchStaff(accessToken, connection, schoolYear),
        ClassifiedParamReader.fetchClassifiedParamOfYear(accessToken, connection, schoolYear),
        SchoolInfoReader.fetchAnnualReportCardParams(accessToken, connection, schoolYear),
      ]);

      const studentClasseByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      const roster: ReportCardRosterEntry[] = studentsRaw.map((s) => ({
        stud_id: s.stud_id,
        matricule: s.matricule,
        name: s.name,
        surname: s.surname,
        bday: s.bday,
        bplace: s.bplace,
        sexe: s.sexe,
        repeating: studentClasseByStudId.get(s.stud_id)?.repeating ?? s.repeating,
      }));

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

      // Each subject's competences + marks, all 3 terms.
      const subjectsData: AnnualSubjectBundleApc[] = await Promise.all(
        subjectsSorted.map(async (subject) => {
          const perTerm = await Promise.all(
            [1, 2, 3].map(async (term) => {
              const competences = await SubjectReader.fetchCompetences(
                accessToken,
                connection,
                schoolYear,
                section,
                classeId,
                subject.subject_id,
                term,
              );
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
              return { competences, marksByCompetence };
            }),
          );
          return {
            subject,
            staffLabel: findStaffLabel(subject.subject_id),
            competencesByTerm: [perTerm[0].competences, perTerm[1].competences, perTerm[2].competences],
            marksByCompetenceByTerm: [
              perTerm[0].marksByCompetence,
              perTerm[1].marksByCompetence,
              perTerm[2].marksByCompetence,
            ],
          };
        }),
      );

      // Term 1/2/3 full ReportCardData, via the existing buildReportCardData with "apc" bundles -
      // sliced from the already-fetched per-term competences/marks (no refetch).
      const termsData = (await Promise.all(
        [1, 2, 3].map(async (term) => {
          const idx = term - 1;
          const disciplineRows = await DisciplineReader.fetchDisciplineOfClasse(
            accessToken,
            connection,
            schoolYear,
            term,
            classeId,
          );
          const disciplineByStudId = new Map(disciplineRows.map((r) => [r.stud_id, r]));
          const bundlesForTerm: ReportCardSubjectBundle[] = subjectsData.map((bundle) => ({
            kind: "apc" as const,
            subject: bundle.subject,
            staffLabel: bundle.staffLabel,
            competences: bundle.competencesByTerm[idx],
            marksByCompetence: bundle.marksByCompetenceByTerm[idx],
          }));
          return buildReportCardData({
            roster,
            subjectsData: bundlesForTerm,
            classifiedParam,
            thParam: null,
            disciplineByStudId,
            language,
          });
        }),
      )) as [ReportCardData, ReportCardData, ReportCardData];

      const classeNameById = new Map(classes.map((c) => [c.classe_id, c.classe_name]));

      return buildAnnualReportCardDataApc({
        roster,
        subjectsData,
        termsData,
        classifiedParam,
        studentClasseByStudId,
        classe: {
          level: classe?.level ?? 0,
          avgDismissalTh: classe?.avgDismissalTh ?? 7.5,
          repeatUB: classe?.repeatUB ?? 9,
          totalAbsTh: classe?.totalAbsTh ?? 40,
          totalExclusionTh: classe?.totalExclusionTh ?? 8,
        },
        isTechnique: computeIsTechnique(schoolHeader.config?.type ?? ""),
        computationMethod: annualParams?.computationMethod ?? null,
        affichagePromotion: annualParams?.affichagePromotion === 1,
        classeNameById,
        language,
      });
    },
    [accessToken, connection, schoolYear, section, classes, schoolHeader, language],
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

  // Loads every student's photo in parallel (same shape every photosByStudId Promise.all in this
  // file already used) while reporting progress as each one resolves - onProgress decides how that
  // maps onto the visible bar (see exportClasseReportCards/handlePrintAnnual/
  // handlePrintAllClassesAnnual for the two different ways it's used: bar tracks photos directly
  // for a single-classe print, or just updates the label under an already-classe-scoped bar for a
  // whole-section loop).
  const loadPhotosWithProgress = async (
    subset: { studId: number }[],
    onProgress: (done: number, total: number) => void,
  ): Promise<Map<number, HTMLImageElement | null>> => {
    const total = subset.length;
    if (total === 0) {
      return new Map();
    }
    let done = 0;
    onProgress(done, total);
    const entries = await Promise.all(
      subset.map(async (s): Promise<[number, HTMLImageElement | null]> => {
        const photo = await StudentReader.loadStudentPhotoImage(accessToken, connection, s.studId);
        done += 1;
        onProgress(done, total);
        return [s.studId, photo];
      }),
    );
    return new Map(entries);
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
    onPhotoProgress: (done: number, total: number) => void,
  ) => {
    const filename = buildTimestampedFilename(
      `Bulletin ${classe.classe_name} TRIM${term}`,
      [`Section ${capitalizeSectionName(section)}`],
      "pdf",
    );
    const photosByStudId = await loadPhotosWithProgress(subset, onPhotoProgress);
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
        (done, total) =>
          setPrintProgress({ current: done, total, label: t.progressLoadingPhotos }),
      );
      showToast(t.printSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrint(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
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
      const total = classes.length;
      for (let i = 0; i < classes.length; i++) {
        const classe = classes[i];
        const overall = t.progressClasse(i + 1, total, classe.classe_name);
        setPrintProgress({ current: i, total, label: t.progressLoadingData, overall });
        const isApc = apcLevels.get(classe.level) === true;
        const data = await loadReportCardDataForClasse(classe.classe_id, selectedTerm, isApc);
        if (data.students.length === 0) {
          continue;
        }
        anyPrinted = true;
        await exportClasseReportCards(
          classe,
          isApc,
          selectedTerm,
          data.classeStats,
          data.students,
          (done, photoTotal) =>
            setPrintProgress({
              current: i,
              total,
              label: t.progressLoadingPhotosDetail(done, photoTotal),
              overall,
            }),
        );
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
    setPrintProgress(null);
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
        setPrintProgress(null);
        return;
      }
      const apcPages: ThPageData[] = [];
      const nonApcPages: ThPageData[] = [];
      const total = classes.length;
      for (let i = 0; i < classes.length; i++) {
        const classe = classes[i];
        setPrintProgress({
          current: i,
          total,
          label: t.progressLoadingData,
          overall: t.progressClasse(i + 1, total, classe.classe_name),
        });
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
        setPrintProgress(null);
        return;
      }
      setPrintProgress({ current: total, total, label: t.progressGeneratingDocument });
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
      showToast(t.printThSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrintTh(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  // Whole-section ANNUAL Tableau d'Honneur batch - same "one page per deserving student, two
  // separate PDFs (APC vs non-APC)" shape as handlePrintTh, but scored on the school YEAR's own
  // annual average/rank/cote (loadAnnualReportCardDataForClasse/loadAnnualApcReportCardDataForClasse)
  // instead of one term's. A dismissed student (decision.kind === "exclu" - i.e.
  // computeMustDismiss already returned true while that student's annual data was built) never
  // deserves the annual Honor Roll even when computeThEligibility alone would otherwise qualify
  // them - an extra gate the term certificate has no equivalent of, since a student can't be
  // dismissed mid-term. Same background art (RESOLUTION100/150/200, keyed off thparam.val1) for
  // both kinds - see exportThAnnualPdf.ts.
  const handlePrintAnnualTh = async () => {
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
        setPrintProgress(null);
        return;
      }
      const apcPages: AnnualThPageData[] = [];
      const nonApcPages: AnnualThPageData[] = [];
      const total = classes.length;
      for (let i = 0; i < classes.length; i++) {
        const classe = classes[i];
        setPrintProgress({
          current: i,
          total,
          label: t.progressLoadingData,
          overall: t.progressClasse(i + 1, total, classe.classe_name),
        });
        const isApc = apcLevels.get(classe.level) === true;
        if (isApc) {
          const data = await loadAnnualApcReportCardDataForClasse(classe.classe_id);
          data.students.forEach((student) => {
            if (student.decision.kind === "exclu") {
              return;
            }
            const eligibility = computeThEligibility(
              thParam,
              student.disciplineAnnual.absNonJust,
              student.avgAnnual,
              student.isClassifiedAnnual,
            );
            if (eligibility.deserves) {
              apcPages.push({
                name: student.name,
                surname: student.surname,
                sexe: student.sexe,
                classeName: classe.classe_name,
                effectif: data.classeStats.effectif,
                avgAnnual: student.avgAnnual,
                rangAnnuel: null,
                cote: student.cote,
                encouragement: eligibility.encouragement,
                felicitation: eligibility.felicitation,
              });
            }
          });
        } else {
          const data = await loadAnnualReportCardDataForClasse(classe.classe_id);
          data.students.forEach((student) => {
            if (student.decision.kind === "exclu") {
              return;
            }
            const eligibility = computeThEligibility(
              thParam,
              student.disciplineAnnual.absNonJust,
              student.avgAnnual,
              student.isClassifiedAnnual,
            );
            if (eligibility.deserves) {
              nonApcPages.push({
                name: student.name,
                surname: student.surname,
                sexe: student.sexe,
                classeName: classe.classe_name,
                effectif: data.classeStats.effectif,
                avgAnnual: student.avgAnnual,
                rangAnnuel: student.rangAnnuel,
                cote: "",
                encouragement: eligibility.encouragement,
                felicitation: eligibility.felicitation,
              });
            }
          });
        }
      }
      if (apcPages.length === 0 && nonApcPages.length === 0) {
        showToast(t.printThEmpty, { type: "warning" });
        setIsSaving(false);
        setPrintProgress(null);
        return;
      }
      setPrintProgress({ current: total, total, label: t.progressGeneratingDocument });
      const sectionSegment = `Section ${capitalizeSectionName(section)}`;
      if (apcPages.length > 0) {
        const filename = buildTimestampedFilename("APC TH ANNUEL", [sectionSegment], "pdf");
        await exportAnnualThPdf("apc", apcPages, schoolHeader, thParam.val1, filename, language);
      }
      if (nonApcPages.length > 0) {
        const filename = buildTimestampedFilename("NON APC TH ANNUEL", [sectionSegment], "pdf");
        await exportAnnualThPdf("nonApc", nonApcPages, schoolHeader, thParam.val1, filename, language);
      }
      showToast(t.printThSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrintAnnualTh(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handlePrintAll = () => handlePrint(students);
  const handlePrintSelection = () => {
    if (selectedIds.size === 0) {
      showToast(t.noSelectionWarning, { type: "warning" });
      return;
    }
    handlePrint(students.filter((s) => selectedIds.has(s.studId)));
  };

  // Annual RC ("Bulletin Annuel") - both APC and non-APC classes, branching on
  // isSelectedClasseApc the same way exportClasseReportCards already branches for the term print
  // path. subsetStudIds null means "the whole classe roster" (mirrors handlePrintAll), otherwise
  // only those ids (mirrors handlePrintSelection), matched against the freshly-loaded annual
  // roster rather than the on-screen term `students` list (same studIds, different data shape).
  const handlePrintAnnual = async (subsetStudIds: Set<number> | null) => {
    if (!selectedClasse) {
      return;
    }
    setIsSaving(true);
    try {
      const filename = buildTimestampedFilename(
        `Bulletin ANNUEL ${selectedClasse.classe_name}`,
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      );
      const classeArg = {
        classe_name: selectedClasse.classe_name,
        classe_master_name: selectedClasse.classe_master_name,
      };
      if (isSelectedClasseApc) {
        const data = await loadAnnualApcReportCardDataForClasse(selectedClasse.classe_id);
        const subset = subsetStudIds
          ? data.students.filter((s) => subsetStudIds.has(s.studId))
          : data.students;
        if (subset.length === 0) {
          showToast(t.emptyStudents, { type: "warning" });
          setIsSaving(false);
          setPrintProgress(null);
          return;
        }
        const photosByStudId = await loadPhotosWithProgress(subset, (done, total) =>
          setPrintProgress({ current: done, total, label: t.progressLoadingPhotos }),
        );
        await exportAnnualReportCardsApcToPdf(
          subset,
          data.classeStats,
          classeArg,
          schoolYear,
          schoolHeader,
          filename,
          photosByStudId,
        );
      } else {
        const data = await loadAnnualReportCardDataForClasse(selectedClasse.classe_id);
        const subset = subsetStudIds
          ? data.students.filter((s) => subsetStudIds.has(s.studId))
          : data.students;
        if (subset.length === 0) {
          showToast(t.emptyStudents, { type: "warning" });
          setIsSaving(false);
          setPrintProgress(null);
          return;
        }
        const photosByStudId = await loadPhotosWithProgress(subset, (done, total) =>
          setPrintProgress({ current: done, total, label: t.progressLoadingPhotos }),
        );
        await exportAnnualReportCardsToPdf(
          subset,
          data.classeStats,
          classeArg,
          schoolYear,
          schoolHeader,
          filename,
          photosByStudId,
        );
      }
      showToast(t.printSuccess, { type: "info" });
    } catch (error) {
      console.error("ReportCardManager.handlePrintAnnual(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  const handlePrintAllAnnual = () => handlePrintAnnual(null);
  const handlePrintSelectionAnnual = () => {
    if (selectedIds.size === 0) {
      showToast(t.noSelectionWarning, { type: "warning" });
      return;
    }
    handlePrintAnnual(selectedIds);
  };

  // Prints one annual PDF per classe of the current section - same load-then-export-then-loop
  // shape as handlePrintAllClasses (term RC), but for the annual "Bulletin Annuel", branching
  // APC vs non-APC per classe the same way handlePrintAnnual already does for the single-classe
  // path. Classes with an empty annual roster are skipped entirely.
  const handlePrintAllClassesAnnual = async () => {
    if (classes.length === 0) {
      return;
    }
    setIsSaving(true);
    let anyPrinted = false;
    try {
      const total = classes.length;
      for (let i = 0; i < classes.length; i++) {
        const classe = classes[i];
        const overall = t.progressClasse(i + 1, total, classe.classe_name);
        setPrintProgress({ current: i, total, label: t.progressLoadingData, overall });
        const isApc = apcLevels.get(classe.level) === true;
        const classeArg = {
          classe_name: classe.classe_name,
          classe_master_name: classe.classe_master_name,
        };
        const filename = buildTimestampedFilename(
          `Bulletin ANNUEL ${classe.classe_name}`,
          [`Section ${capitalizeSectionName(section)}`],
          "pdf",
        );
        if (isApc) {
          const data = await loadAnnualApcReportCardDataForClasse(classe.classe_id);
          if (data.students.length === 0) {
            continue;
          }
          anyPrinted = true;
          const photosByStudId = await loadPhotosWithProgress(data.students, (done, photoTotal) =>
            setPrintProgress({
              current: i,
              total,
              label: t.progressLoadingPhotosDetail(done, photoTotal),
              overall,
            }),
          );
          await exportAnnualReportCardsApcToPdf(
            data.students,
            data.classeStats,
            classeArg,
            schoolYear,
            schoolHeader,
            filename,
            photosByStudId,
          );
        } else {
          const data = await loadAnnualReportCardDataForClasse(classe.classe_id);
          if (data.students.length === 0) {
            continue;
          }
          anyPrinted = true;
          const photosByStudId = await loadPhotosWithProgress(data.students, (done, photoTotal) =>
            setPrintProgress({
              current: i,
              total,
              label: t.progressLoadingPhotosDetail(done, photoTotal),
              overall,
            }),
          );
          await exportAnnualReportCardsToPdf(
            data.students,
            data.classeStats,
            classeArg,
            schoolYear,
            schoolHeader,
            filename,
            photosByStudId,
          );
        }
      }
      if (anyPrinted) {
        showToast(t.printSuccess, { type: "info" });
      } else {
        showToast(t.printAllClassesEmpty, { type: "warning" });
      }
    } catch (error) {
      console.error("ReportCardManager.handlePrintAllClassesAnnual(): Error", error);
      showToast(t.printFailure, { type: "danger" });
    }
    setIsSaving(false);
    setPrintProgress(null);
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay progress={printProgress} />}
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
              <button
                type="button"
                className="btn btn-accent gap-2"
                disabled={classes.length === 0}
                onClick={handlePrintAnnualTh}
              >
                <Award className="w-4 h-4" />
                {t.printAnnualThBtn}
              </button>
              <button
                type="button"
                className="btn btn-outline gap-2"
                disabled={isLoadingData || !reportCardData || students.length === 0}
                onClick={handlePrintAllAnnual}
              >
                <Printer className="w-4 h-4" />
                {t.printAnnualBtn}
              </button>
              <button
                type="button"
                className="btn btn-outline gap-2"
                disabled={isLoadingData || !reportCardData || selectedIds.size === 0}
                onClick={handlePrintSelectionAnnual}
              >
                <Printer className="w-4 h-4" />
                {t.printSelectionAnnualBtn(selectedIds.size)}
              </button>
              <button
                type="button"
                className="btn btn-secondary gap-2"
                disabled={isLoadingClasses || classes.length === 0}
                onClick={handlePrintAllClassesAnnual}
              >
                <Printer className="w-4 h-4" />
                {t.printAllClassesAnnualBtn}
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
