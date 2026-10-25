import { MyConstants } from "./MyConstants";
import type { ApiResult } from "../interfaces/ApiResult";
import type { SubAdmin } from "../interfaces/SubAdmin";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

// SUBADMIN accounts (account.type = 9) - backed by AccountController's subadmin endpoints, which
// only the real ADMIN can reach (role:ADMIN,!SUBADMIN). A subadmin has no record besides its
// account row, so there's no name/surname here - just login.
export class SubAdminReader {
  private static postJson = async (
    path: string,
    accessToken: string | null,
    body: object,
    callerName: string,
  ): Promise<ApiResult> => {
    try {
      const response = await fetch(`${MyConstants.getBaseUrl()}api/subadmins/${path}`, {
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
      console.error(`SubAdminReader.${callerName}(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };

  public static fetchSubAdmins = async (
    accessToken: string | null,
    connection: string,
  ): Promise<SubAdmin[]> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/subadmins/all?connection=${encodeURIComponent(connection)}`;
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
      console.error(`SubAdminReader.fetchSubAdmins(): Error: ${error}`);
      return [];
    }
  };

  public static saveSubAdmin = (
    accessToken: string | null,
    connection: string,
    login: string,
    pwd: string,
  ): Promise<ApiResult> =>
    SubAdminReader.postJson("save", accessToken, { connection, login, pwd }, "saveSubAdmin");

  public static updatePassword = (
    accessToken: string | null,
    connection: string,
    accId: number,
    newPwd: string,
  ): Promise<ApiResult> =>
    SubAdminReader.postJson(
      "updatePassword",
      accessToken,
      { connection, acc_id: accId, new_pwd: newPwd },
      "updatePassword",
    );

  public static deleteSubAdmin = (
    accessToken: string | null,
    connection: string,
    accId: number,
  ): Promise<ApiResult> =>
    SubAdminReader.postJson("delete", accessToken, { connection, acc_id: accId }, "deleteSubAdmin");
}
