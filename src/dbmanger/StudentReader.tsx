import { MyConstants } from "./MyConstants";
import type { Student } from "../interfaces/Student";
import type { StudentClasseInfo } from "../interfaces/StudentClasseInfo";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class StudentReader {
  // /api/students/allStudentsOfClasse - repeating/cas_social on these rows are always 0
  // (StudentController hardcodes them) - see fetchStudentClasseOfClasse for the real values.
  public static fetchStudentsOfClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
  ): Promise<Student[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/allStudentsOfClasse` +
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
      console.error(
        `StudentReader.fetchStudentsOfClasse(): Error fetching students: ${error}`,
      );
      return [];
    }
  };

  // /api/students/allStudClassOfAClasse - the student_classe pivot rows (repeating/cas_social/
  // solvable/abandon) for the same classe+year, merged onto Student rows by stud_id.
  public static fetchStudentClasseOfClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
  ): Promise<StudentClasseInfo[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/allStudClassOfAClasse` +
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
      console.error(
        `StudentReader.fetchStudentClasseOfClasse(): Error fetching student_classe rows: ${error}`,
      );
      return [];
    }
  };

  // /api/students/allStudents - every student of the year, across every classe/section. Only used
  // to build the matricule-uniqueness set for the "Generate matricule" button, since there's no
  // dedicated backend check for it.
  public static fetchAllStudentsOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<Student[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/allStudents` +
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
        `StudentReader.fetchAllStudentsOfYear(): Error fetching students: ${error}`,
      );
      return [];
    }
  };

  // Single-add (SubjectController-style saveAStudent, full server-side field validation incl. the
  // name/surname letters-only regex) - optional fields are sent as null rather than "" so Laravel's
  // `nullable` rule actually short-circuits their min-length/regex checks (an empty string is not
  // treated as null there).
  public static saveAStudent = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
    fields: {
      name: string;
      surname: string;
      bday: string;
      bplace: string;
      sexe: "M" | "F";
      repeating: boolean;
      handicape: boolean;
      cas_social: boolean;
      matricule: string;
    },
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/saveAStudent",
      accessToken,
      {
        connection,
        year,
        classe_id: classeId,
        name: fields.name,
        surname: fields.surname || null,
        bday: fields.bday || null,
        bplace: fields.bplace || null,
        sexe: fields.sexe,
        repeating: fields.repeating,
        handicape: fields.handicape,
        cas_social: fields.cas_social,
        matricule: fields.matricule || null,
      },
      "saveAStudent",
    );
  };

  // Bulk import (SubjectController::saveStudents) - backs the Excel import's "override"/"add
  // without deleting" paths. matricule must be sent as "" (not null/omitted) for "no matricule" -
  // the backend's own null-substitution only checks for `$matricule == ""`, not null.
  public static saveManyStudents = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
    override: boolean,
    rows: {
      name: string;
      surname: string;
      bday: string;
      bplace: string;
      sexe: "M" | "F";
      repeating: boolean;
      handicape: boolean;
      cas_social: boolean;
      matricule: string;
    }[],
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/saveStudents",
      accessToken,
      {
        connection,
        year,
        classe_id: classeId,
        override,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "saveManyStudents",
    );
  };

  // No single-item update endpoint - same one-element-array convention as every other manager.
  public static updateStudents = async (
    accessToken: string | null,
    connection: string,
    year: string,
    updates: {
      stud_id: number;
      name: string;
      surname: string;
      bday: string;
      bplace: string;
      sexe: "M" | "F";
      repeating: boolean;
      handicape: boolean;
      cas_social: boolean;
      matricule: string;
    }[],
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/updateStudents",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "updateStudents",
    );
  };

  public static deleteStudents = async (
    accessToken: string | null,
    connection: string,
    year: string,
    studIds: number[],
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/deleteStudents",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(studIds.map((id) => ({ stud_id: id }))),
        data_size: studIds.length,
      },
      "deleteStudents",
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
      console.error(`StudentReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
