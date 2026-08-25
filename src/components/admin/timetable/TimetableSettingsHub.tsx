import { useLanguage } from "../../../i18n/useLanguage";
import { timetableSettingsHubTranslations } from "../../../i18n/translations";
import AdminMenuCard from "../../dashboard/AdminMenuCard";
import CloseButton from "../../sharedcomp/CloseButton";
import iconStaffLoad from "../../../assets/compo/timetable/staff_load_settings.svg";
import iconTtConfig from "../../../assets/compo/timetable/tt_config_settings.svg";
import iconJours from "../../../assets/compo/timetable/jours_settings.svg";
import iconSubjects from "../../../assets/compo/timetable/subject_settings.svg";

// Landing page for the "Time table settings" submodule (reached from TimetableHub's settings
// button) - same tile-grid pattern as SettingsHub/SubjectsHub. Four sub-screens: teacher weekly load
// (staff_year.max_periods_per_week), time configuration (tt_config), school days (jours), and
// subjects-per-class timetable settings (subject_classe.weight/numnber_of_period_per_week/commoncourse).
const TimetableSettingsHub = () => {
  const [language] = useLanguage();
  const t = timetableSettingsHubTranslations[language];

  const items: { key: string; label: string; icon: string; to?: string }[] = [
    {
      key: "staffLoad",
      label: t.staffLoad,
      icon: iconStaffLoad,
      to: "/admin/timetable/settings/staff-load",
    },
    {
      key: "ttConfig",
      label: t.ttConfig,
      icon: iconTtConfig,
      to: "/admin/timetable/settings/config",
    },
    {
      key: "jours",
      label: t.jours,
      icon: iconJours,
      to: "/admin/timetable/settings/days",
    },
    {
      key: "subjects",
      label: t.subjects,
      icon: iconSubjects,
      to: "/admin/timetable/settings/subjects",
    },
  ];

  return (
    <div className="page-shell flex flex-col items-center">
      <div className="page-header w-full max-w-2xl">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>
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

export default TimetableSettingsHub;
