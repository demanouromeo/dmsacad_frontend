import { Eye, EyeOff, UsersRound, Cloud, Server, Settings, X } from "lucide-react";
import img from "../../assets/medium/login_img1.png";
import Title from "../Title";
import React, { useEffect, useRef, useState } from "react";
import { MyReader } from "../../dbmanger/MyReader";
import { useCookies } from "react-cookie";
import Loading from "../sharedcomp/Loading";
import { useNavigate } from "react-router-dom";
import type { Account } from "../../interfaces/Account";
import type { SchoolYear } from "../../interfaces/SchoolYear";
import { MyConstants, type BackendTarget } from "../../dbmanger/MyConstants";
import { FlagFR, FlagGB } from "../sharedcomp/Flags";
import { loginTranslations, type Language } from "../../i18n/translations";

const LoginForm = () => {
  const [loginVal, setLoginVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [remoteSchool, setRemoteSchool] = useState("");
  const [schoolList, setSchoolList] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [schoolYearList, setSchoolYearList] = useState<SchoolYear[]>([]);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<Language>(
    (localStorage.getItem(MyConstants.LANGUAGE_KEY) as Language) || "fr",
  );
  const [backendTarget, setBackendTargetState] = useState<BackendTarget>(
    MyConstants.getBackendTarget(),
  );
  //const [cookies, setCookie, removeCookie] = useCookies(["schoolName"]);
  const [cookies, setCookie] = useCookies(["schoolName"]);
  const navigate = useNavigate();
  const t = loginTranslations[language];
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(MyConstants.LANGUAGE_KEY, lang);
  };

  const openSettings = () => {
    settingsDialogRef.current?.showModal();
  };

  const closeSettings = () => {
    settingsDialogRef.current?.close();
  };

  const handleSettingsDialogClose = () => {
    settingsButtonRef.current?.focus();
  };

  const handleBackendTargetChange = (target: BackendTarget) => {
    setBackendTargetState(target);
    MyConstants.setBackendTarget(target);
    setSelectedSchoolYear("");
    setSchoolYearList([]);

    if (target === "local") {
      setRemoteSchool(selectedSchool);
      setSelectedSchool(MyConstants.gLocalSchoolCode);
      loadSchoolYears(MyConstants.gLocalSchoolCode);
    } else {
      setSelectedSchool(remoteSchool);
      loadSchools();
      if (remoteSchool) {
        loadSchoolYears(remoteSchool);
      }
    }
  };

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchool(e.target.value);
    console.log("Selected school is now: " + e.target.value);
    //console.log("Selected school is now: " + selectedSchool);
    setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 });
    console.log("Cookie set to: " + cookies.schoolName);

    setSelectedSchoolYear("");
    setSchoolYearList([]);
    if (e.target.value && e.target.value !== "") {
      loadSchoolYears(e.target.value);
    }
  };

  const handleSchoolYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchoolYear(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    //setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 });
    sessionStorage.setItem(MyConstants.SCHOOL_NAME_KEY, selectedSchool);
    sessionStorage.setItem(MyConstants.SCHOOL_YEAR_KEY, selectedSchoolYear);
    if (selectedSchool === "") {
      //alert(t.alertNoSchool(selectedSchool));
      //DISPLAY A BEAUTIFUL BOX RATHER THAN AN ALERT
      return;
    }
    if (selectedSchoolYear === "") {
      return;
    }

    connectUser();
  };

  useEffect(() => {
    var year = sessionStorage.getItem(MyConstants.SCHOOL_YEAR_KEY);
    if (year && year !== "") {
      setSelectedSchoolYear(year);
    }

    if (MyConstants.getBackendTarget() === "local") {
      setSelectedSchool(MyConstants.gLocalSchoolCode);
      loadSchoolYears(MyConstants.gLocalSchoolCode);
      return;
    }

    setIsLoading(true);
    loadSchools();
    var school = sessionStorage.getItem(MyConstants.SCHOOL_NAME_KEY);
    if (school && school !== "") {
      setSelectedSchool(school);
      setRemoteSchool(school);
      loadSchoolYears(school);
    }
  }, []);

  const loadSchools = async () => {
    const list = await MyReader.fetchSchools();
    setSchoolList(list);
    setIsLoading(false);
  };

  const loadSchoolYears = async (connection = "") => {
    const list = await MyReader.fetchSchoolYears(connection);
    setSchoolYearList(list);
  };

  return (
    <div className=" md:h-screen bg-base-300 p-10 mb-10 md:mb-32" id="About">
      <div className="flex justify-end items-center gap-2 mb-2">
        <button
          type="button"
          aria-label="Français"
          title="Français"
          onClick={() => handleLanguageChange("fr")}
          className={`w-8 h-6 rounded overflow-hidden border-2 cursor-pointer ${
            language === "fr"
              ? "border-primary"
              : "border-transparent opacity-60"
          }`}
        >
          <FlagFR className="w-full h-full" />
        </button>
        <button
          type="button"
          aria-label="English"
          title="English"
          onClick={() => handleLanguageChange("en")}
          className={`w-8 h-6 rounded overflow-hidden border-2 cursor-pointer ${
            language === "en"
              ? "border-primary"
              : "border-transparent opacity-60"
          }`}
        >
          <FlagGB className="w-full h-full" />
        </button>
        <button
          ref={settingsButtonRef}
          type="button"
          aria-label={t.settingsBtn}
          title={t.settingsBtn}
          onClick={openSettings}
          className="btn btn-xs btn-ghost btn-circle"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
      <Title title={t.title} />
      <div className="flex justify-center items-center ">
        <div className="hidden md:block md:h-120 w-96">
          <img
            src={img}
            alt=""
            className=" h-full w-full object-cover rounded-tl-xl rounded-bl-xl"
          />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex items-center md:h-120 bg-base-10 border-base-500  rounded-xl md:rounded-tr-xl md:rounded-br-xl md:md:rounded-bl-none md:md:rounded-tl-none w-sm md:w-95 border p-4">
            <div className="w-full">
              <label className="label" htmlFor="login">
                {t.loginLabel}
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input w-full"
                  placeholder={t.loginPlaceholder}
                  required
                  id="login"
                  value={loginVal}
                  onChange={(e) => setLoginVal(e.target.value)}
                />
                <UsersRound className="absolute w-5 h-5 top-2.5 right-2.5 text-slate-600" />
              </div>

              <label className="label mt-5" htmlFor="password">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input w-full"
                  placeholder={t.passwordPlaceholder}
                  required
                  id="password"
                  value={passwordVal}
                  onChange={(e) => setPasswordVal(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-2.5 right-2.5 text-slate-600 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="flex justify-center">
                {isLoading ? <Loading /> : <p></p>}
              </div>
              <button
                className="btn btn-neutral mb-4 w-full mt-4"
                type="submit"
              >
                {t.submitBtn}
              </button>
            </div>
          </div>
        </form>
      </div>

      <dialog
        ref={settingsDialogRef}
        className="modal"
        onClose={handleSettingsDialogClose}
      >
        <div className="modal-box">
          <button
            type="button"
            aria-label={t.closeBtn}
            title={t.closeBtn}
            onClick={closeSettings}
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="font-bold text-lg mb-4">{t.settingsTitle}</h3>

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              aria-label="Remote server"
              title="Remote server"
              onClick={() => handleBackendTargetChange("remote")}
              className={`btn btn-sm gap-1 ${
                backendTarget === "remote" ? "btn-primary" : "btn-ghost"
              }`}
            >
              <Cloud className="w-4 h-4" />
              {t.remoteBtn}
            </button>
            <button
              type="button"
              aria-label="Local server"
              title="Local server"
              onClick={() => handleBackendTargetChange("local")}
              className={`btn btn-sm gap-1 ${
                backendTarget === "local" ? "btn-primary" : "btn-ghost"
              }`}
            >
              <Server className="w-4 h-4" />
              {t.localBtn}
            </button>
          </div>

          {backendTarget !== "local" && (
            <>
              <label htmlFor="schoolList" className="label mt-5">
                {t.schoolLabel}
              </label>
              <select
                id="schoolList"
                className="select w-full"
                onChange={handleSchoolChange}
                value={selectedSchool}
              >
                {schoolList.map((school: any, index) => (
                  <option key={index} value={school}>
                    {school}
                  </option>
                ))}
              </select>
              <label className="label mt-1 mb-3">
                {selectedSchool ? t.currentSchool + selectedSchool : ""}
              </label>
            </>
          )}

          <label htmlFor="schoolYearList" className="label mt-5">
            {t.schoolYearLabel}
          </label>
          <select
            id="schoolYearList"
            className="select w-full"
            onChange={handleSchoolYearChange}
            value={selectedSchoolYear}
            disabled={schoolYearList.length === 0}
          >
            <option value="" disabled>
              {t.schoolYearLabel}
            </option>
            {schoolYearList.map((schoolYear) => (
              <option key={schoolYear.sy_id} value={schoolYear.year}>
                {schoolYear.year}
                {schoolYear.is_current ? " *" : ""}
              </option>
            ))}
          </select>
          <label className="label mt-1 mb-3">
            {selectedSchoolYear
              ? t.currentSchoolYear + selectedSchoolYear
              : ""}
          </label>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t.closeBtn}</button>
        </form>
      </dialog>
    </div>
  );
};

export default LoginForm;
function connectUser() {
  //Implement the logic to connect the user here, such as validating credentials and navigating to the dashboard.
  //if user is connected navigate to dashboard according to his role, if not display an error message
}
