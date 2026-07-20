import { MyConstants } from "./MyConstants";
import type { ApiResult } from "../interfaces/ApiResult";
import type { ClassifiedParam } from "../interfaces/ClassifiedParam";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class ClassifiedParamReader {
  // Any authenticated role can read (ClassifiedparamController::classifiedParamOfYear sits in the
  // jwt.auth-only route group, not role:ADMIN) - report-card generation will need this too, not just
  // this ADMIN-only settings screen. Returns null when nothing has been saved yet for this school
  // year, which the caller should treat the same as classified=0 (see the backend CLAUDE.md).
  public static fetchClassifiedParamOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<ClassifiedParam | null> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/settings/classifiedParamOfYear` +
      `?connection=${encodeURIComponent(connection)}&year=${encodeURIComponent(year)}`;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error(`ClassifiedParamReader.fetchClassifiedParamOfYear(): Error: ${error}`);
      return null;
    }
  };

  // ADMIN-only (ClassifiedparamController::saveClassifiedParamOfYear, role:ADMIN group) - creates or
  // updates the current school year's single row, backend-side (see the controller's own
  // find-then-update-or-create logic - never two separate save/update calls from here).
  public static saveClassifiedParamOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
    classified: boolean,
    nbMatieresRate: number,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/settings/saveClassifiedParamOfYear`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          connection,
          year,
          classified: classified ? 1 : 0,
          nbMatieresRate,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error(`ClassifiedParamReader.saveClassifiedParamOfYear(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
