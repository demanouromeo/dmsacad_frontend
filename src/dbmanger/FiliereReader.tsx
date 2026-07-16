import { MyConstants } from "./MyConstants";
import type { Filiere } from "../interfaces/Filiere";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class FiliereReader {
  // /api/filieres/allFilieres requires jwt.auth (any connected user) - the Authorization
  // header is mandatory here, unlike MyReader's unauthenticated allSchools/getSchoolYears.
  public static fetchFilieres = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<Filiere[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/filieres/allFilieres` +
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
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(
        `FiliereReader.fetchFilieres(): Error fetching filieres: ${error}`,
      );
      return [];
    }
  };

  public static saveFiliere = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    nomFiliere: string,
  ): Promise<ApiResult> => {
    return FiliereReader.postJson(
      "api/filieres/saveFiliere",
      accessToken,
      { connection, year, section, nom_filiere: nomFiliere },
      "saveFiliere",
    );
  };

  public static renameFiliere = async (
    accessToken: string | null,
    connection: string,
    nomFiliereOld: string,
    nomFiliereNew: string,
  ): Promise<ApiResult> => {
    return FiliereReader.postJson(
      "api/filieres/updateFiliere",
      accessToken,
      {
        connection,
        nom_filiere_old: nomFiliereOld,
        nom_filiere_new: nomFiliereNew,
      },
      "renameFiliere",
    );
  };

  public static renameManyFilieres = async (
    accessToken: string | null,
    connection: string,
    updates: { filiere_id: number; nom_filiere: string }[],
  ): Promise<ApiResult> => {
    return FiliereReader.postJson(
      "api/filieres/updateManyFiliere",
      accessToken,
      {
        connection,
        // The backend validates `data` with Laravel's `json` rule, which requires a
        // JSON-encoded *string*, not a nested array - hence the explicit stringify here
        // even though the outer request body is itself JSON.
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "renameManyFilieres",
    );
  };

  public static deleteFilieres = async (
    accessToken: string | null,
    connection: string,
    year: string,
    filiereIds: number[],
  ): Promise<ApiResult> => {
    return FiliereReader.postJson(
      "api/filieres/deleteManyFiliere",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(filiereIds.map((id) => ({ filiere_id: id }))),
        data_size: filiereIds.length,
      },
      "deleteFilieres",
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
      console.error(`FiliereReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
