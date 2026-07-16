import { MyConstants } from "./MyConstants";
import type { LoginResponse } from "../interfaces/LoginResponse";

//const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const API_OPTIONS = {
  method: "GET",
  headers: {
    accept: "application/json",
    //Authorization: `Bearer ${API_KEY}`,
  },
};

export class MyReader {
  public static fetchSchools = async () => {
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
        alert(
          data.Error || "MyReader.fetchSchools(): Failed to fetch schools.",
        );
        return [];
      }
      //console.log(data);
      //return data.results;
      return data;
    } catch (error) {
      //console.error("Error fetching movies:", error);
      console.error(
        `MyReader.fetchSchools(): Error fetching schools: ${error}`,
      );
      alert(
        "MyReader.fetchSchools(): Failed to fetch schools. Please try again later.",
      );
      return [];
    }
  };

  public static fetchSchoolYears = async (connection = "") => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/configs/getSchoolYears?connection=${encodeURIComponent(connection)}`;
    try {
      const response = await fetch(targetUrl, API_OPTIONS);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.Response === "False") {
        alert(
          data.Error ||
            "MyReader.fetchSchoolYears(): Failed to fetch school years.",
        );
        return [];
      }
      return data;
    } catch (error) {
      console.error(
        `MyReader.fetchSchoolYears(): Error fetching school years: ${error}`,
      );
      alert(
        "MyReader.fetchSchoolYears(): Failed to fetch school years. Please try again later.",
      );
      return [];
    }
  };

  // Unlike the fetch* methods above, login/refreshToken return null on failure instead of
  // alert()ing, so LoginForm can distinguish "bad credentials" from "network error" for
  // inline UI feedback. The backend's login/refresh responses also use a `status` boolean,
  // not the `Response: "False"` convention the other endpoints use.
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
}
