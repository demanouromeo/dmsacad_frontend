import { useEffect, useState, type ReactNode } from "react";
import { MyReader } from "../dbmanger/MyReader";
import { MyConstants } from "../dbmanger/MyConstants";
import { decodeJwtPayload } from "../dbmanger/jwt";
import type { AuthPayload } from "../interfaces/AuthPayload";
import { AuthContext, type AuthContextValue } from "./authContext";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authPayload, setAuthPayload] = useState<AuthPayload | null>(null);
  const [connection, setConnection] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const storedConnection = sessionStorage.getItem(
        MyConstants.SCHOOL_NAME_KEY,
      );
      const storedYear = sessionStorage.getItem(MyConstants.SCHOOL_YEAR_KEY);
      if (storedYear) {
        setSchoolYear(storedYear);
      }
      if (!storedConnection) {
        setIsRestoring(false);
        return;
      }
      setConnection(storedConnection);
      const token = await MyReader.refreshToken(storedConnection);
      if (token) {
        setAccessToken(token);
        setAuthPayload(decodeJwtPayload(token));
      }
      setIsRestoring(false);
    };
    restore();
  }, []);

  const login = async (
    loginVal: string,
    pwd: string,
    connectionVal: string,
  ): Promise<boolean> => {
    const result = await MyReader.login(loginVal, pwd, connectionVal);
    if (!result) {
      return false;
    }
    setAccessToken(result.access_token);
    setAuthPayload(decodeJwtPayload(result.access_token));
    setConnection(connectionVal);
    sessionStorage.setItem(MyConstants.SCHOOL_NAME_KEY, connectionVal);
    return true;
  };

  const logout = () => {
    // Fire-and-forget: revoking server-side shouldn't block clearing local state/navigating away.
    MyReader.logout(accessToken);
    setAccessToken(null);
    setAuthPayload(null);
  };

  const value: AuthContextValue = {
    accessToken,
    authPayload,
    connection,
    schoolYear,
    isRestoring,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
