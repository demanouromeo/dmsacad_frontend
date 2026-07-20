import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  accountManagerTranslations,
  accountRoleLabels,
} from "../../../i18n/translations";
import { StaffReader } from "../../../dbmanger/StaffReader";
import { AccountReader } from "../../../dbmanger/AccountReader";
import type { ManagedAccount } from "../../../interfaces/ManagedAccount";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import { MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH } from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";

// account.type values selectable from this screen - see accountRoleLabels' own comment in
// translations.ts for why PARENT(6)/STUDENT(7) are excluded.
const ROLE_TYPES = [1, 2, 3, 4, 5, 8] as const;

const AccountManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = accountManagerTranslations[language];
  const roleLabels = accountRoleLabels[language];

  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [editingAccId, setEditingAccId] = useState<number | null>(null);
  const [editingLogin, setEditingLogin] = useState("");
  const [editingType, setEditingType] = useState("5");
  const [editingNewPassword, setEditingNewPassword] = useState("");
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Set<number>>(
    new Set(),
  );

  // Merges two backend sources sharing the same account.acc_id/login/pwd/type/email columns -
  // see ManagedAccount's own doc comment for why `source`/`sourceId` are kept alongside acc_id.
  const loadAccounts = async () => {
    setIsLoading(true);
    const [staff, admins] = await Promise.all([
      StaffReader.fetchStaff(accessToken, connection, schoolYear),
      AccountReader.fetchAdministrateurAccounts(accessToken, connection),
    ]);
    const merged: ManagedAccount[] = [
      ...staff.map((s) => ({
        acc_id: s.acc_id,
        source: "staff" as const,
        sourceId: s.staff_id,
        name: s.name,
        surname: s.surname,
        login: s.login,
        pwd: s.pwd,
        type: s.type,
        email: s.email,
      })),
      ...admins.map((a) => ({
        acc_id: a.acc_id,
        source: "administrateur" as const,
        sourceId: a.admin_id,
        name: a.name,
        surname: null,
        login: a.login,
        pwd: a.pwd,
        type: a.type,
        email: a.email,
      })),
    ];
    setAccounts(merged);
    setVisiblePasswordIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadAccounts();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const startEdit = (account: ManagedAccount) => {
    setEditingAccId(account.acc_id);
    setEditingLogin(account.login);
    setEditingType(String(account.type));
    setEditingNewPassword("");
  };

  const cancelEdit = () => {
    setEditingAccId(null);
    setEditingLogin("");
    setEditingType("5");
    setEditingNewPassword("");
  };

  const togglePasswordVisibility = (accId: number) => {
    setVisiblePasswordIds((prev) => {
      const next = new Set(prev);
      if (next.has(accId)) {
        next.delete(accId);
      } else {
        next.add(accId);
      }
      return next;
    });
  };

  const saveEdit = async (account: ManagedAccount) => {
    const trimmedLogin = editingLogin.trim();
    const trimmedNewPassword = editingNewPassword.trim();
    if (!trimmedLogin) {
      cancelEdit();
      return;
    }
    if (trimmedLogin.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH) {
      showToast(t.loginTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), {
        type: "warning",
      });
      return;
    }
    if (
      trimmedNewPassword &&
      trimmedNewPassword.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH
    ) {
      showToast(t.passwordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), {
        type: "warning",
      });
      return;
    }
    setIsSaving(true);
    const result = await AccountReader.updateAccount(
      accessToken,
      connection,
      account.acc_id,
      trimmedLogin,
      Number(editingType),
      trimmedNewPassword || undefined,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.updateSuccess, { type: "info" });
    } else {
      showToast(
        isDuplicateNameError(result.message)
          ? t.updateDuplicate
          : t.updateFailure,
        { type: "danger" },
      );
    }
    cancelEdit();
    if (result.status) {
      loadAccounts();
    }
  };

  const roleLabel = (type: number): string =>
    roleLabels[type as keyof typeof roleLabels] ?? String(type);

  const filteredAccounts = accounts.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.surname ?? "").toLowerCase().includes(q) ||
      a.login.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <input
            type="text"
            className="input w-full max-w-md mb-4"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="overflow-x-auto w-full mb-4">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderLogin}</th>
                  <th>{t.tableHeaderPassword}</th>
                  <th>{t.tableHeaderRole}</th>
                  <th>{t.tableHeaderNewPassword}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account, index) => {
                  const isEditing = editingAccId === account.acc_id;
                  return (
                    <tr key={account.acc_id}>
                      <td>{index + 1}</td>
                      <td>
                        {account.name} {account.surname ?? ""}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            value={editingLogin}
                            autoFocus
                            onChange={(e) => setEditingLogin(e.target.value)}
                          />
                        ) : (
                          account.login
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">
                            {visiblePasswordIds.has(account.acc_id)
                              ? account.pwd
                              : "••••••••"}
                          </span>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost btn-square"
                            aria-label={
                              visiblePasswordIds.has(account.acc_id)
                                ? t.hidePasswordHint
                                : t.showPasswordHint
                            }
                            onClick={() =>
                              togglePasswordVisibility(account.acc_id)
                            }
                          >
                            {visiblePasswordIds.has(account.acc_id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="select select-sm"
                            value={editingType}
                            onChange={(e) => setEditingType(e.target.value)}
                          >
                            {ROLE_TYPES.map((code) => (
                              <option key={code} value={code}>
                                {roleLabel(code)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          roleLabel(account.type)
                        )}
                      </td>
                      <td>
                        {isEditing && (
                          <input
                            type="password"
                            className="input input-sm w-full"
                            placeholder={t.newPasswordPlaceholder}
                            value={editingNewPassword}
                            onChange={(e) =>
                              setEditingNewPassword(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(account);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-primary mr-2"
                              onClick={() => saveEdit(account)}
                            >
                              {t.saveBtn}
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-ghost"
                              onClick={cancelEdit}
                            >
                              {t.cancelBtn}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => startEdit(account)}
                          >
                            {t.editBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center opacity-60">
                      {t.emptyList}
                    </td>
                  </tr>
                )}
                {accounts.length > 0 && filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center opacity-60">
                      {t.noSearchResults}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AccountManager;
