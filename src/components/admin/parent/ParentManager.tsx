import { useEffect, useState } from "react";
import { Eye, EyeOff, Users, Wand2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useConfirm } from "../../../confirm/useConfirm";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { parentManagerTranslations, exportTranslations } from "../../../i18n/translations";
import { StudParentReader } from "../../../dbmanger/StudParentReader";
import type { StudParent } from "../../../interfaces/StudParent";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import SearchInput from "../../sharedcomp/SearchInput";
import ExportButtons from "../../sharedcomp/ExportButtons";
import CloseButton from "../../sharedcomp/CloseButton";
import { MIN_STAFF_NAME_LENGTH, MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH, sanitizePhoneNumber } from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import { buildTimestampedFilename, exportRowsToCsv, exportRowsToPdf } from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import ParentPhotoCell from "./ParentPhotoCell";
import ParentPhotoDialog from "./ParentPhotoDialog";
import ParentChildrenDialog from "./ParentChildrenDialog";

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const MIN_PHONE_LENGTH = 4;

const RANDOM_CREDENTIAL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_CREDENTIAL_LENGTH = 6;
const MAX_LOGIN_GENERATION_ATTEMPTS = 50;

const randomCredentialString = (length: number): string =>
  Array.from(
    { length },
    () => RANDOM_CREDENTIAL_CHARS[Math.floor(Math.random() * RANDOM_CREDENTIAL_CHARS.length)],
  ).join("");

// ADMIN "Gestion des parents" screen - same list-based CRUD shape as StaffManager (closest
// precedent - also creates a linked Account row). Not classe/section-scoped, unlike most other
// admin managers - stud_parent has no year dimension, so it only reloads on `connection` change.
const ParentManager = () => {
  const { connection, accessToken } = useAuth();
  const confirm = useConfirm();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = parentManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();

  const [parentList, setParentList] = useState<StudParent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newSurname, setNewSurname] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSurname, setEditingSurname] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingLogin, setEditingLogin] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingNewPassword, setEditingNewPassword] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [photoDialogParent, setPhotoDialogParent] = useState<StudParent | null>(null);
  const [childrenDialogParent, setChildrenDialogParent] = useState<StudParent | null>(null);
  const [photoVersions, setPhotoVersions] = useState<Record<number, number>>({});
  const bumpPhotoVersion = (pId: number) => {
    setPhotoVersions((prev) => ({ ...prev, [pId]: (prev[pId] ?? 0) + 1 }));
  };

  const loadParents = async () => {
    setIsLoading(true);
    const list = await StudParentReader.fetchParents(accessToken, connection);
    setParentList(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadParents();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const resetAddForm = () => {
    setNewName("");
    setNewSurname("");
    setNewPhone("");
    setNewLogin("");
    setNewPassword("");
    setNewEmail("");
    setShowNewPassword(false);
  };

  // Best-effort uniqueness against the currently-loaded list, same caveat as StaffManager's own
  // generateLoginAndPassword - Account.login is globally unique server-side, so the backend's own
  // addDuplicate handling covers the rare residual collision.
  const generateLoginAndPassword = () => {
    const existingLogins = new Set(parentList.map((p) => p.login.toLowerCase()));
    let login = randomCredentialString(RANDOM_CREDENTIAL_LENGTH);
    let attempts = 0;
    while (existingLogins.has(login.toLowerCase()) && attempts < MAX_LOGIN_GENERATION_ATTEMPTS) {
      login = randomCredentialString(RANDOM_CREDENTIAL_LENGTH);
      attempts++;
    }
    setNewLogin(login);
    setNewPassword(randomCredentialString(RANDOM_CREDENTIAL_LENGTH));
    setShowNewPassword(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    const trimmedLogin = newLogin.trim();
    const trimmedPassword = newPassword.trim();
    const trimmedPhone = newPhone.trim();
    const trimmedEmail = newEmail.trim();
    if (!trimmedName || !trimmedLogin || !trimmedPassword || !trimmedPhone || !trimmedEmail) {
      return;
    }
    if (trimmedName.length < MIN_STAFF_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_STAFF_NAME_LENGTH), { type: "warning" });
      return;
    }
    if (
      trimmedLogin.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH ||
      trimmedPassword.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH
    ) {
      showToast(t.loginOrPasswordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }
    if (trimmedPhone.length < MIN_PHONE_LENGTH) {
      showToast(t.phoneTooShort, { type: "warning" });
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      showToast(t.invalidEmail, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudParentReader.saveParent(
      accessToken,
      connection,
      trimmedName,
      newSurname.trim(),
      trimmedPhone,
      trimmedLogin,
      trimmedPassword,
      trimmedEmail,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      resetAddForm();
      loadParents();
    } else {
      showToast(isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure, {
        type: "danger",
      });
    }
  };

  const startEdit = (parent: StudParent) => {
    setEditingId(parent.p_id);
    setEditingName(parent.p_name);
    setEditingSurname(parent.p_surname ?? "");
    setEditingPhone(String(parent.p_phone1));
    setEditingLogin(parent.login);
    setEditingEmail(parent.email ?? "");
    setEditingNewPassword("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingSurname("");
    setEditingPhone("");
    setEditingLogin("");
    setEditingEmail("");
    setEditingNewPassword("");
  };

  const saveEdit = async (parent: StudParent) => {
    const trimmedName = editingName.trim();
    const trimmedLogin = editingLogin.trim();
    const trimmedPhone = editingPhone.trim();
    const trimmedEmail = editingEmail.trim();
    if (!trimmedName || !trimmedLogin || !trimmedPhone || !trimmedEmail) {
      cancelEdit();
      return;
    }
    if (trimmedName.length < MIN_STAFF_NAME_LENGTH) {
      showToast(t.nameTooShort(MIN_STAFF_NAME_LENGTH), { type: "warning" });
      return;
    }
    const trimmedNewPassword = editingNewPassword.trim();
    if (
      trimmedLogin.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH ||
      (trimmedNewPassword && trimmedNewPassword.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH)
    ) {
      showToast(t.loginOrPasswordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH), { type: "warning" });
      return;
    }
    if (trimmedPhone.length < MIN_PHONE_LENGTH) {
      showToast(t.phoneTooShort, { type: "warning" });
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      showToast(t.invalidEmail, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await StudParentReader.updateParent(
      accessToken,
      connection,
      parent.p_id,
      trimmedName,
      editingSurname.trim(),
      trimmedPhone,
      trimmedLogin,
      trimmedEmail,
      trimmedNewPassword || undefined,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.updateSuccess, { type: "info" });
    } else {
      showToast(isDuplicateNameError(result.message) ? t.updateDuplicate : t.updateFailure, {
        type: "danger",
      });
    }
    cancelEdit();
    if (result.status) {
      loadParents();
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredParentList.map((p) => p.p_id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => {
        if (allFilteredSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      });
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    const confirmed = await confirm(t.deleteConfirm(selectedIds.size), { danger: true });
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await StudParentReader.deleteParents(accessToken, connection, Array.from(selectedIds));
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadParents();
    }
  };

  const filteredParentList = parentList.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      p.p_name.toLowerCase().includes(q) ||
      (p.p_surname ?? "").toLowerCase().includes(q) ||
      String(p.p_phone1).includes(q) ||
      p.login.toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  });

  // Never include a password/pwd column - allParents doesn't even select the plaintext value.
  const exportColumns = [
    { header: t.tableHeaderName, accessor: (p: StudParent) => p.p_name },
    { header: t.tableHeaderSurname, accessor: (p: StudParent) => p.p_surname ?? "" },
    { header: t.tableHeaderPhone, accessor: (p: StudParent) => String(p.p_phone1) },
    { header: t.tableHeaderLogin, accessor: (p: StudParent) => p.login },
    { header: t.tableHeaderEmail, accessor: (p: StudParent) => p.email ?? "" },
  ];

  const pdfExportColumns = [
    { header: t.tableHeaderIndex, accessor: (_p: StudParent, index: number) => index + 1 },
    ...exportColumns,
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(buildTimestampedFilename("Liste des parents", [], "csv"), exportColumns, parentList);
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildTimestampedFilename("Liste des parents", [], "pdf"),
      pdfExportColumns,
      parentList,
      schoolHeader,
    );
  };

  return (
    <div className="page-shell-wide">
      {isSaving && <LoadingOverlay />}

      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex items-center gap-2">
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
            excelLabel={et.excelBtn}
            pdfLabel={et.pdfBtn}
            disabled={isLoading || parentList.length === 0}
          />
          <CloseButton />
        </div>
      </div>

      {isLoading ? (
        <div className="surface-card flex justify-center py-20 mb-6">
          <Loading />
        </div>
      ) : (
        <div className="surface-card overflow-hidden mb-6">
          <div className="table-toolbar">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t.searchPlaceholder}
              className="input-sm w-full max-w-xs"
            />
            <button
              type="button"
              className="btn btn-error btn-sm"
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
            >
              {t.deleteSelectionBtn(selectedIds.size)}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        filteredParentList.length > 0 &&
                        filteredParentList.every((p) => selectedIds.has(p.p_id))
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>{t.tableHeaderPhoto}</th>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderSurname}</th>
                  <th>{t.tableHeaderPhone}</th>
                  <th>{t.tableHeaderLogin}</th>
                  <th>{t.tableHeaderEmail}</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredParentList.map((parent, index) => {
                  const isEditing = editingId === parent.p_id;
                  return (
                    <tr key={parent.p_id}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.has(parent.p_id)}
                          onChange={() => toggleSelect(parent.p_id)}
                        />
                      </td>
                      <td>{index + 1}</td>
                      <td>
                        <ParentPhotoCell
                          pId={parent.p_id}
                          refreshVersion={photoVersions[parent.p_id] ?? 0}
                          onClick={() => setPhotoDialogParent(parent)}
                        />
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            title={t.nameTooltip}
                            value={editingName}
                            autoFocus
                            onChange={(e) => setEditingName(e.target.value)}
                          />
                        ) : (
                          parent.p_name
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            title={t.surnameTooltip}
                            value={editingSurname}
                            onChange={(e) => setEditingSurname(e.target.value)}
                          />
                        ) : (
                          parent.p_surname || ""
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            title={t.phoneTooltip}
                            value={editingPhone}
                            onChange={(e) => setEditingPhone(sanitizePhoneNumber(e.target.value))}
                          />
                        ) : (
                          parent.p_phone1
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            title={t.loginTooltip}
                            value={editingLogin}
                            onChange={(e) => setEditingLogin(e.target.value)}
                          />
                        ) : (
                          parent.login
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="email"
                            className="input input-sm w-full"
                            title={t.emailTooltip}
                            value={editingEmail}
                            onChange={(e) => setEditingEmail(e.target.value)}
                          />
                        ) : (
                          parent.email || ""
                        )}
                      </td>
                      <td>
                        {isEditing && (
                          <input
                            type="password"
                            className="input input-sm w-full"
                            placeholder={t.newPasswordPlaceholder}
                            title={t.newPasswordTooltip}
                            value={editingNewPassword}
                            onChange={(e) => setEditingNewPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(parent);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {!isEditing && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline gap-1 mr-2"
                            title={t.manageChildrenHint}
                            onClick={() => setChildrenDialogParent(parent)}
                          >
                            <Users className="w-4 h-4" />
                            {t.manageChildrenBtn}
                          </button>
                        )}
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-primary mr-2"
                              onClick={() => saveEdit(parent)}
                            >
                              {t.saveBtn}
                            </button>
                            <button type="button" className="btn btn-xs btn-ghost" onClick={cancelEdit}>
                              {t.cancelBtn}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => startEdit(parent)}
                          >
                            {t.editBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {parentList.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <p className="empty-state">{t.emptyList}</p>
                    </td>
                  </tr>
                )}
                {parentList.length > 0 && filteredParentList.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <p className="empty-state">{t.noSearchResults}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="surface-card p-4 md:p-5">
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-start">
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderName}
            title={t.nameTooltip}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderSurname}
            title={t.surnameTooltip}
            value={newSurname}
            onChange={(e) => setNewSurname(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderPhone}
            title={t.phoneTooltip}
            value={newPhone}
            onChange={(e) => setNewPhone(sanitizePhoneNumber(e.target.value))}
          />
          <input
            type="email"
            className="input"
            placeholder={t.addPlaceholderEmail}
            title={t.emailTooltip}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderLogin}
            title={t.loginTooltip}
            value={newLogin}
            onChange={(e) => setNewLogin(e.target.value)}
          />
          <label className="input">
            <input
              type={showNewPassword ? "text" : "password"}
              placeholder={t.addPlaceholderPassword}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              className="opacity-60 hover:opacity-100"
              tabIndex={-1}
              aria-label={showNewPassword ? t.hidePasswordHint : t.showPasswordHint}
              onClick={() => setShowNewPassword((prev) => !prev)}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </label>
          <button
            type="button"
            className="btn btn-outline gap-2"
            title={t.generateCredentialsTooltip}
            onClick={generateLoginAndPassword}
          >
            <Wand2 className="w-4 h-4" />
            {t.generateCredentialsBtn}
          </button>
          <button type="submit" className="btn btn-primary">
            {t.addBtn}
          </button>
        </form>
      </div>

      <ParentPhotoDialog
        parent={photoDialogParent}
        onClose={() => setPhotoDialogParent(null)}
        onSaved={bumpPhotoVersion}
      />
      <ParentChildrenDialog parent={childrenDialogParent} onClose={() => setChildrenDialogParent(null)} />
    </div>
  );
};

export default ParentManager;
