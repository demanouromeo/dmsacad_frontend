import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { timetableGridViewTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import { computeDayTimeline, type TimelineEntry } from "../../../utils/timetableTime";
import type { Classe } from "../../../interfaces/Classe";
import type { Jour, TtConfig, ClasseCell, ClasseSubjectSetting } from "../../../interfaces/Timetable";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const cellKey = (jourId: number, periodNumber: number) => `${jourId}-${periodNumber}`;

// "Emploi du temps" per-class weekly grid (matches the reference paper timetable: days as columns,
// periods as rows with time labels, a merged PAUSE row for each break). Each cell is clickable to
// manually set/clear the subject+teacher for that slot, reusing the same overlap validation the
// generator itself relies on (TimetableController::updateCell).
const TimetableGridView = () => {
  const { classeId } = useParams<{ classeId: string }>();
  const navigate = useNavigate();
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = timetableGridViewTranslations[language];

  const selectedClasseId = Number(classeId);

  const [classes, setClasses] = useState<Classe[]>([]);
  const [jours, setJours] = useState<Jour[]>([]);
  const [ttConfig, setTtConfig] = useState<TtConfig | null>(null);
  const [cells, setCells] = useState<ClasseCell[]>([]);
  const [subjectSettings, setSubjectSettings] = useState<ClasseSubjectSetting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editingSlot, setEditingSlot] = useState<{ jourId: number; periodNumber: number } | null>(
    null,
  );
  const [dialogSubjectId, setDialogSubjectId] = useState<number | "">("");
  const [dialogNoTeacher, setDialogNoTeacher] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [classeList, jourList, config] = await Promise.all([
        ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
        TimetableReader.fetchJours(accessToken, connection),
        TimetableReader.fetchTtConfig(accessToken, connection, schoolYear),
      ]);
      setClasses(classeList);
      setJours([...jourList].sort((a, b) => a.num - b.num));
      setTtConfig(config);
      setIsLoading(false);
    };
    load();
  }, [connection, schoolYear, section, accessToken]);

  useEffect(() => {
    if (!selectedClasseId) {
      return;
    }
    const load = async () => {
      const [cellList, settingList] = await Promise.all([
        TimetableReader.fetchClasseCells(accessToken, connection, schoolYear, selectedClasseId),
        TimetableReader.fetchClasseSubjectSettings(accessToken, connection, schoolYear, selectedClasseId),
      ]);
      setCells(cellList);
      setSubjectSettings(settingList);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear, selectedClasseId, reloadToken]);

  const cellMap = useMemo(() => {
    const map = new Map<string, ClasseCell>();
    cells.forEach((c) => map.set(cellKey(c.jour_id, c.period_number), c));
    return map;
  }, [cells]);

  const maxPeriods = jours.reduce((max, j) => Math.max(max, j.number_of_periods), 0);
  const timeline: TimelineEntry[] = ttConfig
    ? computeDayTimeline(ttConfig, maxPeriods)
    : Array.from({ length: maxPeriods }, (_, i) => ({
        type: "period" as const,
        period_number: i + 1,
        start: "",
        end: "",
      }));

  const selectedClasse = classes.find((c) => c.classe_id === selectedClasseId) ?? null;

  const openEditor = (jourId: number, periodNumber: number) => {
    const existing = cellMap.get(cellKey(jourId, periodNumber));
    setEditingSlot({ jourId, periodNumber });
    setDialogSubjectId(existing?.subject_id ?? "");
    setDialogNoTeacher(existing ? existing.staff_id === null : false);
    dialogRef.current?.showModal();
  };

  const closeEditor = () => {
    dialogRef.current?.close();
    setEditingSlot(null);
  };

  const handleDialogSave = async () => {
    if (!editingSlot) {
      return;
    }
    const setting = subjectSettings.find((s) => s.subject_id === dialogSubjectId);
    const staffId = dialogSubjectId === "" || dialogNoTeacher ? null : (setting?.staff_id ?? null);
    setIsSaving(true);
    const result = await TimetableReader.updateCell(
      accessToken,
      connection,
      schoolYear,
      selectedClasseId,
      editingSlot.jourId,
      editingSlot.periodNumber,
      dialogSubjectId === "" ? null : dialogSubjectId,
      staffId,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(dialogSubjectId === "" ? t.clearSuccess : t.saveSuccess, { type: "info" });
      closeEditor();
      setReloadToken((n) => n + 1);
    } else {
      showToast(result.message || t.saveFailure, { type: "danger" });
    }
  };

  const handleClear = async () => {
    if (!editingSlot) {
      return;
    }
    setIsSaving(true);
    const result = await TimetableReader.updateCell(
      accessToken,
      connection,
      schoolYear,
      selectedClasseId,
      editingSlot.jourId,
      editingSlot.periodNumber,
      null,
      null,
    );
    setIsSaving(false);
    if (result.status) {
      showToast(t.clearSuccess, { type: "info" });
      closeEditor();
      setReloadToken((n) => n + 1);
    } else {
      showToast(result.message || t.saveFailure, { type: "danger" });
    }
  };

  const selectedSetting = subjectSettings.find((s) => s.subject_id === dialogSubjectId) ?? null;

  return (
    <div className="page-shell-wide flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <div className="page-header w-full">
        <h1 className="page-title">{t.title}</h1>
        <div className="flex items-center gap-3 flex-nowrap">
          <span className="font-semibold whitespace-nowrap">{t.classeLabel}</span>
          <select
            className="select select-bordered select-sm"
            value={selectedClasseId || ""}
            onChange={(e) => navigate(`/admin/timetable/view/${e.target.value}`)}
          >
            {[...classes]
              .sort((a, b) => a.level - b.level || a.classe_name.localeCompare(b.classe_name))
              .map((c) => (
                <option key={c.classe_id} value={c.classe_id}>
                  {c.classe_name}
                </option>
              ))}
          </select>
          <CloseButton />
        </div>
      </div>

      {isLoading ? (
        <span className="loading loading-spinner loading-lg" />
      ) : jours.length === 0 ? (
        <p className="empty-state">{t.notConfiguredMessage}</p>
      ) : (
        <div className="w-full surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>{t.hoursHeader}</th>
                  {jours.map((j) => (
                    <th key={j.jour_id}>{j.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((entry, idx) =>
                  entry.type === "break" ? (
                    <tr key={`break-${idx}`} className="bg-base-200">
                      <td colSpan={jours.length + 2} className="text-center font-semibold uppercase">
                        {t.breakLabel} {entry.start && `(${entry.start} - ${entry.end})`}
                      </td>
                    </tr>
                  ) : (
                    <tr key={`period-${entry.period_number}`}>
                      <td className="whitespace-nowrap font-semibold text-center">
                        {entry.period_number}
                      </td>
                      <td className="whitespace-nowrap text-sm opacity-70">
                        {entry.start && `${entry.start} - ${entry.end}`}
                      </td>
                      {jours.map((j) => {
                        if (entry.period_number > j.number_of_periods) {
                          return (
                            <td key={j.jour_id} className="opacity-40 text-center">
                              {t.freeSlotLabel}
                            </td>
                          );
                        }
                        const cell = cellMap.get(cellKey(j.jour_id, entry.period_number));
                        return (
                          <td
                            key={j.jour_id}
                            className="cursor-pointer hover:bg-base-200"
                            onClick={() => openEditor(j.jour_id, entry.period_number)}
                          >
                            {cell ? (
                              <div>
                                <div className="font-semibold">{cell.subject_title}</div>
                                <div className="text-xs opacity-70">
                                  {cell.staff_id
                                    ? `${cell.staff_name ?? ""} ${cell.staff_surname ?? ""}`
                                    : t.noTeacherLabel}
                                </div>
                              </div>
                            ) : (
                              <span className="opacity-30">{t.freeSlotLabel}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal" onClose={() => setEditingSlot(null)}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">
            {t.editDialogTitle} {selectedClasse ? `- ${selectedClasse.classe_name}` : ""}
          </h3>

          <label className="form-control mb-3">
            <span className="label-text font-semibold">{t.subjectLabel}</span>
            <select
              className="select select-bordered w-full"
              value={dialogSubjectId}
              onChange={(e) => {
                const value = e.target.value;
                setDialogSubjectId(value === "" ? "" : Number(value));
                setDialogNoTeacher(false);
              }}
            >
              <option value="">{t.noSubjectOption}</option>
              {subjectSettings.map((s) => (
                <option key={s.subject_classe_id} value={s.subject_id}>
                  {s.subject_title}
                </option>
              ))}
            </select>
          </label>

          {dialogSubjectId !== "" && (
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={dialogNoTeacher || !selectedSetting?.staff_id}
                disabled={!selectedSetting?.staff_id}
                onChange={(e) => setDialogNoTeacher(e.target.checked)}
              />
              <span className="text-sm">
                {t.teacherLabel}:{" "}
                {selectedSetting?.staff_id && !dialogNoTeacher
                  ? `${selectedSetting.staff_name ?? ""} ${selectedSetting.staff_surname ?? ""}`
                  : t.noTeacherLabel}
              </span>
            </label>
          )}

          <div className="modal-action">
            {editingSlot && cellMap.get(cellKey(editingSlot.jourId, editingSlot.periodNumber)) && (
              <button type="button" className="btn btn-error" disabled={isSaving} onClick={handleClear}>
                {t.clearBtn}
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={isSaving} onClick={closeEditor}>
              {t.cancelBtn}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSaving || dialogSubjectId === ""}
              onClick={handleDialogSave}
            >
              {t.saveBtn}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default TimetableGridView;
