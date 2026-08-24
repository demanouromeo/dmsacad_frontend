import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { schoolYearManagerTranslations } from "../../../i18n/translations";
import { MyReader } from "../../../dbmanger/MyReader";
import { SchoolInfoReader } from "../../../dbmanger/SchoolInfoReader";
import { computeNextSchoolYear } from "../../../utils/schoolYear";
import { isDuplicateNameError } from "../../../utils/apiErrors";
import type { SchoolYear } from "../../../interfaces/SchoolYear";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

// "Gestion des années scolaires" - lists every school_year row of the current connection and lets
// the admin append the next one. There's no other screen in the app that creates a school_year row
// today (BasculementManager only ever warns "next year missing", see its nextYearMissing toast) -
// this is that missing piece. Deliberately read-only + one Add action, no edit/delete/rename - see
// schoolYearManagerTranslations' own comment for why.
const SchoolYearManager = () => {
  const { connection, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = schoolYearManagerTranslations[language];

  const [years, setYears] = useState<SchoolYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const list = await MyReader.fetchSchoolYears(connection);
      setYears(list ?? []);
      setIsLoading(false);
    };
    load();
  }, [connection, reloadToken]);

  // Years come back ordered by `year DESC` from the backend already (SchoolInfoController::
  // getSchoolYears), but the list is re-sorted here rather than trusting index 0 - it's a small,
  // cheap list and "YYYY/YYYY" strings sort lexicographically the same as chronologically since
  // every year is the same digit width.
  const latestYear = years.reduce<string | null>(
    (latest, sy) => (latest === null || sy.year > latest ? sy.year : latest),
    null,
  );
  const nextYear = latestYear ? computeNextSchoolYear(latestYear) : null;

  const handleAdd = async () => {
    if (!nextYear) {
      return;
    }
    if (!(await confirm(t.addConfirmMessage(nextYear)))) {
      return;
    }
    setIsSaving(true);
    const result = await SchoolInfoReader.addSchoolYear(accessToken, connection, nextYear);
    setIsSaving(false);

    if (result.status) {
      showToast(t.addSuccess, { type: "info" });
      setReloadToken((n) => n + 1);
    } else {
      showToast(isDuplicateNameError(result.message) ? t.addDuplicate : t.addFailure, {
        type: "danger",
      });
    }
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <div className="page-header w-full max-w-2xl">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            title={!nextYear ? t.noNextYearTooltip : undefined}
            disabled={isSaving || !nextYear}
            onClick={handleAdd}
          >
            <Plus className="w-4 h-4" />
            {t.addBtn}
          </button>
          <CloseButton />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={2} showToolbar={false} className="w-full max-w-2xl" />
      ) : (
        <div className="w-full max-w-2xl surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>{t.tableHeaderYear}</th>
                  <th>{t.tableHeaderStatus}</th>
                </tr>
              </thead>
              <tbody>
                {years.map((sy) => (
                  <tr key={sy.sy_id}>
                    <td>{sy.year}</td>
                    <td>{sy.is_current ? t.currentLabel : t.notCurrentLabel}</td>
                  </tr>
                ))}
                {years.length === 0 && (
                  <tr>
                    <td colSpan={2}>
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

export default SchoolYearManager;
