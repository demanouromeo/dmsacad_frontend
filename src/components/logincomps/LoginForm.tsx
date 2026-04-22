import { KeySquare, UsersRound } from "lucide-react";
import img from "../../assets/medium/login_img1.png";
import Title from "../Title";
import React, { useEffect, useState } from "react";
import { MyReader } from "../../dbmanger/MyReader";
import { useCookies } from "react-cookie";
import Loading from "../sharedcomp/Loading";
import { MyConstants } from "../../dbmanger/MyConstants";
import { useNavigate } from "react-router-dom";

const LoginForm = () => {
  const [loginVal, setLoginVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schoolList, setSchoolList] = useState([]);
  const [accountList, setAccountList] = useState([]);
  //const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // 'user' is the name of the cookie we want to access
  //const [cookies, setCookie, removeCookie] = useCookies(["schoolName"]);
  const [cookies, setCookie, removeCookie] = useCookies(["schoolName"]);
  //const vGap1 = 4;
  //const vGap2 = 4;
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    //console.log("Login form submitted");
    //alert(selectedSchool);
    // const list = await MyReader.fetchSchools();
    // setSchoolList(list);
    // alert(list.length);
    setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 }); //Duration of 7 days (7 days * 24 hours/day * 60 minutes/hour * 60 seconds/minute). "/" means the cookie is accessible on all pages of the site.
    //const list = await MyReader.fetchAccounts(selectedSchool);
    const accountsUrl = `${MyConstants.gBaserUrl}api/accounts/${selectedSchool}`;
    console.log("Fetching accounts from: " + accountsUrl);
    navigate("/dashboard-teacher");
  };
  useEffect(() => {
    setIsLoading(true);
    const loadSchools = async () => {
      const list = await MyReader.fetchSchools();
      setSchoolList(list);
      //console.log(schoolList);
      setIsLoading(false);
    };
    loadSchools();

    const loadAccounts = async () => {
      setIsLoading(true);
      const list = await MyReader.fetchAccounts(cookies.schoolName);
      setAccountList(list);
      //alert(accountList.length);
      console.log("accountList: " + accountList);
      //console.log(list);
      setIsLoading(false);
      // for (let i = 0; i < list.length; i++) {
      //   console.log(list[i]);
      // }
    };
    loadAccounts();
  }, []);
  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchool(e.target.value);
    // if (cookies.schoolName != "" && selectedSchool == "") {
    //   setSelectedSchool(cookies.schoolName);
    // }
    console.log("Selected school is now: " + e.target.value);
    removeCookie("schoolName");
    setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 });
    console.log("cookies.schoolName is now: " + cookies.schoolName);
  };

  const deleteCookie = (name: string, path: string = "/") => {
    // Overwrite the cookie with an expired date
    document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
  };

  return (
    <div className=" md:h-screen bg-base-300 p-10 mb-10 md:mb-32" id="About">
      <Title title="Connexion" />
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
                Login
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Login ou code utilisateur"
                  id="login"
                  value={loginVal}
                  onChange={(e) => setLoginVal(e.target.value)}
                />
                <UsersRound className="absolute w-5 h-5 top-2.5 right-2.5 text-slate-600" />
              </div>

              <label className="label mt-5" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type="password"
                  className="input w-full"
                  placeholder="Mot de passe"
                  id="password"
                  value={passwordVal}
                  onChange={(e) => setPasswordVal(e.target.value)}
                />
                <KeySquare className="absolute w-5 h-5 top-2.5 right-2.5 text-slate-600" />
              </div>

              <label htmlFor="schoolList" className="label mt-5">
                Veuillez sélectionner votre école
              </label>
              <select
                id="schoolList"
                className="select w-full"
                onChange={handleSchoolChange}
              >
                <option defaultValue="">
                  Veuillez sélectionner votre école
                </option>
                {schoolList.map((school: any, index) => (
                  <option key={index} value={school}>
                    {school}
                  </option>
                ))}
              </select>
              <label className="label mt-1 mb-3">
                {selectedSchool
                  ? "Ecole actuelle: " + selectedSchool
                  : cookies.schoolName
                    ? "Ecole actuelle: " + cookies.schoolName
                    : "Aucune école sélectionnée"}
              </label>

              <div className="flex justify-center">
                {isLoading ? <Loading /> : <p></p>}
              </div>
              <button
                className="btn btn-neutral mb-4 w-full mt-4"
                type="submit"
              >
                Se connecter
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;
