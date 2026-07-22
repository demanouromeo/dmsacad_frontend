import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Upload, Wand2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useConfirm } from "../../../confirm/useConfirm";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  staffManagerTranslations,
  staffFunctionLabels,
  exportTranslations,
} from "../../../i18n/translations";
import { StaffReader } from "../../../dbmanger/StaffReader";
import type { Staff } from "../../../interfaces/Staff";
import Loading from "../../sharedcomp/Loading";
import StaffPhotoCell from "./StaffPhotoCell";
import StaffPhotoDialog from "./StaffPhotoDialog";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import SearchInput from "../../sharedcomp/SearchInput";
import ExportButtons from "../../sharedcomp/ExportButtons";
import {
  MIN_STAFF_NAME_LENGTH,
  MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH,
} from "../../../utils/textValidation";
import { isDuplicateNameError, stripHtmlTags } from "../../../utils/apiErrors";
import {
  buildTimestampedFilename,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";
import {
  parseStaffImportFile,
  generateImportCredentials,
  type ImportedStaff,
  type StaffImportError,
} from "../../../utils/staffImport";

const mapStaffImportErrorToMessage = (
  error: StaffImportError,
  t: (typeof staffManagerTranslations)["fr"],
): string => {
  switch (error.type) {
    case "unsupportedExtension":
      return t.importUnsupportedExtension;
    case "emptyFile":
      return t.importEmptyFile;
    case "badHeader":
      return t.importBadHeader;
    case "emptyName":
      return t.importEmptyName(error.row);
  }
};

const FUNCTION_CODES = [0, 1, 2, 3, 4, 5] as const;

const RANDOM_CREDENTIAL_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_CREDENTIAL_LENGTH = 6;
const MAX_LOGIN_GENERATION_ATTEMPTS = 50;

const randomCredentialString = (length: number): string =>
  Array.from(
    { length },
    () =>
      RANDOM_CREDENTIAL_CHARS[
        Math.floor(Math.random() * RANDOM_CREDENTIAL_CHARS.length)
      ],
  ).join("");

const StaffManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const confirm = useConfirm();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = staffManagerTranslations[language];
  const et = exportTranslations[language];
  const schoolHeader = useSchoolHeader();
  const functionLabels = staffFunctionLabels[language];

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newSurname, setNewSurname] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSexe, setNewSexe] = useState("M");
  const [newCivility, setNewCivility] = useState("");
  const [newFunction, setNewFunction] = useState("0");
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSurname, setEditingSurname] = useState("");
  const [editingPhone, setEditingPhone] = useState("");
  const [editingSexe, setEditingSexe] = useState("M");
  const [editingCivility, setEditingCivility] = useState("");
  const [editingFunction, setEditingFunction] = useState("0");
  const [editingLogin, setEditingLogin] = useState("");
  const [editingNewPassword, setEditingNewPassword] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Set<number>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [photoDialogStaff, setPhotoDialogStaff] = useState<Staff | null>(null);
  const [photoVersions, setPhotoVersions] = useState<Record<number, number>>({});
  const bumpPhotoVersion = (staffId: number) => {
    setPhotoVersions((prev) => ({ ...prev, [staffId]: (prev[staffId] ?? 0) + 1 }));
  };

  const loadStaff = async () => {
    setIsLoading(true);
    const list = await StaffReader.fetchStaff(
      accessToken,
      connection,
      schoolYear,
    );
    setStaffList(list);
    setSelectedIds(new Set());
    setVisiblePasswordIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadStaff();
    setSearchQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const resetAddForm = () => {
    setNewName("");
    setNewSurname("");
    setNewPhone("");
    setNewSexe("M");
    setNewCivility("");
    setNewFunction("0");
    setNewLogin("");
    setNewPassword("");
    setShowNewPassword(false);
  };

  // Best-effort uniqueness: staffList only covers the current school year (StaffReader.fetchStaff
  // isn't year-unbounded), but Account.login is globally unique server-side (see backend CLAUDE.md) -
  // retrying against 62^6 possibilities makes a collision with a login from another year vanishingly
  // unlikely, and the existing addDuplicate handling in handleAdd already covers the rare case where
  // the backend still rejects it.
  const generateLoginAndPassword = () => {
    const existingLogins = new Set(
      staffList.map((s) => s.login.toLowerCase()),
    );
    let login = randomCredentialString(RANDOM_CREDENTIAL_LENGTH);
    let attempts = 0;
    while (
      existingLogins.has(login.toLowerCase()) &&
      attempts < MAX_LOGIN_GENERATION_ATTEMPTS
    ) {
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
    if (!trimmedName || !trimmedLogin || !trimmedPassword) {
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
      showToast(
        t.loginOrPasswordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH),
        { type: "warning" },
      );
      return;
    }
    setIsSaving(true);
    const result = await StaffReader.saveStaff(accessToken, connection, schoolYear, {
      name: trimmedName,
      surname: newSurname.trim(),
      phone1: newPhone.trim(),
      sexe: newSexe,
      function: Number(newFunction),
      civility: newCivility.trim(),
      login: trimmedLogin,
      pwd: trimmedPassword,
    });
    setIsSaving(false);
    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      resetAddForm();
      loadStaff();
    } else {
      showToast(
        isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure,
        { type: "danger" },
      );
    }
  };

  const startEdit = (staff: Staff) => {
    setEditingId(staff.staff_id);
    setEditingName(staff.name);
    setEditingSurname(staff.surname ?? "");
    setEditingPhone(staff.phone1 ?? "");
    setEditingSexe(staff.sexe);
    setEditingCivility(staff.civility ?? "");
    setEditingFunction(String(staff.function));
    setEditingLogin(staff.login);
    setEditingNewPassword("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingSurname("");
    setEditingPhone("");
    setEditingSexe("M");
    setEditingCivility("");
    setEditingFunction("0");
    setEditingLogin("");
    setEditingNewPassword("");
  };

  const saveEdit = async (staff: Staff) => {
    const trimmedName = editingName.trim();
    const trimmedLogin = editingLogin.trim();
    if (!trimmedName || !trimmedLogin) {
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
      (trimmedNewPassword &&
        trimmedNewPassword.length < MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH)
    ) {
      showToast(
        t.loginOrPasswordTooShort(MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH),
        { type: "warning" },
      );
      return;
    }
    setIsSaving(true);
    const result = await StaffReader.updateStaff(accessToken, connection, schoolYear, [
      {
        staff_id: staff.staff_id,
        name: trimmedName,
        surname: editingSurname.trim(),
        sexe: editingSexe,
        phone1: editingPhone.trim(),
        function: Number(editingFunction),
        civility: editingCivility.trim(),
        login: trimmedLogin,
        acc_id: staff.acc_id,
        ...(trimmedNewPassword ? { pwd: trimmedNewPassword } : {}),
      },
    ]);
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
      loadStaff();
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

  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Operates on the currently filtered rows, not the whole list - selecting "all" while a search is
  // active only selects what's visible, matching what the user can see they're selecting.
  const toggleSelectAll = () => {
    const filteredIds = filteredStaffList.map((s) => s.staff_id);
    const allFilteredSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
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
    const confirmed = await confirm(t.deleteConfirm(selectedIds.size), {
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    setIsSaving(true);
    const result = await StaffReader.deleteStaff(
      accessToken,
      connection,
      schoolYear,
      section,
      Array.from(selectedIds),
    );
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      loadStaff();
    }
  };

  // No name-uniqueness check before saving, unlike Classe/Filiere/Speciality/Subject's import - staff
  // names aren't required to be unique server-side (that's exactly why the classe-master/SG pickers
  // disambiguate by staff_id in brackets), so there's nothing to guard against here.
  const persistImportedStaff = async (rows: ImportedStaff[], override: boolean) => {
    setIsSaving(true);
    const payload = rows.map((row) => {
      const { login, pwd } = generateImportCredentials(
        row.name,
        row.surname,
        row.sourceRow,
      );
      return {
        name: row.name,
        surname: row.surname,
        phone1: row.phone1,
        function: row.function,
        civility: row.civility,
        sexe: "",
        login,
        pwd,
      };
    });
    const saveResult = await StaffReader.saveManyStaffs(
      accessToken,
      connection,
      schoolYear,
      section,
      payload,
      override,
    );
    setIsSaving(false);
    if (saveResult.status) {
      showToast(t.importSuccess(rows.length), { type: "info" });
      loadStaff();
    } else {
      const detail = stripHtmlTags(saveResult.message);
      showToast(detail ? t.importFailureDetail(detail) : t.importFailure, {
        type: "danger",
      });
    }
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    setIsSaving(true);
    const parsed = await parseStaffImportFile(file);
    setIsSaving(false);
    if (!parsed.status) {
      showToast(mapStaffImportErrorToMessage(parsed.error, t), {
        type: "danger",
      });
      return;
    }

    const wantsDelete = await confirm(t.importDeleteExistingQuestion, {
      confirmLabel: t.importDeleteBtn,
      cancelLabel: t.importAddWithoutDeleteBtn,
    });

    if (wantsDelete) {
      const reallyDelete = await confirm(t.importDeleteConfirmAgain, {
        danger: true,
        confirmLabel: t.importDeleteFinalBtn,
      });
      if (!reallyDelete) {
        return;
      }
      await persistImportedStaff(parsed.staff, true);
      return;
    }

    await persistImportedStaff(parsed.staff, false);
  };

  const functionLabel = (code: number): string =>
    functionLabels[code as keyof typeof functionLabels] ?? String(code);

  const filteredStaffList = staffList.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.surname ?? "").toLowerCase().includes(q) ||
      (s.phone1 ?? "").toLowerCase().includes(q) ||
      (s.civility ?? "").toLowerCase().includes(q) ||
      s.login.toLowerCase().includes(q) ||
      functionLabel(s.function).toLowerCase().includes(q)
    );
  });

  // Never include `pwd` (or anything password-derived) in these columns.
  const exportColumns = [
    { header: t.tableHeaderName, accessor: (s: Staff) => s.name },
    { header: t.tableHeaderSurname, accessor: (s: Staff) => s.surname ?? "" },
    { header: t.tableHeaderPhone, accessor: (s: Staff) => s.phone1 ?? "" },
    { header: t.tableHeaderSexe, accessor: (s: Staff) => s.sexe },
    { header: t.tableHeaderCivility, accessor: (s: Staff) => s.civility ?? "" },
    {
      header: t.tableHeaderFunction,
      accessor: (s: Staff) => functionLabel(s.function),
    },
    { header: t.tableHeaderLogin, accessor: (s: Staff) => s.login },
  ];

  // PDF-only: prepends a row-index column, same convention as StudentManager's own
  // pdfExportColumns - CSV relies on the spreadsheet's own implicit row numbers instead.
  const pdfExportColumns = [
    {
      header: t.tableHeaderIndex,
      accessor: (_s: Staff, index: number) => index + 1,
    },
    ...exportColumns,
  ];

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildTimestampedFilename("Liste du personnel", [], "csv"),
      exportColumns,
      staffList,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildTimestampedFilename("Liste du personnel", [], "pdf"),
      pdfExportColumns,
      staffList,
      schoolHeader,
    );
  };

  return (
    <div className="page-shell-wide">
      {isSaving && <LoadingOverlay />}

      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <ExportButtons
            onExportExcel={handleExportExcel}
            onExportPdf={handleExportPdf}
            excelLabel={et.excelBtn}
            pdfLabel={et.pdfBtn}
            disabled={isLoading || staffList.length === 0}
          />
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleImportFileChange}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm gap-2"
            disabled={isLoading}
            onClick={() => importFileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            {t.importBtn}
          </button>
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
                        filteredStaffList.length > 0 &&
                        filteredStaffList.every((s) =>
                          selectedIds.has(s.staff_id),
                        )
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>{t.tableHeaderPhoto}</th>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderSurname}</th>
                  <th>{t.tableHeaderPhone}</th>
                  <th>{t.tableHeaderSexe}</th>
                  <th>{t.tableHeaderCivility}</th>
                  <th>{t.tableHeaderFunction}</th>
                  <th>{t.tableHeaderLogin}</th>
                  <th>{t.tableHeaderPassword}</th>
                  <th>{t.tableHeaderNewPassword}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList.map((staff, index) => {
                  const isEditing = editingId === staff.staff_id;
                  return (
                    <tr key={staff.staff_id}>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.has(staff.staff_id)}
                          onChange={() => toggleSelect(staff.staff_id)}
                        />
                      </td>
                      <td>{index + 1}</td>
                      <td>
                        <StaffPhotoCell
                          staffId={staff.staff_id}
                          refreshVersion={photoVersions[staff.staff_id] ?? 0}
                          onClick={() => setPhotoDialogStaff(staff)}
                        />
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            value={editingName}
                            autoFocus
                            onChange={(e) => setEditingName(e.target.value)}
                          />
                        ) : (
                          staff.name
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            value={editingSurname}
                            onChange={(e) =>
                              setEditingSurname(e.target.value)
                            }
                          />
                        ) : (
                          staff.surname || ""
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            value={editingPhone}
                            onChange={(e) => setEditingPhone(e.target.value)}
                          />
                        ) : (
                          staff.phone1 || ""
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="select select-sm"
                            value={editingSexe}
                            onChange={(e) => setEditingSexe(e.target.value)}
                          >
                            <option value="M">{t.sexeMale}</option>
                            <option value="F">{t.sexeFemale}</option>
                          </select>
                        ) : (
                          staff.sexe
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            value={editingCivility}
                            onChange={(e) =>
                              setEditingCivility(e.target.value)
                            }
                          />
                        ) : (
                          staff.civility || ""
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="select select-sm"
                            value={editingFunction}
                            onChange={(e) =>
                              setEditingFunction(e.target.value)
                            }
                          >
                            {FUNCTION_CODES.map((code) => (
                              <option key={code} value={code}>
                                {functionLabel(code)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          functionLabel(staff.function)
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="input input-sm w-full"
                            value={editingLogin}
                            onChange={(e) => setEditingLogin(e.target.value)}
                          />
                        ) : (
                          staff.login
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">
                            {visiblePasswordIds.has(staff.staff_id)
                              ? staff.pwd
                              : "••••••••"}
                          </span>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost btn-square"
                            aria-label={
                              visiblePasswordIds.has(staff.staff_id)
                                ? t.hidePasswordHint
                                : t.showPasswordHint
                            }
                            onClick={() =>
                              togglePasswordVisibility(staff.staff_id)
                            }
                          >
                            {visiblePasswordIds.has(staff.staff_id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
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
                              if (e.key === "Enter") saveEdit(staff);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        )}
                      </td>
                      <td className="text-right">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-primary mr-2"
                              onClick={() => saveEdit(staff)}
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
                            onClick={() => startEdit(staff)}
                          >
                            {t.editBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan={13}>
                      <p className="empty-state">{t.emptyList}</p>
                    </td>
                  </tr>
                )}
                {staffList.length > 0 && filteredStaffList.length === 0 && (
                  <tr>
                    <td colSpan={13}>
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
        <form
          onSubmit={handleAdd}
          className="flex flex-wrap gap-2 items-start"
        >
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderName}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderSurname}
            value={newSurname}
            onChange={(e) => setNewSurname(e.target.value)}
          />
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderPhone}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <select
            className="select"
            value={newSexe}
            onChange={(e) => setNewSexe(e.target.value)}
          >
            <option value="M">{t.sexeMale}</option>
            <option value="F">{t.sexeFemale}</option>
          </select>
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderCivility}
            value={newCivility}
            onChange={(e) => setNewCivility(e.target.value)}
          />
          <select
            className="select"
            value={newFunction}
            onChange={(e) => setNewFunction(e.target.value)}
          >
            {FUNCTION_CODES.map((code) => (
              <option key={code} value={code}>
                {functionLabel(code)}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="input"
            placeholder={t.addPlaceholderLogin}
            value={newLogin}
            onChange={(e) => setNewLogin(e.target.value)}
          />
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              className="input pr-10"
              placeholder={t.addPlaceholderPassword}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              tabIndex={-1}
              aria-label={
                showNewPassword ? t.hidePasswordHint : t.showPasswordHint
              }
              onClick={() => setShowNewPassword((prev) => !prev)}
            >
              {showNewPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            className="btn btn-outline gap-2"
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

      <StaffPhotoDialog
        staff={photoDialogStaff}
        onClose={() => setPhotoDialogStaff(null)}
        onSaved={bumpPhotoVersion}
      />
    </div>
  );
};

export default StaffManager;
