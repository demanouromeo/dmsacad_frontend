import { KeySquare, UsersRound } from "lucide-react";
import img from "../../assets/medium/login_img1.png";
import Title from "../Title";
import React, { useEffect, useState } from "react";

const LoginForm = () => {
  const [loginVal, setLoginVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    //console.log("Login form submitted");
    alert(loginVal);
  };
  return (
    <div className=" md:h-screen bg-base-300 p-10 mb-10 md:mb-32" id="About">
      <Title title="LOGIN" />
      <div className="flex justify-center items-center ">
        <div className="hidden md:block md:h-120 w-96">
          <img
            src={img}
            alt=""
            className=" h-full w-full object-cover rounded-tl-xl rounded-bl-xl"
          />
        </div>

        <form onSubmit={handleLogin}>
          <div className="flex items-center md:h-120 bg-base-10 border-base-500  rounded-xl md:rounded-tr-xl md:rounded-br-xl md:md:rounded-bl-none md:md:rounded-tl-none w-xs border p-4">
            <div className="w-full">
              <label className="label" htmlFor="login">
                Login
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="input"
                  placeholder="Login ou code utilisateur"
                  id="login"
                  value={loginVal}
                  onChange={(e) => setLoginVal(e.target.value)}
                />
                <UsersRound className="absolute w-5 h-5 top-2.5 right-2.5 text-slate-600" />
              </div>

              <label className="label mt-4" htmlFor="password">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type="password"
                  className="input"
                  placeholder="Mot de passe"
                  id="password"
                  value={passwordVal}
                  onChange={(e) => setPasswordVal(e.target.value)}
                />
                <KeySquare className="absolute w-5 h-5 top-2.5 right-2.5 text-slate-600" />
              </div>

              <button
                className="btn btn-neutral mt-5 mb-4 w-full"
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
