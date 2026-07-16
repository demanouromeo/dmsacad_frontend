import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

const Dashboard = () => {
  const { authPayload, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">{authPayload?.name}</h1>
      <button className="btn btn-neutral" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Dashboard;
