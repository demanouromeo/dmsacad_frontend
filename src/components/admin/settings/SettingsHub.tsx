import { useLanguage } from "../../../i18n/useLanguage";
import { settingsHubTranslations } from "../../../i18n/translations";
import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconSettings from "../../../assets/menu/Settings.svg";

// Landing page for the "settings" dashboard card - only one sub-module built so far
// ("classifiedParam" -> ClassifiedParamManager). Same SubjectsHub/AccountHub pattern. Reuses the
// generic Settings.svg icon since there's no dedicated icon asset for this sub-module yet.
const SettingsHub = () => {
  const [language] = useLanguage();
  const t = settingsHubTranslations[language];

  const items: { key: string; label: string; icon: string; to?: string }[] = [
    {
      key: "classifiedParam",
      label: t.classifiedParam,
      icon: iconSettings,
      to: "/admin/settings/classified-param",
    },
  ];

  return (
    <div className="p-10 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-3xl justify-items-center">
        {items.map((item) => (
          <AdminMenuCard key={item.key} label={item.label} icon={item.icon} to={item.to} />
        ))}
      </div>
    </div>
  );
};

export default SettingsHub;
