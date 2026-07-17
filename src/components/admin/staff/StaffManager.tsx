import { useEffect, useState } from "react";
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
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import ExportButtons from "../../sharedcomp/ExportButtons";
import {
  MIN_STAFF_NAME_LENGTH,
  MIN_STAFF_LOGIN_OR_PASSWORD_LENGTH,
} from "../../../utils/textValidation";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import {
  buildExportFilename,
  exportRowsToCsv,
  exportRowsToPdf,
} from "../../../utils/exportData";
import { useSchoolHeader } from "../../../hooks/useSchoolHeader";

const FUNCTION_CODES = [0, 1, 2, 3, 4, 5] as const;

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

  const loadStaff = async () => {
    setIsLoading(true);
    const list = await StaffReader.fetchStaff(
      accessToken,
      connection,
      schoolYear,
    );
    setStaffList(list);
    setSelectedIds(new Set());
    setIsLoading(false);
  };

  useEffect(() => {
    loadStaff();
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

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === staffList.length
        ? new Set()
        : new Set(staffList.map((s) => s.staff_id)),
    );
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

  const functionLabel = (code: number): string =>
    functionLabels[code as keyof typeof functionLabels] ?? String(code);

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

  const handleExportExcel = () => {
    exportRowsToCsv(
      buildExportFilename([t.title, connection, schoolYear], "csv"),
      exportColumns,
      staffList,
      schoolHeader,
    );
  };

  const handleExportPdf = () => {
    exportRowsToPdf(
      t.title,
      buildExportFilename([t.title, connection, schoolYear], "pdf"),
      exportColumns,
      staffList,
      schoolHeader,
    );
  };

  return (
    <div className="p-10">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-4">{t.title}</h1>
      <div className="mb-6">
        <ExportButtons
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          excelLabel={et.excelBtn}
          pdfLabel={et.pdfBtn}
          disabled={isLoading || staffList.length === 0}
        />
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <div className="overflow-x-auto w-full mb-4">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={
                        staffList.length > 0 &&
                        selectedIds.size === staffList.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>#</th>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderSurname}</th>
                  <th>{t.tableHeaderPhone}</th>
                  <th>{t.tableHeaderSexe}</th>
                  <th>{t.tableHeaderCivility}</th>
                  <th>{t.tableHeaderFunction}</th>
                  <th>{t.tableHeaderLogin}</th>
                  <th>{t.tableHeaderNewPassword}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff, index) => {
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
                      <td>
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
                    <td colSpan={11} className="text-center opacity-60">
                      {t.emptyList}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="btn btn-error btn-sm mb-6"
            disabled={selectedIds.size === 0}
            onClick={handleDeleteSelected}
          >
            {t.deleteSelectionBtn(selectedIds.size)}
          </button>
        </>
      )}

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap gap-2 max-w-4xl items-start"
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
        <input
          type="password"
          className="input"
          placeholder={t.addPlaceholderPassword}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-neutral">
          {t.addBtn}
        </button>
      </form>
    </div>
  );
};

export default StaffManager;
