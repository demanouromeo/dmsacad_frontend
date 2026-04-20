import { MyConstants } from "./MyConstants";

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
        `${MyConstants.gBaserUrl}api/modules/schoolConfig/allSchools`,
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
    } finally {
    }
  };

  public static fetchAccounts = async (schoolCode = "") => {
    const targetUrl = `${MyConstants.gBaserUrl}api/accounts/${schoolCode}`;
    try {
      const response = await fetch(targetUrl, API_OPTIONS);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.Response === "False") {
        alert(
          data.Error || "MyReader.fetchAccounts(): Failed to fetch accounts.",
        );
        return [];
      }
      console.log(data);
      return data.results;
      //return data;
    } catch (error) {
      //console.error("Error fetching movies:", error);
      console.error(
        `MyReader.fetchAccounts(): Error fetching accounts: ${error}`,
      );
      alert(
        "MyReader.fetchAccounts(): Failed to fetch accounts. Please try again later.<br/>" +
          targetUrl,
      );
      return [];
    } finally {
    }
  };
}
