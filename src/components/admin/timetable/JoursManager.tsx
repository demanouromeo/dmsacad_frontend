import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { joursManagerTranslations } from "../../../i18n/translations";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import type { Jour } from "../../../interfaces/Timetable";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const MIN_NUM = 1;
const MAX_NUM = 7;
const MIN_PERIODS = 1;
const MAX_PERIODS = 12;

// "Jours de classe" - jours is effectively a single school-wide set of days (label/num each carry a
// genuine UNIQUE index, confirmed live - see TimetableController::saveJour's own comment), not one set
// per school year. Editing an existing day keeps its `num` fixed (that's its identity for the upsert)
// and only updates label/number_of_periods; adding a new day picks a `num` not already in use.
const JoursManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = joursManagerTranslations[language];

  const [jours, setJours] = useState<Jour[]>([]);
  const [editedLabels, setEditedLabels] = useState<Record<number, string>>({});
  const [editedPeriods, setEditedPeriods] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [newLabel, setNewLabel] = useState("");
  const [newNum, setNewNum] = useState(1);
  const [newPeriods, setNewPeriods] = useState(7);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const list = await TimetableReader.fetchJours(accessToken, connection);
      setJours(list);
      setEditedLabels(Object.fromEntries(list.map((j) => [j.jour_id, j.label])));
      setEditedPeriods(Object.fromEntries(list.map((j) => [j.jour_id, j.number_of_periods])));
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, reloadToken]);

  const handleSaveRow = async (jour: Jour) => {
    setIsSaving(true);
    const result = await TimetableReader.saveJour(
      accessToken,
      connection,
      schoolYear,
      editedLabels[jour.jour_id] ?? jour.label,
      jour.num,
      editedPeriods[jour.jour_id] ?? jour.number_of_periods,
    );
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setReloadToken((n) => n + 1);
    }
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      return;
    }
    setIsSaving(true);
    const result = await TimetableReader.saveJour(
      accessToken,
      connection,
      schoolYear,
      newLabel.trim(),
      newNum,
      newPeriods,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.saveSuccess, { type: "info" });
      setNewLabel("");
      setReloadToken((n) => n + 1);
    } else {
      showToast(t.saveFailure, { type: "danger" });
    }
  };

  const handleDelete = async (jour: Jour) => {
    if (!(await confirm(t.deleteConfirmMessage(jour.label), { danger: true }))) {
      return;
    }
    setIsSaving(true);
    const result = await TimetableReader.deleteJour(accessToken, connection, jour.jour_id);
    setIsSaving(false);
    showToast(result.status ? t.deleteSuccess : t.deleteFailure, {
      type: result.status ? "info" : "danger",
    });
    if (result.status) {
      setReloadToken((n) => n + 1);
    }
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <div className="page-header w-full max-w-3xl">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} showToolbar={false} className="w-full max-w-3xl" />
      ) : (
        <div className="w-full max-w-3xl surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>{t.tableHeaderNum}</th>
                  <th>{t.tableHeaderLabel}</th>
                  <th>{t.tableHeaderPeriods}</th>
                  <th>{t.tableHeaderActions}</th>
                </tr>
              </thead>
              <tbody>
                {jours.map((j) => (
                  <tr key={j.jour_id}>
                    <td>{j.num}</td>
                    <td>
                      <input
                        type="text"
                        className="input input-bordered input-sm w-40"
                        value={editedLabels[j.jour_id] ?? j.label}
                        onChange={(e) =>
                          setEditedLabels((prev) => ({ ...prev, [j.jour_id]: e.target.value }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={MIN_PERIODS}
                        max={MAX_PERIODS}
                        className="input input-bordered input-sm w-20"
                        value={editedPeriods[j.jour_id] ?? j.number_of_periods}
                        onChange={(e) =>
                          setEditedPeriods((prev) => ({
                            ...prev,
                            [j.jour_id]: Number(e.target.value),
                          }))
                        }
                      />
                    </td>
                    <td className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isSaving}
                        onClick={() => handleSaveRow(j)}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-error btn-sm"
                        disabled={isSaving}
                        onClick={() => handleDelete(j)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {jours.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <p className="empty-state">{t.emptyState}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-toolbar flex flex-wrap items-end gap-3 p-4 border-t border-base-200">
            <label className="form-control">
              <span className="label-text text-xs">{t.tableHeaderNum}</span>
              <select
                className="select select-bordered select-sm w-20"
                value={newNum}
                onChange={(e) => setNewNum(Number(e.target.value))}
              >
                {Array.from({ length: MAX_NUM - MIN_NUM + 1 }, (_, i) => MIN_NUM + i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control flex-1 min-w-40">
              <span className="label-text text-xs">{t.tableHeaderLabel}</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder={t.dayLabelPlaceholder}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </label>
            <label className="form-control">
              <span className="label-text text-xs">{t.tableHeaderPeriods}</span>
              <input
                type="number"
                min={MIN_PERIODS}
                max={MAX_PERIODS}
                className="input input-bordered input-sm w-20"
                value={newPeriods}
                onChange={(e) => setNewPeriods(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2"
              disabled={isSaving || !newLabel.trim()}
              onClick={handleAdd}
            >
              <Plus className="w-4 h-4" />
              {t.addBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoursManager;
