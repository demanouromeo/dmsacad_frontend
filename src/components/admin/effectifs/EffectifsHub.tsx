import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconEffectifs from "../../../assets/menu/Bilan.svg";
import iconPv from "../../../assets/menu/Imprimer les bulletins.svg";

// Landing page for the "Bilan" dashboard card - its 2 sub-modules: "Effectifs par classe" (the
// existing whole-school headcount report, EffectifsManager) and "Procès Verbaux" (PvManager, new).
// Same FillRateHub/SettingsHub pattern. Hardcoded French, matching EffectifsManager's own
// "French only" precedent for this module - no per-file translation dictionary here either.
const EffectifsHub = () => {
  const items = [
    {
      key: "par-classe",
      label: "Effectifs par classe",
      icon: iconEffectifs,
      to: "/admin/effectifs/par-classe",
    },
    {
      key: "pv",
      label: "Procès Verbaux",
      icon: iconPv,
      to: "/admin/effectifs/pv",
    },
  ];

  return (
    <div className="page-shell">
      <h1 className="page-title mb-6">Bilan</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        {items.map((item) => (
          <AdminMenuCard key={item.key} label={item.label} icon={item.icon} to={item.to} />
        ))}
      </div>
    </div>
  );
};

export default EffectifsHub;
