import { useLanguage } from "../../../i18n/useLanguage";
import { subjectsHubTranslations } from "../../../i18n/translations";
import AdminMenuCard from "../../dashboard/AdminMenuCard";
import iconCourse from "../../../assets/compo/group/course.png";
import iconGroup from "../../../assets/compo/group/group.png";
import iconSubjectsOfClass from "../../../assets/compo/group/subjects_of_class.png";
import iconCompetence from "../../../assets/compo/group/competence.png";

// Landing page for the "Manage subjects" dashboard card - its 4 sub-modules. Only "matieres"
// (SubjectManager) and "groupes" (GroupeManager) are built; the other two render as inert cards
// (no `to`), same convention AdminMenuGrid uses for unbuilt modules.
const SubjectsHub = () => {
  const [language] = useLanguage();
  const t = subjectsHubTranslations[language];

  const items: { key: string; label: string; icon: string; to?: string }[] = [
    {
      key: "matieres",
      label: t.matieres,
      icon: iconCourse,
      to: "/admin/subjects/matieres",
    },
    {
      key: "groupes",
      label: t.groupes,
      icon: iconGroup,
      to: "/admin/subjects/groupes",
    },
    {
      key: "matieresClasses",
      label: t.matieresClasses,
      icon: iconSubjectsOfClass,
      to: "/admin/subjects/matieres-classes",
    },
    {
      key: "matieresCompetences",
      label: t.matieresCompetences,
      icon: iconCompetence,
    },
  ];

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-3xl">
        {items.map((item) => (
          <AdminMenuCard
            key={item.key}
            label={item.label}
            icon={item.icon}
            to={item.to}
          />
        ))}
      </div>
    </div>
  );
};

export default SubjectsHub;
