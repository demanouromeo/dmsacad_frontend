import { MyConstants } from "./MyConstants";
import type { Groupe } from "../interfaces/Groupe";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class GroupeReader {
  // /api/groupes/allGroupes requires jwt.auth (any connected user). Rows come from
  // MyHelper::getGroupesOfYearOfSection (SELECT * FROM groupe ... ORDER BY groupe_name) - only
  // groupe_id/groupe_name are used here, the rest of the row (description/str1/str2/val1/val2)
  // isn't surfaced anywhere in this app yet.
  public static fetchGroupes = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<Groupe[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/groupes/allGroupes` +
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
        `GroupeReader.fetchGroupes(): Error fetching groupes: ${error}`,
      );
      return [];
    }
  };

  // groupe_name is globally UNIQUE at the DB level (not just per-section) - saveGroupe re-links the
  // existing groupe row to the current section+year when the name already exists elsewhere, only
  // failing (an "already exists" error) when that same groupe is already linked to the current
  // school year (see GroupeController::saveGroupe and the groupe_year(sy_id, groupe_id) unique
  // constraint). This is what actually enforces "two groups in different sections can't share a
  // name" - nothing extra is needed client-side.
  public static saveGroupe = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    groupeName: string,
  ): Promise<ApiResult> => {
    return GroupeReader.postJson(
      "api/groupes/saveGroupe",
      accessToken,
      { connection, year, section, groupe_name: groupeName },
      "saveGroupe",
    );
  };

  // No single-item update endpoint - even a one-row rename goes through updateManyGroupes with a
  // one-element array, same as Filiere/Speciality/Classe/Subject/Staff. Doesn't take year/section:
  // it's a raw `UPDATE groupe SET groupe_name = ...` keyed only by groupe_id - the DB's own unique
  // constraint on groupe_name is what rejects a rename that collides with another groupe.
  public static updateGroupes = async (
    accessToken: string | null,
    connection: string,
    updates: { groupe_id: number; groupe_name: string }[],
  ): Promise<ApiResult> => {
    return GroupeReader.postJson(
      "api/groupes/updateManyGroupes",
      accessToken,
      {
        connection,
        // The backend validates `data` with Laravel's `string` rule (json_decode'd manually), same
        // JSON-encoded-string convention as every other *ManyX endpoint in this app.
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "updateGroupes",
    );
  };

  public static deleteGroupes = async (
    accessToken: string | null,
    connection: string,
    year: string,
    groupeIds: number[],
  ): Promise<ApiResult> => {
    return GroupeReader.postJson(
      "api/groupes/deleteManyGroupes",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(groupeIds.map((id) => ({ groupe_id: id }))),
        data_size: groupeIds.length,
      },
      "deleteGroupes",
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
      console.error(`GroupeReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
