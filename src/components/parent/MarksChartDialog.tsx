import { useEffect, useRef, useState } from "react";
import { parentPortalTranslations } from "../../i18n/translations";
import { useLanguage } from "../../i18n/useLanguage";

export interface MarksChartEntry {
  id: number;
  label: string;
  // null = no mark recorded for this subject (not a genuine 0).
  mark: number | null;
}

interface MarksChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: MarksChartEntry[];
}

type ChartType = "bar" | "pie";

const MAX_MARK = 20;

// Structurally copied from src/components/admin/marks/FillRateChartDialog.tsx (same
// conic-gradient/width-bar-with-no-chart-lib pattern, same native <dialog> shell) but re-scaled for
// 0-20 marks instead of 0-100 fill rates - bar width is mark/20*100, labels read "x.xx/20" instead
// of "x%". Kept as its own component rather than a prop-driven reuse of FillRateChartDialog since
// the value domain and labeling genuinely differ.
const colorForIndex = (index: number, total: number): string =>
  `hsl(${Math.round((index * 360) / Math.max(total, 1))}, 65%, 55%)`;

const MarksChartDialog = ({ isOpen, onClose, title, entries }: MarksChartDialogProps) => {
  const [language] = useLanguage();
  const t = parentPortalTranslations[language];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chartType, setChartType] = useState<ChartType>("bar");

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const usableEntries = entries.filter(
    (e): e is MarksChartEntry & { mark: number } => e.mark !== null,
  );
  const totalMark = usableEntries.reduce((sum, e) => sum + e.mark, 0);

  const pieSegments = usableEntries.reduce<
    Array<MarksChartEntry & { mark: number; color: string; start: number; end: number }>
  >((acc, e, index) => {
    const share = totalMark > 0 ? (e.mark / totalMark) * 100 : 0;
    const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
    acc.push({ ...e, color: colorForIndex(index, usableEntries.length), start, end: start + share });
    return acc;
  }, []);
  const pieGradient =
    pieSegments.length > 0
      ? `conic-gradient(${pieSegments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(", ")})`
      : undefined;

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">{title}</h3>

        <div className="join mb-4">
          <button
            type="button"
            className={`btn btn-sm join-item ${chartType === "bar" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setChartType("bar")}
          >
            {t.chartBarLabel}
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${chartType === "pie" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setChartType("pie")}
          >
            {t.chartPieLabel}
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="opacity-60">{t.chartEmpty}</p>
        ) : chartType === "bar" ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {entries.map((e, index) => (
              <div key={e.id} className="flex items-center gap-2">
                <span className="w-48 shrink-0 truncate text-sm" title={e.label}>
                  {index + 1} - {e.label}
                </span>
                <div className="flex-1 bg-base-200 rounded h-4 overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${((e.mark ?? 0) / MAX_MARK) * 100}%`,
                      backgroundColor: colorForIndex(index, entries.length),
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-sm text-right">
                  {e.mark === null ? "…" : `${e.mark.toFixed(2)}/20`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div
              className="w-52 h-52 rounded-full shrink-0"
              style={{ background: pieGradient ?? "var(--fallback-b2,oklch(var(--b2)))" }}
            />
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {pieSegments.map((e, index) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: e.color }}
                  />
                  <span className="truncate" title={e.label}>
                    {index + 1} - {e.label}
                  </span>
                  <strong className="ml-auto">{e.mark.toFixed(2)}/20</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.chartCloseBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>{t.chartCloseBtn}</button>
      </form>
    </dialog>
  );
};

export default MarksChartDialog;
