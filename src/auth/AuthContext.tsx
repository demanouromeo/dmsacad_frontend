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

    // The school header cookie itself is (re)fetched by the effect below, which reacts to
    // connection/schoolYear/accessToken - setting them above is enough to trigger it, here and
    // on every later TopBanner year/school switch alike.

    return true;
  };

  // Keeps the school header cookie (name/address/logo_path/signature fields - basic_school_config
  // is one row per school year) in sync with whichever year is actually selected, not just a
  // one-off snapshot taken at login: re-fetches on login, on session restore once the refresh
  // token resolves, and again every time TopBanner's year switch calls setSchoolYear. Best-effort -
  // a failure here just clears the cookie rather than surfacing an error, same as before.
  useEffect(() => {
    if (!connection || !schoolYear || !accessToken) {
      return;
    }
    let cancelled = false;
    const refreshHeaderCookie = async () => {
      const headerConfig = await SchoolInfoReader.fetchSchoolConfigOfYear(
        accessToken,
        connection,
        schoolYear,
      );
      if (cancelled) {
        return;
      }
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
    };
    refreshHeaderCookie();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, accessToken]);

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
