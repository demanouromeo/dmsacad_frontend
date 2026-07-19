import { useEffect, useRef, useState } from "react";
import { markEntryManagerTranslations } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/useLanguage";

export interface FillRateChartEntry {
  id: number;
  label: string;
  rate: number | null;
}

interface FillRateChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: FillRateChartEntry[];
}

type ChartType = "bar" | "pie";

// Deterministic, evenly-spaced hue per subject index (not tied to fill rate value) so a given
// subject keeps the same color between the bar and pie views and across re-renders.
const colorForIndex = (index: number, total: number): string =>
  `hsl(${Math.round((index * 360) / Math.max(total, 1))}, 65%, 55%)`;

// Same native <dialog> + modal/modal-box/modal-backdrop pattern as TopBanner's year/section
// dialogs and StudentPhotoDialog - a single shared instance owned by MarkEntryManager, opened via
// the `isOpen` prop rather than the parent reaching into a ref. No charting library is pulled in
// (bar = plain width-percentage divs, pie = a CSS conic-gradient) - matches this app's existing
// "avoid a dependency for something this simple" precedent (CSV over xlsx, no PDF lib for anything
// but the actual PDF export).
const FillRateChartDialog = ({ isOpen, onClose, title, entries }: FillRateChartDialogProps) => {
  const [language] = useLanguage();
  const t = markEntryManagerTranslations[language];
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
    (e): e is FillRateChartEntry & { rate: number } => e.rate !== null,
  );
  const totalRate = usableEntries.reduce((sum, e) => sum + e.rate, 0);

  const pieSegments = usableEntries.reduce<
    Array<FillRateChartEntry & { rate: number; color: string; start: number; end: number }>
  >((acc, e, index) => {
    const share = totalRate > 0 ? (e.rate / totalRate) * 100 : 0;
    const start = acc.length > 0 ? acc[acc.length - 1].end : 0;
    acc.push({ ...e, color: colorForIndex(index, usableEntries.length), start, end: start + share });
    return acc;
  }, []);
  const pieGradient =
    pieSegments.length > 0
      ? `conic-gradient(${pieSegments
          .map((s) => `${s.color} ${s.start}% ${s.end}%`)
          .join(", ")})`
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
            {t.fillRateChartBarLabel}
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item ${chartType === "pie" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setChartType("pie")}
          >
            {t.fillRateChartPieLabel}
          </button>
        </div>

        {entries.length === 0 ? (
          <p className="opacity-60">{t.fillRateChartEmpty}</p>
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
                      width: `${e.rate ?? 0}%`,
                      backgroundColor:
                        e.rate !== null && e.rate < 100
                          ? "var(--color-error, #ef4444)"
                          : colorForIndex(index, entries.length),
                    }}
                  />
                </div>
                <span className="w-14 shrink-0 text-sm text-right">
                  {e.rate === null ? "…" : `${e.rate.toFixed(1)}%`}
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
                  <strong className="ml-auto">{e.rate.toFixed(1)}%</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.fillRateChartCloseBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>{t.fillRateChartCloseBtn}</button>
      </form>
    </dialog>
  );
};

export default FillRateChartDialog;
