import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { subAdminManagerTranslations } from "../../../i18n/translations";
import { SubAdminReader } from "../../../dbmanger/SubAdminReader";
import type { SubAdmin } from "../../../interfaces/SubAdmin";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import { MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH } from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";

// "Sous-administrateurs" - ADMIN-only (not SUBADMIN, see App.tsx's `!SUBADMIN` route group)
// management of the account.type=9 accounts: list, change password, delete, plus an add form.
const SubAdminManager = () => {
  const { connection, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = subAdminManagerTranslations[language];

  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Pending (unsaved) new password per row, keyed by acc_id.
  const [newPasswords, setNewPasswords] = useState<Record<number, string>>({});

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loadSubAdmins = async () => {
    setIsLoading(true);
    setSubAdmins(await SubAdminReader.fetchSubAdmins(accessToken, connection));
    setNewPasswords({});
    setIsLoading(false);
  };

  useEffect(() => {
    loadSubAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedLogin = login.trim();
    if (trimmedLogin.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH) {
      showToast(t.loginTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }
    if (password.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH) {
      showToast(t.passwordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }
    if (password !== confirmPassword) {
      showToast(t.passwordMismatch, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await SubAdminReader.saveSubAdmin(accessToken, connection, trimmedLogin, password);
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setLogin("");
      setPassword("");
      setConfirmPassword("");
      loadSubAdmins();
    } else {
      showToast(isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure, {
        type: "danger",
      });
    }
  };

  const handleChangePassword = async (subAdmin: SubAdmin) => {
    const newPwd = (newPasswords[subAdmin.acc_id] ?? "").trim();
    if (newPwd.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH) {
      showToast(t.passwordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await SubAdminReader.updatePassword(accessToken, connection, subAdmin.acc_id, newPwd);
    setIsSaving(false);
    if (result.status) {
      showToast(t.passwordSuccess, { type: "info" });
      setNewPasswords((prev) => ({ ...prev, [subAdmin.acc_id]: "" }));
    } else {
      showToast(t.passwordFailure, { type: "danger" });
    }
  };

  const handleDelete = async (subAdmin: SubAdmin) => {
    if (!(await confirm(t.deleteConfirm(subAdmin.login), { danger: true }))) return;
    setIsSaving(true);
    const result = await SubAdminReader.deleteSubAdmin(accessToken, connection, subAdmin.acc_id);
    setIsSaving(false);
    if (result.status) {
      showToast(t.deleteSuccess, { type: "info" });
      loadSubAdmins();
    } else {
      showToast(t.deleteFailure, { type: "danger" });
    }
  };

  return (
    <div className="page-shell">
      {isSaving && <LoadingOverlay />}
      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} columns={4} className="mb-6" />
      ) : (
        <div className="surface-card overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.tableHeaderLogin}</th>
                  <th>{t.tableHeaderChangePassword}</th>
                  <th>{t.tableHeaderDelete}</th>
                </tr>
              </thead>
              <tbody>
                {subAdmins.map((subAdmin, index) => (
                  <tr key={subAdmin.acc_id}>
                    <td>{index + 1}</td>
                    <td>{subAdmin.login}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          className="input input-sm w-48"
                          placeholder={t.newPasswordPlaceholder}
                          autoComplete="new-password"
                          value={newPasswords[subAdmin.acc_id] ?? ""}
                          onChange={(e) =>
                            setNewPasswords((prev) => ({
                              ...prev,
                              [subAdmin.acc_id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleChangePassword(subAdmin);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          onClick={() => handleChangePassword(subAdmin)}
                        >
                          {t.changePasswordBtn}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost btn-square text-error"
                        title={t.deleteTooltip}
                        aria-label={t.deleteTooltip}
                        onClick={() => handleDelete(subAdmin)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {subAdmins.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-state">{t.emptyList}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="surface-card p-4 md:p-5">
        <h2 className="font-semibold mb-3">{t.addTitle}</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            {t.loginLabel}
            <input
              type="text"
              className="input input-sm w-48"
              value={login}
              autoComplete="off"
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t.passwordLabel}
            <div className="flex items-center gap-1">
              <input
                type={showPassword ? "text" : "password"}
                className="input input-sm w-48"
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-xs btn-ghost btn-square"
                aria-label={showPassword ? t.hidePasswordHint : t.showPasswordHint}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t.confirmPasswordLabel}
            <input
              type={showPassword ? "text" : "password"}
              className="input input-sm w-48"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            {t.addBtn}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubAdminManager;
