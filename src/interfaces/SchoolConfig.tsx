// Mirrors saveSchoolInfo's request body fields in the backend's SchoolInfoController - the form
// field names here are exactly the POST parameter names the backend expects (schoolName,
// schoolNameEN, delRegionFR, ...), not renamed to a local convention, so the reader can send them
// through unchanged.
export interface SchoolConfig {
  schoolName: string;
  schoolNameEN: string;
  delRegionFR: string;
  delRegionEN: string;
  delDeptFR: string;
  delDeptEN: string;
  phone: string;
  email: string;
  pobox: string;
  type: string;
  signDate: string;
  signPlace: string;
  immt: string;
  str1: string;
  str2: string;
}

export const EMPTY_SCHOOL_CONFIG: SchoolConfig = {
  schoolName: "",
  schoolNameEN: "",
  delRegionFR: "",
  delRegionEN: "",
  delDeptFR: "",
  delDeptEN: "",
  phone: "",
  email: "",
  pobox: "",
  type: "",
  signDate: "",
  signPlace: "",
  immt: "",
  str1: "",
  str2: "",
};
