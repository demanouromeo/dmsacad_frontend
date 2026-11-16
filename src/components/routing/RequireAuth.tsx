import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import Loading from "../sharedcomp/Loading";
import TopBanner from "../layout/TopBanner";
import MagicAssistant from "../assistant/MagicAssistant";

const RequireAuth = () => {
  const { accessToken, isRestoring, schoolYear } = useAuth();

  if (isRestoring) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loading />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <TopBanner />
      {/* key={schoolYear}: switching the school year from TopBanner remounts the open screen, so every
          list/setting it loaded (classes, staff, subjects, students, timetables, parameters...) is
          fetched again for the new year instead of showing the previous year's data. */}
      <div key={schoolYear} className="pt-[calc(4rem+var(--safe-top))]">
        <Outlet />
      </div>
      <MagicAssistant />
    </>
  );
};

export default RequireAuth;
