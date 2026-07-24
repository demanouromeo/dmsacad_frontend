import { useLanguage } from "../../../i18n/useLanguage";
import { settingsHubTranslations } from "../../../i18n/translations";
import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconClassifiedParam from "../../../assets/compo/settings/classified_settings.svg";
import iconAnnualRcAvgParam from "../../../assets/compo/settings/bulletin_settings.svg";
import iconThParam from "../../../assets/compo/settings/th_settings.svg";
import iconPromotionSettings from "../../../assets/compo/promotion/promo_settings.svg";

// Landing page for the "settings" dashboard card - sub-modules: "classifiedParam" ->
// ClassifiedParamManager, "annualRcAvgParam" -> AnnualRcAvgManager, "thParam" -> ThParamManager,
// "promotionSettings" -> PromotionSettingsManager. Same SubjectsHub/AccountHub pattern.
const SettingsHub = () => {
  const [language] = useLanguage();
  const t = settingsHubTranslations[language];

  const items: { key: string; label: string; icon: string; to?: string }[] = [
    {
      key: "classifiedParam",
      label: t.classifiedParam,
      icon: iconClassifiedParam,
      to: "/admin/settings/classified-param",
    },
    {
      key: "annualRcAvgParam",
      label: t.annualRcAvgParam,
      icon: iconAnnualRcAvgParam,
      to: "/admin/settings/annual-rc-avg",
    },
    {
      key: "thParam",
      label: t.thParam,
      icon: iconThParam,
      to: "/admin/settings/th-param",
    },
    {
      key: "promotionSettings",
      label: t.promotionSettings,
      icon: iconPromotionSettings,
      to: "/admin/settings/promotion",
    },
  ];

  return (
    <div className="page-shell flex flex-col items-center">
      <h1 className="page-title mb-6">{t.title}</h1>
      <div className="flex flex-wrap justify-center gap-6">
        {items.map((item) => (
          <div key={item.key} className="w-40">
            <AdminMenuCard label={item.label} icon={item.icon} to={item.to} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsHub;
