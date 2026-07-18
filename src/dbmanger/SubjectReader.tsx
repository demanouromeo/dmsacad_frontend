import { MyConstants } from "./MyConstants";
import type { Subject } from "../interfaces/Subject";
import type { SubjectClasseRow } from "../interfaces/SubjectClasseRow";
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

  // Backs the Excel import feature's "add without override" path - section/year scope the
  // duplicate-title check the backend performs (see SubjectController::saveManySubjects).
  public static saveManySubjects = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    rows: { subject_title: string }[],
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/saveManySubjects",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "saveManySubjects",
    );
  };

  // Destructive - deletes every subject for the given section+year (used by the import feature's
  // "override" path). Takes no subject_id list: the backend clears the whole section+year in one
  // shot.
  public static deleteAllSubjectsOfSectionAndYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/deleteAllSubjectsOfSectionAndYear",
      accessToken,
      { connection, year, section },
      "deleteAllSubjectsOfSectionAndYear",
      "DELETE",
    );
  };

  // Backs the "Subjects and classes" screen's left panel - subjects of the current section+year not
  // yet assigned to classeId (SubjectController::subjectsNotOfClasse). No ordering is applied
  // server-side, so callers must sort the result themselves.
  public static fetchSubjectsNotOfClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeId: number,
  ): Promise<Subject[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/subjects/subjectsNotOfClasse` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&section=${encodeURIComponent(section)}` +
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
        `SubjectReader.fetchSubjectsNotOfClasse(): Error fetching subjects: ${error}`,
      );
      return [];
    }
  };

  // Right panel of the same screen - subjects already assigned to classeId, with their coef/groupe
  // (SubjectController::subjectOfClasse). Also unordered server-side.
  public static fetchSubjectsOfClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeId: number,
  ): Promise<SubjectClasseRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/subjects/subjectOfClasse` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&section=${encodeURIComponent(section)}` +
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
        `SubjectReader.fetchSubjectsOfClasse(): Error fetching subjects: ${error}`,
      );
      return [];
    }
  };

  // Upserts subject_classe rows (SubjectController::saveManySC) - used both to assign newly-added
  // subjects to a classe and to persist coef/groupe edits on already-assigned rows: the backend
  // finds-or-creates per row keyed on (subject_id, classe_id, sy_id, section_id), so resending an
  // unchanged row is a harmless no-op update.
  public static saveManySC = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    rows: {
      subject_id: number;
      coef: number;
      classe_id: number;
      groupe_id: number;
    }[],
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/saveManySC",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "saveManySC",
    );
  };

  // Unassigns one subject from one classe (SubjectController::deleteASubjectOfAClasseYearAndSection)
  // - there's no bulk variant, so multi-select removal loops this call per subject client-side.
  public static deleteSubjectOfClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeId: number,
    subjectId: number,
  ): Promise<ApiResult> => {
    return SubjectReader.postJson(
      "api/subjects/deleteASubjectOfAClasseYearAndSection",
      accessToken,
      {
        connection,
        year,
        section,
        classe_id: classeId,
        subject_id: subjectId,
      },
      "deleteSubjectOfClasse",
      "DELETE",
    );
  };

  // Replaces every subject_classe row of one destination classe with a copy of fromClasseId's rows
  // (SubjectController::calquerSubjects, "calquer" = "to copy/trace"). Unusually a GET despite being
  // a write - the backend route is defined that way, so this mirrors it rather than guessing a POST.
  // Copying to several destination classes loops this call once per target client-side, since the
  // endpoint only accepts one destination (by name) per call.
  public static calquerSubjects = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    fromClasseId: number,
    toClasseName: string,
  ): Promise<ApiResult> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/subjects/calquerSubjects` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&section=${encodeURIComponent(section)}` +
      `&classe_id=${fromClasseId}` +
      `&classe_name=${encodeURIComponent(toClasseName)}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      return await response.json();
    } catch (error) {
      console.error(`SubjectReader.calquerSubjects(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };

  private static postJson = async (
    path: string,
    accessToken: string | null,
    body: object,
    callerName: string,
    method: "POST" | "DELETE" = "POST",
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}${path}`;
    try {
      const response = await fetch(targetUrl, {
        method,
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
