import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { studentManagerTranslations } from "../../../i18n/translations";
import { StudentReader } from "../../../dbmanger/StudentReader";
import type { StudentSearchResult } from "../../../interfaces/StudentSearchResult";
import StudentPhotoCell from "./StudentPhotoCell";
import { capitalizeSectionName } from "../../../utils/exportData";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 200;

interface StudentSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

// Whole-school student finder (every section and school year), independent of the screen's own
// classe/year/section. Native <dialog>, same pattern as StudentPhotoDialog/ChangeClasseDialog.
// Results are read-only: Nº, photo, name, school year, section, classe.
const StudentSearchDialog = ({ open, onClose }: StudentSearchDialogProps) => {
  const { connection, accessToken } = useAuth();
  const showToast = useToast();
  const [language] = useLanguage();
  const t = studentManagerTranslations[language];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      setQuery("");
      setResults(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      showToast(t.searchStudentTooShort, { type: "warning" });
      return;
    }
    setIsSearching(true);
    const found = await StudentReader.searchStudents(accessToken, connection, trimmed);
    setIsSearching(false);
    if (found === null) {
      showToast(t.searchStudentFailure, { type: "danger" });
      return;
    }
    setResults(found);
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box w-11/12 max-w-4xl">
        <h3 className="font-bold text-lg mb-4">{t.searchStudentDialogTitle}</h3>

        <form
          className="flex gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <input
            type="text"
            className="input w-full"
            placeholder={t.searchStudentPlaceholder}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary gap-2" disabled={isSearching}>
            <Search className="w-4 h-4" />
            {t.searchStudentBtn}
          </button>
        </form>

        {isSearching && <p className="text-sm">…</p>}

        {!isSearching && results !== null && results.length === 0 && (
          <p className="empty-state">{t.searchStudentNoResult}</p>
        )}

        {!isSearching && results !== null && results.length > 0 && (
          <div className="overflow-x-auto max-h-96">
            <table className="table table-zebra data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.tableHeaderPhoto}</th>
                  <th>{t.searchStudentColName}</th>
                  <th>{t.searchStudentColYear}</th>
                  <th>{t.searchStudentColSection}</th>
                  <th>{t.searchStudentColClasse}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, index) => (
                  <tr key={`${r.stud_id}-${r.year ?? ""}-${r.classe_name ?? ""}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <StudentPhotoCell studId={r.stud_id} refreshVersion={0} onClick={() => {}} />
                    </td>
                    <td>
                      {r.name} {r.surname ?? ""}
                      {r.matricule ? (
                        <span className="block text-xs opacity-60">{r.matricule}</span>
                      ) : null}
                    </td>
                    <td>{r.year ?? "-"}</td>
                    <td>{r.section ? capitalizeSectionName(r.section) : "-"}</td>
                    <td>{r.classe_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results !== null && results.length >= MAX_RESULTS && (
          <p className="text-xs opacity-70 mt-2">{t.searchStudentTruncated}</p>
        )}

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            {t.searchStudentCloseBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label={t.searchStudentCloseBtn} />
      </form>
    </dialog>
  );
};

export default StudentSearchDialog;
