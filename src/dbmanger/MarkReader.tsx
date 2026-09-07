import { MyConstants } from "./MyConstants";
import type { Mark } from "../interfaces/Mark";
import type { LockRow } from "../interfaces/LockRow";
import type { ApiResult } from "../interfaces/ApiResult";
import type { FillRateNonApcRow } from "../interfaces/FillRateNonApcRow";
import type { FillRateApcRow } from "../interfaces/FillRateApcRow";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export interface MarkInput {
  stud_id: number;
  mark: number;
  isEmpty: number;
}

const MARK_FETCH_MAX_ATTEMPTS = 3;
const MARK_FETCH_RETRY_DELAY_MS = 400;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Report-card loads fire dozens of these concurrently (per subject x dbsequence/competence). Under
// that concurrency, shared-hosting MySQL connection limits can intermittently refuse a new
// connection - the backend then answers with HTTP 200 and a plain-text PHP error body instead of a
// real error status (confirmed live against the remote API), which fails `response.json()` and
// used to be indistinguishable from "this subject has no marks yet", silently corrupting computed
// averages. Retrying a couple of times before giving up survives that kind of transient blip.
const fetchMarksWithRetry = async (targetUrl: string, accessToken: string | null): Promise<Mark[]> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MARK_FETCH_MAX_ATTEMPTS; attempt++) {
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
      lastError = error;
      if (attempt < MARK_FETCH_MAX_ATTEMPTS) {
        await delay(MARK_FETCH_RETRY_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
};

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
      return await fetchMarksWithRetry(targetUrl, accessToken);
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
      return await fetchMarksWithRetry(targetUrl, accessToken);
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

  // Whole-section, whole-year fill-rate aggregate for non-APC classes - one row per (classe,
  // subject, dbsequence 1-6), roster_count/filled_count already summed server-side
  // (StudentController::fillRateNonApc). Backs the Fill rate module, which needs every classe of a
  // section at once rather than the single-classe fetchSeqMarks loop MarkEntryManager's own
  // fill-rate panel uses.
  public static fetchFillRateNonApc = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<FillRateNonApcRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/fillRateNonApc` +
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
      console.error(`MarkReader.fetchFillRateNonApc(): Error fetching fill rate: ${error}`);
      return [];
    }
  };

  // Same idea as fetchFillRateNonApc but for APC classes - one row per (classe, subject, term,
  // competence), see FillRateApcRow's comment (StudentController::fillRateApc).
  public static fetchFillRateApc = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<FillRateApcRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/fillRateApc` +
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
      console.error(`MarkReader.fetchFillRateApc(): Error fetching fill rate: ${error}`);
      return [];
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
      console.error(`MarkReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
