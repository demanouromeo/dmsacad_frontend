import { MyConstants } from "./MyConstants";
import type { ApiResult } from "../interfaces/ApiResult";
import type {
  TtConfig,
  Jour,
  StaffMaxPeriods,
  ClasseSubjectSetting,
  ClasseCell,
  StaffCell,
  AllStaffCell,
  StaffTimetableInfo,
  GenerateResult,
  SendEmailsResult,
} from "../interfaces/Timetable";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class TimetableReader {
  public static fetchTtConfig = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<TtConfig | null> => {
    const rows = await TimetableReader.getJson<TtConfig[]>(
      "api/timetable/getTtConfig",
      accessToken,
      { connection, year },
      "fetchTtConfig",
    );
    return rows && rows.length > 0 ? rows[0] : null;
  };

  public static saveTtConfig = async (
    accessToken: string | null,
    connection: string,
    year: string,
    config: Omit<TtConfig, "tt_config_id" | "sy_id">,
  ): Promise<ApiResult> => {
    return TimetableReader.postJson(
      "api/timetable/saveTtConfig",
      accessToken,
      { connection, year, ...config },
      "saveTtConfig",
    );
  };

  public static fetchJours = async (
    accessToken: string | null,
    connection: string,
  ): Promise<Jour[]> => {
    return (
      (await TimetableReader.getJson<Jour[]>(
        "api/timetable/getJours",
        accessToken,
        { connection },
        "fetchJours",
      )) ?? []
    );
  };

  public static saveJour = async (
    accessToken: string | null,
    connection: string,
    year: string,
    label: string,
    num: number,
    numberOfPeriods: number,
  ): Promise<ApiResult> => {
    return TimetableReader.postJson(
      "api/timetable/saveJour",
      accessToken,
      { connection, year, label, num, number_of_periods: numberOfPeriods },
      "saveJour",
    );
  };

  public static deleteJour = async (
    accessToken: string | null,
    connection: string,
    jourId: number,
  ): Promise<ApiResult> => {
    return TimetableReader.postJson(
      "api/timetable/deleteJour",
      accessToken,
      { connection, jour_id: jourId },
      "deleteJour",
    );
  };

  public static fetchStaffMaxPeriods = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<StaffMaxPeriods[]> => {
    return (
      (await TimetableReader.getJson<StaffMaxPeriods[]>(
        "api/timetable/getStaffMaxPeriods",
        accessToken,
        { connection, year },
        "fetchStaffMaxPeriods",
      )) ?? []
    );
  };

  public static updateStaffMaxPeriods = async (
    accessToken: string | null,
    connection: string,
    year: string,
    staffId: number,
    maxPeriodsPerWeek: number,
  ): Promise<ApiResult> => {
    return TimetableReader.postJson(
      "api/timetable/updateStaffMaxPeriods",
      accessToken,
      { connection, year, staff_id: staffId, max_periods_per_week: maxPeriodsPerWeek },
      "updateStaffMaxPeriods",
    );
  };

  public static fetchClasseSubjectSettings = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
  ): Promise<ClasseSubjectSetting[]> => {
    return (
      (await TimetableReader.getJson<ClasseSubjectSetting[]>(
        "api/timetable/getClasseSubjectSettings",
        accessToken,
        { connection, year, classe_id: classeId },
        "fetchClasseSubjectSettings",
      )) ?? []
    );
  };

  public static updateClasseSubjectSetting = async (
    accessToken: string | null,
    connection: string,
    subjectClasseId: number,
    weight: number,
    numberOfPeriodPerWeek: number,
    commonCourse: boolean,
  ): Promise<ApiResult> => {
    return TimetableReader.postJson(
      "api/timetable/updateClasseSubjectSetting",
      accessToken,
      {
        connection,
        subject_classe_id: subjectClasseId,
        weight,
        numnber_of_period_per_week: numberOfPeriodPerWeek,
        commoncourse: commonCourse ? 1 : 0,
      },
      "updateClasseSubjectSetting",
    );
  };

  public static generate = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<GenerateResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/timetable/generate`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ connection, year }),
      });
      return await response.json();
    } catch (error) {
      console.error(`TimetableReader.generate(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };

  public static sendTeacherEmails = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<SendEmailsResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/timetable/sendTeacherEmails`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ connection, year }),
      });
      return await response.json();
    } catch (error) {
      console.error(`TimetableReader.sendTeacherEmails(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };

  public static fetchClasseCells = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
  ): Promise<ClasseCell[]> => {
    return (
      (await TimetableReader.getJson<ClasseCell[]>(
        "api/timetable/getClasseCells",
        accessToken,
        { connection, year, classe_id: classeId },
        "fetchClasseCells",
      )) ?? []
    );
  };

  public static updateCell = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
    jourId: number,
    periodNumber: number,
    subjectId: number | null,
    staffId: number | null,
  ): Promise<ApiResult> => {
    return TimetableReader.postJson(
      "api/timetable/updateCell",
      accessToken,
      {
        connection,
        year,
        classe_id: classeId,
        jour_id: jourId,
        period_number: periodNumber,
        subject_id: subjectId,
        staff_id: staffId,
      },
      "updateCell",
    );
  };

  public static fetchMyCells = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<StaffCell[]> => {
    return (
      (await TimetableReader.getJson<StaffCell[]>(
        "api/timetable/getMyCells",
        accessToken,
        { connection, year },
        "fetchMyCells",
      )) ?? []
    );
  };

  public static fetchMyStaffInfo = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<StaffTimetableInfo | null> => {
    return TimetableReader.getJson<StaffTimetableInfo>(
      "api/timetable/getMyStaffInfo",
      accessToken,
      { connection, year },
      "fetchMyStaffInfo",
    );
  };

  // Bulk, ADMIN-only equivalents of fetchMyCells/fetchMyStaffInfo above - back the Time table hub's
  // "print/export every staff member's individual time table at once" feature
  // (TimetableController::getAllStaffCells/getAllStaffInfo), so that loop only costs 2 requests for
  // the whole school instead of 2×N single-staff requests.
  public static fetchAllStaffCells = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<AllStaffCell[]> => {
    return (
      (await TimetableReader.getJson<AllStaffCell[]>(
        "api/timetable/getAllStaffCells",
        accessToken,
        { connection, year },
        "fetchAllStaffCells",
      )) ?? []
    );
  };

  public static fetchAllStaffInfo = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<StaffTimetableInfo[]> => {
    return (
      (await TimetableReader.getJson<StaffTimetableInfo[]>(
        "api/timetable/getAllStaffInfo",
        accessToken,
        { connection, year },
        "fetchAllStaffInfo",
      )) ?? []
    );
  };

  private static getJson = async <T,>(
    path: string,
    accessToken: string | null,
    params: Record<string, string | number>,
    callerName: string,
  ): Promise<T | null> => {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");
    const targetUrl = `${MyConstants.getBaseUrl()}${path}?${query}`;
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
      console.error(`TimetableReader.${callerName}(): Error: ${error}`);
      return null;
    }
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
      console.error(`TimetableReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
