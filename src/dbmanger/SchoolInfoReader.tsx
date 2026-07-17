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

// Loading through an Image element (rather than fetch()/HEAD) means simple display doesn't need
// any CORS headers - a plain <img> tag never did either. crossOrigin is still set to "anonymous"
// so callers that need to read pixel data back out (jsPDF embeds the logo into exported PDFs via
// <canvas>) get a non-tainted image; the images folder now sends Access-Control-Allow-Origin: *
// (see public/images/.htaccess) specifically to make that work.
const loadLogoImage = (url: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

export class SchoolInfoReader {
  // Resolves the school logo for the given connection by probing each known extension in turn,
  // or null if none load. Used both by this form's own preview (via .src) and by the export
  // letterhead (utils/exportHeader.ts), which needs the loaded element itself to embed in a PDF.
  public static fetchLogoImage = async (
    connection: string,
  ): Promise<HTMLImageElement | null> => {
    for (const extension of LOGO_EXTENSIONS) {
      const url = buildLogoUrl(connection, extension);
      const img = await loadLogoImage(url);
      if (img) {
        return img;
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
  // fills in the multipart boundary automatically. `logo` is optional: the backend only replaces
  // the stored logo when one is actually sent, otherwise it keeps whatever's already on disk.
  public static saveSchoolInfo = async (
    accessToken: string | null,
    connection: string,
    year: string,
    fields: SchoolConfig,
    logo: File | null,
  ): Promise<ApiResult> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/configs/schoolConfigSorU`;
    const formData = new FormData();
    formData.append("connection", connection);
    formData.append("year", year);
    if (logo) {
      formData.append("logo", logo);
    }
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
