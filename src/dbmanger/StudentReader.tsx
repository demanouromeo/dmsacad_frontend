import { MyConstants } from "./MyConstants";
import type { Student } from "../interfaces/Student";
import type { StudentClasseInfo } from "../interfaces/StudentClasseInfo";
import type { StudentSectionSummaryRow } from "../interfaces/StudentSectionSummaryRow";
import type { ApiResult } from "../interfaces/ApiResult";
import type { StudentSearchResult } from "../interfaces/StudentSearchResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

// Same helper as SchoolInfoReader.tsx's private loadImageElement - duplicated rather than shared
// since it's ~8 lines and this codebase keeps each *Reader file independent. crossOrigin is never
// needed here: the photo is always loaded from a same-origin blob: URL (see loadStudentPhotoImage),
// never directly from the API URL.
const loadImageElement = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

const PHOTO_MAX_CONCURRENT = 4;
const PHOTO_MAX_ATTEMPTS = 3;
const PHOTO_RETRY_DELAY_MS = 500;

// Tiny FIFO limiter shared by every photo fetch of the page, so a 60-row list doesn't fire 60
// simultaneous requests at the backend.
let photoActive = 0;
const photoWaiting: (() => void)[] = [];
const runPhotoRequest = async <T,>(task: () => Promise<T>): Promise<T> => {
  if (photoActive >= PHOTO_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => photoWaiting.push(resolve));
  }
  photoActive++;
  try {
    return await task();
  } finally {
    photoActive--;
    photoWaiting.shift()?.();
  }
};

// Some student rows store bday as a full ISO datetime ("2013-08-23T00:00:00.000Z") instead of a plain
// date. Strip the time part once, here at the source, so every list, edit field, PDF and Excel
// export built from these rows shows "2013-08-23". Anything that isn't an ISO datetime (including
// the other free-form formats already in the data) is left untouched.
const stripBdayTime = (students: Student[]): Student[] =>
  students.map((s) => {
    const match = typeof s.bday === "string" ? /^(d{4}-d{2}-d{2})T/.exec(s.bday) : null;
    return match ? { ...s, bday: match[1] } : s;
  });

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
      return stripBdayTime(await response.json());
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
      return stripBdayTime(await response.json());
    } catch (error) {
      console.error(
        `StudentReader.fetchAllStudentsOfYear(): Error fetching students: ${error}`,
      );
      return [];
    }
  };

  // /api/students/allStudentsSummaryOfSection - one row per enrolled student across every classe of
  // the given section+year (sexe/repeating/classe_id/classe_name/level only), used to tally the
  // "Effectifs par classe" report. Unlike fetchStudentsOfClasse/fetchStudentClasseOfClasse, this is
  // section-wide in a single request rather than needing a per-classe merge.
  public static fetchStudentsSummaryOfSection = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<StudentSectionSummaryRow[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/allStudentsSummaryOfSection` +
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
        `StudentReader.fetchStudentsSummaryOfSection(): Error fetching summary: ${error}`,
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

  // Batch upsert of student_classe.solvable1 - StudentController::updateSolvable. Despite the
  // column name, solvable1=0 means "insolvable" (hasn't paid) and solvable1=1 means "solvable"
  // (has paid) - see InsolvableManager, which is the only caller.
  public static updateSolvable = async (
    accessToken: string | null,
    connection: string,
    year: string,
    updates: { stud_id: number; classe_id: number; solvable1: number }[],
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/updateSolvable",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "updateSolvable",
    );
  };

  // Batch upsert of the end-of-year decision override fields - StudentController::updatePromotionInfo.
  // dismissalReason is an unused legacy column (this app derives the display reason from
  // codeExclusion everywhere else, e.g. EXCLUSION_OPTIONS in reportCardPdfShared.ts) - always sent
  // empty. promuEn null means "not manually set" (AUTO), matching StudentClasseInfo's own field.
  public static updatePromotionInfo = async (
    accessToken: string | null,
    connection: string,
    year: string,
    updates: {
      stud_id: number;
      classe_id: number;
      isMannullalyClassified: number;
      isMannullalyDismissed: number;
      mustRepeat: number;
      promuEn: number | null;
      codeExclusion: number;
    }[],
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/updatePromotionInfo",
      accessToken,
      {
        connection,
        year,
        data: JSON.stringify(updates.map((u) => ({ ...u, dismissalReason: "" }))),
        data_size: updates.length,
      },
      "updatePromotionInfo",
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

  // Whole-school search by matricule/name across every section and school year (ADMIN-only
  // endpoint). Resolves null on failure, [] when nothing matches.
  public static searchStudents = async (
    accessToken: string | null,
    connection: string,
    query: string,
  ): Promise<StudentSearchResult[] | null> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/searchStudents` +
      `?connection=${encodeURIComponent(connection)}` +
      `&q=${encodeURIComponent(query)}`;
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
      const data = await response.json();
      return Array.isArray(data) ? data : null;
    } catch (error) {
      console.error(`StudentReader.searchStudents(): Error: ${error}`);
      return null;
    }
  };

  // School-wide: strips the "T00:00:00.000Z" time part from stored birth dates. Resolves the
  // number of rows changed (0 when there was nothing to clean) or null on failure.
  public static cleanBirthDates = async (
    accessToken: string | null,
    connection: string,
  ): Promise<number | null> => {
    const result = (await StudentReader.postJson(
      "api/students/cleanBirthDates",
      accessToken,
      { connection },
      "cleanBirthDates",
    )) as ApiResult & { updated?: number };
    return result.status ? (result.updated ?? 0) : null;
  };

  // Moves one student between classes of the same year (backend copies matching-subject marks).
  public static changeStudentClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    studId: number,
    classeIdOld: number,
    classeIdNew: number,
  ): Promise<ApiResult> => {
    return StudentReader.postJson(
      "api/students/changeStudentClasse",
      accessToken,
      {
        connection,
        year,
        stud_id: studId,
        classe_id_old: classeIdOld,
        classe_id_new: classeIdNew,
      },
      "changeStudentClasse",
    );
  };

  // student.photo is a mediumblob (raw bytes, not a filesystem path like the school logo) - every
  // read has to go through this authenticated endpoint rather than a static <img src>. Mirrors
  // SchoolInfoReader.loadLogoImageForExport exactly: fetch the bytes as a Blob, turn them into a
  // same-origin blob: object URL (so a later <canvas> read for PDF/report-card embedding never hits
  // a CORS-tainted-canvas error), then load that into an Image element. Returns null both when the
  // student has no photo yet (404) and on any network failure - callers show the same placeholder
  // icon either way, so there's no need to distinguish the two.
  public static loadStudentPhotoImage = async (
    accessToken: string | null,
    connection: string,
    studId: number,
  ): Promise<HTMLImageElement | null> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/students/studentPhoto` +
      `?connection=${encodeURIComponent(connection)}` +
      `&stud_id=${studId}`;
    // Every row of the student list loads its own photo at the same time, so a transient failure
    // (connection refused under that burst, a dropped response, an undecodable partial body) used
    // to leave that row on the placeholder for good. Requests now go through a small shared queue
    // (PHOTO_MAX_CONCURRENT in flight) and are retried with a short backoff - except a 404, which
    // legitimately means "no photo yet" and is returned immediately.
    for (let attempt = 1; attempt <= PHOTO_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await runPhotoRequest(() =>
          fetch(targetUrl, {
            headers: {
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
          }),
        );
        if (response.status === 404) {
          return null;
        }
        if (response.ok) {
          const blob = await response.blob();
          const img = await loadImageElement(URL.createObjectURL(blob));
          if (img) {
            return img;
          }
        }
      } catch (error) {
        console.error(`StudentReader.loadStudentPhotoImage(): Error: ${error}`);
      }
      if (attempt < PHOTO_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, PHOTO_RETRY_DELAY_MS * attempt));
      }
    }
    return null;
  };

  // Unlike every other write in this file, the body is multipart FormData (the photo is an uploaded
  // file), so this bypasses postJson the same way SchoolInfoReader.saveSchoolInfo bypasses its own
  // JSON convention for the logo.
  public static uploadStudentPhoto = async (
    accessToken: string | null,
    connection: string,
    studId: number,
    photo: Blob,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/students/uploadStudentPhoto`;
    const formData = new FormData();
    formData.append("connection", connection);
    formData.append("stud_id", String(studId));
    formData.append("photo", photo, "photo.jpg");
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: formData,
      });
      return await response.json();
    } catch (error) {
      console.error(`StudentReader.uploadStudentPhoto(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
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
      console.error(`StudentReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
