import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Settings2 } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useConfirm } from "../../../confirm/useConfirm";
import { useLanguage } from "../../../i18n/useLanguage";
import { timetableHubTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import type { Classe } from "../../../interfaces/Classe";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

// Landing page for the "Time table" dashboard card - Generate (confirm-gated, regenerates the whole
// school's time table for the current year) and Time table settings buttons, plus a per-class list
// linking into TimetableGridView (viewing the whole school means flipping through classes, same as a
// paper timetable is one sheet per class).
const TimetableHub = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const [language] = useLanguage();
  const t = timetableHubTranslations[language];

  const [classes, setClasses] = useState<Classe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const list = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(list);
      setIsLoading(false);
    };
    load();
  }, [connection, schoolYear, section, accessToken]);

  const handleGenerate = async () => {
    if (!(await confirm(t.generateConfirmMessage, { danger: true }))) {
      return;
    }
    setIsGenerating(true);
    const result = await TimetableReader.generate(accessToken, connection, schoolYear);
    setIsGenerating(false);

    if (!result.status) {
      showToast(result.message || t.generateFailure, { type: "danger" });
      return;
    }
    const unassigned = result.warnings?.unassignedTeacher.reduce((sum, w) => sum + w.count, 0) ?? 0;
    const noCapacity = result.warnings?.noCapacity.reduce((sum, w) => sum + w.count, 0) ?? 0;
    if (unassigned > 0 || noCapacity > 0) {
      showToast(t.generateSuccessWithWarnings(unassigned, noCapacity), { type: "warning" });
    } else {
      showToast(t.generateSuccess, { type: "info" });
    }
  };

  const sortedClasses = [...classes].sort(
    (a, b) => a.level - b.level || a.classe_name.localeCompare(b.classe_name),
  );

  return (
    <div className="page-shell flex flex-col items-center">
      {isGenerating && <LoadingOverlay />}
      <div className="page-header w-full max-w-3xl">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            disabled={isGenerating}
            onClick={handleGenerate}
          >
            <CalendarClock className="w-4 h-4" />
            {t.generateBtn}
          </button>
          <Link to="/admin/timetable/settings" className="btn btn-ghost btn-sm gap-2">
            <Settings2 className="w-4 h-4" />
            {t.settingsBtn}
          </Link>
          <CloseButton />
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <h2 className="text-lg font-semibold mb-2">{t.classesListTitle}</h2>
        {isLoading ? (
          <TableSkeleton rows={8} columns={3} showToolbar={false} className="w-full" />
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra data-table">
                <thead>
                  <tr>
                    <th>{t.tableHeaderClasse}</th>
                    <th>{t.tableHeaderLevel}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClasses.map((c) => (
                    <tr key={c.classe_id}>
                      <td>{c.classe_name}</td>
                      <td>{c.level}</td>
                      <td>
                        <Link
                          to={`/admin/timetable/view/${c.classe_id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          {t.viewBtn}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {sortedClasses.length === 0 && (
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
    </div>
  );
};

export default TimetableHub;
