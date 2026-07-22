import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { selfCredentialsManagerTranslations } from "../../../i18n/translations";
import { AccountReader } from "../../../dbmanger/AccountReader";
import { MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH } from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

// "Manage credential" - self-service login/password change, reachable by ANY authenticated role
// (see App.tsx: this route sits inside RequireAuth but outside RequireRole). Old password is
// verified twice: on blur (AccountReader.verifyOldPassword, a read-only check) so the field turns
// red as soon as the user finishes typing a wrong one, and again inside the actual save call
// (AccountController::updateAccount), which is the real, authoritative gate - the on-blur result is
// only ever used for the UI, never trusted as the reason Save is allowed to succeed.
const SelfCredentialsManager = () => {
  const { connection, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = selfCredentialsManagerTranslations[language];

  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newLogin, setNewLogin] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // null = not checked yet (blank, or never blurred since the last edit) - only `false` renders the
  // invalid state, so an untouched field doesn't start out looking like an error.
  const [oldPasswordValid, setOldPasswordValid] = useState<boolean | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoadingAccount(true);
      const account = await AccountReader.fetchMyAccount(accessToken, connection);
      if (account) {
        setNewLogin(account.login);
      }
      setIsLoadingAccount(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const handleOldPasswordChange = (value: string) => {
    setOldPassword(value);
    // Re-typing invalidates the last blur check - Save stays disabled until the field is blurred
    // again, rather than trusting a check against a value that's since changed.
    setOldPasswordValid(null);
  };

  const handleOldPasswordBlur = async () => {
    if (oldPassword.trim() === "") {
      setOldPasswordValid(null);
      return;
    }
    const valid = await AccountReader.verifyOldPassword(accessToken, connection, oldPassword);
    setOldPasswordValid(valid);
  };

  const handleSave = async () => {
    if (oldPassword.trim() === "") {
      showToast(t.oldPasswordRequired, { type: "warning" });
      return;
    }
    if (oldPasswordValid !== true) {
      showToast(t.oldPasswordWrong, { type: "danger" });
      return;
    }
    const trimmedLogin = newLogin.trim();
    const trimmedNewPassword = newPassword.trim();
    if (trimmedLogin.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH) {
      showToast(t.loginTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }
    if (trimmedNewPassword && trimmedNewPassword.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH) {
      showToast(t.passwordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }

    setIsSaving(true);
    const result = await AccountReader.updateMyCredentials(
      accessToken,
      connection,
      oldPassword,
      trimmedLogin,
      trimmedNewPassword || undefined,
    );
    setIsSaving(false);

    if (result.status) {
      showToast(t.updateSuccess, { type: "info" });
      setOldPassword("");
      setNewPassword("");
      setOldPasswordValid(null);
      return;
    }

    if (result.message === "Old password is incorrect") {
      setOldPasswordValid(false);
      showToast(t.oldPasswordWrong, { type: "danger" });
      return;
    }
    showToast(isDuplicateNameError(result.message) ? t.updateDuplicate : t.updateFailure, {
      type: "danger",
    });
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <h1 className="page-title mb-6 text-center">{t.title}</h1>

      {isLoadingAccount ? (
        <div className="surface-card w-full max-w-sm flex justify-center py-16">
          <Loading />
        </div>
      ) : (
        <div className="surface-card p-6 flex flex-col gap-4 w-full max-w-sm">
          <div>
            <label className="font-medium block mb-1">{t.oldPasswordLabel}</label>
            <div className="relative">
              <input
                type={showOldPassword ? "text" : "password"}
                className={`input w-full ${oldPasswordValid === false ? "input-error" : ""}`}
                value={oldPassword}
                onChange={(e) => handleOldPasswordChange(e.target.value)}
                onBlur={handleOldPasswordBlur}
              />
              <button
                type="button"
                onClick={() => setShowOldPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showOldPassword ? t.hidePasswordHint : t.showPasswordHint}
                className="absolute top-2.5 right-2.5 text-slate-600 cursor-pointer"
              >
                {showOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {oldPasswordValid === false && (
              <p className="text-error text-sm mt-1">{t.oldPasswordWrong}</p>
            )}
          </div>

          <div>
            <label className="font-medium block mb-1">{t.newLoginLabel}</label>
            <input
              type="text"
              className="input w-full"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
            />
          </div>

          <div>
            <label className="font-medium block mb-1">{t.newPasswordLabel}</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                className="input w-full"
                placeholder={t.newPasswordPlaceholder}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showNewPassword ? t.hidePasswordHint : t.showPasswordHint}
                className="absolute top-2.5 right-2.5 text-slate-600 cursor-pointer"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={isSaving || oldPassword.trim() === "" || oldPasswordValid !== true}
            onClick={handleSave}
          >
            {t.saveBtn}
          </button>
        </div>
      )}
    </div>
  );
};

export default SelfCredentialsManager;
