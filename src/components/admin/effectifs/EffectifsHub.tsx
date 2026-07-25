import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconEffectifs from "../../../assets/compo/stat/effectifs.svg";
import iconPv from "../../../assets/compo/stat/pv.svg";
import iconStatGroupees from "../../../assets/compo/stat/stat_groupees.svg";
import iconSyntheseGlobale from "../../../assets/compo/stat/synthese_globale.svg";
import iconSyntheseResultats from "../../../assets/compo/stat/synthese_resultats.svg";
import iconStatMatiere from "../../../assets/compo/stat/stat_par_matiere.svg";
import iconClassement from "../../../assets/compo/stat/champion.svg";
import iconStatParClasse from "../../../assets/compo/stat/stat_par_classe.svg";

// Landing page for the "Bilan" dashboard card - its 8 sub-modules: "Effectifs par classe" (the
// existing whole-school headcount report, EffectifsManager), "Procès Verbaux" (PvManager),
// "Statistiques Groupées" (StatGroupeesManager), "Synthèse globale" (SyntheseGlobaleManager),
// "Synthèse des résultats" (SyntheseResultatsManager, new), "Statistiques par matière"
// (StatMatiereManager), "Classement" (ClassementManager) and "Statistiques par classe"
// (StatParClasseManager). Same FillRateHub/SettingsHub pattern. Hardcoded French, matching
// EffectifsManager's own "French only" precedent for this module - no per-file translation
// dictionary here either. Each tile's own dedicated icon lives under src/assets/compo/stat/.
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
