import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { dashboardTranslations } from "../../i18n/translations";
import AdminMenuGrid from "./AdminMenuGrid";

const Dashboard = () => {
  const { authPayload, schoolYear, section, logout } = useAuth();
  const [language] = useLanguage();
  const t = dashboardTranslations[language];
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">{authPayload?.name}</h1>
      {authPayload?.role === "ADMIN" && (
        <>
          <p className="mb-4 opacity-70">
            {schoolYear} &mdash; {section}
          </p>
          <div className="mb-6">
            <AdminMenuGrid />
          </div>
        </>
      )}
      <button className="btn btn-neutral" onClick={handleLogout}>
        {t.logoutBtn}
      </button>
    </div>
  );
};

export default Dashboard;
