import { MyConstants } from "./MyConstants";
import type { Classe } from "../interfaces/Classe";
import type { ApiResult } from "../interfaces/ApiResult";
import type { ApcLevel } from "../interfaces/ApcLevel";
import type { ClasseOfSubject } from "../interfaces/ClasseOfSubject";

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
