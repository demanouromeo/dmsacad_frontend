import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, RefreshCw, Undo2, HelpCircle, Wrench, Printer, XCircle } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { basculementManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { MyReader } from "../../../dbmanger/MyReader";
import { computeMaxClasseLevel } from "../../../utils/schoolTypes";
import { computeNextSchoolYear } from "../../../utils/schoolYear";
import { formatRcNumber } from "../../../utils/reportCard/reportCardCompute";
import {
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../../../utils/reportCard/loadAnnualReportCardData";
import { computeMustDismiss } from "../../../utils/reportCard/annualReportCardCompute";
import {
  exportRowsToPdf,
  buildTimestampedFilename,
  capitalizeSectionName,
  type ExportColumn,
} from "../../../utils/exportData";
import { exportProvisionalListToPdf, type ProvisionalListBlock } from "../../../utils/exportProvisionalList";
import type { Classe } from "../../../interfaces/Classe";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import SearchInput from "../../sharedcomp/SearchInput";
import iconInitBasculement from "../../../assets/compo/basculement/init_basculement.svg";

interface LeftRow {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  sexe: string;
  avgAnnual: number;
  absTotal: number;
  casSocial: number;
  isDismissed: boolean;
  // Pass-through override fields, unedited on this screen but required by updatePromotionInfo's
  // full-row upsert shape - round-tripped unchanged so this screen never clobbers Promotion's own
  // overrides for the other fields.
  isMannullalyClassified: number;
  mustRepeat: number;
  promuEn: number | null;
  codeExclusion: number;
}

interface RightRow {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  sexe: string;
  casSocial: number;
  repeating: number;
}

const sortByName = <T extends { name: string; surname: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) =>
    `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "fr", { sensitivity: "base" }),
  );

// "Gestion du basculement" - dual-panel end-of-year classe transfer screen. Left = current-year
// classe roster (source), right = next-year classe roster (destination). Reuses the same annual
// data pipeline (loadAnnualReportCardDataForClasse/Apc, computeMustDismiss) PromotionManager.tsx
// already established - computeDismiss(student, classe, year) from the product spec IS
// computeMustDismiss. The backend endpoints this screen calls (applyBasculement/removeBasculement/
// resetBasculement/cancelAllBasculement/processRedoublants/clearExclus/saveChanges, all in
// ClasseController) already existed and were already routed before this screen was built.
const BasculementManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = basculementManagerTranslations[language];
  const schoolHeader = useSchoolHeader();
  const maxLevel = computeMaxClasseLevel(schoolHeader.config?.type ?? "");
  const nextYear = useMemo(() => computeNextSchoolYear(schoolYear), [schoolYear]);
  const helpDialogRef = useRef<HTMLDialogElement>(null);

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [nextYearClasses, setNextYearClasses] = useState<Classe[]>([]);
  const [nextYearExists, setNextYearExists] = useState<boolean | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  const [selectedLeftClasseId, setSelectedLeftClasseId] = useState<number | null>(null);
  const [selectedRightClasseId, setSelectedRightClasseId] = useState<number | null>(null);

  const [leftRows, setLeftRows] = useState<LeftRow[]>([]);
  const [isLoadingLeft, setIsLoadingLeft] = useState(false);
  const [leftReloadToken, setLeftReloadToken] = useState(0);
  const [leftSelectedIds, setLeftSelectedIds] = useState<Set<number>>(new Set());
  const [leftSearch, setLeftSearch] = useState("");
  const [sortByMerit, setSortByMerit] = useState(false);

  const [rightRows, setRightRows] = useState<RightRow[]>([]);
  const [isLoadingRight, setIsLoadingRight] = useState(false);
  const [rightReloadToken, setRightReloadToken] = useState(0);
  const [rightSelectedIds, setRightSelectedIds] = useState<Set<number>>(new Set());
  const [rightSearch, setRightSearch] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const [classeList, apcLevelList] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
      ]);
      setClasses(classeList);
      setApcLevels(new Map(apcLevelList.map((entry) => [entry.level, entry.activated])));
      setSelectedLeftClasseId((prev) =>
        prev !== null && classeList.some((c) => c.classe_id === prev)
          ? prev
          : (classeList[0]?.classe_id ?? null),
      );

      if (nextYear) {
        const years = await MyReader.fetchSchoolYears(connection);
        const exists = (years ?? []).some((y) => y.year === nextYear);
        setNextYearExists(exists);
        if (exists) {
          const nyClasses = await ClasseReader.fetchClasses(accessToken, connection, nextYear, section);
          setNextYearClasses(nyClasses);
        } else {
          setNextYearClasses([]);
          showToast(t.nextYearMissing(nextYear), { type: "warning" });
        }
      } else {
        setNextYearExists(false);
        setNextYearClasses([]);
      }
      setIsLoadingClasses(false);
    };
    load();
    setLeftSearch("");
    setRightSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  const selectedLeftClasse = classes.find((c) => c.classe_id === selectedLeftClasseId) ?? null;
  const isLeftApc = selectedLeftClasse ? apcLevels.get(selectedLeftClasse.level) === true : false;

  const rightTargetClasses = useMemo(() => {
    if (!selectedLeftClasse || selectedLeftClasse.level >= maxLevel) {
      return [];
    }
    return nextYearClasses.filter((c) => c.level === selectedLeftClasse.level + 1);
  }, [nextYearClasses, selectedLeftClasse, maxLevel]);

  useEffect(() => {
    setSelectedRightClasseId((prev) =>
      prev !== null && rightTargetClasses.some((c) => c.classe_id === prev)
        ? prev
        : (rightTargetClasses[0]?.classe_id ?? null),
    );
  }, [rightTargetClasses]);

  const selectedRightClasse = nextYearClasses.find((c) => c.classe_id === selectedRightClasseId) ?? null;
  const sameLevelNextClasses = useMemo(
    () => (selectedRightClasse ? nextYearClasses.filter((c) => c.level === selectedRightClasse.level) : []),
    [nextYearClasses, selectedRightClasse],
  );

  useEffect(() => {
    const load = async () => {
      if (!selectedLeftClasseId || !selectedLeftClasse) {
        setLeftRows([]);
        return;
      }
      setIsLoadingLeft(true);
      // Clear immediately, not just at the end - handlePrintExclus (and any other reader of
      // leftRows outside the loading-gated table render) must never see the PREVIOUS classe's
      // rows/title mismatch while this classe's fetch is still in flight.
      setLeftRows([]);
      const params = {
        accessToken,
        connection,
        schoolYear,
        section,
        classes,
        schoolHeader,
        language,
        classeId: selectedLeftClasseId,
      };
      const [annualData, studentClasseRaw] = await Promise.all([
        isLeftApc ? loadAnnualApcReportCardDataForClasse(params) : loadAnnualReportCardDataForClasse(params),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, selectedLeftClasseId),
      ]);
      const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      const built: LeftRow[] = annualData.students
        .filter((s) => (infoByStudId.get(s.studId)?.basculated ?? 0) === 0)
        .map((s) => {
          const info = infoByStudId.get(s.studId);
          const { mustDismiss } = computeMustDismiss(
            info?.isMannullalyDismissed ?? 2,
            info?.codeExclusion ?? 0,
            s.disciplineAnnual.absNonJust,
            s.disciplineAnnual.exclusionJours,
            s.avgAnnual,
            selectedLeftClasse.avgDismissalTh,
            selectedLeftClasse.repeatUB,
            (info?.repeating ?? 0) === 1,
            selectedLeftClasse.totalExclusionTh,
            selectedLeftClasse.totalAbsTh,
            info?.solvable1 ?? null,
          );
          return {
            studId: s.studId,
            matricule: s.matricule,
            name: s.name,
            surname: s.surname,
            sexe: s.sexe,
            avgAnnual: s.avgAnnual,
            absTotal: s.disciplineAnnual.absNonJust + s.disciplineAnnual.exclusionJours,
            casSocial: info?.cas_social ?? 0,
            isDismissed: mustDismiss,
            isMannullalyClassified: info?.isMannullalyClassified ?? 2,
            mustRepeat: info?.mustRepeat ?? 2,
            promuEn: info?.promuEn ?? null,
            codeExclusion: info?.codeExclusion ?? 0,
          };
        });
      setLeftRows(built);
      setLeftSelectedIds(new Set());
      setIsLoadingLeft(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeftClasseId, isLeftApc, leftReloadToken]);

  useEffect(() => {
    const load = async () => {
      if (!selectedRightClasseId || !nextYear) {
        setRightRows([]);
        return;
      }
      setIsLoadingRight(true);
      const [studentsRaw, studentClasseRaw] = await Promise.all([
        StudentReader.fetchStudentsOfClasse(accessToken, connection, nextYear, selectedRightClasseId),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, nextYear, selectedRightClasseId),
      ]);
      const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      const built: RightRow[] = sortByName(
        studentsRaw.map((s) => ({
          studId: s.stud_id,
          matricule: s.matricule ?? "",
          name: s.name,
          surname: s.surname ?? "",
          sexe: s.sexe,
          casSocial: infoByStudId.get(s.stud_id)?.cas_social ?? 0,
          repeating: infoByStudId.get(s.stud_id)?.repeating ?? s.repeating,
        })),
      );
      setRightRows(built);
      setRightSelectedIds(new Set());
      setIsLoadingRight(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRightClasseId, nextYear, rightReloadToken]);

  const filteredLeftRows = useMemo(() => {
    const q = leftSearch.trim().toLowerCase();
    const rows = leftRows.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.surname.toLowerCase().includes(q) ||
        r.matricule.toLowerCase().includes(q),
    );
    return sortByMerit ? [...rows].sort((a, b) => b.avgAnnual - a.avgAnnual) : sortByName(rows);
  }, [leftRows, leftSearch, sortByMerit]);

  const filteredRightRows = useMemo(() => {
    const q = rightSearch.trim().toLowerCase();
    return rightRows.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.surname.toLowerCase().includes(q) ||
        r.matricule.toLowerCase().includes(q),
    );
  }, [rightRows, rightSearch]);

  const toggleLeftSelect = (studId: number) =>
    setLeftSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studId)) next.delete(studId);
      else next.add(studId);
      return next;
    });

  const selectableLeftIds = filteredLeftRows.filter((r) => !r.isDismissed).map((r) => r.studId);
  const toggleLeftSelectAll = () => {
    const allSelected = selectableLeftIds.length > 0 && selectableLeftIds.every((id) => leftSelectedIds.has(id));
    setLeftSelectedIds(allSelected ? new Set() : new Set(selectableLeftIds));
  };

  const toggleRightSelect = (studId: number) =>
    setRightSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studId)) next.delete(studId);
      else next.add(studId);
      return next;
    });

  const rightIds = filteredRightRows.map((r) => r.studId);
  const toggleRightSelectAll = () => {
    const allSelected = rightIds.length > 0 && rightIds.every((id) => rightSelectedIds.has(id));
    setRightSelectedIds(allSelected ? new Set() : new Set(rightIds));
  };

  const handleExclureChange = async (row: LeftRow, value: 0 | 1) => {
    const fullName = `${row.name} ${row.surname}`.trim();
    const message = value === 1 ? t.exclureConfirmOui(fullName) : t.exclureConfirmNon(fullName);
    const confirmed = await confirm(message, { danger: value === 1 });
    if (!confirmed || !selectedLeftClasseId) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.updatePromotionInfo(accessToken, connection, schoolYear, [
      {
        stud_id: row.studId,
        classe_id: selectedLeftClasseId,
        isMannullalyClassified: row.isMannullalyClassified,
        isMannullalyDismissed: value,
        mustRepeat: row.mustRepeat,
        promuEn: row.promuEn,
        codeExclusion: row.codeExclusion,
      },
    ]);
    setIsSaving(false);
    showToast(result.status ? t.exclureSuccess : t.exclureFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftReloadToken((n) => n + 1);
    }
  };

  const handleRightClasseChange = async (row: RightRow, newClasseId: number) => {
    if (newClasseId === selectedRightClasseId || !nextYear) {
      return;
    }
    const targetName = nextYearClasses.find((c) => c.classe_id === newClasseId)?.classe_name ?? "";
    const fullName = `${row.name} ${row.surname}`.trim();
    if (!(await confirm(t.classeChangeConfirmMessage(fullName, targetName)))) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.saveBasculementChanges(accessToken, connection, schoolYear, nextYear, [
      { stud_id: row.studId, promuEn: newClasseId, cas_social: row.casSocial },
    ]);
    setIsSaving(false);
    showToast(result.status ? t.classeChangeSuccess : t.classeChangeFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setRightReloadToken((n) => n + 1);
    }
  };

  const handleBasculer = async () => {
    if (!selectedLeftClasseId || !selectedRightClasseId || !selectedRightClasse || !nextYear) {
      return;
    }
    const selected = leftRows.filter((r) => leftSelectedIds.has(r.studId) && !r.isDismissed);
    if (selected.length === 0) {
      showToast(t.basculerNoneSelected, { type: "warning" });
      return;
    }
    if (!(await confirm(t.basculerConfirmMessage(selected.length, selectedRightClasse.classe_name)))) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.applyBasculement(
      accessToken,
      connection,
      schoolYear,
      nextYear,
      selectedLeftClasseId,
      selectedRightClasseId,
      selected.map((r) => ({ stud_id: r.studId, cas_social: r.casSocial })),
    );
    setIsSaving(false);
    showToast(result.status ? t.basculerSuccess : t.basculerFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftReloadToken((n) => n + 1);
      setRightReloadToken((n) => n + 1);
    }
  };

  const handleRemoveBasculement = async () => {
    if (!selectedLeftClasseId || !selectedRightClasseId || !nextYear) {
      return;
    }
    const selected = rightRows.filter((r) => rightSelectedIds.has(r.studId));
    if (selected.length === 0) {
      showToast(t.removeBasculementNoneSelected, { type: "warning" });
      return;
    }
    if (!(await confirm(t.removeBasculementConfirmMessage(selected.length), { danger: true }))) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.removeBasculement(
      accessToken,
      connection,
      schoolYear,
      nextYear,
      selectedLeftClasseId,
      selectedRightClasseId,
      selected.map((r) => ({ stud_id: r.studId })),
    );
    setIsSaving(false);
    showToast(result.status ? t.removeBasculementSuccess : t.removeBasculementFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftReloadToken((n) => n + 1);
      setRightReloadToken((n) => n + 1);
    }
  };

  const handleResetClasse = async () => {
    if (!selectedLeftClasse || !selectedLeftClasseId || !nextYear) {
      return;
    }
    if (!(await confirm(t.resetClasseConfirmMessage(selectedLeftClasse.classe_name), { danger: true }))) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.resetBasculement(
      accessToken,
      connection,
      schoolYear,
      nextYear,
      selectedLeftClasseId,
    );
    setIsSaving(false);
    showToast(result.status ? t.resetClasseSuccess : t.resetClasseFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftReloadToken((n) => n + 1);
      setRightReloadToken((n) => n + 1);
    }
  };

  const handleCancelAll = async () => {
    if (!nextYear) {
      return;
    }
    if (!(await confirm(t.cancelAllConfirmMessage, { danger: true }))) {
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.cancelAllBasculement(accessToken, connection, schoolYear, nextYear);
    setIsSaving(false);
    showToast(result.status ? t.cancelAllSuccess : t.cancelAllFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setLeftReloadToken((n) => n + 1);
      setRightReloadToken((n) => n + 1);
    }
  };

  // Init: seeds every classe of the section as repeaters-in-place for next_year, and clears any
  // next-year placeholder for dismissed students - see annualReportCardCompute.ts/computeMustDismiss
  // for what "dismissed" means here. Runs sequentially per classe (not Promise.all), same
  // "avoid firing every request at once" precedent as exportAllMarksReportToPdf's whole-section loop.
  const handleInit = async () => {
    if (!nextYear || classes.length === 0) {
      return;
    }
    if (!(await confirm(t.initConfirmMessage, { danger: true }))) {
      return;
    }
    setIsSaving(true);
    let allOk = true;
    const dismissedAll: { stud_id: number; classe_id: number }[] = [];
    for (const classe of classes) {
      const isApc = apcLevels.get(classe.level) === true;
      const params = {
        accessToken,
        connection,
        schoolYear,
        section,
        classes,
        schoolHeader,
        language,
        classeId: classe.classe_id,
      };
      const [annualData, studentClasseRaw] = await Promise.all([
        isApc ? loadAnnualApcReportCardDataForClasse(params) : loadAnnualReportCardDataForClasse(params),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, classe.classe_id),
      ]);
      const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      const redoublants: { stud_id: number; cas_social: number }[] = [];
      annualData.students.forEach((s) => {
        const info = infoByStudId.get(s.studId);
        if ((info?.basculated ?? 0) === 1) {
          return;
        }
        const { mustDismiss } = computeMustDismiss(
          info?.isMannullalyDismissed ?? 2,
          info?.codeExclusion ?? 0,
          s.disciplineAnnual.absNonJust,
          s.disciplineAnnual.exclusionJours,
          s.avgAnnual,
          classe.avgDismissalTh,
          classe.repeatUB,
          (info?.repeating ?? 0) === 1,
          classe.totalExclusionTh,
          classe.totalAbsTh,
          info?.solvable1 ?? null,
        );
        if (mustDismiss) {
          dismissedAll.push({ stud_id: s.studId, classe_id: classe.classe_id });
        } else {
          redoublants.push({ stud_id: s.studId, cas_social: info?.cas_social ?? 0 });
        }
      });
      if (redoublants.length > 0) {
        const result = await ClasseReader.processRedoublants(
          accessToken,
          connection,
          schoolYear,
          nextYear,
          classe.classe_id,
          redoublants,
        );
        if (!result.status) {
          allOk = false;
        }
      }
    }
    if (dismissedAll.length > 0) {
      const result = await ClasseReader.clearExclus(accessToken, connection, nextYear, dismissedAll);
      if (!result.status) {
        allOk = false;
      }
    }
    setIsSaving(false);
    showToast(allOk ? t.initSuccess : t.initFailure, { type: allOk ? "info" : "danger" });
    setLeftReloadToken((n) => n + 1);
    setRightReloadToken((n) => n + 1);
  };

  const handlePrintProvisoire = async () => {
    if (!nextYear || nextYearClasses.length === 0) {
      showToast(t.printEmptyProvisoire, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const blocks: ProvisionalListBlock[] = [];
    for (const classe of nextYearClasses) {
      const [studentsRaw, studentClasseRaw] = await Promise.all([
        StudentReader.fetchStudentsOfClasse(accessToken, connection, nextYear, classe.classe_id),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, nextYear, classe.classe_id),
      ]);
      if (studentsRaw.length === 0) {
        continue;
      }
      const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));
      blocks.push({
        classeName: classe.classe_name,
        rows: sortByName(
          studentsRaw.map((s) => ({
            matricule: s.matricule ?? "",
            name: s.name,
            surname: s.surname ?? "",
            sexe: s.sexe,
            repeatingLabel:
              (infoByStudId.get(s.stud_id)?.repeating ?? s.repeating) === 1 ? t.optionOui : t.optionNon,
          })),
        ),
        garcons: studentsRaw.filter((s) => s.sexe === "M").length,
        filles: studentsRaw.filter((s) => s.sexe === "F").length,
      });
    }
    setIsSaving(false);
    if (blocks.length === 0) {
      showToast(t.printEmptyProvisoire, { type: "warning" });
      return;
    }
    await exportProvisionalListToPdf(
      nextYear,
      blocks,
      schoolHeader,
      buildTimestampedFilename(t.printProvisoireTitle(nextYear), [`Section ${capitalizeSectionName(section)}`], "pdf"),
      { matricule: "Matricule", name: "Nom", surname: "Prénom", sexe: "Sexe", repeating: "Redouble" },
    );
  };

  const handlePrintExclus = async () => {
    if (!selectedLeftClasse) {
      return;
    }
    const exclus = leftRows.filter((r) => r.isDismissed);
    if (exclus.length === 0) {
      showToast(t.printEmptyExclus, { type: "warning" });
      return;
    }
    const columns: ExportColumn<LeftRow>[] = [
      { header: "Matricule", accessor: (r) => r.matricule },
      { header: "Nom", accessor: (r) => r.name },
      { header: "Prénom", accessor: (r) => r.surname },
      { header: "Sexe", accessor: (r) => r.sexe },
      { header: "Moy.", accessor: (r) => formatRcNumber(r.avgAnnual) },
      { header: "T. Abs", accessor: (r) => r.absTotal },
    ];
    const title = t.printExclusTitle(selectedLeftClasse.classe_name);
    await exportRowsToPdf(title, buildTimestampedFilename(title, [], "pdf"), columns, exclus, schoolHeader);
  };

  const nothingLoaded = isLoadingClasses && classes.length === 0;

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2"
            title={t.initBtn}
            disabled={isSaving || !nextYearExists}
            onClick={handleInit}
          >
            <img src={iconInitBasculement} alt="" className="w-7 h-7 transition-transform hover:scale-110" />
            {t.initBtn}
          </button>
          <div className="dropdown dropdown-end">
            <button type="button" tabIndex={0} className="btn btn-ghost btn-sm gap-2">
              <Wrench className="w-4 h-4" />
              {t.toolboxBtn}
            </button>
            <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box shadow z-10 w-72 p-2">
              <li>
                <button type="button" disabled={!nextYearExists} onClick={handleCancelAll}>
                  <XCircle className="w-4 h-4" />
                  {t.cancelAllBtn}
                </button>
              </li>
              <li>
                <button type="button" disabled={!nextYearExists} onClick={handlePrintProvisoire}>
                  <Printer className="w-4 h-4" />
                  {t.printProvisoireBtn}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  disabled={!selectedLeftClasse || isLoadingLeft}
                  onClick={handlePrintExclus}
                >
                  <Printer className="w-4 h-4" />
                  {t.printExclusBtn}
                </button>
              </li>
            </ul>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square"
            title={t.helpBtn}
            onClick={() => helpDialogRef.current?.showModal()}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <CloseButton />
        </div>
      </div>

      <dialog ref={helpDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">{t.helpTitle}</h3>
          <p className="py-4">{t.helpText}</p>
          <div className="modal-action">
            <form method="dialog">
              <button type="submit" className="btn">
                OK
              </button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      {nothingLoaded ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">{t.emptyClasses}</p>
      ) : (
        <>
          {nextYearExists === false && (
            <div className="alert alert-warning mb-4">
              <span>{t.nextYearMissing(nextYear ?? "")}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            {/* Left panel - current year source classe */}
            <div className="surface-card overflow-hidden">
              <div className="table-toolbar flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="font-medium">{t.leftClasseLabel}</label>
                  <select
                    className="select select-sm w-44"
                    title={t.leftClasseSelectTooltip}
                    value={selectedLeftClasseId ?? ""}
                    onChange={(e) => setSelectedLeftClasseId(Number(e.target.value))}
                  >
                    {classes.map((c) => (
                      <option key={c.classe_id} value={c.classe_id}>
                        {c.classe_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs gap-1"
                    title={selectedLeftClasse ? t.resetClasseBtn(selectedLeftClasse.classe_name) : ""}
                    disabled={isSaving || !selectedLeftClasse || !nextYearExists}
                    onClick={handleResetClasse}
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="table-toolbar flex flex-wrap items-center justify-between gap-3">
                <SearchInput
                  value={leftSearch}
                  onChange={setLeftSearch}
                  placeholder={t.searchPlaceholder}
                  className="input-sm w-full max-w-xs"
                />
                <label className="label cursor-pointer gap-2 text-sm">
                  <span>{t.sortByMeritLabel(schoolYear)}</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={sortByMerit}
                    onChange={(e) => setSortByMerit(e.target.checked)}
                  />
                </label>
              </div>
              {isLoadingLeft ? (
                <div className="flex justify-center py-16">
                  <Loading />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra data-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={
                              selectableLeftIds.length > 0 &&
                              selectableLeftIds.every((id) => leftSelectedIds.has(id))
                            }
                            onChange={toggleLeftSelectAll}
                          />
                        </th>
                        <th>{t.tableHeaderNo}</th>
                        <th>{t.tableHeaderName}</th>
                        <th>{t.tableHeaderInfo}</th>
                        <th>{t.tableHeaderExclu}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeftRows.map((row, index) => (
                        <tr key={row.studId}>
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              disabled={row.isDismissed}
                              checked={leftSelectedIds.has(row.studId)}
                              onChange={() => toggleLeftSelect(row.studId)}
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>
                            {row.name} {row.surname}
                          </td>
                          <td className={row.isDismissed ? "text-error" : ""}>
                            {t.infoLabel(formatRcNumber(row.avgAnnual), row.absTotal)}
                          </td>
                          <td>
                            <select
                              className={`select select-sm ${row.isDismissed ? "text-error" : ""}`}
                              title={t.exclureSelectTooltip}
                              value={row.isDismissed ? 1 : 0}
                              onChange={(e) => handleExclureChange(row, Number(e.target.value) as 0 | 1)}
                            >
                              <option value={0}>{t.optionNon}</option>
                              <option value={1}>{t.optionOui}</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {leftRows.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <p className="empty-state">{t.emptyStudents}</p>
                          </td>
                        </tr>
                      )}
                      {leftRows.length > 0 && filteredLeftRows.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <p className="empty-state">{t.noSearchResults}</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Middle transfer toolbar */}
            <div className="flex lg:flex-col items-center justify-center gap-3 py-4">
              <button
                type="button"
                className="btn btn-primary btn-circle"
                title={t.basculerBtn}
                disabled={isSaving || !nextYearExists || !selectedRightClasseId}
                onClick={handleBasculer}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="btn btn-error btn-circle"
                title={t.removeBasculementBtn}
                disabled={isSaving || !nextYearExists || !selectedRightClasseId}
                onClick={handleRemoveBasculement}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Right panel - next year destination classe */}
            <div className="surface-card overflow-hidden">
              <div className="table-toolbar flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm">
                    {selectedLeftClasse ? t.rightClasseHeader(selectedLeftClasse.classe_name) : ""}
                  </span>
                  <select
                    className="select select-sm w-44"
                    title={t.rightClasseSelectTooltip}
                    value={selectedRightClasseId ?? ""}
                    disabled={rightTargetClasses.length === 0}
                    onChange={(e) => setSelectedRightClasseId(Number(e.target.value))}
                  >
                    {rightTargetClasses.length === 0 && <option value="">{t.emptyRightClasses}</option>}
                    {rightTargetClasses.map((c) => (
                      <option key={c.classe_id} value={c.classe_id}>
                        {c.classe_name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-2"
                  disabled={isLoadingRight}
                  onClick={() => setRightReloadToken((n) => n + 1)}
                >
                  <RefreshCw className="w-4 h-4" />
                  {t.refreshBtn}
                </button>
              </div>
              <div className="table-toolbar">
                <SearchInput
                  value={rightSearch}
                  onChange={setRightSearch}
                  placeholder={t.searchPlaceholder}
                  className="input-sm w-full max-w-xs"
                />
              </div>
              {isLoadingRight ? (
                <div className="flex justify-center py-16">
                  <Loading />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra data-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={rightIds.length > 0 && rightIds.every((id) => rightSelectedIds.has(id))}
                            onChange={toggleRightSelectAll}
                          />
                        </th>
                        <th>{t.tableHeaderNo}</th>
                        <th>{t.tableHeaderName}</th>
                        <th>{t.tableHeaderClasse}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRightRows.map((row, index) => (
                        <tr key={row.studId}>
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={rightSelectedIds.has(row.studId)}
                              onChange={() => toggleRightSelect(row.studId)}
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td>
                            {row.name} {row.surname}
                          </td>
                          <td>
                            <select
                              className="select select-sm"
                              title={t.rowClasseSelectTooltip}
                              value={selectedRightClasseId ?? ""}
                              onChange={(e) => handleRightClasseChange(row, Number(e.target.value))}
                            >
                              {sameLevelNextClasses.map((c) => (
                                <option key={c.classe_id} value={c.classe_id}>
                                  {c.classe_name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                      {rightRows.length === 0 && (
                        <tr>
                          <td colSpan={4}>
                            <p className="empty-state">{t.emptyRightStudents}</p>
                          </td>
                        </tr>
                      )}
                      {rightRows.length > 0 && filteredRightRows.length === 0 && (
                        <tr>
                          <td colSpan={4}>
                            <p className="empty-state">{t.noSearchResults}</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BasculementManager;
