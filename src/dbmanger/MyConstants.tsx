//const gBaserUrl = "https://dmsacad.com/dmsacad_backend/api/modules/schoolConfig/allSchools";
//const gBaserUrl = "https://dmsacad.com/dmsacad_backend/api/modules";
export type BackendTarget = "remote" | "local";

export class MyConstants {
  public static gBaseRemoteUrl = "https://dmsacad.com/dmsacad_backend_secured/";
  public static gBaseLocalUrl = "http://localhost/dmsacad_backend_dev/";
  public static SCHOOL_NAME_KEY = "schoolName";
  public static SCHOOL_YEAR_KEY = "schoolYear";
  public static SECTION_KEY = "section";
  public static LANGUAGE_KEY = "language";
  public static gLocalSchoolCode = "mysql";
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
}
