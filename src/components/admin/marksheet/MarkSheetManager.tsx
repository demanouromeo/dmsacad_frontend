import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { markSheetManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import type { Classe } from "../../../interfaces/Classe";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import { exportMarkSheetsToPdf, type MarkSheetClasse } from "../../../utils/exportMarkSheets";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";
import CloseButton from "../../sharedcomp/CloseButton";

// "Fiches de report de notes" - a one-button screen, not a CRUD/list manager like the rest of
// /admin/*. There's nothing to review or edit on screen: the output is a blank paper form per
// classe (see exportMarkSheets.ts), so clicking "Generate" is the entire feature - it fetches every
// classe of the current section+year plus each one's roster, then hands the whole batch to
// exportMarkSheetsToPdf in one PDF (skipping classes with no students, same precedent as
// AllMarksReportBlock in exportAllMarksReport.ts).
const MarkSheetManager = () => {
  const { connection, schoolYear, section, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = markSheetManagerTranslations[language];
  const [isGenerating, setIsGenerating] = useState(false);
  // Classes of the current section+year, backing the single-classe dropdown below.
  const [classeOptions, setClasseOptions] = useState<Classe[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await ClasseReader.fetchClasses(accessToken, connection, schoolYear, section);
      if (cancelled) {
        return;
      }
      setClasseOptions(list);
      setSelectedClasseId((prev) =>
        prev !== null && list.some((c) => c.classe_id === prev) ? prev : (list[0]?.classe_id ?? null),
      );
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [connection, schoolYear, section, accessToken]);

  // Without `onlyClasseId`, one sheet per classe of the section; with it, just that classe's sheet.
  const handleGenerate = async (onlyClasseId?: number) => {
    setIsGenerating(true);
    // The dropdown already loaded the classes - reuse them instead of fetching again, so a single
    // classe's sheet doesn't depend on a second (possibly failing) classes request.
    const [allClasses, apcLevelList] = await Promise.all([
      classeOptions.length > 0
        ? Promise.resolve(classeOptions)
        : ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
      ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
    ]);
    const classes =
      onlyClasseId === undefined ? allClasses : allClasses.filter((c) => c.classe_id === onlyClasseId);
    if (classes.length === 0) {
      setIsGenerating(false);
      showToast(t.emptyClasses, { type: "warning" });
      return;
    }
    const apcLevelMap = new Map(apcLevelList.map((entry) => [entry.level, entry.activated]));

    const perClasse = await Promise.all(
      classes.map(async (classe): Promise<MarkSheetClasse | null> => {
        const roster = await StudentReader.fetchStudentsOfClasse(
          accessToken,
          connection,
          schoolYear,
          classe.classe_id,
        );
        if (roster.length === 0) {
          return null;
        }
        return {
          classeName: classe.classe_name,
          isApc: apcLevelMap.get(classe.level) === true,
          students: roster.map((s) => ({ name: s.name, surname: s.surname })),
        };
      }),
    );
    const markSheetClasses = perClasse.filter((c): c is MarkSheetClasse => c !== null);
    if (markSheetClasses.length === 0) {
      setIsGenerating(false);
      showToast(t.emptyRosters, { type: "warning" });
      return;
    }

    await exportMarkSheetsToPdf(
      markSheetClasses,
      buildTimestampedFilename(
        "Fiches de report de notes",
        [
          onlyClasseId === undefined
            ? `Section ${capitalizeSectionName(section)}`
            : `Classe ${classes[0].classe_name}`,
        ],
        "pdf",
      ),
    );
    setIsGenerating(false);
  };

  return (
    <div className="page-shell">
      {isGenerating && <LoadingOverlay />}
      <div className="page-header">
        <h1 className="page-title">{t.title}</h1>
        <CloseButton />
      </div>
      <div className="surface-card p-6 md:p-8 max-w-2xl">
        <p className="text-base-content/70 mb-6">{t.description}</p>
        <button
          type="button"
          className="btn btn-primary gap-2"
          title={t.generateTooltip}
          disabled={isGenerating}
          onClick={() => handleGenerate()}
        >
          <FileText className="w-4 h-4" />
          {t.generateBtn}
        </button>
      </div>

      <div className="surface-card p-6 md:p-8 max-w-2xl mt-6">
        <p className="text-base-content/70 mb-6">{t.singleDescription}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="font-medium">{t.classeLabel}</label>
          <select
            className="select w-56"
            value={selectedClasseId ?? ""}
            disabled={classeOptions.length === 0}
            onChange={(e) => setSelectedClasseId(Number(e.target.value))}
          >
            {classeOptions.map((c) => (
              <option key={c.classe_id} value={c.classe_id}>
                {c.classe_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary gap-2"
            title={t.generateOneTooltip}
            disabled={isGenerating || selectedClasseId === null}
            onClick={() => selectedClasseId !== null && handleGenerate(selectedClasseId)}
          >
            <FileText className="w-4 h-4" />
            {t.generateOneBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MarkSheetManager;
