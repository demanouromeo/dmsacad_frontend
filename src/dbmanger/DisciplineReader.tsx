import { MyConstants } from "./MyConstants";
import type { DisciplineRosterRow } from "../interfaces/DisciplineRosterRow";
import type { DisciplineOfClasseRow } from "../interfaces/DisciplineOfClasseRow";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export interface DisciplineInput {
  stud_id: number;
  nbAbs: number;
  exclusion: number;
  lateness: number;
  consigne: number;
  avertissement: number;
  dismissed: number;
  comment: string;
}

export class DisciplineReader {
  // A classe's roster already shaped as a zeroed discipline-entry seed -
  // StudentController::allStudentsOfClasseForAbs. `repeating` is hardcoded 0 here too, same gap as
  // allStudentsOfClasse - callers overlay the real flag from StudentReader.fetchStudentClasseOfClasse.
  public static fetchRosterForAbs = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
  ): Promise<DisciplineRosterRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/allStudentsOfClasseForAbs` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&classe_id=${classeId}`;
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
      console.error(`DisciplineReader.fetchRosterForAbs(): Error fetching roster: ${error}`);
      return [];
    }
  };

  // Real per-(classe, term) discipline values - StudentController::getDisciplineOfClasse. A student
  // with no `discipline` row yet for that term simply doesn't appear in the result.
  public static fetchDisciplineOfClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    termId: number,
    classeId: number,
  ): Promise<DisciplineOfClasseRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/getDisciplineOfClasse` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&term_id=${termId}` +
      `&classe_id=${classeId}`;
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
      console.error(`DisciplineReader.fetchDisciplineOfClasse(): Error fetching discipline: ${error}`);
      return [];
    }
  };

  // Batch upsert into `discipline`, keyed by (stud_id, sy_id, term) - StudentController::saveOrUpdateABS.
  public static saveDiscipline = async (
    accessToken: string | null,
    connection: string,
    year: string,
    termId: number,
    rows: DisciplineInput[],
  ): Promise<ApiResult> => {
    return DisciplineReader.postJson(
      "api/students/saveOrUpdateABS",
      accessToken,
      {
        connection,
        year,
        term_id: termId,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "saveDiscipline",
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
      console.error(`DisciplineReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
