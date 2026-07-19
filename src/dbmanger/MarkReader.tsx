import { MyConstants } from "./MyConstants";
import type { Mark } from "../interfaces/Mark";
import type { LockRow } from "../interfaces/LockRow";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export interface MarkInput {
  stud_id: number;
  mark: number;
  isEmpty: number;
}

export class MarkReader {
  // Non-APC marks (student_subject) for one (classe, subject, dbsequence) - dbsequence is derived
  // client-side from (term, sequence) by MarkEntryManager, see StudentController::getSeqMarks.
  public static fetchSeqMarks = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
    subjectId: number,
    dbsequence: number,
  ): Promise<Mark[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/getSeqMarks` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&classe_id=${classeId}` +
      `&subject_id=${subjectId}` +
      `&sequence=${dbsequence}`;
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
      console.error(`MarkReader.fetchSeqMarks(): Error fetching marks: ${error}`);
      return [];
    }
  };

  // APC marks (stud_comp_mark) for one (classe, subject, term, competence) -
  // StudentController::getCompMarks.
  public static fetchCompMarks = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
    subjectId: number,
    termId: number,
    subjectCompetenceId: number,
  ): Promise<Mark[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/getCompMarks` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&classe_id=${classeId}` +
      `&subject_id=${subjectId}` +
      `&term_id=${termId}` +
      `&subject_competence_id=${subjectCompetenceId}`;
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
      console.error(`MarkReader.fetchCompMarks(): Error fetching marks: ${error}`);
      return [];
    }
  };

  public static saveSeqMarks = async (
    accessToken: string | null,
    connection: string,
    year: string,
    subjectId: number,
    dbsequence: number,
    rows: MarkInput[],
  ): Promise<ApiResult> => {
    return MarkReader.postJson(
      "api/students/saveSeqMarks",
      accessToken,
      {
        connection,
        year,
        subject_id: subjectId,
        sequence: dbsequence,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "saveSeqMarks",
    );
  };

  public static saveCompMarks = async (
    accessToken: string | null,
    connection: string,
    year: string,
    subjectId: number,
    termId: number,
    subjectCompetenceId: number,
    rows: MarkInput[],
  ): Promise<ApiResult> => {
    return MarkReader.postJson(
      "api/students/saveCompMarks",
      accessToken,
      {
        connection,
        year,
        subject_id: subjectId,
        term_id: termId,
        subject_competence_id: subjectCompetenceId,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "saveCompMarks",
    );
  };

  // LockController::locksOfYear - every lock_sequence row for the year, keyed by `seq` only
  // (no classe/subject column - see LockRow's comment).
  public static fetchLocksOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<LockRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/lock/locksOfYear` +
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
      console.error(`MarkReader.fetchLocksOfYear(): Error fetching locks: ${error}`);
      return [];
    }
  };

  public static saveLock = async (
    accessToken: string | null,
    connection: string,
    year: string,
    seq: number,
    isBlocked: boolean,
  ): Promise<ApiResult> => {
    return MarkReader.postJson(
      "api/lock/saveOrUpdateLocks",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify([{ seq, is_blocked: isBlocked ? 1 : 0 }]),
        data_size: 1,
      },
      "saveLock",
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
      console.error(`MarkReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
