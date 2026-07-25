import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconEffectifs from "../../../assets/menu/Bilan.svg";
import iconPv from "../../../assets/menu/Imprimer les bulletins.svg";
import iconStatGroupees from "../../../assets/menu/Taux_de_remplissage.svg";
import iconSyntheseGlobale from "../../../assets/menu/Livret Scolaires.svg";
// Same fallback precedent as iconClassement below - no dedicated icon for this module either.
import iconSyntheseResultats from "../../../assets/menu/Bilan.svg";
import iconStatMatiere from "../../../assets/menu/Matières.svg";
// No dedicated ranking/trophy icon exists under src/assets/menu - falls back to Bilan.svg (reused
// a second time), same precedent already established for this hub's own landing tile.
import iconClassement from "../../../assets/menu/Bilan.svg";
// Same fallback precedent as iconClassement above - no dedicated "class list" icon exists either.
import iconStatParClasse from "../../../assets/menu/Bilan.svg";

// Landing page for the "Bilan" dashboard card - its 8 sub-modules: "Effectifs par classe" (the
// existing whole-school headcount report, EffectifsManager), "Procès Verbaux" (PvManager),
// "Statistiques Groupées" (StatGroupeesManager), "Synthèse globale" (SyntheseGlobaleManager),
// "Synthèse des résultats" (SyntheseResultatsManager, new), "Statistiques par matière"
// (StatMatiereManager), "Classement" (ClassementManager) and "Statistiques par classe"
// (StatParClasseManager). Same FillRateHub/SettingsHub pattern. Hardcoded French, matching
// EffectifsManager's own "French only" precedent for this module - no per-file translation
// dictionary here either.
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
    {
      key: "stat-groupees",
      label: "Statistiques Groupées",
      icon: iconStatGroupees,
      to: "/admin/effectifs/stat-groupees",
    },
    {
      key: "synthese-globale",
      label: "Synthèse globale",
      icon: iconSyntheseGlobale,
      to: "/admin/effectifs/synthese-globale",
    },
    {
      key: "synthese-resultats",
      label: "Synthèse des résultats",
      icon: iconSyntheseResultats,
      to: "/admin/effectifs/synthese-resultats",
    },
    {
      key: "stat-matiere",
      label: "Statistiques par matière",
      icon: iconStatMatiere,
      to: "/admin/effectifs/stats-matiere",
    },
    {
      key: "classement",
      label: "Classement",
      icon: iconClassement,
      to: "/admin/effectifs/classement",
    },
    {
      key: "stat-par-classe",
      label: "Statistiques par classe",
      icon: iconStatParClasse,
      to: "/admin/effectifs/stat-par-classe",
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
