import { useState } from "react";
import { useLanguage } from "../../i18n/useLanguage";
import { adminMenuTranslations, subjectsHubTranslations } from "../../i18n/translations";
import AdminMenuCard from "./AdminMenuCard";
import SearchInput from "../sharedcomp/SearchInput";

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
type SubjectsHubKey = keyof (typeof subjectsHubTranslations)["fr"];

// The 4 sub-modules reachable from the "subjects" card via SubjectsHub - the only functionality with
// subfunctionalities right now (see SubjectsHub.tsx). Searching one of their names (e.g.
// "compétences") still surfaces the parent "subjects" card below, since a subfunctionality has no
// card of its own on this grid.
const SUBJECT_SUB_ITEM_KEYS: SubjectsHubKey[] = [
  "matieres",
  "groupes",
  "matieresClasses",
  "matieresCompetences",
];

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
  { key: "markSheet", icon: iconMarkSheet, to: "/admin/mark-sheet" },
  { key: "printReportCards", icon: iconPrintReportCards, to: "/admin/report-cards" },
  { key: "fillRate", icon: iconFillRate, to: "/admin/fill-rate" },
  { key: "discipline", icon: iconDiscipline, to: "/admin/discipline" },
  { key: "summary", icon: iconSummary, to: "/admin/effectifs" },
  { key: "sms", icon: iconSms },
  { key: "schoolReport", icon: iconSchoolReport },
  { key: "parents", icon: iconParents },
  { key: "manageAccount", icon: iconManageAccount, to: "/admin/manage-accounts" },
  { key: "settings", icon: iconSettings, to: "/admin/settings" },
  { key: "promotions", icon: iconPromotions, to: "/admin/promotion" },
  { key: "basculement", icon: iconBasculement },
  { key: "scholarship", icon: iconScholarship },
  { key: "insolvents", icon: iconInsolvents, to: "/admin/insolvables" },
];

const AdminMenuGrid = () => {
  const [language] = useLanguage();
  const t = adminMenuTranslations[language];
  const hubT = subjectsHubTranslations[language];
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(query);
  const filteredItems =
    query === ""
      ? ADMIN_MENU_ITEMS
      : ADMIN_MENU_ITEMS.filter(
          (item) =>
            matches(t[item.key]) ||
            (item.key === "subjects" &&
              SUBJECT_SUB_ITEM_KEYS.some((key) => matches(hubT[key]))),
        );

  return (
    <div>
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t.searchPlaceholder}
        className="w-full max-w-sm mb-6"
      />
      {filteredItems.length === 0 ? (
        <p className="opacity-60 text-center py-10">{t.searchNoResults}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {filteredItems.map((item) => (
            <AdminMenuCard
              key={item.key}
              label={t[item.key]}
              icon={item.icon}
              to={item.to}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMenuGrid;
