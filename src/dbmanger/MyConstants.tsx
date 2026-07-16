//const gBaserUrl = "https://dmsacad.com/dmsacad_backend/api/modules/schoolConfig/allSchools";
//const gBaserUrl = "https://dmsacad.com/dmsacad_backend/api/modules";
export class MyConstants {
  public static gBaseRemoteUrl = "https://dmsacad.com/dmsacad_backend_secured/";
  public static gBaseLocalUrl = "http://localhost/dmsacad_backend_dev/";
  public static SCHOOL_NAME_KEY = "schoolName";
  public static LANGUAGE_KEY = "language";
  public static gLocalSchoolCode = "mysql";
  //public static gBaserUrl = "/api/dmsacad_backend"; //THIS CHANGE IS LOCAL TO PREVENT CORS ISSUES. WE SHALL USE THE REAL ADDRESS TO PRODUCTION RELEASE
  // public getFullName(): string {
  //   return `${this.firstName} ${this.lastName}`;
  // }
}
