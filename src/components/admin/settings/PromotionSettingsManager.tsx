import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { promotionSettingsManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import type { Classe } from "../../../interfaces/Classe";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

const DEFAULT_TOTAL_ABS_TH = 40;
const DEFAULT_TOTAL_EXCLUSION_TH = 8;
const DEFAULT_AVG_DISMISSAL_TH = 7.5;
const DEFAULT_REPEAT_UB = 9;
const DEFAULT_PASS_MARK = 10;

const MAX_ABS_EXCLUSION_TH = 300;
const MIN_AVG = 0;
const MAX_AVG = 20;

// "Paramètres de promotion" - classe-scoped end-of-year decision thresholds (classe_year), same
// fields annualReportCardCompute.ts's computeMustDismiss/computeMustRepeat already read (see the
// Classe interface). fetchClasses already returns these columns per-classe, so no dedicated fetch
// is needed - only ClasseReader.updateClassSettings (ClasseController::updateClassSettings) is new.
// passMark isn't part of this screen's form - it's round-tripped unchanged on save, same convention
// updateClasses uses for classe_master_id/sg_id when this screen doesn't edit them.
const PromotionSettingsManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [language] = useLanguage();
  const t = promotionSettingsManagerTranslations[language];

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [totalAbsTh, setTotalAbsTh] = useState(DEFAULT_TOTAL_ABS_TH);
  const [totalExclusionTh, setTotalExclusionTh] = useState(DEFAULT_TOTAL_EXCLUSION_TH);
  const [avgDismissalTh, setAvgDismissalTh] = useState(DEFAULT_AVG_DISMISSAL_TH);
  const [repeatUb, setRepeatUb] = useState(DEFAULT_REPEAT_UB);
  const [passMark, setPassMark] = useState(DEFAULT_PASS_MARK);

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;

  // Strict: avgDismissalTh must be < repeatUb, same reasoning as ThParamManager's lb<ub check, so
  // the "Redouble si moyenne dans [avgDismissalTh, repeatUb[" interval always contains a value.
  const isRangeInvalid = avgDismissalTh >= repeatUb;

  const resetFormFromClasse = (classe: Classe | null) => {
    setTotalAbsTh(classe?.totalAbsTh ?? DEFAULT_TOTAL_ABS_TH);
    setTotalExclusionTh(classe?.totalExclusionTh ?? DEFAULT_TOTAL_EXCLUSION_TH);
    setAvgDismissalTh(classe?.avgDismissalTh ?? DEFAULT_AVG_DISMISSAL_TH);
    setRepeatUb(classe?.repeatUB ?? DEFAULT_REPEAT_UB);
    setPassMark(classe?.passMark ?? DEFAULT_PASS_MARK);
  };

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const list = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(list);
      setSelectedClasseId((prev) => {
        if (prev !== null && list.some((c) => c.classe_id === prev)) {
          return prev;
        }
        return list.length > 0 ? list[0].classe_id : null;
      });
      setIsLoadingClasses(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    resetFormFromClasse(selectedClasse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClasseId, classes]);

  const handleSave = async () => {
    if (selectedClasseId === null || isRangeInvalid) {
      if (isRangeInvalid) showToast(t.rangeError, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await ClasseReader.updateClassSettings(
      accessToken,
      connection,
      schoolYear,
      selectedClasseId,
      totalAbsTh,
      totalExclusionTh,
      avgDismissalTh,
      repeatUb,
      passMark,
    );
    if (result.status) {
      setClasses((prev) =>
        prev.map((c) =>
          c.classe_id === selectedClasseId
            ? { ...c, totalAbsTh, totalExclusionTh, avgDismissalTh, repeatUB: repeatUb, passMark }
            : c,
        ),
      );
    }
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.sectionHint(section)}</p>
        </div>
      </div>

      {isLoadingClasses ? (
        <div className="surface-card w-full max-w-3xl flex justify-center py-16">
          <Loading />
        </div>
      ) : classes.length === 0 ? (
        <p className="empty-state">{t.emptyClasses}</p>
      ) : (
        <div className="w-full max-w-3xl flex flex-col gap-6">
          <div className="surface-card p-4 md:p-6 flex items-center gap-2">
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

          {selectedClasse && (
            <div className="surface-card p-6 md:p-8 flex flex-col gap-5">
              <h2 className="text-lg font-semibold">{t.formTitle(selectedClasse.classe_name)}</h2>

              <div className="flex flex-wrap items-center gap-3">
                <label className="font-medium whitespace-nowrap">{t.totalAbsThLabel}</label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-24 text-center"
                  min={1}
                  max={MAX_ABS_EXCLUSION_TH}
                  step={1}
                  value={totalAbsTh}
                  onChange={(e) => setTotalAbsTh(Number(e.target.value))}
                />
                <span className="text-sm opacity-70 italic">{t.totalAbsThHint}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="font-medium whitespace-nowrap">{t.totalExclusionThLabel}</label>
                <input
                  type="number"
                  className="input input-bordered input-sm w-24 text-center"
                  min={0}
                  max={MAX_ABS_EXCLUSION_TH}
                  step={1}
                  value={totalExclusionTh}
                  onChange={(e) => setTotalExclusionTh(Number(e.target.value))}
                />
                <span className="text-sm opacity-70 italic">{t.totalExclusionThHint}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="font-medium whitespace-nowrap">{t.avgDismissalThLabel}</label>
                <input
                  type="number"
                  className={`input input-bordered input-sm w-24 text-center ${
                    isRangeInvalid ? "input-error" : ""
                  }`}
                  min={MIN_AVG}
                  max={MAX_AVG}
                  step={0.25}
                  value={avgDismissalTh}
                  onChange={(e) => setAvgDismissalTh(Number(e.target.value))}
                />
                <span className="text-sm opacity-70 italic">{t.avgDismissalThHint}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="font-medium whitespace-nowrap">{t.repeatIntervalLabel}</label>
                <span>[</span>
                <input
                  type="number"
                  className="input input-bordered input-sm w-20 text-center bg-base-200"
                  value={avgDismissalTh}
                  disabled
                  readOnly
                />
                <span>,</span>
                <input
                  type="number"
                  className={`input input-bordered input-sm w-20 text-center ${
                    isRangeInvalid ? "input-error" : ""
                  }`}
                  min={MIN_AVG}
                  max={MAX_AVG}
                  step={0.25}
                  value={repeatUb}
                  onChange={(e) => setRepeatUb(Number(e.target.value))}
                />
                <span>[</span>
                <span className="text-sm opacity-70 italic">
                  {t.repeatIntervalHint(avgDismissalTh, repeatUb)}
                </span>
              </div>
              {isRangeInvalid && <p className="text-error text-sm -mt-2">{t.rangeError}</p>}

              <p className="text-sm">{t.admittedIntervalText(repeatUb, totalAbsTh, totalExclusionTh)}</p>

              <div className="flex gap-3 justify-center mt-2">
                <button
                  type="button"
                  className="btn btn-primary gap-2"
                  disabled={isSaving || isRangeInvalid}
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4" />
                  {t.saveBtn}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost gap-2"
                  disabled={isSaving}
                  onClick={() => navigate("/admin/settings")}
                >
                  <X className="w-4 h-4" />
                  {t.closeBtn}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PromotionSettingsManager;
