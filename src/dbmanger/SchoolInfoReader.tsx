import { MyConstants } from "./MyConstants";
import type { SchoolConfig } from "../interfaces/SchoolConfig";
import type { ApiResult } from "../interfaces/ApiResult";
import type { SchoolHeaderConfig } from "../interfaces/SchoolHeaderConfig";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

export class SchoolInfoReader {
  // Backs the school header (logo + identity fields) shown on printed/exported documents.
  // Returns null on any failure/empty result rather than alert()ing - this runs silently on
  // every login, not from a user-facing form, so there's nothing useful to alert() about.
  public static fetchSchoolConfigOfYear = async (
    accessToken: string | null,
    connection: string,
    year: string,
  ): Promise<SchoolHeaderConfig | null> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/configs/allSchoolConfigOfYear?connection=${encodeURIComponent(connection)}&year=${encodeURIComponent(year)}`;
    try {
      const response = await fetch(targetUrl, {
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
      console.error(
        `SchoolInfoReader.fetchSchoolConfigOfYear(): Error: ${error}`,
      );
      return null;
    }
  };

  // Unlike the other *Reader classes' JSON POSTs, this endpoint accepts the logo as an uploaded
  // file, so the body must be multipart FormData - do not set a Content-Type header, the browser
  // fills in the multipart boundary automatically.
  public static saveSchoolInfo = async (
    accessToken: string | null,
    connection: string,
    year: string,
    fields: SchoolConfig,
    logo: File,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/configs/schoolConfigSorU`;
    const formData = new FormData();
    formData.append("connection", connection);
    formData.append("year", year);
    formData.append("logo", logo);
    (Object.keys(fields) as (keyof SchoolConfig)[]).forEach((key) => {
      formData.append(key, fields[key]);
    });
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
      console.error(`SchoolInfoReader.saveSchoolInfo(): Error: ${error}`);
      return NETWORK_ERROR_RESULT;
    }
  };
}
