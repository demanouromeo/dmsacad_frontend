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
