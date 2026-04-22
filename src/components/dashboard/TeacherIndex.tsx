import { useCookies } from "react-cookie";

function AccessDenied() {
  return <h1>Access Denied</h1>;
}
function AccessGranted() {
  return <h1>Teacher Index Page</h1>;
}
function TeacherIndex() {
  const [cookies] = useCookies(["schoolName"]);

  if (cookies.schoolName) {
    return <AccessGranted />;
  }
  return <AccessDenied />;
}
export default TeacherIndex;
