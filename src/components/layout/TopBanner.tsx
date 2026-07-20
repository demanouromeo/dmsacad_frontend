import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
import {
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  Home,
  KeyRound,
  LogOut,
  Settings,
  SlidersHorizontal,
  UserCog,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { bannerTranslations } from "../../i18n/translations";
import { MyReader } from "../../dbmanger/MyReader";
import { SchoolInfoReader } from "../../dbmanger/SchoolInfoReader";
import { MyConstants } from "../../dbmanger/MyConstants";
import type { SchoolYear } from "../../interfaces/SchoolYear";
import type { SchoolHeaderConfig } from "../../interfaces/SchoolHeaderConfig";
import { FlagFR, FlagGB } from "../sharedcomp/Flags";

const TopBanner = () => {
  const {
    connection,
    schoolYear,
    section,
    setSchoolYear,
    setSection,
    authPayload,
    logout,
  } = useAuth();
  const [language, setLanguage] = useLanguage();
  const t = bannerTranslations[language];
  const navigate = useNavigate();
  const location = useLocation();
  // Hidden on /dashboard - it's the root of the authenticated app, so browser history above it is
  // either nothing or the unauthenticated login page, neither of which "back" should surface here.
  const canGoBack = location.pathname !== "/dashboard";

  const [cookies] = useCookies([MyConstants.SCHOOL_HEADER_CONFIG_KEY]);
  const schoolHeaderConfig = cookies[MyConstants.SCHOOL_HEADER_CONFIG_KEY] as
    | SchoolHeaderConfig
    | undefined;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const schoolYearDialogRef = useRef<HTMLDialogElement>(null);
  const sectionDialogRef = useRef<HTMLDialogElement>(null);
  const [schoolYearList, setSchoolYearList] = useState<SchoolYear[]>([]);
  const [draftSchoolYear, setDraftSchoolYear] = useState(schoolYear);
  const [draftSection, setDraftSection] = useState(section);

  // The school header (name/address/logo_path) cookie is set at login (see AuthContext.login) -
  // reload the actual logo image whenever the recorded logo_path changes rather than fetching the
  // config again here, following the same SchoolInfoReader.loadLogoImage convention as
  // SchoolInfoManager's preview.
  useEffect(() => {
    let cancelled = false;
    SchoolInfoReader.loadLogoImage(schoolHeaderConfig?.logo_path).then(
      (logoImage) => {
        if (!cancelled) {
          setLogoUrl(logoImage ? logoImage.src : null);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [schoolHeaderConfig?.logo_path]);

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

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      <div className="navbar bg-base-100 shadow fixed top-0 inset-x-0 z-50 px-4">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={t.logoAlt}
              className="h-10 w-10 rounded object-contain shrink-0"
            />
          )}
          <div className="flex items-center gap-1 shrink-0">
            {canGoBack && (
              <div className="tooltip tooltip-bottom" data-tip={t.backHint}>
                <button
                  type="button"
                  className="btn btn-ghost btn-circle"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            )}
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

          <div className="dropdown dropdown-end">
            <div className="tooltip tooltip-bottom" data-tip={t.profileHint}>
              <div
                tabIndex={0}
                role="button"
                className="avatar avatar-placeholder"
              >
                <div className="bg-neutral text-neutral-content w-10 rounded-full">
                  <UserRound className="w-5 h-5" />
                </div>
              </div>
            </div>
            <ul className="dropdown-content menu bg-base-100 rounded-box z-10 w-64 p-2 shadow">
              <li>
                <button type="button" disabled className="text-base-content/50">
                  <SlidersHorizontal className="w-4 h-4" />
                  {t.profileMenuPreferences}
                  <span className="opacity-60 text-xs ml-auto">
                    {t.comingSoonTooltip}
                  </span>
                </button>
              </li>
              <li>
                <button type="button" disabled className="text-base-content/50">
                  <UserCog className="w-4 h-4" />
                  {t.profileMenuEditProfile}
                  <span className="opacity-60 text-xs ml-auto">
                    {t.comingSoonTooltip}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/account/credentials")}
                >
                  <KeyRound className="w-4 h-4" />
                  {t.profileMenuCredentials}
                </button>
              </li>
              {authPayload?.role === "ADMIN" && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/settings")}
                  >
                    <Settings className="w-4 h-4" />
                    {t.profileMenuSettings}
                  </button>
                </li>
              )}
              <li>
                <button type="button" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  {t.profileMenuLogout}
                </button>
              </li>
            </ul>
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
