import { MyConstants } from "./MyConstants";
import type { Classe } from "../interfaces/Classe";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class ClasseReader {
  // /api/classes/allClasse1 requires jwt.auth (any connected user). Unlike allFilieres/
  // allSpecialitesOfSection, it responds 404 (not 200 + []) when the section has no classes yet -
  // that's a normal, expected state here (a freshly created section), not a fetch failure, so it's
  // handled separately from other non-ok statuses below rather than logged as an error.
  public static fetchClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<Classe[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/classes/allClasse1` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&section=${encodeURIComponent(section)}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(
        `ClasseReader.fetchClasses(): Error fetching classes: ${error}`,
      );
      return [];
    }
  };

  public static saveClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeName: string,
    level: number,
    specialityName?: string,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/saveClasse",
      accessToken,
      {
        connection,
        year,
        section,
        classe_name: classeName,
        level,
        ...(specialityName ? { speciality_name: specialityName } : {}),
      },
      "saveClasse",
    );
  };

  // No single-item update endpoint exists server-side, same as Filiere/Speciality - even a
  // one-row edit goes through updateManyClasses with a one-element array. classe_master_id/sg_id
  // are included on every call (unchanged, sourced from the already-loaded Classe) even though
  // this screen doesn't let the user edit them: the backend writes whatever key is present
  // (or null if the key is missing) straight onto classe_year, so omitting them would silently
  // clear any classe master/SG already assigned via the dedicated assignment endpoints.
  public static updateClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    updates: {
      classe_id: number;
      classe_name: string;
      level: number;
      speciality_id: number | null;
      classe_master_id: number | null;
      sg_id: number | null;
    }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/updateManyClasses",
      accessToken,
      {
        connection,
        year,
        // The backend validates `data` with Laravel's `json` rule, which requires a
        // JSON-encoded *string*, not a nested array - hence the explicit stringify here
        // even though the outer request body is itself JSON.
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "updateClasses",
    );
  };

  public static deleteClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeIds: number[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/deleteManyClasses",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(classeIds.map((id) => ({ classe_id: id }))),
        data_size: classeIds.length,
      },
      "deleteClasses",
    );
  };

  private static postJson = async (
    path: string,
    accessToken: string | null,
    body: object,
    callerName: string,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}${path}`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (error) {
      console.error(`ClasseReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
