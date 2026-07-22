import { useState } from "react";
import { Save } from "lucide-react";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { annualRcAvgManagerTranslations } from "../../../i18n/translations";
import { MyConstants } from "../../../dbmanger/MyConstants";

// "Paramètres du bulletin annuel" - how a student's annual average is derived from their 3 term
// averages. Unlike ClassifiedParamManager (its sibling under SettingsHub), this parameter is never
// persisted server-side - it's kept in localStorage only, under MyConstants.ANNUAL_RC_AVG_SETTING_KEY,
// "1" = Calcul simple ((trim1+trim2+trim3)/3, the default), "0" = Calcul complexe (coefficients
// cancelled for subjects with no marks - the actual algorithm is out of scope here, only the flag).
//
// affichagePromotion (MyConstants.AFFICHAGE_PROMOTION_KEY, same localStorage convention) is a second,
// independent flag also consumed by annual report card printing: true shows the student's next-year
// classe when promoted ("Promu en 5e B"), false leaves it blank for manual fill-in
// ("Promu en ______________").
const AnnualRcAvgManager = () => {
  const showToast = useToast();
  const [language] = useLanguage();
  const t = annualRcAvgManagerTranslations[language];

  const [useSimpleCalc, setUseSimpleCalc] = useState(
    MyConstants.getAnnualRcAvgSetting() !== "0",
  );
  const [affichagePromotion, setAffichagePromotion] = useState(
    MyConstants.getAffichagePromotion(),
  );

  const handleSave = () => {
    MyConstants.setAnnualRcAvgSetting(useSimpleCalc ? "1" : "0");
    MyConstants.setAffichagePromotion(affichagePromotion);
    showToast(t.saveSuccess, { type: "info" });
  };

  return (
    <div className="page-shell flex flex-col items-center">
      <h1 className="page-title mb-6 text-center">{t.title}</h1>

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

        <button
          type="button"
          className="btn btn-primary gap-2 self-center mt-4"
          onClick={handleSave}
        >
          <Save className="w-4 h-4" />
          {t.saveBtn}
        </button>
      </div>
    </div>
  );
};

export default AnnualRcAvgManager;
