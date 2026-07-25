import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { adminMenuTranslations, dashboardTranslations } from "../../i18n/translations";
import AdminMenuGrid from "./AdminMenuGrid";
import AdminMenuCard from "./AdminMenuCard";
import { NON_ADMIN_MENU_ITEMS } from "./menuItems";

const Dashboard = () => {
  const { authPayload, logout } = useAuth();
  const [language] = useLanguage();
  const t = dashboardTranslations[language];
  const menuT = adminMenuTranslations[language];
  const navigate = useNavigate();
  const nonAdminMenuItems = authPayload ? (NON_ADMIN_MENU_ITEMS[authPayload.role] ?? []) : [];

  // PARENT has its own dedicated dashboard (children list) rather than this admin-oriented one -
  // bounce there immediately, before the history-guard effect below runs, to avoid a stray extra
  // history entry from pushState followed by a replace-navigate.
  useEffect(() => {
    if (authPayload?.role === "PARENT") {
      navigate("/parent/dashboard", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPayload]);

  // Dashboard is the first authenticated screen after login (LoginForm pushes "/dashboard" onto
  // "/"'s history entry) - browser Back from here would otherwise silently land back on "/" while
  // the access token stays live in memory (AuthContext.logout() is never called), letting the
  // user re-enter /dashboard by URL without logging in again. Pushing a sentinel entry on mount
  // means the first Back press fires `popstate` while Dashboard is still mounted, so it can be
  // treated as an explicit logout instead of a silent, incomplete one.
  useEffect(() => {
    if (authPayload?.role === "PARENT") {
      return;
    }
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      logout();
      navigate("/", { replace: true });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPayload]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-sm opacity-60 mb-1">{t.welcomeBack}</p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            {authPayload?.name}
          </h1>
        </div>
        {/* The only entry point non-ADMIN roles have into "Manage credential" - they never see
            AdminMenuGrid (mounted only for role === "ADMIN" below), so this button is deliberately
            unconditional rather than nested in that block. ADMIN users can reach the same screen from
            here too, or via AccountHub's second card. */}
        <button
          className="btn btn-outline btn-primary"
          onClick={() => navigate("/account/credentials")}
        >
          {t.manageCredentialsBtn}
        </button>
      </div>
      {authPayload?.role === "ADMIN" && <AdminMenuGrid />}
      {nonAdminMenuItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {nonAdminMenuItems.map((item) => (
            <AdminMenuCard key={item.key} label={menuT[item.key]} icon={item.icon} to={item.to} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
