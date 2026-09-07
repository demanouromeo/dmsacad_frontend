import { useEffect, useRef } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { basculementManagerTranslations } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/useLanguage";
import {
  CHART_COLOR_EXCLUS,
  CHART_COLOR_REDOUBLANTS,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
} from "../../../utils/chartPalette";

interface BasculementStatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classeName: string;
  total: number;
  exclus: number;
  redoublants: number;
}

interface StatTileProps {
  label: string;
  value: number;
}

const StatTile = ({ label, value }: StatTileProps) => (
  <div className="bg-base-200 rounded-xl px-4 py-3 text-center flex-1 min-w-[7rem]">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs uppercase tracking-wider text-base-content/55 mt-1">{label}</div>
  </div>
);

const tooltipStyle = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: "0.5rem",
  color: CHART_TEXT_COLOR,
};

// Same native <dialog> pattern as FillRateChartDialog/TopBanner's dialogs. Every student still
// sitting in the left panel's leftRows (see BasculementManager.tsx) is, by this screen's own
// design, either dismissed or a repeater-in-place - a student who has actually been promoted gets
// moved out of leftRows via "Basculer" - so exclus + redoublants always equals total; the pie
// below illustrates that split rather than treating "redoublants" as a separately computed
// academic decision.
const BasculementStatsDialog = ({
  isOpen,
  onClose,
  classeName,
  total,
  exclus,
  redoublants,
}: BasculementStatsDialogProps) => {
  const [language] = useLanguage();
  const t = basculementManagerTranslations[language];
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  const pieData = [
    { key: "exclus", label: t.statsExclusLabel, value: exclus, color: CHART_COLOR_EXCLUS },
    { key: "redoublants", label: t.statsRedoublantsLabel, value: redoublants, color: CHART_COLOR_REDOUBLANTS },
  ];

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg mb-4">{t.statsTitle(classeName)}</h3>

        <div className="flex flex-wrap gap-3 mb-6">
          <StatTile label={t.statsTotalLabel} value={total} />
          <StatTile label={t.statsExclusLabel} value={exclus} />
          <StatTile label={t.statsRedoublantsLabel} value={redoublants} />
        </div>

        {total === 0 ? (
          <p className="opacity-60">{t.statsEmpty}</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={200} height={200} className="shrink-0">
              <PieChart>
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: CHART_TEXT_COLOR }}
                  formatter={(value, _name, item) => [
                    `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
                    item.payload.label,
                  ]}
                />
                <Pie data={pieData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90}>
                  {pieData.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2">
              {pieData.map((slice) => (
                <li key={slice.key} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <span>{slice.label}</span>
                  <strong className="ml-auto">
                    {slice.value} ({total > 0 ? ((slice.value / total) * 100).toFixed(1) : "0.0"}%)
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t.statsCloseBtn}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>{t.statsCloseBtn}</button>
      </form>
    </dialog>
  );
};

export default BasculementStatsDialog;
