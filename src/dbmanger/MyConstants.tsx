//const gBaserUrl = "https://dmsacad.com/dmsacad_backend/api/modules/schoolConfig/allSchools";
//const gBaserUrl = "https://dmsacad.com/dmsacad_backend/api/modules";
import { Capacitor } from "@capacitor/core";

export type BackendTarget = "remote" | "local";

export class MyConstants {
  public static gBaseRemoteUrl = "https://dmsacad.com/dmsacad_backend_secured/";
  public static gBaseLocalUrl = "http://localhost/dmsacad_backend_dev/";
  public static SCHOOL_NAME_KEY = "schoolName";
  public static SCHOOL_YEAR_KEY = "schoolYear";
  public static SECTION_KEY = "section";
  public static LANGUAGE_KEY = "language";
  public static THEME_KEY = "theme";
  public static gLocalSchoolCode = "mysql";
  // On mobile (packaged Capacitor app or a phone-width browser), the school/year pickers default
  // to this connection/year rather than staying empty, so a tester can run straight into the TEST
  // school without choosing anything first. Only applies when nothing has been picked yet - see
  // LoginForm.tsx's selectedSchool/selectedSchoolYear initializers.
  public static gMobileDefaultSchoolCode = "TEST";
  public static gMobileDefaultSchoolYear = "2026/2027";
  public static BACKEND_TARGET_KEY = "backendTarget";
  public static SCHOOL_CONFIG_KEY = "schoolConfig";
  // Cookie (not sessionStorage) holding the raw allSchoolConfigOfYear response - fetched fresh on
  // every login so printed/exported documents can build a school header (name, address, logo)
  // without an extra round trip. Reuses the 7-day maxAge already used for the schoolName cookie.
  public static SCHOOL_HEADER_CONFIG_KEY = "schoolHeaderConfig";
  public static SCHOOL_HEADER_CONFIG_COOKIE_MAX_AGE = 604800;
  public static SCHOOL_TYPE_KEY = "schoolType";
  public static RESPONSABLE_FR_KEY = "responsableFr";
  public static RESPONSABLE_EN_KEY = "responsableEn";
  public static DEFAULT_SCHOOL_TYPE = "LYCEE";
  public static DEFAULT_RESPONSABLE_FR = "Proviseur";
  public static DEFAULT_RESPONSABLE_EN = "Principal";
  // Scholarship ("Boursiers") minimum-average threshold - per-browser only, never sent to the
  // backend (there's no DB column for it), see ScholarshipManager.tsx.
  public static SCHOLARSHIP_MIN_AVG_KEY = "scholarshipMinAvg";
  public static DEFAULT_SCHOLARSHIP_MIN_AVG = 12.5;

  public static getBackendTarget = (): BackendTarget => {
    return (
      (localStorage.getItem(MyConstants.BACKEND_TARGET_KEY) as BackendTarget) ||
      "remote"
    );
  };

  public static setBackendTarget = (target: BackendTarget) => {
    localStorage.setItem(MyConstants.BACKEND_TARGET_KEY, target);
  };

  public static getBaseUrl = (): string => {
    return MyConstants.getBackendTarget() === "local"
      ? MyConstants.gBaseLocalUrl
      : MyConstants.gBaseRemoteUrl;
  };

  // On the packaged Android/iOS app, Capacitor tears down and recreates the WebView (and with it,
  // sessionStorage) every time the app is fully closed and reopened - so a user's chosen
  // school/year/section (SCHOOL_NAME_KEY/SCHOOL_YEAR_KEY/SECTION_KEY) would silently reset on every
  // relaunch. In a browser tab, sessionStorage clearing on close is the expected/desired behavior,
  // so only native platforms are switched to localStorage (which Capacitor persists to disk across
  // app restarts); the selection is still overwritten in place whenever the user actually changes
  // it, so it's "remembered until changed", not sticky forever.
  public static getSelectionStorage = (): Storage =>
    Capacitor.isNativePlatform() ? localStorage : sessionStorage;
}
