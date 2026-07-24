import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { annualRcAvgManagerTranslations } from "../../../i18n/translations";
import { SchoolInfoReader } from "../../../dbmanger/SchoolInfoReader";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

// "Paramètres du bulletin annuel" - how a student's annual average is derived from their 3 term
// averages, plus affichagePromotion (whether the annual report card shows the student's next-year
// classe when promoted). Both are whole-school settings, not per-user, so - unlike the frontend-only
// approach this screen originally used - they're persisted server-side on basic_school_config's
// val1/val2 columns (one row per school year), the same single-record-form shape as its sibling
// ClassifiedParamManager: useSimpleCalc true = val1 "1" (Calcul simple, the default), false = val1
// "0" (Calcul complexe - coefficients cancelled for subjects with no marks, the actual algorithm is
// out of scope here, only the flag). affichagePromotion true = val2 "1" ("Promu en 5e B"), false =
// val2 "0" ("Promu en ______________").
const AnnualRcAvgManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [language] = useLanguage();
  const t = annualRcAvgManagerTranslations[language];

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [useSimpleCalc, setUseSimpleCalc] = useState(true);
  const [affichagePromotion, setAffichagePromotion] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const params = await SchoolInfoReader.fetchAnnualReportCardParams(
        accessToken,
        connection,
        schoolYear,
      );
      setUseSimpleCalc(params?.computationMethod !== 0);
      setAffichagePromotion(params?.affichagePromotion === 1);
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await SchoolInfoReader.saveAnnualReportCardParams(
      accessToken,
      connection,
      schoolYear,
      useSimpleCalc,
      affichagePromotion,
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
        <div className="w-full max-w-2xl surface-card p-6 md:p-8 flex flex-col gap-2">
          <p className="text-sm opacity-70 mb-2">{t.description}</p>

          <label
            className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer ${
              useSimpleCalc ? "bg-base-200" : ""
            }`}
          >
            <input
              type="radio"
              className="radio radio-primary mt-1"
              checked={useSimpleCalc}
              onChange={() => setUseSimpleCalc(true)}
            />
            <div className="flex-1">
              <p className="font-semibold text-primary">{t.optionSimpleTitle}</p>
              <p className="text-sm opacity-70 mt-1">{t.optionSimpleDescription}</p>
            </div>
          </label>

          <label
            className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer ${
              !useSimpleCalc ? "bg-base-200" : ""
            }`}
          >
            <input
              type="radio"
              className="radio radio-primary mt-1"
              checked={!useSimpleCalc}
              onChange={() => setUseSimpleCalc(false)}
            />
            <div className="flex-1">
              <p className="font-semibold text-primary">{t.optionComplexTitle}</p>
              <p className="text-sm opacity-70 mt-1">{t.optionComplexDescription}</p>
            </div>
          </label>

          <label className="flex items-start gap-4 p-4 rounded-lg cursor-pointer mt-2">
            <input
              type="checkbox"
              className="checkbox checkbox-primary mt-1"
              checked={affichagePromotion}
              onChange={(e) => setAffichagePromotion(e.target.checked)}
            />
            <div className="flex-1">
              <p className="font-semibold">{t.affichagePromotionLabel}</p>
              <p className="text-sm opacity-70 mt-1">
                {affichagePromotion
                  ? t.affichagePromotionHintOn
                  : t.affichagePromotionHintOff}
              </p>
            </div>
          </label>

          <div className="flex gap-3 justify-center mt-4">
            <button
              type="button"
              className="btn btn-primary gap-2"
              disabled={isSaving}
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

export default AnnualRcAvgManager;
