//const API_BASE_URL = "https://dmsacad.com/";

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
        alert(data.Error || "Failed to fetch schools.");
        return [];
      }
      console.log(data);
      //return data.results;
      return data;
    } catch (error) {
      //console.error("Error fetching movies:", error);
      console.error(`Error fetching schools: ${error}`);
      alert("Failed to fetch schools. Please try again later.");
      return [];
    } finally {
    }
  };
}
