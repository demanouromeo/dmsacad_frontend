import type { adminMenuTranslations } from "../../i18n/translations";

import iconSchoolDetails from "../../assets/menu/Information de bqse.svg";
import iconFilieres from "../../assets/menu/Filières.svg";
import iconSpecialities from "../../assets/menu/Spécialités.svg";
import iconClasses from "../../assets/menu/Gestion des classes.svg";
import iconSubjects from "../../assets/menu/Matières.svg";
import iconStaff from "../../assets/menu/Gestion du personnel.svg";
import iconAssignCourses from "../../assets/menu/Attribution.svg";
import iconTimetable from "../../assets/menu/Emploi du temps.svg";
import iconManageVp from "../../assets/menu/censeur.svg";
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

// Plain data module (no component export) so both AdminMenuGrid/Dashboard and MagicAssistant
// (see assistantEngine.ts's "what can I access" answer) share one source of truth for which
// modules exist per role, instead of keeping a second hand-maintained copy in sync. Split out of
// AdminMenuGrid.tsx/Dashboard.tsx specifically because a file mixing a component export with a
// plain constant export breaks React Fast Refresh (same reason AuthContext was split into
// authContext.ts/useAuth.ts - see that pattern elsewhere in this app).

export type AdminMenuKey = keyof (typeof adminMenuTranslations)["fr"];

export interface AdminMenuItem {
  key: AdminMenuKey;
  icon: string;
  to?: string;
}

// `to` is only set for functionalities that are actually implemented; the rest render
// as non-clickable cards until their screens are built.
export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
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
  { key: "timetable", icon: iconTimetable, to: "/admin/timetable" },
  { key: "manageVp", icon: iconManageVp, to: "/admin/vp-management" },
  { key: "students", icon: iconStudents, to: "/admin/students" },
  { key: "marksEntry", icon: iconMarksEntry, to: "/admin/mark-entry" },
  { key: "markSheet", icon: iconMarkSheet, to: "/admin/mark-sheet" },
  { key: "printReportCards", icon: iconPrintReportCards, to: "/admin/report-cards" },
  { key: "fillRate", icon: iconFillRate, to: "/admin/fill-rate" },
  { key: "discipline", icon: iconDiscipline, to: "/admin/discipline" },
  { key: "summary", icon: iconSummary, to: "/admin/effectifs" },
  { key: "sms", icon: iconSms },
  { key: "schoolReport", icon: iconSchoolReport },
  { key: "parents", icon: iconParents, to: "/admin/parents" },
  { key: "manageAccount", icon: iconManageAccount, to: "/admin/manage-accounts" },
  { key: "settings", icon: iconSettings, to: "/admin/settings" },
  { key: "promotions", icon: iconPromotions, to: "/admin/promotion" },
  { key: "basculement", icon: iconBasculement, to: "/admin/basculement" },
  { key: "scholarship", icon: iconScholarship, to: "/admin/scholarship" },
  { key: "insolvents", icon: iconInsolvents, to: "/admin/insolvables" },
];

// SG/CENSEUR/TEACHER have no AdminMenuGrid (ADMIN-only) - this is their only navigable entry
// point into the modules RequireRole lets them reach (see App.tsx: /admin/discipline allows
// ADMIN+SG+CENSEUR, /admin/classes+/admin/subjects/matieres-classes+/admin/students allow
// ADMIN+CENSEUR, /admin/mark-entry allows ADMIN+SG+CENSEUR+TEACHER). Each screen does its own
// further filtering (DisciplineManager/ClasseManager/SubjectClasseManager/StudentManager by
// Classe.sg_id or Classe.vp_id, MarkEntryManager by course assignment) - this list only decides
// which cards a role sees at all.
export const NON_ADMIN_MENU_ITEMS: Record<
  string,
  {
    key: "discipline" | "marksEntry" | "classes" | "subjectsOfClasse" | "students";
    icon: string;
    to: string;
  }[]
> = {
  SG: [
    { key: "discipline", icon: iconDiscipline, to: "/admin/discipline" },
    { key: "marksEntry", icon: iconMarksEntry, to: "/admin/mark-entry" },
  ],
  TEACHER: [{ key: "marksEntry", icon: iconMarksEntry, to: "/admin/mark-entry" }],
  CENSEUR: [
    { key: "marksEntry", icon: iconMarksEntry, to: "/admin/mark-entry" },
    { key: "discipline", icon: iconDiscipline, to: "/admin/discipline" },
    { key: "classes", icon: iconClasses, to: "/admin/classes" },
    { key: "subjectsOfClasse", icon: iconSubjects, to: "/admin/subjects/matieres-classes" },
    { key: "students", icon: iconStudents, to: "/admin/students" },
  ],
};
