import { MyConstants } from "./MyConstants";
import type { AdministrateurAccount } from "../interfaces/AdministrateurAccount";
import type { ApiResult } from "../interfaces/ApiResult";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class AccountReader {
  // Not year-scoped - administrateur has no administrateur_year table the way staff does (see
  // AccountController::allAdministrateurAccounts).
  public static fetchAdministrateurAccounts = async (
    accessToken: string | null,
    connection: string,
  ): Promise<AdministrateurAccount[]> => {
    const targetUrl =
      `${MyConstants.getBaseUrl()}api/accounts/allAdministrateurAccounts` +
      `?connection=${encodeURIComponent(connection)}`;
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
        `AccountReader.fetchAdministrateurAccounts(): Error fetching administrator accounts: ${error}`,
      );
      return [];
    }
  };

  // `newPwd` is optional - omit it entirely to leave the account's password unchanged, same
  // convention as StaffReader.updateStaff's optional `pwd`. Backed by the ADMIN-only
  // AccountController::adminUpdateAccount, not the self-service updateAccount endpoint (which has
  // no role gate and always requires a new password).
  public static updateAccount = async (
    accessToken: string | null,
    connection: string,
    accId: number,
    login: string,
    type: number,
    newPwd?: string,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/adminUpdateAccount`;
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
          acc_id: accId,
          login,
          type,
          ...(newPwd ? { new_pwd: newPwd } : {}),
        }),
      });
      return await response.json();
    } catch (error) {
      console.error(`AccountReader.updateAccount(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };

  // The caller's own login (never pwd) - AccountController::myAccount, JWT-scoped to the requesting
  // account. Used to prefill "Manage credential"'s New login field, since the JWT payload itself
  // carries no login. POST (not GET) so this literal path isn't shadowed by the ADMIN group's
  // earlier-registered GET /accounts/{connection} wildcard - see the backend route's own comment.
  public static fetchMyAccount = async (
    accessToken: string | null,
    connection: string,
  ): Promise<{ acc_id: number; login: string; email: string | null } | null> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/myAccount`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ connection }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`AccountReader.fetchMyAccount(): Error: ${error}`);
      return null;
    }
  };

  // On-blur check for "Manage credential"'s Old password field - no mutation, JWT-scoped to the
  // requesting account. AccountController::verifyOldPassword.
  public static verifyOldPassword = async (
    accessToken: string | null,
    connection: string,
    oldPwd: string,
  ): Promise<boolean> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/verifyOldPassword`;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ connection, old_pwd: oldPwd }),
      });
      const result: ApiResult = await response.json();
      return result.status === true;
    } catch (error) {
      console.error(`AccountReader.verifyOldPassword(): Error: ${error}`);
      return false;
    }
  };

  // Self-service credential save for "Manage credential" - AccountController::updateAccount
  // (jwt.auth only, no role:ADMIN - distinct from the ADMIN-only updateAccount() method above,
  // which hits adminUpdateAccount and takes a caller-supplied acc_id). `newPwd` is optional, same
  // "omit to leave unchanged" convention as the ADMIN method. The account being edited is always the
  // JWT's own - never sent as a param.
  public static updateMyCredentials = async (
    accessToken: string | null,
    connection: string,
    oldPwd: string,
    login: string,
    newPwd?: string,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/accounts/updateAccount`;
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
          old_pwd: oldPwd,
          login,
          ...(newPwd ? { new_pwd: newPwd } : {}),
        }),
      });
      return await response.json();
    } catch (error) {
      console.error(`AccountReader.updateMyCredentials(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
