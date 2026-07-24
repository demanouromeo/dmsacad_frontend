import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { thParamManagerTranslations } from "../../../i18n/translations";
import { ThParamReader } from "../../../dbmanger/ThParamReader";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

const DEFAULT_LB = 14;
const DEFAULT_UB = 20;
const DEFAULT_SEUIL_ABS = 10;
const DEFAULT_VAL1 = 2;
const MIN_AVG = 0;
const MAX_AVG = 20;
const MAX_SEUIL_ABS = 100;

// "Paramètres du tableau d'honneur" - defines thparam.lb/ub/seuil_abs/val1 for the current school
// year (see the backend CLAUDE.md-style summary in translations.ts above ThParamManagerTranslations
// for what these drive at Honors Roll generation time, which isn't built yet). Single-record
// form, same shape as ClassifiedParamManager - no table, no search, one Save action.
const ThParamManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [language] = useLanguage();
  const t = thParamManagerTranslations[language];

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lb, setLb] = useState(DEFAULT_LB);
  const [ub, setUb] = useState(DEFAULT_UB);
  const [seuilAbs, setSeuilAbs] = useState(DEFAULT_SEUIL_ABS);
  const [val1, setVal1] = useState(DEFAULT_VAL1);

  // Strict: lb must be < ub, not just <=, so the interval always contains at least one value.
  // Checked live (not only on Save) so the user gets immediate feedback while typing rather than
  // discovering the problem only after clicking Save - matches this app's precedent of rejecting/
  // flagging invalid numeric input as it happens (see MarkEntryManager's sanitizeMarkInput).
  const isRangeInvalid = lb >= ub;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const param = await ThParamReader.fetchThParamOfYear(accessToken, connection, schoolYear);
      if (param) {
        setLb(param.lb);
        setUb(param.ub);
        setSeuilAbs(param.seuil_abs);
        setVal1(param.val1);
      } else {
        setLb(DEFAULT_LB);
        setUb(DEFAULT_UB);
        setSeuilAbs(DEFAULT_SEUIL_ABS);
        setVal1(DEFAULT_VAL1);
      }
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const handleSave = async () => {
    if (isRangeInvalid) {
      showToast(t.rangeError, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await ThParamReader.saveThParam(
      accessToken,
      connection,
      schoolYear,
      lb,
      ub,
      seuilAbs,
      val1,
    );
    setIsSaving(false);

    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <h1 className="page-title mb-6 text-center">{t.title}</h1>

      {isLoading ? (
        <div className="surface-card w-full max-w-2xl flex justify-center py-16">
          <Loading />
        </div>
      ) : (
        <div className="w-full max-w-2xl surface-card p-6 md:p-8 flex flex-col gap-6">
          <p className="text-sm opacity-70">{t.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="form-control">
              <span className="label-text mb-1">{t.lbLabel}</span>
              <input
                type="number"
                className={`input input-bordered w-full ${
                  isRangeInvalid ? "input-error" : ""
                }`}
                min={MIN_AVG}
                max={MAX_AVG}
                step={0.25}
                value={lb}
                onChange={(e) => setLb(Number(e.target.value))}
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">{t.ubLabel}</span>
              <input
                type="number"
                className={`input input-bordered w-full ${
                  isRangeInvalid ? "input-error" : ""
                }`}
                min={MIN_AVG}
                max={MAX_AVG}
                step={0.25}
                value={ub}
                onChange={(e) => setUb(Number(e.target.value))}
              />
            </label>
          </div>
          {isRangeInvalid && <p className="text-error text-sm -mt-2">{t.rangeError}</p>}

          <label className="form-control">
            <span className="label-text mb-1">{t.seuilAbsLabel}</span>
            <input
              type="number"
              className="input input-bordered w-full sm:w-1/2"
              min={0}
              max={MAX_SEUIL_ABS}
              step={1}
              value={seuilAbs}
              onChange={(e) => {
                const raw = Number(e.target.value);
                setSeuilAbs(Math.min(Math.max(raw, 0), MAX_SEUIL_ABS));
              }}
            />
          </label>

          <div>
            <p className="font-semibold text-primary mb-2">{t.resolutionTitle}</p>
            <div className="flex flex-col gap-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                  val1 === 1 ? "bg-base-200" : ""
                }`}
              >
                <input
                  type="radio"
                  className="radio radio-primary"
                  checked={val1 === 1}
                  onChange={() => setVal1(1)}
                />
                {t.resolutionLow}
              </label>
              <label
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                  val1 === 2 ? "bg-base-200" : ""
                }`}
              >
                <input
                  type="radio"
                  className="radio radio-primary"
                  checked={val1 === 2}
                  onChange={() => setVal1(2)}
                />
                {t.resolutionMedium}
              </label>
              <label
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer ${
                  val1 === 3 ? "bg-base-200" : ""
                }`}
              >
                <input
                  type="radio"
                  className="radio radio-primary"
                  checked={val1 === 3}
                  onChange={() => setVal1(3)}
                />
                {t.resolutionHigh}
              </label>
            </div>
          </div>

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
  );
};

export default ThParamManager;
