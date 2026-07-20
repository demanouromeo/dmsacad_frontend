import { MyConstants } from "./MyConstants";
import type { Staff } from "../interfaces/Staff";
import type { StaffSummary } from "../interfaces/StaffSummary";
import type { CourseAssignment } from "../interfaces/CourseAssignment";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

// Same helper as StudentReader.tsx's loadImageElement - duplicated rather than shared since it's
// ~8 lines and this codebase keeps each *Reader file independent.
const loadImageElement = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

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

  // Backs the Excel/CSV import feature. Unlike Classe/Subject's import (a separate delete-then-save
  // pair of calls), saveManyStaffs has its own built-in `override` flag: when set, the backend wipes
  // every staff record of the current year+section server-side before inserting the new ones, in one
  // atomic call - see StaffController::saveManyStaffs.
  public static saveManyStaffs = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    rows: {
      name: string;
      surname: string;
      phone1: string;
      function: number;
      civility: string;
      sexe: string;
      login: string;
      pwd: string;
    }[],
    override: boolean,
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/saveManyStaffs",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(rows),
        data_size: rows.length,
        ...(override ? { override: "1" } : {}),
      },
      "saveManyStaffs",
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

  // Backs the "Assign courses" screen - every (subject, classe, staff) assignment in the current
  // section+year, in one call (StaffController::AllAttributionsOfSection). Cached and refetched
  // after every mutation on that screen rather than re-derived from smaller per-staff/per-subject
  // endpoints, since it already carries everything both panels need (right panel filters by
  // staff_id, left panel's "other teachers" annotation filters by subject_id+classe_id).
  public static fetchAllAttributionsOfSection = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<CourseAssignment[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/staffs/AllAttributionsOfSection` +
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
        `StaffReader.fetchAllAttributionsOfSection(): Error fetching attributions: ${error}`,
      );
      return [];
    }
  };

  // Assigns one (subject, classe) pair to one staff member (StaffController::assignACourse) - a
  // no-op server-side if that exact triple is already assigned.
  public static assignCourse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    subjectId: number,
    classeId: number,
    staffId: number,
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/assignACourse",
      accessToken,
      {
        connection,
        year,
        section,
        subject_id: subjectId,
        classe_id: classeId,
        staff_id: staffId,
      },
      "assignCourse",
    );
  };

  // Unassigns one (subject, classe, staff) row (StaffController::removeACourse) - backs the
  // right panel's per-row delete icon.
  public static removeCourse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    subjectId: number,
    classeId: number,
    staffId: number,
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/removeACourse",
      accessToken,
      {
        connection,
        year,
        section,
        subject_id: subjectId,
        classe_id: classeId,
        staff_id: staffId,
      },
      "removeCourse",
      "DELETE",
    );
  };

  // Unassigns every course currently assigned to one staff member, in the current section+year
  // (StaffController::removeALLCourses / MyHelper::removeAStaffCourses) - backs the "Remove all"
  // button, scoped to the selected teacher only (not the whole section).
  public static removeAllCoursesOfStaff = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    staffId: number,
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/removeALLCourses",
      accessToken,
      { connection, year, section, staff_id: staffId },
      "removeAllCoursesOfStaff",
      "DELETE",
    );
  };

  // Batch-assigns several (subject, classe) pairs to one staff member in one call
  // (StaffController::batchAssignCourses) - backs the left panel's "Save" button (one row per
  // checked classe, all sharing the currently selected subject+staff).
  public static batchAssignCourses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    rows: { staff_id: number; subject_id: number; classe_id: number }[],
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/batchAssignCourses",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "batchAssignCourses",
    );
  };

  // Batch-unassigns several (subject, classe, staff) rows in one call
  // (StaffController::batchRemoveCourses) - backs the right panel's bulk-delete button, and is also
  // how the "delete all assignments of the section+year" red button is implemented client-side
  // (no dedicated whole-section wipe endpoint exists server-side, so it's this call given every
  // currently-loaded attribution row).
  public static batchRemoveCourses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    rows: { staff_id: number; subject_id: number; classe_id: number }[],
  ): Promise<ApiResult> => {
    return StaffReader.postJson(
      "api/staffs/batchRemoveCourses",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(rows),
        data_size: rows.length,
      },
      "batchRemoveCourses",
    );
  };

  // staff.photo is a mediumblob (raw bytes, not a filesystem path) - every read has to go through
  // this authenticated endpoint rather than a static <img src>. Mirrors
  // StudentReader.loadStudentPhotoImage exactly: fetch the bytes as a Blob, turn them into a
  // same-origin blob: object URL, then load that into an Image element. Returns null both when the
  // staff member has no photo yet (404) and on any network failure - callers show the same
  // placeholder icon either way.
  public static loadStaffPhotoImage = async (
    accessToken: string | null,
    connection: string,
    staffId: number,
  ): Promise<HTMLImageElement | null> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/staffs/staffPhoto` +
      `?connection=${encodeURIComponent(connection)}` +
      `&staff_id=${staffId}`;
    try {
      const response = await fetch(targetUrl, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return loadImageElement(URL.createObjectURL(blob));
    } catch (error) {
      console.error(`StaffReader.loadStaffPhotoImage(): Error: ${error}`);
      return null;
    }
  };

  // Unlike every other write in this file, the body is multipart FormData (the photo is an uploaded
  // file), so this bypasses postJson the same way StudentReader.uploadStudentPhoto does.
  public static uploadStaffPhoto = async (
    accessToken: string | null,
    connection: string,
    staffId: number,
    photo: Blob,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/staffs/uploadStaffPhoto`;
    const formData = new FormData();
    formData.append("connection", connection);
    formData.append("staff_id", String(staffId));
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
      console.error(`StaffReader.uploadStaffPhoto(): Error: ${error}`);
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
      console.error(`StaffReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
