import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, GraduationCap, Home, UserRound } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { bannerTranslations } from "../../i18n/translations";
import { MyReader } from "../../dbmanger/MyReader";
import type { SchoolYear } from "../../interfaces/SchoolYear";
import { FlagFR, FlagGB } from "../sharedcomp/Flags";

const TopBanner = () => {
  const { connection, schoolYear, section, setSchoolYear, setSection } =
    useAuth();
  const [language, setLanguage] = useLanguage();
  const t = bannerTranslations[language];

  const schoolYearDialogRef = useRef<HTMLDialogElement>(null);
  const sectionDialogRef = useRef<HTMLDialogElement>(null);
  const [schoolYearList, setSchoolYearList] = useState<SchoolYear[]>([]);
  const [draftSchoolYear, setDraftSchoolYear] = useState(schoolYear);
  const [draftSection, setDraftSection] = useState(section);

  const openSchoolYearDialog = async () => {
    setDraftSchoolYear(schoolYear);
    const list = await MyReader.fetchSchoolYears(connection);
    setSchoolYearList(list);
    schoolYearDialogRef.current?.showModal();
  };

  const saveSchoolYear = () => {
    setSchoolYear(draftSchoolYear);
    schoolYearDialogRef.current?.close();
  };

  const openSectionDialog = () => {
    setDraftSection(section);
    sectionDialogRef.current?.showModal();
  };

  const saveSection = () => {
    setSection(draftSection);
    sectionDialogRef.current?.close();
  };

  return (
    <>
      <div className="navbar bg-base-100 shadow fixed top-0 inset-x-0 z-50 px-4">
        <div className="flex-1 flex items-center gap-1">
          <div className="tooltip tooltip-bottom" data-tip={t.homeHint}>
            <Link to="/dashboard" className="btn btn-ghost btn-circle">
              <Home className="w-5 h-5" />
            </Link>
          </div>
          <div className="tooltip tooltip-bottom" data-tip={t.schoolYearHint}>
            <button
              type="button"
              className="btn btn-ghost btn-circle"
              onClick={openSchoolYearDialog}
            >
              <CalendarDays className="w-5 h-5" />
            </button>
          </div>
          <div className="tooltip tooltip-bottom" data-tip={t.sectionHint}>
            <button
              type="button"
              className="btn btn-ghost btn-circle"
              onClick={openSectionDialog}
            >
              <GraduationCap className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="dropdown dropdown-end">
            <div
              className="tooltip tooltip-bottom"
              data-tip={t.languageHint}
            >
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-circle"
              >
                {language === "fr" ? (
                  <FlagFR className="w-6 h-4" />
                ) : (
                  <FlagGB className="w-6 h-4" />
                )}
              </div>
            </div>
            <ul className="dropdown-content menu bg-base-100 rounded-box z-10 w-32 p-2 shadow">
              <li>
                <button type="button" onClick={() => setLanguage("fr")}>
                  <FlagFR className="w-6 h-4" />
                  Français
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLanguage("en")}>
                  <FlagGB className="w-6 h-4" />
                  English
                </button>
              </li>
            </ul>
          </div>

          <div className="tooltip tooltip-bottom" data-tip={t.profileHint}>
            <div className="avatar avatar-placeholder">
              <div className="bg-neutral text-neutral-content w-10 rounded-full">
                <UserRound className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <dialog ref={schoolYearDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">
            {t.schoolYearDialogTitle}
          </h3>
          <select
            className="select w-full"
            value={draftSchoolYear}
            onChange={(e) => setDraftSchoolYear(e.target.value)}
          >
            {schoolYearList.map((sy) => (
              <option key={sy.sy_id} value={sy.year}>
                {sy.year}
                {sy.is_current ? " *" : ""}
              </option>
            ))}
          </select>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => schoolYearDialogRef.current?.close()}
            >
              {t.cancelBtn}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveSchoolYear}
            >
              {t.saveBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t.cancelBtn}</button>
        </form>
      </dialog>

      <dialog ref={sectionDialogRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">{t.sectionDialogTitle}</h3>
          <div className="flex gap-4">
            <label className="label gap-2">
              <input
                type="radio"
                name="banner-section"
                className="radio"
                value="francophone"
                checked={draftSection === "francophone"}
                onChange={(e) => setDraftSection(e.target.value)}
              />
              {t.francoLabel}
            </label>
            <label className="label gap-2">
              <input
                type="radio"
                name="banner-section"
                className="radio"
                value="anglophone"
                checked={draftSection === "anglophone"}
                onChange={(e) => setDraftSection(e.target.value)}
              />
              {t.anglophoneLabel}
            </label>
          </div>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => sectionDialogRef.current?.close()}
            >
              {t.cancelBtn}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveSection}
            >
              {t.saveBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t.cancelBtn}</button>
        </form>
      </dialog>
    </>
  );
};

export default TopBanner;
