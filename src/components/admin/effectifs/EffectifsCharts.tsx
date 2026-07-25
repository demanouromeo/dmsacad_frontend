import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sumSections, type SectionEffectif } from "../../../utils/effectifs";
import {
  buildClasseGenderRows,
  buildClasseRepeatRows,
  buildCycleGroupRows,
  type ClasseGenderRow,
  type ClasseRepeatRow,
} from "../../../utils/effectifsCharts";
import {
  CHART_AXIS_COLOR,
  CHART_COLOR_CYCLE_1,
  CHART_COLOR_CYCLE_2,
  CHART_COLOR_FILLES,
  CHART_COLOR_GARCONS,
  CHART_COLOR_NOUVEAUX,
  CHART_COLOR_REDOUBLANTS,
  CHART_GRID_COLOR,
  CHART_TEXT_COLOR,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
} from "../../../utils/chartPalette";

interface EffectifsChartsProps {
  sections: SectionEffectif[];
}

const sectionDisplayName = (section: string): string =>
  section === "anglophone" ? "Anglophone" : "Francophone";

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

const legendStyle = { color: CHART_TEXT_COLOR, fontSize: "0.8rem" };

// Two classe-scoped horizontal stacked bars (Garçons/Filles, Nouveaux/Redoublants) - same shape
// for chart #2 and #3, kept as separate (non-generic) components since Recharts v3's typed
// `dataKey` prop doesn't accept a keyof-derived string cleanly.
const classeBarCommonProps = (rowCount: number) => ({
  height: Math.max(200, rowCount * 32 + 40),
});

const GenderStackedBar = ({ data }: { data: ClasseGenderRow[] }) => (
  <ResponsiveContainer width="100%" height={classeBarCommonProps(data.length).height}>
    <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
      <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
      <XAxis type="number" allowDecimals={false} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} />
      <YAxis
        type="category"
        dataKey="classe_name"
        width={90}
        stroke={CHART_AXIS_COLOR}
        tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
      />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: CHART_TEXT_COLOR }} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
      <Legend wrapperStyle={legendStyle} />
      <Bar dataKey="garcons" name="Garçons" stackId="a" fill={CHART_COLOR_GARCONS} radius={[0, 4, 4, 0]} />
      <Bar dataKey="filles" name="Filles" stackId="a" fill={CHART_COLOR_FILLES} radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

const RepeatStackedBar = ({ data }: { data: ClasseRepeatRow[] }) => (
  <ResponsiveContainer width="100%" height={classeBarCommonProps(data.length).height}>
    <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
      <CartesianGrid horizontal={false} stroke={CHART_GRID_COLOR} />
      <XAxis type="number" allowDecimals={false} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} />
      <YAxis
        type="category"
        dataKey="classe_name"
        width={90}
        stroke={CHART_AXIS_COLOR}
        tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
      />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: CHART_TEXT_COLOR }} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
      <Legend wrapperStyle={legendStyle} />
      <Bar dataKey="nouveaux" name="Nouveaux" stackId="a" fill={CHART_COLOR_NOUVEAUX} radius={[0, 4, 4, 0]} />
      <Bar dataKey="redoublants" name="Redoublants" stackId="a" fill={CHART_COLOR_REDOUBLANTS} radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

// KPI row + three Recharts charts (per-classe gender split, per-classe repeat-status split,
// cycle-vs-section grouped comparison) visualising the same numbers the report table already
// shows - on-screen only, not part of the CSV/PDF export. See the module's plan for the form/
// color reasoning (no pie, no reuse of the app's success/error green-red for identity series).
const EffectifsCharts = ({ sections }: EffectifsChartsProps) => {
  const grandTotal = sumSections(sections);
  const cycleRows = buildCycleGroupRows(sections);

  return (
    <div className="surface-card p-4 md:p-6 mb-6 space-y-8">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-base-content/55 mb-3">
          Vue d'ensemble
        </h3>
        <div className="flex flex-wrap gap-3">
          <StatTile label="Total élèves" value={grandTotal.total} />
          <StatTile label="Garçons" value={grandTotal.garcons} />
          <StatTile label="Filles" value={grandTotal.filles} />
          <StatTile label="Nouveaux" value={grandTotal.nouveaux} />
          <StatTile label="Redoublants" value={grandTotal.redoublants} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-base-content/55 mb-3">
          Répartition par cycle
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cycleRows} margin={{ left: 8, right: 16 }}>
            <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="section"
              tickFormatter={sectionDisplayName}
              stroke={CHART_AXIS_COLOR}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
            />
            <YAxis allowDecimals={false} stroke={CHART_AXIS_COLOR} tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: CHART_TEXT_COLOR }}
              labelFormatter={(label) => sectionDisplayName(String(label))}
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
            />
            <Legend wrapperStyle={legendStyle} />
            <Bar dataKey="cycle1" name="Cycle 1" fill={CHART_COLOR_CYCLE_1} radius={[4, 4, 0, 0]} />
            <Bar dataKey="cycle2" name="Cycle 2" fill={CHART_COLOR_CYCLE_2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {sections.map((section) => (
        <div key={section.section} className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-base-content/55 mb-3">
              Garçons / Filles — {sectionDisplayName(section.section)}
            </h3>
            <GenderStackedBar data={buildClasseGenderRows(section)} />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-base-content/55 mb-3">
              Nouveaux / Redoublants — {sectionDisplayName(section.section)}
            </h3>
            <RepeatStackedBar data={buildClasseRepeatRows(section)} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default EffectifsCharts;
