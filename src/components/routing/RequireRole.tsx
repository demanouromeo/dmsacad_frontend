import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

const RequireRole = ({ allow }: { allow: string[] }) => {
  const { authPayload } = useAuth();

  if (!authPayload || !allow.includes(authPayload.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default RequireRole;
