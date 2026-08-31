import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { staffMaxPeriodsManagerTranslations } from "../../../i18n/translations";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import type { StaffMaxPeriods } from "../../../interfaces/Timetable";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";
import { DEFAULT_REPORT_CONCURRENCY, mapWithConcurrency } from "../../../utils/concurrency";

const MIN_MAX_PERIODS = 1;
const MAX_MAX_PERIODS = 60;

// "Charge horaire des enseignants" - staff_year.max_periods_per_week, one editable number per teacher,
// saved row by row (no bulk-select/edit-toggle needed for a single numeric field).
const StaffMaxPeriodsManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = staffMaxPeriodsManagerTranslations[language];

  const [staffList, setStaffList] = useState<StaffMaxPeriods[]>([]);
  const [editedValues, setEditedValues] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingStaffId, setSavingStaffId] = useState<number | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const list = await TimetableReader.fetchStaffMaxPeriods(accessToken, connection, schoolYear);
      setStaffList(list);
      setEditedValues(
        Object.fromEntries(list.map((s) => [s.staff_id, s.max_periods_per_week])),
      );
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const handleSave = async (staffId: number) => {
    const value = editedValues[staffId];
    setSavingStaffId(staffId);
    const result = await TimetableReader.updateStaffMaxPeriods(
      accessToken,
      connection,
      schoolYear,
      staffId,
      value,
    );
    setSavingStaffId(null);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  // Floating "save all" button - saves every row's currently edited value at once (bounded
  // concurrency, same DEFAULT_REPORT_CONCURRENCY convention as every other whole-list loop in this
  // app), rather than requiring the admin to click each row's own save icon individually.
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    const results = await mapWithConcurrency(staffList, DEFAULT_REPORT_CONCURRENCY, (s) =>
      TimetableReader.updateStaffMaxPeriods(
        accessToken,
        connection,
        schoolYear,
        s.staff_id,
        editedValues[s.staff_id] ?? s.max_periods_per_week,
      ),
    );
    setIsSavingAll(false);
    const failedCount = results.filter((r) => !r.status).length;
    if (failedCount === 0) {
      showToast(t.saveAllSuccess, { type: "info" });
    } else {
      showToast(t.saveAllPartialFailure(failedCount), { type: "danger" });
    }
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {(savingStaffId !== null || isSavingAll) && <LoadingOverlay />}
      <div className="page-header w-full max-w-2xl">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} columns={3} showToolbar={false} className="w-full max-w-2xl" />
      ) : (
        <div className="w-full max-w-2xl surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>{t.tableHeaderName}</th>
                  <th>{t.tableHeaderMaxPeriods}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => (
                  <tr key={s.staff_id}>
                    <td>
                      {s.name} {s.surname ?? ""}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={MIN_MAX_PERIODS}
                        max={MAX_MAX_PERIODS}
                        className="input input-bordered input-sm w-24"
                        value={editedValues[s.staff_id] ?? s.max_periods_per_week}
                        onChange={(e) =>
                          setEditedValues((prev) => ({
                            ...prev,
                            [s.staff_id]: Number(e.target.value),
                          }))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={savingStaffId !== null || isSavingAll}
                        onClick={() => handleSave(s.staff_id)}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      <p className="empty-state">{t.emptyState}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && staffList.length > 0 && (
        <div
          className="tooltip tooltip-right fixed bottom-[calc(1.5rem+var(--safe-bottom))] left-[calc(1.5rem+var(--safe-left))] z-40"
          data-tip={t.saveAllTooltip}
        >
          <button
            type="button"
            aria-label={t.saveAllTooltip}
            className="btn btn-circle btn-lg btn-primary shadow-lg shadow-primary/30 transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl"
            disabled={savingStaffId !== null || isSavingAll}
            onClick={handleSaveAll}
          >
            <Save className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};

export default StaffMaxPeriodsManager;
