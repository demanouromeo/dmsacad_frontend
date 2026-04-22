import { KeySquare, UsersRound } from "lucide-react";
import img from "../../assets/medium/login_img1.png";
import Title from "../Title";
import React, { useEffect, useState } from "react";
import { MyReader } from "../../dbmanger/MyReader";
import { useCookies } from "react-cookie";
import Loading from "../sharedcomp/Loading";
import { useNavigate } from "react-router-dom";
import type { Account } from "../../interfaces/Account";

const LoginForm = () => {
  const [loginVal, setLoginVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [schoolList, setSchoolList] = useState([]);
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 'user' is the name of the cookie we want to access
  //const [cookies, setCookie, removeCookie] = useCookies(["schoolName"]);
  const [cookies, setCookie] = useCookies(["schoolName"]);
  const navigate = useNavigate();

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchool(e.target.value);
    console.log("Selected school is now: " + e.target.value);
    loadAccounts();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCookie("schoolName", selectedSchool, { path: "/", maxAge: 604800 });

    if (!cookies.schoolName) {
      alert(`Veuillez sélectionner une école [${cookies.schoolName}]`);
      return;
    }

    const account = accountList.find(
      (acc) =>
        (acc.login === loginVal || acc.pwd === passwordVal) &&
        acc.pwd === passwordVal,
    );

    if (!account) {
      alert(`Login ou mot de passe incorrect \nECOLE:[${cookies.schoolName}]`);
      return;
    } else {
      navigate("/dashboard-teacher");
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadSchools();
    loadAccounts();
  }, []);

  const loadSchools = async () => {
    const list = await MyReader.fetchSchools();
    setSchoolList(list);
    setIsLoading(false);
  };

  const loadAccounts = async () => {
    setIsLoading(true);
    const list = await MyReader.fetchAccounts(cookies.schoolName);
    setAccountList(list);
    setIsLoading(false);
  };

  // const deleteCookie = (name: string, path: string = "/") => {
  //   // Overwrite the cookie with an expired date
  //   document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
  // };

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
                  required
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
                  required
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
