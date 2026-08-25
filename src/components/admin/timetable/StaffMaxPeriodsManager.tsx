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

  return (
    <div className="page-shell flex flex-col items-center">
      {savingStaffId !== null && <LoadingOverlay />}
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
                        disabled={savingStaffId !== null}
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
    </div>
  );
};

export default StaffMaxPeriodsManager;
