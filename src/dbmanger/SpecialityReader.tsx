import { MyConstants } from "./MyConstants";
import type { Speciality } from "../interfaces/Speciality";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class SpecialityReader {
  // `allSpecialitesOfYear` is section-agnostic and known-buggy server-side (wrong join, ignores
  // the year filter) - `allSpecialitesOfSection` is the correctly-scoped endpoint, same shape as
  // FiliereReader.fetchFilieres. It requires jwt.auth (any connected user), so the Authorization
  // header is mandatory here, unlike MyReader's unauthenticated allSchools/getSchoolYears.
  public static fetchSpecialities = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<Speciality[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/specialities/allSpecialitesOfSection` +
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
        `SpecialityReader.fetchSpecialities(): Error fetching specialities: ${error}`,
      );
      return [];
    }
  };

  public static saveSpeciality = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    nomFiliere: string,
    specialityName: string,
    description: string,
  ): Promise<ApiResult> => {
    return SpecialityReader.postJson(
      "api/specialities/saveSpeciality",
      accessToken,
      {
        connection,
        year,
        section,
        nom_filiere: nomFiliere,
        speciality_name: specialityName,
        // Omit `desc` entirely when empty rather than sending "" - Laravel's
        // ConvertEmptyStringsToNull middleware turns "" into null before validation
        // runs, and the backend's `desc` rule ('string', no `nullable`) rejects null.
        // An absent optional field skips validation instead.
        ...(description ? { desc: description } : {}),
      },
      "saveSpeciality",
    );
  };

  // No single-item update endpoint exists server-side - even a one-row rename goes through
  // updateManySpecialities with a one-element array. `nom_filiere` is optional per item: when
  // present, the backend reassigns that speciality's speciality_year row (scoped to `year`
  // and `section`) to the named filiere; when omitted, only name/description are touched.
  public static updateManySpecialities = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    updates: {
      speciality_id: number;
      speciality_name: string;
      description: string;
      nom_filiere?: string;
    }[],
  ): Promise<ApiResult> => {
    return SpecialityReader.postJson(
      "api/specialities/updateManySpecialities",
      accessToken,
      {
        connection,
        year,
        section,
        // The backend validates `data` with Laravel's `json` rule, which requires a
        // JSON-encoded *string*, not a nested array - hence the explicit stringify here
        // even though the outer request body is itself JSON.
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "updateManySpecialities",
    );
  };

  public static deleteSpecialities = async (
    accessToken: string | null,
    connection: string,
    year: string,
    specialityIds: number[],
  ): Promise<ApiResult> => {
    return SpecialityReader.postJson(
      "api/specialities/deleteManySpecialities",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(
          specialityIds.map((id) => ({ speciality_id: id })),
        ),
        data_size: specialityIds.length,
      },
      "deleteSpecialities",
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
      console.error(`SpecialityReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
