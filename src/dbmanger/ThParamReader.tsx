import { MyConstants } from "./MyConstants";
import type { ApiResult } from "../interfaces/ApiResult";
import type { ThParam } from "../interfaces/ThParam";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class ThParamReader {
  // Any authenticated role can read (ThParamController::thParamOfYear sits in the jwt.auth-only
  // route group, not role:ADMIN) - Honors Roll (Tableau d'honneur) generation will need this too,
  // not just this ADMIN-only settings screen. Returns null when nothing has been saved yet for this
  // school year.
  public static fetchThParamOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<ThParam | null> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/th/thParamOfYear` +
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
      console.error(`ThParamReader.fetchThParamOfYear(): Error: ${error}`);
      return null;
    }
  };

  // ADMIN-only (ThParamController::saveThParam, role:ADMIN group) - creates or updates the current
  // school year's single row, backend-side (find-then-update-or-create by sy_id, same as
  // ClassifiedparamController::saveClassifiedParamOfYear - never two separate save/update calls from
  // here). lb_default/ub_default are sent equal to lb/ub - there's no separate "restore to default"
  // UI on this screen, so the "default" pair just tracks whatever was last explicitly saved.
  // seuil_abs_default is deliberately not sent - the backend only ever sets it once, on first create
  // (mirroring its own update path, which leaves that column untouched).
  public static saveThParam = async (
    accessToken: string | null,
    connection: string,
    year: string,
    lb: number,
    ub: number,
    seuilAbs: number,
    val1: number,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/th/saveThParam`;
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
          lb,
          ub,
          lb_default: lb,
          ub_default: ub,
          seuil_abs: seuilAbs,
          val1,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error(`ThParamReader.saveThParam(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
