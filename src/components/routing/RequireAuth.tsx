import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import Loading from "../sharedcomp/Loading";
import TopBanner from "../layout/TopBanner";

const RequireAuth = () => {
  const { accessToken, isRestoring } = useAuth();

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
      <div className="pt-16">
        <Outlet />
      </div>
    </>
  );
};

export default RequireAuth;
