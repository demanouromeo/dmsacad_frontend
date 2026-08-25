import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { classeSubjectSettingsManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import type { Classe } from "../../../interfaces/Classe";
import type { ClasseSubjectSetting } from "../../../interfaces/Timetable";
import TableSkeleton from "../../sharedcomp/skeletons/TableSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const MIN_WEIGHT = 1;
const MAX_WEIGHT = 10;
const MIN_PERIODS = 0;
const MAX_PERIODS = 20;

interface EditedSetting {
  weight: number;
  numnber_of_period_per_week: number;
  commoncourse: boolean;
}

// "Matières par classe - paramètres de l'emploi du temps" - edits subject_classe.weight/
// numnber_of_period_per_week/commoncourse for the selected classe's assigned subjects. Same
// classe-selector shape as SubjectClasseManager/SubjectCompetenceManager.
const ClasseSubjectSettingsManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = classeSubjectSettingsManagerTranslations[language];

  const [classes, setClasses] = useState<Classe[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  const [settings, setSettings] = useState<ClasseSubjectSetting[]>([]);
  const [edited, setEdited] = useState<Record<number, EditedSetting>>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoadingClasses(true);
      const list = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      setClasses(list);
      setSelectedClasseId((prev) =>
        prev !== null && list.some((c) => c.classe_id === prev) ? prev : (list[0]?.classe_id ?? null),
      );
      setIsLoadingClasses(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, section]);

  useEffect(() => {
    if (selectedClasseId === null) {
      setSettings([]);
      return;
    }
    const load = async () => {
      setIsLoadingSettings(true);
      const list = await TimetableReader.fetchClasseSubjectSettings(
        accessToken,
        connection,
        schoolYear,
        selectedClasseId,
      );
      setSettings(list);
      setEdited(
        Object.fromEntries(
          list.map((s) => [
            s.subject_classe_id,
            {
              weight: s.weight,
              numnber_of_period_per_week: s.numnber_of_period_per_week,
              commoncourse: s.commoncourse === 1,
            },
          ]),
        ),
      );
      setIsLoadingSettings(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, selectedClasseId]);

  const handleSave = async (row: ClasseSubjectSetting) => {
    const values = edited[row.subject_classe_id];
    if (!values) {
      return;
    }
    setSavingId(row.subject_classe_id);
    const result = await TimetableReader.updateClasseSubjectSetting(
      accessToken,
      connection,
      row.subject_classe_id,
      values.weight,
      values.numnber_of_period_per_week,
      values.commoncourse,
    );
    setSavingId(null);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {savingId !== null && <LoadingOverlay />}
      <div className="page-header w-full max-w-4xl">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>

      <div className="w-full max-w-4xl flex items-center gap-3 mb-4">
        <span className="font-semibold">{t.classeLabel}</span>
        {isLoadingClasses ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <select
            className="select select-bordered select-sm"
            value={selectedClasseId ?? ""}
            onChange={(e) => setSelectedClasseId(Number(e.target.value))}
          >
            {classes.map((c) => (
              <option key={c.classe_id} value={c.classe_id}>
                {c.classe_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoadingSettings ? (
        <TableSkeleton rows={6} columns={5} showToolbar={false} className="w-full max-w-4xl" />
      ) : (
        <div className="w-full max-w-4xl surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>{t.tableHeaderSubject}</th>
                  <th>{t.tableHeaderTeacher}</th>
                  <th title={t.weightHint}>{t.tableHeaderWeight}</th>
                  <th>{t.tableHeaderPeriodsPerWeek}</th>
                  <th title={t.commonCourseHint}>{t.tableHeaderCommonCourse}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {settings.map((row) => {
                  const values = edited[row.subject_classe_id] ?? {
                    weight: row.weight,
                    numnber_of_period_per_week: row.numnber_of_period_per_week,
                    commoncourse: row.commoncourse === 1,
                  };
                  return (
                    <tr key={row.subject_classe_id}>
                      <td>{row.subject_title}</td>
                      <td>
                        {row.staff_id
                          ? `${row.staff_name ?? ""} ${row.staff_surname ?? ""}`
                          : <span className="opacity-60">{t.noTeacherLabel}</span>}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={MIN_WEIGHT}
                          max={MAX_WEIGHT}
                          className="input input-bordered input-sm w-20"
                          value={values.weight}
                          onChange={(e) =>
                            setEdited((prev) => ({
                              ...prev,
                              [row.subject_classe_id]: { ...values, weight: Number(e.target.value) },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={MIN_PERIODS}
                          max={MAX_PERIODS}
                          className="input input-bordered input-sm w-20"
                          value={values.numnber_of_period_per_week}
                          onChange={(e) =>
                            setEdited((prev) => ({
                              ...prev,
                              [row.subject_classe_id]: {
                                ...values,
                                numnber_of_period_per_week: Number(e.target.value),
                              },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={values.commoncourse}
                          onChange={(e) =>
                            setEdited((prev) => ({
                              ...prev,
                              [row.subject_classe_id]: { ...values, commoncourse: e.target.checked },
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={savingId !== null}
                          onClick={() => handleSave(row)}
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {settings.length === 0 && (
                  <tr>
                    <td colSpan={6}>
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

export default ClasseSubjectSettingsManager;
