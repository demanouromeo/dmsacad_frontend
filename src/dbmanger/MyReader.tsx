import { MyConstants } from "./MyConstants";
import type { LoginResponse } from "../interfaces/LoginResponse";
import type { SchoolYear } from "../interfaces/SchoolYear";

//const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const API_OPTIONS = {
  method: "GET",
  headers: {
    accept: "application/json",
    //Authorization: `Bearer ${API_KEY}`,
  },
};

export class MyReader {
  // Returns null on failure (network error or an API-level `Response: "False"`) so callers can
  // distinguish "failed to load" (toast) from "loaded, genuinely empty" ([]) - see LoginForm's
  // loadSchools/loadSchoolYears and TopBanner's openSchoolYearDialog for the toast side of this.
  public static fetchSchools = async (): Promise<string[] | null> => {
    try {
      const response = await fetch(
        `${MyConstants.getBaseUrl()}api/configs/allSchools`,
        API_OPTIONS,
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.Response === "False") {
        console.error(
          `MyReader.fetchSchools(): ${data.Error || "Failed to fetch schools."}`,
        );
        return null;
      }
      return data;
    } catch (error) {
      console.error(
        `MyReader.fetchSchools(): Error fetching schools: ${error}`,
      );
      return null;
    }
  };

  public static fetchSchoolYears = async (
    connection = "",
  ): Promise<SchoolYear[] | null> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/configs/getSchoolYears?connection=${encodeURIComponent(connection)}`;
    try {
      const response = await fetch(targetUrl, API_OPTIONS);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.Response === "False") {
        console.error(
          `MyReader.fetchSchoolYears(): ${data.Error || "Failed to fetch school years."}`,
        );
        return null;
      }
      return data;
    } catch (error) {
      console.error(
        `MyReader.fetchSchoolYears(): Error fetching school years: ${error}`,
      );
      return null;
    }
  };

  // login/refreshToken return null on failure too (same as the fetch* methods above), so
  // LoginForm can distinguish "bad credentials" from "network error" for inline UI feedback.
  // The backend's login/refresh responses also use a `status` boolean, not the
  // `Response: "False"` convention the other endpoints use.
  public static login = async (
    login: string,
    pwd: string,
    connection: string,
  ): Promise<LoginResponse | null> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/connect`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ login, pwd, connection }),
      });
      const data = await response.json();
      if (!response.ok || data.status === false) {
        console.error(
          `MyReader.login(): Login failed: ${data.message || response.status}`,
        );
        return null;
      }
      return data as LoginResponse;
    } catch (error) {
      console.error(`MyReader.login(): Error logging in: ${error}`);
      return null;
    }
  };

  public static refreshToken = async (
    connection: string,
  ): Promise<string | null> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/refresh`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ connection }),
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return data.access_token || null;
    } catch (error) {
      console.error(
        `MyReader.refreshToken(): Error refreshing token: ${error}`,
      );
      return null;
    }
  };

  // Best-effort: logging out client-side must always succeed even if this call fails
  // (network error, already-expired token, etc.), so this never throws or returns a
  // value callers need to check - it just tries to revoke the token server-side too.
  public static logout = async (accessToken: string | null): Promise<void> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/logout`;
    try {
      await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
      });
    } catch (error) {
      console.error(`MyReader.logout(): Error logging out: ${error}`);
    }
  };
}
