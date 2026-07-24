import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/useLanguage";
import { parentPortalTranslations } from "../../i18n/translations";
import { StudParentReader } from "../../dbmanger/StudParentReader";
import type { ParentChild } from "../../interfaces/StudParent";
import Loading from "../sharedcomp/Loading";
import StudentPhotoCell from "../admin/student/StudentPhotoCell";

// The PARENT role's own landing page (Dashboard.tsx redirects PARENT here) - lists every child
// linked to the connected parent (authPayload.user_id *is* the parent's p_id, thanks to the
// AccountController::connect/refresh fix), one card each, navigating to the read-only detail
// screen on click. No edit affordance anywhere - matches the spec's "not allowed to edit student
// details or marks".
const ParentDashboard = () => {
  const { connection, schoolYear, accessToken, authPayload } = useAuth();
  const [language] = useLanguage();
  const t = parentPortalTranslations[language];
  const navigate = useNavigate();

  const [children, setChildren] = useState<ParentChild[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!authPayload) {
        return;
      }
      setIsLoading(true);
      const list = await StudParentReader.fetchChildrenOfParent(
        accessToken,
        connection,
        schoolYear,
        authPayload.user_id,
      );
      setChildren(list);
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, authPayload]);

  return (
    <div className="page-shell-wide">
      <div className="page-header">
        <h1 className="page-title">{t.dashboardTitle}</h1>
      </div>

      {isLoading ? (
        <div className="surface-card flex justify-center py-20">
          <Loading />
        </div>
      ) : children.length === 0 ? (
        <div className="surface-card py-16">
          <p className="empty-state">{t.dashboardEmpty}</p>
        </div>
      ) : (
        <>
          <p className="opacity-60 mb-4">{t.dashboardHint}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              // A plain div (not a <button>) wrapping StudentPhotoCell's own <button> - a <button>
              // cannot legally contain another interactive <button>, which broke click targeting.
              <div
                key={child.stud_id}
                className="surface-card p-4 flex items-center gap-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/parent/child/${child.stud_id}`)}
              >
                <StudentPhotoCell
                  studId={child.stud_id}
                  refreshVersion={0}
                  onClick={() => navigate(`/parent/child/${child.stud_id}`)}
                />
                <div>
                  <p className="font-semibold">{`${child.name} ${child.surname ?? ""}`.trim()}</p>
                  <p className="text-sm opacity-70">{child.classe_name}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ParentDashboard;
