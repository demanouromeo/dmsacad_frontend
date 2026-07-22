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
  // Annual report card average computation mode - "1" = Calcul simple ((trim1+trim2+trim3)/3),
  // "0" = Calcul complexe (coefficients cancelled for subjects with no marks). Not persisted
  // server-side, not sensitive - kept in localStorage so it survives logout/browser restart and
  // is only lost if the user clears their browser data - see AnnualRcAvgManager.tsx.
  public static ANNUAL_RC_AVG_SETTING_KEY = "ANNUAL_RC_AVG_SETTING";
  public static DEFAULT_ANNUAL_RC_AVG_SETTING = "1";

  public static getAnnualRcAvgSetting = (): string => {
    return (
      localStorage.getItem(MyConstants.ANNUAL_RC_AVG_SETTING_KEY) ||
      MyConstants.DEFAULT_ANNUAL_RC_AVG_SETTING
    );
  };

  public static setAnnualRcAvgSetting = (value: string) => {
    localStorage.setItem(MyConstants.ANNUAL_RC_AVG_SETTING_KEY, value);
  };

  // Whether the annual report card shows the student's next-year classe when promoted (e.g.
  // "Promu en 5e B") or leaves it blank for manual fill-in (e.g. "Promu en ______________").
  // Same storage convention/rationale as ANNUAL_RC_AVG_SETTING_KEY above - see AnnualRcAvgManager.tsx.
  public static AFFICHAGE_PROMOTION_KEY = "AFFICHAGE_PROMOTION";
  public static DEFAULT_AFFICHAGE_PROMOTION = "0";

  public static getAffichagePromotion = (): boolean => {
    return (
      (localStorage.getItem(MyConstants.AFFICHAGE_PROMOTION_KEY) ||
        MyConstants.DEFAULT_AFFICHAGE_PROMOTION) === "1"
    );
  };

  public static setAffichagePromotion = (value: boolean) => {
    localStorage.setItem(MyConstants.AFFICHAGE_PROMOTION_KEY, value ? "1" : "0");
  };

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
