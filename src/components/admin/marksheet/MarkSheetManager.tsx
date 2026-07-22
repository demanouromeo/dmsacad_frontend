import { useState } from "react";
import { FileText } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { markSheetManagerTranslations } from "../../../i18n/translations";
import { ClasseReader } from "../../../dbmanger/ClasseReader";
import { StudentReader } from "../../../dbmanger/StudentReader";
import { buildTimestampedFilename, capitalizeSectionName } from "../../../utils/exportData";
import { exportMarkSheetsToPdf, type MarkSheetClasse } from "../../../utils/exportMarkSheets";
import LoadingOverlay from "../../sharedcomp/LoadingOverlay";

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    const [classes, apcLevelList] = await Promise.all([
      ClasseReader.fetchClasses(accessToken, connection, schoolYear, section),
      ClasseReader.fetchApcLevels(accessToken, connection, schoolYear, section),
    ]);
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
        [`Section ${capitalizeSectionName(section)}`],
        "pdf",
      ),
    );
    setIsGenerating(false);
  };

  return (
    <div className="page-shell">
      {isGenerating && <LoadingOverlay />}
      <h1 className="page-title mb-4">{t.title}</h1>
      <div className="surface-card p-6 md:p-8 max-w-2xl">
        <p className="text-base-content/70 mb-6">{t.description}</p>
        <button
          type="button"
          className="btn btn-primary gap-2"
          disabled={isGenerating}
          onClick={handleGenerate}
        >
          <FileText className="w-4 h-4" />
          {t.generateBtn}
        </button>
      </div>
    </div>
  );
};

export default MarkSheetManager;
