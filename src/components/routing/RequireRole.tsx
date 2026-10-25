import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

const RequireRole = ({ allow }: { allow: string[] }) => {
  const { authPayload } = useAuth();

  if (!authPayload || !(
      allow.includes(authPayload.role) ||
      (authPayload.role === "SUBADMIN" &&
        allow.includes("ADMIN") &&
        !allow.includes("!SUBADMIN"))
    )) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default RequireRole;
