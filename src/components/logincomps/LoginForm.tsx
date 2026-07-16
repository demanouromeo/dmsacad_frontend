import { Eye, EyeOff, UsersRound } from "lucide-react";
import img from "../../assets/medium/login_img1.png";
import Title from "../Title";
import React, { useEffect, useState } from "react";
import { MyReader } from "../../dbmanger/MyReader";
import { useCookies } from "react-cookie";
import Loading from "../sharedcomp/Loading";
import { useNavigate } from "react-router-dom";
import type { Account } from "../../interfaces/Account";
import { MyConstants } from "../../dbmanger/MyConstants";
import { FlagFR, FlagGB } from "../sharedcomp/Flags";
import { loginTranslations, type Language } from "../../i18n/translations";

const LoginForm = () => {
  const [loginVal, setLoginVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schoolList, setSchoolList] = useState([]);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<Language>(
    (localStorage.getItem(MyConstants.LANGUAGE_KEY) as Language) || "fr",
  );
  //const [cookies, setCookie, removeCookie] = useCookies(["schoolName"]);
  const [cookies, setCookie] = useCookies(["schoolName"]);
  const navigate = useNavigate();
  const t = loginTranslations[language];

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(MyConstants.LANGUAGE_KEY, lang);
  };

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchool(e.target.value);
    console.log("Selected school is now: " + e.target.value);
    //console.log("Selected school is now: " + selectedSchool);
    setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 });
    console.log("Cookie set to: " + cookies.schoolName);

    // if (selectedSchool && selectedSchool !== "") {
    //   loadAccounts(selectedSchool);  IT DOESN'T WORK WHEN THE PARAMETER IS THE STATE VARIABLE 'selectedSchool', IT WORKS WHEN IT'S THE EVENT TARGET VALUE, I DON'T KNOW WHY
    // }
    if (e.target.value && e.target.value !== "") {
      loadAccounts(e.target.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    //setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 });
    sessionStorage.setItem(MyConstants.SCHOOL_NAME_KEY, selectedSchool);
    if (selectedSchool === "") {
      alert(t.alertNoSchool(selectedSchool));
      return;
    }

    const account = accountList.find(
      (acc) =>
        (acc.login === loginVal || acc.pwd === passwordVal) &&
        acc.pwd === passwordVal,
    );

    if (!account) {
      alert(t.alertBadCredentials(selectedSchool));
      return;
    } else {
      navigate("/dashboard-teacher");
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadSchools();
    var school = sessionStorage.getItem(MyConstants.SCHOOL_NAME_KEY);
    if (school && school !== "") {
      setSelectedSchool(school);
      loadAccounts(school);
    }
  }, []);

  const loadSchools = async () => {
    const list = await MyReader.fetchSchools();
    setSchoolList(list);
    setIsLoading(false);
  };

  const loadAccounts = async (school = "") => {
    setIsLoading(true);
    const list = await MyReader.fetchAccounts(school);
    console.log(
      "LoginForm.loadAccounts()\nAccounts list loaded for school " + school,
      //   +": ",
      // list,
    );
    setAccountList(list);
    setIsLoading(false);
  };

  // const deleteCookie = (name: string, path: string = "/") => {
  //   // Overwrite the cookie with an expired date
  //   document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
  // };

  return (
    <div className=" md:h-screen bg-base-300 p-10 mb-10 md:mb-32" id="About">
      <div className="flex justify-end gap-2 mb-2">
        <button
          type="button"
          aria-label="Français"
          title="Français"
          onClick={() => handleLanguageChange("fr")}
          className={`w-8 h-6 rounded overflow-hidden border-2 cursor-pointer ${
            language === "fr" ? "border-primary" : "border-transparent opacity-60"
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
            language === "en" ? "border-primary" : "border-transparent opacity-60"
          }`}
        >
          <FlagGB className="w-full h-full" />
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
    </div>
  );
};

export default LoginForm;
