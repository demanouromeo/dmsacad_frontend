import { Fragment, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Search } from "lucide-react";
import { useAuth } from "../../../auth/useAuth";
import { useToast } from "../../../toast/useToast";
import { useLanguage } from "../../../i18n/useLanguage";
import { studentManagerTranslations } from "../../../i18n/translations";
import { StudentReader } from "../../../dbmanger/StudentReader";
import type { StudentSearchResult } from "../../../interfaces/StudentSearchResult";
import StudentPhotoCell from "./StudentPhotoCell";
import { capitalizeSectionName } from "../../../utils/exportData";

// Same cleanup StudentReader applies to its own rows: drop a "T00:00:00.000Z" time part.
const formatBday = (bday: string | null): string => {
  if (!bday) {
    return "-";
  }
  const match = /^(d{4}-d{2}-d{2})T/.exec(bday);
  return match ? match[1] : bday;
};

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
  // Row keys whose details line (sexe / lieu / date de naissance / redouble) is currently shown.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Every way of closing (button, Escape, backdrop) lands here: clear the previous search so the
  // next opening starts blank, then tell the parent.
  const handleClose = () => {
    setQuery("");
    setResults(null);
    setExpandedKeys(new Set());
    onClose();
  };

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
    setExpandedKeys(new Set());
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={handleClose}>
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
                  <th>{t.searchStudentColMore}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, index) => {
                  const rowKey = `${r.stud_id}-${r.year ?? ""}-${r.classe_name ?? ""}-${index}`;
                  const isOpen = expandedKeys.has(rowKey);
                  return (
                  <Fragment key={rowKey}>
                  <tr>
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
                    <td>
                      <div className="tooltip tooltip-left" data-tip={t.searchStudentMoreTooltip}>
                        <button
                          type="button"
                          className="btn btn-xs btn-ghost btn-square"
                          aria-label={t.searchStudentMoreTooltip}
                          aria-expanded={isOpen}
                          onClick={() => toggleExpanded(rowKey)}
                        >
                          {isOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-base-200/50">
                        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                          <span>
                            {t.tableHeaderSexe}: <b>{r.sexe ?? "-"}</b>
                          </span>
                          <span>
                            {t.tableHeaderBplace}: <b>{r.bplace || "-"}</b>
                          </span>
                          <span>
                            {t.tableHeaderBday}: <b>{formatBday(r.bday)}</b>
                          </span>
                          <span>
                            {t.tableHeaderRepeating}:{" "}
                            <b>{r.repeating === null ? "-" : r.repeating === 1 ? t.searchStudentYes : t.searchStudentNo}</b>
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results !== null && results.length >= MAX_RESULTS && (
          <p className="text-xs opacity-70 mt-2">{t.searchStudentTruncated}</p>
        )}

        <div className="modal-action">
          <button type="button" className="btn" onClick={handleClose}>
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
