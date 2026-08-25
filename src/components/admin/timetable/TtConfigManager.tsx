import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, X } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { ttConfigManagerTranslations } from "../../../i18n/translations";
import { TimetableReader } from "../../../dbmanger/TimetableReader";
import FormSkeleton from "../../sharedcomp/skeletons/FormSkeleton";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

const DEFAULTS = {
  start_time: "07h30",
  duration_break1: 15,
  duration_break2: 30,
  period_duration: 60,
  number_of_period_before_break1_start: 3,
  number_of_period_before_break2_start: 2,
};

const START_TIME_REGEX = /^\d{2}h\d{2}$/;

// "Configuration des horaires" - tt_config, one row per school (find-or-create by sy_id server-side).
// Single-record form, same shape as ClassifiedParamManager.
const TtConfigManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const [language] = useLanguage();
  const t = ttConfigManagerTranslations[language];

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [startTime, setStartTime] = useState(DEFAULTS.start_time);
  const [break1, setBreak1] = useState(DEFAULTS.duration_break1);
  const [break2, setBreak2] = useState(DEFAULTS.duration_break2);
  const [periodDuration, setPeriodDuration] = useState(DEFAULTS.period_duration);
  const [beforeBreak1, setBeforeBreak1] = useState(DEFAULTS.number_of_period_before_break1_start);
  const [beforeBreak2, setBeforeBreak2] = useState(DEFAULTS.number_of_period_before_break2_start);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const config = await TimetableReader.fetchTtConfig(accessToken, connection, schoolYear);
      if (config) {
        setStartTime(config.start_time);
        setBreak1(config.duration_break1);
        setBreak2(config.duration_break2);
        setPeriodDuration(config.period_duration);
        setBeforeBreak1(config.number_of_period_before_break1_start);
        setBeforeBreak2(config.number_of_period_before_break2_start);
      } else {
        setStartTime(DEFAULTS.start_time);
        setBreak1(DEFAULTS.duration_break1);
        setBreak2(DEFAULTS.duration_break2);
        setPeriodDuration(DEFAULTS.period_duration);
        setBeforeBreak1(DEFAULTS.number_of_period_before_break1_start);
        setBeforeBreak2(DEFAULTS.number_of_period_before_break2_start);
      }
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const handleSave = async () => {
    if (!START_TIME_REGEX.test(startTime)) {
      showToast(t.invalidStartTime, { type: "warning" });
      return;
    }
    setIsSaving(true);
    const result = await TimetableReader.saveTtConfig(accessToken, connection, schoolYear, {
      start_time: startTime,
      duration_break1: break1,
      duration_break2: break2,
      period_duration: periodDuration,
      number_of_period_before_break1_start: beforeBreak1,
      number_of_period_before_break2_start: beforeBreak2,
    });
    setIsSaving(false);
    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  return (
    <div className="page-shell flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <div className="page-header w-full max-w-2xl">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>

      {isLoading ? (
        <FormSkeleton fields={6} className="w-full max-w-2xl" />
      ) : (
        <div className="w-full max-w-2xl surface-card p-6 md:p-8 flex flex-col gap-4">
          <label className="form-control">
            <span className="label-text font-semibold">{t.startTimeLabel}</span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={startTime}
              placeholder="07h30"
              onChange={(e) => setStartTime(e.target.value)}
            />
            <span className="text-xs opacity-70 mt-1">{t.startTimeHint}</span>
          </label>

          <label className="form-control">
            <span className="label-text font-semibold">{t.periodDurationLabel}</span>
            <input
              type="number"
              min={30}
              max={60}
              className="input input-bordered w-full"
              value={periodDuration}
              onChange={(e) => setPeriodDuration(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <span className="label-text font-semibold">{t.beforeBreak1Label}</span>
            <input
              type="number"
              min={1}
              className="input input-bordered w-full"
              value={beforeBreak1}
              onChange={(e) => setBeforeBreak1(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <span className="label-text font-semibold">{t.break1DurationLabel}</span>
            <input
              type="number"
              min={0}
              className="input input-bordered w-full"
              value={break1}
              onChange={(e) => setBreak1(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <span className="label-text font-semibold">{t.beforeBreak2Label}</span>
            <input
              type="number"
              min={1}
              className="input input-bordered w-full"
              value={beforeBreak2}
              onChange={(e) => setBeforeBreak2(Number(e.target.value))}
            />
          </label>

          <label className="form-control">
            <span className="label-text font-semibold">{t.break2DurationLabel}</span>
            <input
              type="number"
              min={0}
              className="input input-bordered w-full"
              value={break2}
              onChange={(e) => setBreak2(Number(e.target.value))}
            />
          </label>

          <div className="flex gap-3 justify-center mt-4">
            <button
              type="button"
              className="btn btn-primary gap-2"
              disabled={isSaving}
              onClick={handleSave}
            >
              <Save className="w-4 h-4" />
              {t.saveBtn}
            </button>
            <button
              type="button"
              className="btn btn-ghost gap-2"
              disabled={isSaving}
              onClick={() => navigate(-1)}
            >
              <X className="w-4 h-4" />
              {t.closeBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TtConfigManager;
