import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import Loading from "../sharedcomp/Loading";

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

  return <Outlet />;
};

export default RequireAuth;
