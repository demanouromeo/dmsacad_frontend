import { useEffect, useRef, useState } from "react";
import { markScanTranslations } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/useLanguage";
import type { Student } from "../../../interfaces/Student";
import { parseOcrMark, type OcrCellsBySequence } from "../../../utils/markSheetOcr";

export interface ScanImportRow {
  stud_id: number;
  mark: number;
}

interface MarkSheetScanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subjectTitle: string;
  result: OcrCellsBySequence;
  roster: Student[];
  lockedSeqs: Set<number>;
  // Columns offered for import: 1..n sequences (non-APC) or competence ranks (APC, with their texts).
  columns: number[];
  isApc: boolean;
  competenceTexts: string[];
  onValidate: (rowsBySeq: Map<number, ScanImportRow[]>) => void;
}

const cellKey = (seq: number, studId: number) => `${seq}:${studId}`;

// Step 2 of the "scan a handwritten mark sheet" flow (MarkEntryManager owns step 1, the OCR run):
// lists the sequences that had handwriting, lets the user tick which to import, and lists every
// unreadable/invalid cell with an input to correct it (prefilled with the OCR's raw guess). Same
// native <dialog> pattern as FillRateChartDialog; the parent remounts it (key) for each new scan.
const MarkSheetScanDialog = ({
  isOpen,
  onClose,
  subjectTitle,
  result,
  roster,
  lockedSeqs,
  columns,
  isApc,
  competenceTexts,
  onValidate,
}: MarkSheetScanDialogProps) => {
  const [language] = useLanguage();
  const t = markScanTranslations[language];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detectedSeqs = columns.filter((seq) => (result.get(seq)?.size ?? 0) > 0);
  const emptySeqs = columns.filter((seq) => !detectedSeqs.includes(seq));
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(detectedSeqs.filter((seq) => !lockedSeqs.has(seq))),
  );
  const [corrections, setCorrections] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    result.forEach((cells, seq) =>
      cells.forEach((cell, studId) => {
        if (cell.status !== "valid") {
          initial[cellKey(seq, studId)] = cell.raw;
        }
      }),
    );
    return initial;
  });

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const studentName = (studId: number) => {
    const s = roster.find((r) => r.stud_id === studId);
    return s ? `${s.name} ${s.surname ?? ""}`.trim() : String(studId);
  };

  // Valid cells plus any issue the user has since corrected into a valid mark, per sequence.
  const rowsOfSeq = (seq: number): ScanImportRow[] => {
    const rows: ScanImportRow[] = [];
    result.get(seq)?.forEach((cell, studId) => {
      if (cell.status === "valid") {
        rows.push({ stud_id: studId, mark: cell.value as number });
        return;
      }
      const fixed = parseOcrMark(corrections[cellKey(seq, studId)] ?? "");
      if (fixed.status === "valid") {
        rows.push({ stud_id: studId, mark: fixed.value });
      }
    });
    return rows;
  };

  const label = (n: number) => (isApc ? t.competenceLabel(n, competenceTexts[n - 1] ?? "") : t.sequenceLabel(n));
  const seqList = (seqs: readonly number[]) => seqs.map(label).join(", ");
  const importableCount = [...selected].reduce((n, seq) => n + rowsOfSeq(seq).length, 0);
  const selectedSorted = [...selected].sort((a, b) => a - b);

  const toggle = (seq: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) {
        next.delete(seq);
      } else {
        next.add(seq);
      }
      return next;
    });

  const handleValidate = () => {
    const rowsBySeq = new Map<number, ScanImportRow[]>();
    selectedSorted.forEach((seq) => {
      const rows = rowsOfSeq(seq);
      if (rows.length > 0) {
        rowsBySeq.set(seq, rows);
      }
    });
    onValidate(rowsBySeq);
  };

  const issueRows = selectedSorted.flatMap((seq) =>
    [...(result.get(seq)?.entries() ?? [])]
      .filter(([, cell]) => cell.status !== "valid")
      .map(([studId, cell]) => ({ seq, studId, cell })),
  );

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-3">{t.dialogTitle(subjectTitle)}</h3>
        <p className="mb-1">{t.detectedIntro(seqList(detectedSeqs))}</p>
        {emptySeqs.length > 0 && (
          <p className="mb-3 text-base-content/70">{t.emptySeqs(seqList(emptySeqs))}</p>
        )}

        <p className="font-medium mb-2">{isApc ? t.chooseComps : t.chooseSeqs}</p>
        <div className="flex flex-col gap-2 mb-4">
          {detectedSeqs.map((seq) => {
            const cells = [...(result.get(seq)?.values() ?? [])];
            const issues = cells.filter((c) => c.status !== "valid").length;
            const locked = lockedSeqs.has(seq);
            return (
              <label key={seq} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={selected.has(seq)}
                  disabled={locked}
                  onChange={() => toggle(seq)}
                />
                <span className="font-medium">{label(seq)}</span>
                <span className="text-sm text-base-content/70">
                  {t.sequenceSummary(cells.length - issues, issues)}
                  {locked && ` - ${t.lockedSeq}`}
                </span>
              </label>
            );
          })}
        </div>

        {issueRows.length > 0 && (
          <>
            <p className="font-medium mb-2">{t.issuesTitle}</p>
            <div className="max-h-56 overflow-y-auto flex flex-col gap-1 mb-4">
              {issueRows.map(({ seq, studId, cell }) => (
                <div key={cellKey(seq, studId)} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate">{label(seq)}</span>
                  <span className="grow truncate">{studentName(studId)}</span>
                  <span className="text-warning shrink-0">
                    {cell.status === "invalid" ? t.issueInvalid : t.issueUnreadable}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="input input-sm w-20"
                    value={corrections[cellKey(seq, studId)] ?? ""}
                    onChange={(e) =>
                      setCorrections((prev) => ({ ...prev, [cellKey(seq, studId)]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            {t.cancelBtn}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={importableCount === 0}
            onClick={handleValidate}
          >
            {t.validateBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label={t.cancelBtn} />
      </form>
    </dialog>
  );
};

export default MarkSheetScanDialog;
