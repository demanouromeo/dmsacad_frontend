import { useEffect, useState, type ReactNode } from "react";
import { useCookies } from "react-cookie";
import { MyReader } from "../dbmanger/MyReader";
import { SchoolInfoReader } from "../dbmanger/SchoolInfoReader";
import { MyConstants } from "../dbmanger/MyConstants";
import { decodeJwtPayload } from "../dbmanger/jwt";
import type { AuthPayload } from "../interfaces/AuthPayload";
import { AuthContext, type AuthContextValue } from "./authContext";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [, setSchoolHeaderCookie, removeSchoolHeaderCookie] = useCookies([
    MyConstants.SCHOOL_HEADER_CONFIG_KEY,
  ]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authPayload, setAuthPayload] = useState<AuthPayload | null>(null);
  const [connection, setConnection] = useState("");
  const [schoolYear, setSchoolYearState] = useState("");
  const [section, setSectionState] = useState("");
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const storedConnection = sessionStorage.getItem(
        MyConstants.SCHOOL_NAME_KEY,
      );
      const storedYear = sessionStorage.getItem(MyConstants.SCHOOL_YEAR_KEY);
      const storedSection = sessionStorage.getItem(MyConstants.SECTION_KEY);
      if (storedYear) {
        setSchoolYearState(storedYear);
      }
      if (storedSection) {
        setSectionState(storedSection);
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
    yearVal: string,
    sectionVal: string,
  ): Promise<boolean> => {
    const result = await MyReader.login(loginVal, pwd, connectionVal);
    if (!result) {
      return false;
    }
    setAccessToken(result.access_token);
    setAuthPayload(decodeJwtPayload(result.access_token));
    setConnection(connectionVal);
    setSchoolYearState(yearVal);
    setSectionState(sectionVal);
    sessionStorage.setItem(MyConstants.SCHOOL_NAME_KEY, connectionVal);
    sessionStorage.setItem(MyConstants.SCHOOL_YEAR_KEY, yearVal);
    sessionStorage.setItem(MyConstants.SECTION_KEY, sectionVal);

    // Best-effort: the school header (name/address/logo for printed & exported documents) is
    // refreshed on every login, but a failure here must never block the login itself.
    const headerConfig = await SchoolInfoReader.fetchSchoolConfigOfYear(
      result.access_token,
      connectionVal,
      yearVal,
    );
    if (headerConfig) {
      setSchoolHeaderCookie(MyConstants.SCHOOL_HEADER_CONFIG_KEY, headerConfig, {
        path: "/",
        maxAge: MyConstants.SCHOOL_HEADER_CONFIG_COOKIE_MAX_AGE,
      });
    } else {
      removeSchoolHeaderCookie(MyConstants.SCHOOL_HEADER_CONFIG_KEY, {
        path: "/",
      });
    }

    return true;
  };

  const setSchoolYear = (year: string) => {
    setSchoolYearState(year);
    sessionStorage.setItem(MyConstants.SCHOOL_YEAR_KEY, year);
  };

  const setSection = (sectionVal: string) => {
    setSectionState(sectionVal);
    sessionStorage.setItem(MyConstants.SECTION_KEY, sectionVal);
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
    section,
    isRestoring,
    login,
    setSchoolYear,
    setSection,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};
