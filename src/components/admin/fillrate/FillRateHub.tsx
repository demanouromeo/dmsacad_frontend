import { useLanguage } from "../../../i18n/useLanguage";
import { fillRateHubTranslations } from "../../../i18n/translations";
import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconGlobalView from "../../../assets/compo/fill_rate/global_view.png";
import iconClassView from "../../../assets/compo/fill_rate/class_view.png";

// Landing page for the "Taux de remplissage" dashboard card - its 2 sub-modules, both built:
// "global" (FillRateGlobalManager - whole-school report, pivotable by classe/subject/term/teacher)
// and "class" (FillRateClassManager - one classe's per-subject fill rate, mirroring
// MarkEntryManager's own fill-rate side panel but as a dedicated screen). Same SubjectsHub pattern.
const FillRateHub = () => {
  const [language] = useLanguage();
  const t = fillRateHubTranslations[language];

  const items: { key: string; label: string; icon: string; to?: string }[] = [
    {
      key: "global",
      label: t.global,
      icon: iconGlobalView,
      to: "/admin/fill-rate/global",
    },
    {
      key: "class",
      label: t.class,
      icon: iconClassView,
      to: "/admin/fill-rate/class",
    },
  ];

  return (
    <div className="page-shell">
      <h1 className="page-title mb-6">{t.title}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {items.map((item) => (
          <AdminMenuCard key={item.key} label={item.label} icon={item.icon} to={item.to} />
        ))}
      </div>
    </div>
  );
};

export default FillRateHub;
