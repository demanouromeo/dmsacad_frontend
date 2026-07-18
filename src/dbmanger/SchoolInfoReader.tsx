import { MyConstants } from "./MyConstants";
import type { SchoolConfig } from "../interfaces/SchoolConfig";
import type { ApiResult } from "../interfaces/ApiResult";
import type { SchoolHeaderConfig } from "../interfaces/SchoolHeaderConfig";

const NETWORK_ERROR_RESULT: ApiResult = {
  status: false,
  message: "Network error. Please try again later.",
};

// Apache's docroot here is the Laravel app root (not `public/`) - confirmed live, a request for
// `${baseUrl}images/...` 404s while `${baseUrl}public/images/...` 200s - so the `public/` segment
// is required even though it isn't part of `logo_path` itself, which is stored relative to
// `public_path()` on the backend.
const buildLogoUrl = (logoPath: string): string =>
  `${MyConstants.getBaseUrl()}public/${logoPath}`;

// Loading through an Image element (rather than fetch()/HEAD) means simple display doesn't need
// any CORS headers - a plain <img> tag never did either. crossOrigin is only set to "anonymous"
// when the caller actually needs to read pixel data back out (jsPDF embeds the logo into exported
// PDFs via <canvas>), which requires the server to answer with Access-Control-Allow-Origin (see
// public/images/.htaccess) - the remote host's front-end CDN currently strips/ignores that header,
// so forcing crossOrigin on the plain-display path (the school-info form preview) made even a
// perfectly loadable image fail with net::ERR_FAILED for no display-only reason.
const loadImageElement = (
  url: string,
  needsCanvasAccess: boolean,
): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    if (needsCanvasAccess) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

export class SchoolInfoReader {
  // Resolves the school logo from the `logo_path` a prior allSchoolConfigOfYear/schoolConfigSorU
  // call already returned (relative to the backend's public/ root, e.g.
  // "images/TEST/logo/logo.png") - null if there's no path yet (never uploaded) or it fails to
  // load. This used to guess the extension by probing png/jpg/jpeg in turn, which could resolve
  // to a stale leftover file with a different extension than the one actually last saved; trusting
  // the backend's own recorded path is the source of truth instead.
  public static loadLogoImage = async (
    logoPath: string | null | undefined,
    needsCanvasAccess = false,
  ): Promise<HTMLImageElement | null> => {
    if (!logoPath) {
      return null;
    }
    return loadImageElement(buildLogoUrl(logoPath), needsCanvasAccess);
  };

  // Loads the logo for PDF/export embedding through the authenticated /api/configs/schoolLogo
  // proxy instead of the static public/images/ path loadLogoImage uses - that static path works
  // fine for plain display, but embedding into a PDF requires reading the pixels back out of a
  // <canvas>, which the browser blocks (tainted canvas) unless the response carries
  // Access-Control-Allow-Origin. The remote host's static-file CDN doesn't send that header and it
  // isn't something this app can configure, whereas /api/* routes already get it from Laravel's own
  // CORS middleware (confirmed working remotely for every other endpoint). Fetching the bytes as a
  // Blob and handing the resulting blob: object URL to <img> (rather than a plain <img crossOrigin>
  // pointed at the API URL) sidesteps crossOrigin/CORS entirely for the canvas read that follows -
  // blob: URLs are always same-origin regardless of where the bytes actually came from.
  public static loadLogoImageForExport = async (
    accessToken: string | null,
    connection: string,
  ): Promise<HTMLImageElement | null> => {
    const targetUrl = `${MyConstants.getBaseUrl()}api/configs/schoolLogo?connection=${encodeURIComponent(connection)}`;
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
      return loadImageElement(URL.createObjectURL(blob), false);
    } catch (error) {
      console.error(`SchoolInfoReader.loadLogoImageForExport(): Error: ${error}`);
      return null;
    }
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
