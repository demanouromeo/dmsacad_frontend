import { MyConstants } from "./MyConstants";
import type { Classe } from "../interfaces/Classe";
import type { ApiResult } from "../interfaces/ApiResult";
import type { ApcLevel } from "../interfaces/ApcLevel";
import type { ClasseOfSubject } from "../interfaces/ClasseOfSubject";
import type { VpClasse } from "../interfaces/VpClasse";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class ClasseReader {
  // /api/classes/allClasse1 requires jwt.auth (any connected user). Unlike allFilieres/
  // allSpecialitesOfSection, it responds 404 (not 200 + []) when the section has no classes yet -
  // that's a normal, expected state here (a freshly created section), not a fetch failure, so it's
  // handled separately from other non-ok statuses below rather than logged as an error.
  public static fetchClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<Classe[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/classes/allClasse1` +
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
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(
        `ClasseReader.fetchClasses(): Error fetching classes: ${error}`,
      );
      return [];
    }
  };

  public static saveClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeName: string,
    level: number,
    specialityName?: string,
    classeMasterId?: number | null,
    sgId?: number | null,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/saveClasse",
      accessToken,
      {
        connection,
        year,
        section,
        classe_name: classeName,
        level,
        ...(specialityName ? { speciality_name: specialityName } : {}),
        ...(classeMasterId ? { classe_master_id: classeMasterId } : {}),
        ...(sgId ? { sg_id: sgId } : {}),
      },
      "saveClasse",
    );
  };

  // No single-item update endpoint exists server-side, same as Filiere/Speciality - even a
  // one-row edit goes through updateManyClasses with a one-element array. classe_master_id/sg_id
  // are included on every call (unchanged, sourced from the already-loaded Classe) even though
  // this screen doesn't let the user edit them: the backend writes whatever key is present
  // (or null if the key is missing) straight onto classe_year, so omitting them would silently
  // clear any classe master/SG already assigned via the dedicated assignment endpoints.
  public static updateClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    updates: {
      classe_id: number;
      classe_name: string;
      level: number;
      speciality_id: number | null;
      classe_master_id: number | null;
      sg_id: number | null;
    }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/updateManyClasses",
      accessToken,
      {
        connection,
        year,
        // The backend validates `data` with Laravel's `json` rule, which requires a
        // JSON-encoded *string*, not a nested array - hence the explicit stringify here
        // even though the outer request body is itself JSON.
        data: JSON.stringify(updates),
        data_size: updates.length,
      },
      "updateClasses",
    );
  };

  public static deleteClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    classeIds: number[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/deleteManyClasses",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(classeIds.map((id) => ({ classe_id: id }))),
        data_size: classeIds.length,
      },
      "deleteClasses",
    );
  };

  // Backs the Excel/CSV import feature - sg_id/classe_master_id/speciality_name are always sent as
  // null since the imported file only carries name+level, and the backend writes whatever key is
  // present (or null) straight onto classe_year (see updateClasses' comment above).
  public static saveManyClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    rows: { classe_name: string; level: number }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/saveManyClasses",
      accessToken,
      {
        connection,
        year,
        section,
        data: JSON.stringify(
          rows.map((r) => ({
            classe_name: r.classe_name,
            level: r.level,
            sg_id: null,
            classe_master_id: null,
            speciality_name: null,
          })),
        ),
        data_size: rows.length,
      },
      "saveManyClasses",
    );
  };

  // A classe is APC not via its own row, but indirectly: apc_level is keyed by (sy_id, section_id,
  // level), not by classe_id - so this is a per-level flag shared by every classe at that level, not
  // a per-classe one. 404 means no apc_level row exists yet for this year+section (nothing
  // activated), same "empty state, not an error" handling as fetchClasses' 404.
  public static fetchApcLevels = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<ApcLevel[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/classes/getAPCLevels` +
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
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const rows: { level: number; activated: number }[] = await response.json();
      return rows.map((row) => ({ level: row.level, activated: Boolean(row.activated) }));
    } catch (error) {
      console.error(
        `ClasseReader.fetchApcLevels(): Error fetching APC levels: ${error}`,
      );
      return [];
    }
  };

  // Updates a single classe's classe_year end-of-year decision thresholds (Promotion settings
  // sub-module) - passMark isn't editable in that screen yet, so callers pass through the value
  // already loaded on the Classe unchanged, same "unedited fields still round-tripped" convention
  // updateClasses uses for classe_master_id/sg_id.
  public static updateClassSettings = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classeId: number,
    totalAbsTh: number,
    totalExclusionTh: number,
    avgDismissalTh: number,
    repeatUb: number,
    passMark: number,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/updateClassSettings",
      accessToken,
      {
        connection,
        year,
        classe_id: classeId,
        totalAbsTh,
        totalExclusionTh,
        avgDismissalTh,
        repeatUb,
        passMark,
      },
      "updateClassSettings",
    );
  };

  // Upserts the (year, section, level) APC flag - affects every classe at that level, not just one.
  public static updateApcLevel = async (
    accessToken: string | null,
    connection: string,
    year: string,
    level: number,
    section: string,
    activated: boolean,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/updateApcLevel",
      accessToken,
      { connection, year, level, section, activated },
      "updateApcLevel",
    );
  };

  // Destructive - deletes every classe for the given section+year (used by the import feature's
  // "override" path). Unlike deleteClasses, takes no classe_id list: the backend clears the whole
  // section+year in one shot.
  public static deleteClassesOfSectionAndYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/deleteClassesOfSectionAndYear",
      accessToken,
      { connection, year, section },
      "deleteClassesOfSectionAndYear",
      "DELETE",
    );
  };

  // Backs the "Assign courses" screen's left panel - classes where subjectId is taught in the
  // current section+year (ClasseController::allClassesOfSubject). 404 means no classe teaches this
  // subject yet - an expected empty state, same handling as fetchClasses'/fetchApcLevels' 404.
  public static fetchClassesOfSubject = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    subjectId: number,
  ): Promise<ClasseOfSubject[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/classes/allClassesOfSubject` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&section=${encodeURIComponent(section)}` +
      `&subject_id=${subjectId}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(
        `ClasseReader.fetchClassesOfSubject(): Error fetching classes: ${error}`,
      );
      return [];
    }
  };

  // Backs the "Manage Vice principals" screen's right panel - classes currently assigned to one VP
  // (classe_year.vp_id) in the current section+year (ClasseController::allVpClasses). 404 means this
  // VP has no classes assigned yet, same "empty state, not an error" handling as fetchClasses' 404.
  public static fetchVpClasses = async (
    accessToken: string | null,
    connection: string,
    year: string,
    section: string,
    vpId: number,
  ): Promise<VpClasse[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/classes/allVpClasses` +
      `?connection=${encodeURIComponent(connection)}` +
      `&year=${encodeURIComponent(year)}` +
      `&section=${encodeURIComponent(section)}` +
      `&vp_id=${vpId}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (response.status === 404) {
        return [];
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(
        `ClasseReader.fetchVpClasses(): Error fetching VP classes: ${error}`,
      );
      return [];
    }
  };

  // Batch-assigns several classes to one VP in one call (ClasseController::assignClassesToAVp) - a
  // classe already assigned to this VP is simply overwritten with the same value (no-op), same
  // "same triple is a no-op" tolerance StaffReader.batchAssignCourses relies on.
  public static assignClassesToVp = async (
    accessToken: string | null,
    connection: string,
    year: string,
    vpId: number,
    classeIds: number[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/assignClassesToAVp",
      accessToken,
      {
        connection,
        year,
        vp_id: vpId,
        data: JSON.stringify(classeIds.map((id) => ({ classe_id: id }))),
        data_size: classeIds.length,
      },
      "assignClassesToVp",
    );
  };

  // Assigns (or reassigns) a single classe to a single VP (ClasseController::assignVpAClass) -
  // backs the "Assign from class list" view's per-row VP combobox, where each row change concerns
  // exactly one classe rather than a batch. Since classe_year.vp_id is a plain column overwrite,
  // this silently replaces whatever VP the classe previously had, if any.
  public static assignVpToClasse = async (
    accessToken: string | null,
    connection: string,
    year: string,
    vpId: number,
    classeId: number,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/assignVpAClass",
      accessToken,
      { connection, year, vp_id: vpId, classe_id: classeId },
      "assignVpToClasse",
    );
  };

  // Unassigns one classe from one VP (ClasseController::removeAClassFromAVp) - note the backend
  // param is `class_id`, not `classe_id`, unlike every other classe-scoped endpoint in this file.
  public static removeClasseFromVp = async (
    accessToken: string | null,
    connection: string,
    year: string,
    vpId: number,
    classeId: number,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/removeAClassFromAVp",
      accessToken,
      { connection, year, vp_id: vpId, class_id: classeId },
      "removeClasseFromVp",
      "DELETE",
    );
  };

  // Unassigns every classe currently assigned to one VP, in the current year
  // (ClasseController::removeALLVpClasses) - backs the "Remove all" button.
  public static removeAllClassesFromVp = async (
    accessToken: string | null,
    connection: string,
    year: string,
    vpId: number,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/removeALLVpClasses",
      accessToken,
      { connection, year, vp_id: vpId },
      "removeAllClassesFromVp",
      "DELETE",
    );
  };

  // ---- Basculement (end-of-year promotion transfer) ----
  // These wrap ClasseController's existing applyBasculement/removeBasculement/resetBasculement/
  // cancelAllBasculement/processRedoublants/clearExclus/saveChanges endpoints - a legacy backend
  // surface (ported from a prior mobile-app feature) that already fully existed and was already
  // routed before BasculementManager.tsx was built; only the frontend wiring was missing.

  // Transfers selected students out of `classeId` (their current classe) into `newClasseId` for
  // `nextYear` - sets student_classe.basculated=1/basculated_classe_id on the current-year row and
  // removes any pre-existing next-year placeholder row created by processRedoublants.
  public static applyBasculement = async (
    accessToken: string | null,
    connection: string,
    year: string,
    nextYear: string,
    classeId: number,
    newClasseId: number,
    students: { stud_id: number; cas_social: number }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/applyBasculement",
      accessToken,
      {
        connection,
        year,
        next_year: nextYear,
        new_classe_id: newClasseId,
        data: JSON.stringify(students.map((s) => ({ ...s, classe_id: classeId }))),
        data_size: students.length,
      },
      "applyBasculement",
    );
  };

  // Undoes a basculement for selected students already transferred into `newClasseId` - resets
  // basculated/basculated_classe_id on the current-year row and deletes the next-year row.
  public static removeBasculement = async (
    accessToken: string | null,
    connection: string,
    year: string,
    nextYear: string,
    classeId: number,
    newClasseId: number,
    students: { stud_id: number }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/removeBasculement",
      accessToken,
      {
        connection,
        year,
        next_year: nextYear,
        new_classe_id: newClasseId,
        data: JSON.stringify(students.map((s) => ({ ...s, classe_id: classeId }))),
        data_size: students.length,
      },
      "removeBasculement",
    );
  };

  // Cancels every basculement of one current-year classe (deletes every next-year row tied to its
  // students, resets basculated/basculated_classe_id for the whole classe).
  public static resetBasculement = async (
    accessToken: string | null,
    connection: string,
    year: string,
    nextYear: string,
    classeId: number,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/resetBasculement",
      accessToken,
      { connection, year, next_year: nextYear, classe_id: classeId },
      "resetBasculement",
      "DELETE",
    );
  };

  // Cancels every basculement of every classe of the year (toolbox's "Annuler tout").
  public static cancelAllBasculement = async (
    accessToken: string | null,
    connection: string,
    year: string,
    nextYear: string,
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/cancelAllBasculement",
      accessToken,
      { connection, year, next_year: nextYear },
      "cancelAllBasculement",
      "DELETE",
    );
  };

  // Init step 1: pre-registers non-dismissed, not-yet-basculated students of one current-year
  // classe as repeaters (`repeating=1`) in the SAME classe_id for nextYear - a no-op (skipped, not
  // an error) server-side for a student who already has that next-year row.
  public static processRedoublants = async (
    accessToken: string | null,
    connection: string,
    year: string,
    nextYear: string,
    classeId: number,
    students: { stud_id: number; cas_social: number }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/processRedoublants",
      accessToken,
      {
        connection,
        year,
        next_year: nextYear,
        data: JSON.stringify(students.map((s) => ({ ...s, classe_id: classeId }))),
        data_size: students.length,
      },
      "processRedoublants",
    );
  };

  // Init step 2: deletes the next-year placeholder row (if any) for every dismissed student, across
  // every classe at once - each entry carries its own origin classe_id.
  public static clearExclus = async (
    accessToken: string | null,
    connection: string,
    nextYear: string,
    students: { stud_id: number; classe_id: number }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/clearExclus",
      accessToken,
      {
        connection,
        next_year: nextYear,
        data: JSON.stringify(students),
        data_size: students.length,
      },
      "clearExclus",
    );
  };

  // Right panel's per-row "change this student's next-year classe" action - deletes every next-year
  // row for that stud_id (regardless of classe) and re-inserts one at promuEn.
  public static saveBasculementChanges = async (
    accessToken: string | null,
    connection: string,
    year: string,
    nextYear: string,
    students: { stud_id: number; promuEn: number; cas_social: number }[],
  ): Promise<ApiResult> => {
    return ClasseReader.postJson(
      "api/classes/saveChanges",
      accessToken,
      {
        connection,
        year,
        next_year: nextYear,
        data: JSON.stringify(students),
        data_size: students.length,
      },
      "saveBasculementChanges",
    );
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
      console.error(`ClasseReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
