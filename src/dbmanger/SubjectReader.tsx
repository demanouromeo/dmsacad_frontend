import { MyConstants } from "./MyConstants";
import type { Subject } from "../interfaces/Subject";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class SubjectReader {
  // /api/subjects/allSubjectOfSectionAndYear requires jwt.auth (any connected user). Rows come
  // straight from a raw DB::select (MySubjectHelper::getSubjectsOfYearOfSection) - just
  // subject_id/subject_title, unlike Filiere/Speciality/Classe which return full model rows.
  public static fetchSubjects = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<Subject[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/subjects/allSubjectOfSectionAndYear` +
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
        `SubjectReader.fetchSubjects(): Error fetching subjects: ${error}`,
      );
      return [];
    }
  };

  public static saveSubject = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    subjectTitle: string,
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/saveSubject",
      accessToken,
      {
        connection,
        year,
        section,
        subject_title: subjectTitle,
      },
      "saveSubject",
    );
  };

  // No single-item update endpoint is used here (updateSubject exists server-side but
  // updateManySubjects covers the same one-element-array shape Filiere/Speciality/Classe already
  // use) - section/year are required so the backend can scope its duplicate-title check.
  public static updateSubjects = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    updates: { subject_id: number; subject_title: string }[],
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/updateManySubjects",
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
      "updateSubjects",
    );
  };

  public static deleteSubjects = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    subjectIds: number[],
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/deleteManySubjects",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(subjectIds.map((id) => ({ subject_id: id }))),
        data_size: subjectIds.length,
      },
      "deleteSubjects",
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
      console.error(`SubjectReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
