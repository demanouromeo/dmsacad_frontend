import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { markEntryManagerTranslations } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  CHART_AXIS_COLOR,
  CHART_CATEGORICAL_CAP,
  CHART_CATEGORICAL_COLORS,
  CHART_COLOR_OTHERS,
  CHART_GRID_COLOR,
  CHART_STATUS_GOOD,
  CHART_STATUS_WARNING,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
} from "../../../utils/chartPalette";

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

interface BarRow {
  id: number;
  displayLabel: string;
  rate: number;
}

interface PieSlice {
  id: number;
  label: string;
  displayLabel: string;
  rate: number;
  color: string;
}

const tooltipStyle = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: "0.5rem",
  color: CHART_TEXT_COLOR,
};

// Same native <dialog> + modal/modal-box/modal-backdrop pattern as TopBanner's year/section
// dialogs and StudentPhotoDialog - a single shared instance owned by MarkEntryManager, opened via
// the `isOpen` prop rather than the parent reaching into a ref. Charts are rendered with Recharts,
// following this app's established Recharts + chartPalette.ts convention (see EffectifsCharts.tsx)
// rather than the hand-rolled CSS bars/conic-gradient this dialog used previously.
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

  // Bar view is a completion/threshold status (fully filled vs still missing marks), not a
  // per-subject identity - colored via the shared status pair rather than a categorical hue.
  const barRows: BarRow[] = entries.map((e, index) => ({
    id: e.id,
    displayLabel: `${index + 1} - ${e.label}`,
    rate: e.rate ?? 0,
  }));

  // Pie view is per-subject identity, an unbounded-cardinality series - cap direct colors at the
  // palette size and fold any remainder into one grouped "Autres" slice instead of generating
  // another hue past the cap (see chartPalette.ts).
  const usableEntries = entries.filter(
    (e): e is FillRateChartEntry & { rate: number } => e.rate !== null,
  );
  const directCount = Math.min(usableEntries.length, CHART_CATEGORICAL_CAP - 1);
  const pieSlices: PieSlice[] = usableEntries.slice(0, directCount).map((e, index) => ({
    id: e.id,
    label: e.label,
    displayLabel: `${index + 1} - ${e.label}`,
    rate: e.rate,
    color: CHART_CATEGORICAL_COLORS[index],
  }));
  const remaining = usableEntries.slice(directCount);
  if (remaining.length > 0) {
    pieSlices.push({
      id: -1,
      label: t.fillRateChartOthers,
      displayLabel: `${t.fillRateChartOthers} (${remaining.length})`,
      rate: remaining.reduce((sum, e) => sum + e.rate, 0),
      color: CHART_COLOR_OTHERS,
    });
  }
  const pieTotal = pieSlices.reduce((sum, s) => sum + s.rate, 0);
  const pieSharePct = (rate: number) => (pieTotal > 0 ? ((rate / pieTotal) * 100).toFixed(1) : "0.0");

  const barChartHeight = Math.max(200, barRows.length * 32 + 40);

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
          <div className="max-h-96 overflow-y-auto">
            <ResponsiveContainer width="100%" height={barChartHeight}>
              <BarChart data={barRows} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  stroke={CHART_AXIS_COLOR}
                  tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="displayLabel"
                  width={160}
                  stroke={CHART_AXIS_COLOR}
                  tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TEXT_COLOR }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, t.fillRateChartRateLabel]}
                  cursor={{ fill: "rgba(255,255,255,0.06)" }}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {barRows.map((row) => (
                    <Cell
                      key={row.id}
                      fill={row.rate >= 100 ? CHART_STATUS_GOOD : CHART_STATUS_WARNING}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={220} height={220} className="shrink-0">
              <PieChart>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TEXT_COLOR }}
                  formatter={(value) => [`${pieSharePct(Number(value))}%`, t.fillRateChartRateLabel]}
                />
                <Pie data={pieSlices} dataKey="rate" nameKey="displayLabel" outerRadius={100}>
                  {pieSlices.map((slice) => (
                    <Cell key={slice.id} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {pieSlices.map((slice) => (
                <li key={slice.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate" title={slice.label}>
                    {slice.displayLabel}
                  </span>
                  <strong className="ml-auto">{pieSharePct(slice.rate)}%</strong>
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
