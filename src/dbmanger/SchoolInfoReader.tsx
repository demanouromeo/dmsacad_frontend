import { MyConstants } from "./MyConstants";
import type { SchoolConfig } from "../interfaces/SchoolConfig";
import type { ApiResult } from "../interfaces/ApiResult";
import type { SchoolHeaderConfig } from "../interfaces/SchoolHeaderConfig";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

// The logo isn't looked up via the basic_school_config row (its logo_path is a timestamped
// per-upload filename) - it lives at a fixed, well-known location per connection, one level
// below the images root, with an unpredictable extension. Probe png/jpg/jpeg in order.
const LOGO_EXTENSIONS = ["png", "jpg", "jpeg"] as const;

// Apache's docroot here is the Laravel app root (not `public/`) - confirmed live, a request for
// `${baseUrl}images/...` 404s while `${baseUrl}public/images/...` 200s - so the `public/` segment
// is required even though it isn't part of the logical `images/{connection}/logo/...` path the
// backend itself stores/writes relative to `public_path()`.
const buildLogoUrl = (connection: string, extension: string): string =>
  `${MyConstants.getBaseUrl()}public/images/${connection}/logo/logo.${extension}`;

// Static assets under /public aren't covered by the backend's CORS config (only api/* is), so a
// cross-origin fetch()/HEAD probe would be blocked. Loading through an Image element sidesteps
// that entirely - like a plain <img> tag, it doesn't require CORS headers to load/display.
const probeImageUrl = (url: string): Promise<boolean> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

export class SchoolInfoReader {
  // Resolves the school logo's URL for the given connection by probing each known extension in
  // turn, or null if none load. Used both by this form's own preview and by any other module
  // (report headers, printed documents, ...) that needs to display the school logo.
  public static fetchLogo = async (connection: string): Promise<string | null> => {
    for (const extension of LOGO_EXTENSIONS) {
      const url = buildLogoUrl(connection, extension);
      if (await probeImageUrl(url)) {
        return url;
      }
    }
    return null;
  };

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
