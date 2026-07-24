import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, RefreshCw } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import { promotionManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { computeIsTechnique } from "../../../utils/schoolTypes";
import { formatRcNumber } from "../../../utils/reportCard/reportCardCompute";
import {
  loadAnnualReportCardDataForClasse,
  loadAnnualApcReportCardDataForClasse,
} from "../../../utils/reportCard/loadAnnualReportCardData";
import {
  computeMustDismiss,
  computeMustRepeat,
  computeAnnualClassified,
  computeAnnualDecision,
} from "../../../utils/reportCard/annualReportCardCompute";
import type { Classe } from "../../../interfaces/Classe";
import type { ClassifiedParam } from "../../../interfaces/ClassifiedParam";
import type { AnnualDecision } from "../../../interfaces/AnnualReportCard";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import SearchInput from "../../sharedcomp/SearchInput";
import iconPromotionSettings from "../../../assets/compo/promotion/promo_settings.svg";

interface PromotionRow {
  studId: number;
  matricule: string;
  name: string;
  surname: string;
  sexe: string;
  avgAnnual: number;
  absNonJust: number;
  exclusionJours: number;
  termIsClassified: [boolean, boolean, boolean];
  repeating: number;
  solvable1: number | null;
  isMannullalyDismissed: number; // 0=NON, 1=OUI, 2=AUTO
  mustRepeat: number; // 0=NON, 1=OUI, 2=AUTO
  isMannullalyClassified: number; // 0=NC, 1=C, 2=AUTO
  promuEn: number | null;
  codeExclusion: number; // 0=none, 1..6 - see EXCLUSION_OPTIONS
}

const EXCLUSION_CODES = [1, 2, 3, 4, 5, 6] as const;

// "Gestion de la promotion" - classe-scoped table letting ADMIN set the end-of-year decision
// overrides (student_classe.isMannullalyDismissed/mustRepeat/isMannullalyClassified/promuEn/
// codeExclusion) that annualReportCardCompute.ts's computeMustDismiss/computeMustRepeat/
// computeAnnualClassified/computeAnnualDecision already read when printing the annual report card.
// Reuses that exact same data load (loadAnnualReportCardDataForClasse/
// loadAnnualApcReportCardDataForClasse, extracted out of ReportCardManager.tsx for this purpose)
// rather than re-deriving avgAnnual/discipline totals separately.
const PromotionManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [language] = useLanguage();
  const t = promotionManagerTranslations[language];
  const schoolHeader = useSchoolHeader();
  const isTechnique = computeIsTechnique(schoolHeader.config?.type ?? "");

  const [classes, setClasses] = useState<Classe[]>([]);
  const [apcLevels, setApcLevels] = useState<Map<number, boolean>>(new Map());
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [classifiedParam, setClassifiedParam] = useState<ClassifiedParam | null>(null);
  const [nbMatieres, setNbMatieres] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [promoteTargetClasseId, setPromoteTargetClasseId] = useState<number | null>(null);

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;
  const isSelectedClasseApc = selectedClasse ? apcLevels.get(selectedClasse.level) === true : false;
  const classeNameById = useMemo(
    () => new Map(classes.map((c) => [c.classe_id, c.classe_name])),
    [classes],
  );
  const nextLevelClasses = useMemo(
    () => (selectedClasse ? classes.filter((c) => c.level === selectedClasse.level + 1) : []),
    [classes, selectedClasse],
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    setPromoteTargetClasseId(nextLevelClasses.length > 0 ? nextLevelClasses[0].classe_id : null);
  }, [nextLevelClasses]);

  useEffect(() => {
    const load = async () => {
      if (selectedClasseId === null || !selectedClasse) {
        setRows([]);
        return;
      }
      setIsLoadingData(true);
      const [annualData, studentClasseRaw] = await Promise.all([
        isSelectedClasseApc
          ? loadAnnualApcReportCardDataForClasse({
              accessToken,
              connection,
              schoolYear,
              section,
              classes,
              schoolHeader,
              language,
              classeId: selectedClasseId,
            })
          : loadAnnualReportCardDataForClasse({
              accessToken,
              connection,
              schoolYear,
              section,
              classes,
              schoolHeader,
              language,
              classeId: selectedClasseId,
            }),
        StudentReader.fetchStudentClasseOfClasse(accessToken, connection, schoolYear, selectedClasseId),
      ]);
      const infoByStudId = new Map(studentClasseRaw.map((info) => [info.stud_id, info]));

      const builtRows: PromotionRow[] = annualData.students.map((s) => {
        const info = infoByStudId.get(s.studId);
        const isMannullalyDismissed = info?.isMannullalyDismissed ?? 2;
        const repeatingBool = (info?.repeating ?? 0) === 1;
        let codeExclusion = info?.codeExclusion ?? 0;
        // Smart default: when Exclure is still AUTO and no reason has ever been picked, prefill
        // Exclu pour with what the algorithm would currently compute - mirrors the pseudocode's
        // own "on place le code d'exclusion s'il est = 0". Independently editable afterward.
        if (codeExclusion === 0 && isMannullalyDismissed === 2) {
          const { mustDismiss, code } = computeMustDismiss(
            isMannullalyDismissed,
            codeExclusion,
            s.disciplineAnnual.absNonJust,
            s.disciplineAnnual.exclusionJours,
            s.avgAnnual,
            selectedClasse.avgDismissalTh,
            selectedClasse.repeatUB,
            repeatingBool,
            selectedClasse.totalExclusionTh,
            selectedClasse.totalAbsTh,
            info?.solvable1 ?? null,
          );
          if (mustDismiss && code != null) {
            codeExclusion = code;
          }
        }
        return {
          studId: s.studId,
          matricule: s.matricule,
          name: s.name,
          surname: s.surname,
          sexe: s.sexe,
          avgAnnual: s.avgAnnual,
          absNonJust: s.disciplineAnnual.absNonJust,
          exclusionJours: s.disciplineAnnual.exclusionJours,
          termIsClassified: s.termIsClassified,
          repeating: info?.repeating ?? 0,
          solvable1: info?.solvable1 ?? null,
          isMannullalyDismissed,
          mustRepeat: info?.mustRepeat ?? 2,
          isMannullalyClassified: info?.isMannullalyClassified ?? 2,
          promuEn: info?.promuEn ?? null,
          codeExclusion,
        };
      });
      builtRows.sort((a, b) =>
        `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, "fr", { sensitivity: "base" }),
      );
      setClassifiedParam(annualData.classifiedParam);
      setNbMatieres(annualData.nbMatieres);
      setRows(builtRows);
      setIsLoadingData(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, isSelectedClasseApc, reloadToken]);

  // Re-runs the same annual-decision pipeline the report card print uses, against a row's CURRENT
  // (possibly just-edited) override values - lets AUTO rows live-preview what the annual RC would
  // actually decide, without a second fetch.
  const computeLiveDecision = (row: PromotionRow): AnnualDecision | null => {
    if (!selectedClasse) {
      return null;
    }
    const { mustDismiss, code: dismissCode } = computeMustDismiss(
      row.isMannullalyDismissed,
      row.codeExclusion,
      row.absNonJust,
      row.exclusionJours,
      row.avgAnnual,
      selectedClasse.avgDismissalTh,
      selectedClasse.repeatUB,
      row.repeating === 1,
      selectedClasse.totalExclusionTh,
      selectedClasse.totalAbsTh,
      row.solvable1,
    );
    const isClassifiedAnnual = computeAnnualClassified(
      row.isMannullalyClassified,
      classifiedParam,
      row.termIsClassified,
      nbMatieres,
    );
    const mustRepeatComputed = computeMustRepeat(
      row.mustRepeat,
      row.isMannullalyDismissed,
      row.avgAnnual,
      selectedClasse.repeatUB,
      selectedClasse.avgDismissalTh,
      row.repeating === 1,
      mustDismiss,
    );
    const promuEnClasseName = row.promuEn != null ? classeNameById.get(row.promuEn) ?? null : null;
    return computeAnnualDecision(
      selectedClasse.level,
      isTechnique,
      mustDismiss,
      dismissCode,
      mustRepeatComputed,
      isClassifiedAnnual,
      row.avgAnnual,
      selectedClasse.repeatUB,
      promuEnClasseName,
      false,
      language,
    );
  };

  const updateRow = (studId: number, patch: Partial<PromotionRow>) => {
    setRows((prev) => prev.map((r) => (r.studId === studId ? { ...r, ...patch } : r)));
  };

  const handleExclureChange = (row: PromotionRow, value: number) => {
    if (value === 2 && row.codeExclusion === 0) {
      const { mustDismiss, code } = computeMustDismiss(
        value,
        row.codeExclusion,
        row.absNonJust,
        row.exclusionJours,
        row.avgAnnual,
        selectedClasse?.avgDismissalTh ?? 7.5,
        selectedClasse?.repeatUB ?? 9,
        row.repeating === 1,
        selectedClasse?.totalExclusionTh ?? 8,
        selectedClasse?.totalAbsTh ?? 40,
        row.solvable1,
      );
      updateRow(row.studId, {
        isMannullalyDismissed: value,
        codeExclusion: mustDismiss && code != null ? code : row.codeExclusion,
      });
    } else {
      updateRow(row.studId, { isMannullalyDismissed: value });
    }
  };

  const toUpdatePayload = (row: PromotionRow) => ({
    stud_id: row.studId,
    classe_id: selectedClasse?.classe_id ?? 0,
    isMannullalyClassified: row.isMannullalyClassified,
    isMannullalyDismissed: row.isMannullalyDismissed,
    mustRepeat: row.mustRepeat,
    promuEn: row.promuEn,
    codeExclusion: row.codeExclusion,
  });

  const handleSave = async () => {
    if (!selectedClasse || rows.length === 0) {
      return;
    }
    setIsSaving(true);
    const result = await StudentReader.updatePromotionInfo(
      accessToken,
      connection,
      schoolYear,
      rows.map(toUpdatePayload),
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  const handlePromote = async () => {
    if (!selectedClasse || promoteTargetClasseId === null) {
      return;
    }
    const admitted = rows.filter((r) => computeLiveDecision(r)?.kind === "promu");
    if (admitted.length === 0) {
      showToast(t.promoteNoneAdmitted, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const updated = admitted.map((r) => ({ ...r, promuEn: promoteTargetClasseId }));
    const result = await StudentReader.updatePromotionInfo(
      accessToken,
      connection,
      schoolYear,
      updated.map(toUpdatePayload),
    );
    if (result.status) {
      const updatedById = new Map(updated.map((r) => [r.studId, r]));
      setRows((prev) => prev.map((r) => updatedById.get(r.studId) ?? r));
    }
    setIsSaving(false);
    showToast(result.status ? t.promoteSuccess : t.promoteFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  const filteredRows = rows.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return (
      r.name.toLowerCase().includes(q) ||
      r.surname.toLowerCase().includes(q) ||
      r.matricule.toLowerCase().includes(q)
    );
  });

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
          <div className="surface-card p-4 md:p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
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

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">
                {selectedClasse ? t.promoteHeader(selectedClasse.classe_name) : ""}
              </span>
              <select
                className="select select-sm w-40"
                value={promoteTargetClasseId ?? ""}
                disabled={nextLevelClasses.length === 0}
                onChange={(e) => setPromoteTargetClasseId(Number(e.target.value))}
              >
                {nextLevelClasses.map((c) => (
                  <option key={c.classe_id} value={c.classe_id}>
                    {c.classe_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2"
                disabled={isSaving || nextLevelClasses.length === 0}
                onClick={handlePromote}
              >
                <Save className="w-4 h-4" />
                {t.promoteBtn}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                title={t.settingsBtn}
                onClick={() => navigate("/admin/settings/promotion")}
              >
                <img src={iconPromotionSettings} alt="" className="w-5 h-5" />
              </button>
            </div>
          </div>

          {isLoadingData ? (
            <div className="surface-card flex justify-center py-20">
              <Loading />
            </div>
          ) : (
            <div className="surface-card overflow-hidden">
              <div className="table-toolbar flex items-center justify-between gap-3">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t.searchPlaceholder}
                  className="input-sm w-full max-w-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm gap-2"
                    disabled={isLoadingData}
                    onClick={() => setReloadToken((n) => n + 1)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t.refreshBtn}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-2"
                    disabled={isSaving || rows.length === 0}
                    onClick={handleSave}
                  >
                    <Save className="w-4 h-4" />
                    {t.saveBtn}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-zebra data-table">
                  <thead>
                    <tr>
                      <th>{t.tableHeaderNo}</th>
                      <th>{t.tableHeaderName}</th>
                      <th>{t.tableHeaderMoy}</th>
                      <th>{t.tableHeaderTAbs}</th>
                      <th>{t.tableHeaderNbExclu}</th>
                      <th>{t.tableHeaderExclure}</th>
                      <th>{t.tableHeaderRedouble}</th>
                      <th>{t.tableHeaderPromuEn}</th>
                      <th>{t.tableHeaderClassified}</th>
                      <th>{t.tableHeaderExcluPour}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={row.studId}>
                        <td>{index + 1}</td>
                        <td>
                          {row.name} {row.surname}
                        </td>
                        <td
                          className={
                            selectedClasse && row.avgAnnual < selectedClasse.repeatUB
                              ? "text-error font-semibold"
                              : ""
                          }
                        >
                          {formatRcNumber(row.avgAnnual)}
                        </td>
                        <td>{row.absNonJust}</td>
                        <td>{row.exclusionJours}</td>
                        <td>
                          <select
                            className="select select-sm"
                            value={row.isMannullalyDismissed}
                            onChange={(e) => handleExclureChange(row, Number(e.target.value))}
                          >
                            <option value={2}>{t.optionAuto}</option>
                            <option value={1}>{t.optionOui}</option>
                            <option value={0}>{t.optionNon}</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="select select-sm"
                            value={row.mustRepeat}
                            onChange={(e) =>
                              updateRow(row.studId, { mustRepeat: Number(e.target.value) })
                            }
                          >
                            <option value={2}>{t.optionAuto}</option>
                            <option value={1}>{t.optionOui}</option>
                            <option value={0}>{t.optionNon}</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="select select-sm"
                            value={row.promuEn ?? ""}
                            onChange={(e) =>
                              updateRow(row.studId, {
                                promuEn: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          >
                            <option value="">{""}</option>
                            {nextLevelClasses.map((c) => (
                              <option key={c.classe_id} value={c.classe_id}>
                                {c.classe_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="select select-sm"
                            value={row.isMannullalyClassified}
                            onChange={(e) =>
                              updateRow(row.studId, { isMannullalyClassified: Number(e.target.value) })
                            }
                          >
                            <option value={2}>{t.optionAuto}</option>
                            <option value={1}>{t.optionClassified}</option>
                            <option value={0}>{t.optionNotClassified}</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="select select-sm"
                            value={row.codeExclusion}
                            onChange={(e) =>
                              updateRow(row.studId, { codeExclusion: Number(e.target.value) })
                            }
                          >
                            <option value={0}>{""}</option>
                            {EXCLUSION_CODES.map((code) => (
                              <option key={code} value={code}>
                                {
                                  {
                                    1: t.exclusionReasonAge,
                                    2: t.exclusionReasonConduite,
                                    3: t.exclusionReasonTravail,
                                    4: t.exclusionReasonTripler,
                                    5: t.exclusionReasonAbandon,
                                    6: t.exclusionReasonInsolvable,
                                  }[code]
                                }
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={10}>
                          <p className="empty-state">{t.emptyStudents}</p>
                        </td>
                      </tr>
                    )}
                    {rows.length > 0 && filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={10}>
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

export default PromotionManager;
