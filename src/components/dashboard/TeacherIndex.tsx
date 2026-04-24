import { useCookies } from "react-cookie";
import { MyConstants } from "../../dbmanger/MyConstants";

function AccessDenied() {
  return <h1>Access Denied</h1>;
}
function AccessGranted() {
  return <h1>Teacher Index Page</h1>;
}
function TeacherIndex() {
  var school = sessionStorage.getItem(MyConstants.SCHOOL_NAME_KEY);

  if (school) {
    return <AccessGranted />;
  }
  return <AccessDenied />;
}
export default TeacherIndex;
