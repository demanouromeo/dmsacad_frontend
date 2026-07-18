import { MyConstants } from "./MyConstants";
import type { Staff } from "../interfaces/Staff";
import type { StaffSummary } from "../interfaces/StaffSummary";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class StaffReader {
  // Staff aren't section-scoped the way classes/specialities are (allStaffs1 only takes
  // connection+year) - a staff member can be attached to courses/classes across sections.
  public static fetchStaff = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<Staff[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/staffs/allStaffs1` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}`;
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
        `StaffReader.fetchStaff(): Error fetching staff: ${error}`,
      );
      return [];
    }
  };

  // Backs the classe-master picker in ClasseManager - strictly `function = 0` (teaching staff),
  // unlike allTeachingStaffOfYear which despite its name also includes censeurs/SG/chef de travaux
  // (function 1/2/6). Not section-scoped, same as fetchStaff.
  public static fetchClassMastersOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<StaffSummary[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/staffs/allClassMastersOfYear` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}`;
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
        `StaffReader.fetchClassMastersOfYear(): Error fetching class masters: ${error}`,
      );
      return [];
    }
  };

  // Backs the SG/discipline-master picker in ClasseManager - strictly `function = 1`. Not
  // section-scoped, same as fetchStaff.
  public static fetchSgOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<StaffSummary[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/staffs/allSgOfYear` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}`;
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
        `StaffReader.fetchSgOfYear(): Error fetching SG staff: ${error}`,
      );
      return [];
    }
  };

  // saveStaff has no path to create a staff record without an account - login/pwd are mandatory
  // server-side, not an optional extra step.
  public static saveStaff = async (
    accessToken: string | null,
    connection: string,
    year: string,
    staff: {
      name: string;
      surname: string;
      phone1: string;
      sexe: string;
      function: number;
      civility: string;
      login: string;
      pwd: string;
    },
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/saveStaff",
      accessToken,
      {
        connection,
        year,
        name: staff.name,
        ...(staff.surname ? { surname: staff.surname } : {}),
        ...(staff.phone1 ? { phone1: staff.phone1 } : {}),
        sexe: staff.sexe,
        function: staff.function,
        ...(staff.civility ? { civility: staff.civility } : {}),
        login: staff.login,
        pwd: staff.pwd,
      },
      "saveStaff",
    );
  };

  // No single-item update endpoint, same as Filiere/Speciality/Classe - even a one-row edit goes
  // through updateManyStaffs with a one-element array. `pwd` is optional per item: the backend only
  // rotates the account password when a non-empty value is supplied, so omit it entirely to leave
  // the password unchanged rather than round-tripping the plaintext value the list endpoint returns.
  public static updateStaff = async (
    accessToken: string | null,
    connection: string,
    year: string,
    updates: {
      staff_id: number;
      name: string;
      surname: string;
      sexe: string;
      phone1: string;
      function: number;
      civility: string;
      login: string;
      acc_id: number;
      pwd?: string;
    }[],
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/updateManyStaffs",
      accessToken,
      {
        connection,
        year,
        // The backend validates `data` with Laravel's `json` rule, which requires a
        // JSON-encoded *string*, not a nested array - hence the explicit stringify here
        // even though the outer request body is itself JSON.
        data: JSON.stringify(
          updates.map((u) => ({ ...u, pwd: u.pwd ?? "" })),
        ),
        data_size: updates.length,
      },
      "updateStaff",
    );
  };

  public static deleteStaff = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    staffIds: number[],
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/deleteManyStaffs",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(staffIds.map((id) => ({ staff_id: id }))),
        data_size: staffIds.length,
      },
      "deleteStaff",
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
      console.error(`StaffReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
