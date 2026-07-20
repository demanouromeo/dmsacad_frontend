import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { classifiedParamManagerTranslations } from "../../../i18n/translations";
import { ClassifiedParamReader } from "../../../dbmanger/ClassifiedParamReader";
import Loading from "../../sharedcomp/Loading";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

const DEFAULT_NB_MATIERES_RATE = 40;
const MIN_RATE = 1;
const MAX_RATE = 100;

// "Classement des élèves (Classés/NC)" - defines classifiedparam.classified/nb_matieres_rate for the
// current school year (see the backend CLAUDE.md's "Classified / Not Classified (NC) parameter"
// section for what these drive at report-card time). Unlike the list-based CRUD managers elsewhere in
// this app, this is a single-record radio+slider form, closer in shape to SchoolInfoManager - no
// table, no search, one Save action.
const ClassifiedParamManager = () => {
  const { connection, schoolYear, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = classifiedParamManagerTranslations[language];

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // true = "Classement en fonction du nombre de matières" (classified=1), false = "Classer tous les
  // élèves" (classified=0) - see the backend algorithm's own inverted naming (classified=0 means
  // *everyone* is classified, classified=1 means the rate-based algorithm decides).
  const [useRateClassification, setUseRateClassification] = useState(false);
  const [nbMatieresRate, setNbMatieresRate] = useState(DEFAULT_NB_MATIERES_RATE);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const param = await ClassifiedParamReader.fetchClassifiedParamOfYear(
        accessToken,
        connection,
        schoolYear,
      );
      if (param) {
        setUseRateClassification(param.classified === 1);
        setNbMatieresRate(param.nb_matieres_rate || DEFAULT_NB_MATIERES_RATE);
      } else {
        setUseRateClassification(false);
        setNbMatieresRate(DEFAULT_NB_MATIERES_RATE);
      }
      setIsLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, schoolYear]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await ClassifiedParamReader.saveClassifiedParamOfYear(
      accessToken,
      connection,
      schoolYear,
      useRateClassification,
      nbMatieresRate,
    );
    setIsSaving(false);

    showToast(result.status ? t.saveSuccess : t.saveFailure, {
      type: result.status ? "info" : "danger",
    });
  };

  return (
    <div className="p-10 flex flex-col items-center">
      {isSaving && <LoadingOverlay />}
      <h1 className="text-2xl font-bold mb-6 text-center uppercase tracking-wide opacity-80">
        {t.title}
      </h1>

      {isLoading ? (
        <Loading />
      ) : (
        <div className="w-full max-w-2xl bg-base-100 rounded-2xl shadow-md p-8 flex flex-col gap-2">
          <label
            className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer ${
              useRateClassification ? "bg-base-200" : ""
            }`}
          >
            <input
              type="radio"
              className="radio radio-primary mt-1"
              checked={useRateClassification}
              onChange={() => setUseRateClassification(true)}
            />
            <div className="flex-1">
              <p className="font-semibold text-primary">{t.optionRateTitle}</p>
              <p className="text-sm opacity-70 mt-1">{t.optionRateDescription}</p>
              {useRateClassification && (
                <div className="mt-4">
                  <input
                    type="range"
                    min={MIN_RATE}
                    max={MAX_RATE}
                    step={1}
                    value={nbMatieresRate}
                    onChange={(e) => setNbMatieresRate(Number(e.target.value))}
                    className="range range-primary w-full"
                  />
                  <p className="text-center font-semibold mt-2">{nbMatieresRate}</p>
                </div>
              )}
            </div>
          </label>

          <label
            className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer ${
              !useRateClassification ? "bg-base-200" : ""
            }`}
          >
            <input
              type="radio"
              className="radio radio-primary mt-1"
              checked={!useRateClassification}
              onChange={() => setUseRateClassification(false)}
            />
            <div className="flex-1">
              <p className="font-semibold text-primary">{t.optionAllTitle}</p>
              <p className="text-sm opacity-70 mt-1">{t.optionAllDescription}</p>
            </div>
          </label>

          <button
            type="button"
            className="btn btn-primary gap-2 self-center mt-4"
            disabled={isSaving}
            onClick={handleSave}
          >
            <Save className="w-4 h-4" />
            {t.saveBtn}
          </button>
        </div>
      )}
    </div>
  );
};

export default ClassifiedParamManager;
