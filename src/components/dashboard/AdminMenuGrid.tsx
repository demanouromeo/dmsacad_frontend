import { useLanguage } from "../../i18n/useLanguage";
import { adminMenuTranslations } from "../../i18n/translations";
import AdminMenuCard from "./AdminMenuCard";

import iconSchoolDetails from "../../assets/menu/Information de bqse.svg";
import iconFilieres from "../../assets/menu/Filières.svg";
import iconSpecialities from "../../assets/menu/Spécialités.svg";
import iconClasses from "../../assets/menu/Gestion des classes.svg";
import iconSubjects from "../../assets/menu/Matières.svg";
import iconStaff from "../../assets/menu/Gestion du personnel.svg";
import iconAssignCourses from "../../assets/menu/Attribution.svg";
import iconStudents from "../../assets/menu/Gestion des élèves.svg";
import iconMarksEntry from "../../assets/menu/Saisie des notes.svg";
import iconMarkSheet from "../../assets/menu/Fiches de report de notes.svg";
import iconPrintReportCards from "../../assets/menu/Imprimer les bulletins.svg";
import iconFillRate from "../../assets/menu/Taux_de_remplissage.svg";
import iconDiscipline from "../../assets/menu/Discipline.svg";
import iconSummary from "../../assets/menu/Bilan.svg";
import iconSms from "../../assets/menu/Gestion des messages.svg";
import iconSchoolReport from "../../assets/menu/Livret Scolaires.svg";
import iconParents from "../../assets/menu/Parents.svg";
import iconManageAccount from "../../assets/menu/Gestion des comptes utilisateurs.svg";
import iconSettings from "../../assets/menu/Settings.svg";
import iconPromotions from "../../assets/menu/Promotion.svg";
import iconBasculement from "../../assets/menu/Basculement.svg";
import iconScholarship from "../../assets/menu/Boursiers.svg";
import iconInsolvents from "../../assets/menu/Insolvables.svg";

type AdminMenuKey = keyof (typeof adminMenuTranslations)["fr"];

interface AdminMenuItem {
  key: AdminMenuKey;
  icon: string;
  to?: string;
}

// `to` is only set for functionalities that are actually implemented; the rest render
// as non-clickable cards until their screens are built.
const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { key: "schoolDetails", icon: iconSchoolDetails, to: "/admin/school-info" },
  { key: "filieres", icon: iconFilieres, to: "/admin/filieres" },
  { key: "specialities", icon: iconSpecialities, to: "/admin/specialities" },
  { key: "classes", icon: iconClasses, to: "/admin/classes" },
  { key: "subjects", icon: iconSubjects, to: "/admin/subjects" },
  { key: "staff", icon: iconStaff, to: "/admin/staffs" },
  {
    key: "assignCourses",
    icon: iconAssignCourses,
    to: "/admin/course-assignment",
  },
  { key: "students", icon: iconStudents, to: "/admin/students" },
  { key: "marksEntry", icon: iconMarksEntry, to: "/admin/mark-entry" },
  { key: "markSheet", icon: iconMarkSheet },
  { key: "printReportCards", icon: iconPrintReportCards },
  { key: "fillRate", icon: iconFillRate },
  { key: "discipline", icon: iconDiscipline },
  { key: "summary", icon: iconSummary, to: "/admin/effectifs" },
  { key: "sms", icon: iconSms },
  { key: "schoolReport", icon: iconSchoolReport },
  { key: "parents", icon: iconParents },
  { key: "manageAccount", icon: iconManageAccount },
  { key: "settings", icon: iconSettings },
  { key: "promotions", icon: iconPromotions },
  { key: "basculement", icon: iconBasculement },
  { key: "scholarship", icon: iconScholarship },
  { key: "insolvents", icon: iconInsolvents },
];

const AdminMenuGrid = () => {
  const [language] = useLanguage();
  const t = adminMenuTranslations[language];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {ADMIN_MENU_ITEMS.map((item) => (
        <AdminMenuCard
          key={item.key}
          label={t[item.key]}
          icon={item.icon}
          to={item.to}
        />
      ))}
    </div>
  );
};

export default AdminMenuGrid;
