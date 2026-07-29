// Fixed per-role chart colors, deliberately not reusing this app's daisyUI success/error hues
// (green/red already carry a status meaning here via toasts) - see EffectifsCharts.tsx.
export const CHART_COLOR_GARCONS = "#3987e5"; // blue
export const CHART_COLOR_FILLES = "#9085e9"; // violet
export const CHART_COLOR_NOUVEAUX = "#3987e5"; // blue
export const CHART_COLOR_REDOUBLANTS = "#d95926"; // orange
export const CHART_COLOR_CYCLE_1 = "#3987e5"; // blue
export const CHART_COLOR_CYCLE_2 = "#9085e9"; // violet

// Recharts chrome (axes/grid/tooltip) against this app's fixed dark theme (src/index.css,
// daisyUI theme "dmsacad") - Recharts' own defaults assume a light surface.
export const CHART_AXIS_COLOR = "#898781"; // muted ink
export const CHART_GRID_COLOR = "#3a3a38"; // one step off the dark base-100 surface
export const CHART_TOOLTIP_BG = "#232320"; // ~= --color-base-200
export const CHART_TOOLTIP_BORDER = "rgba(255,255,255,0.10)";
export const CHART_TEXT_COLOR = "#ffffff";

// Status pair (dark-surface steps) for a completion/threshold encoding (e.g. mark entry's fill
// rate: fully filled vs still missing marks) - distinct from the identity colors above, reserved
// per the dataviz skill's rule that status color is never reused for series identity.
export const CHART_STATUS_GOOD = "#0ca30c"; // complete
export const CHART_STATUS_WARNING = "#fab219"; // incomplete

// Fixed, ordered categorical palette (dark-surface steps) for an unbounded-cardinality identity
// series (e.g. one color per subject in mark entry's fill-rate pie) - the same eight hues/order
// as this skill's validated reference palette (see EffectifsCharts.tsx's 3-color subset above).
// Order is the CVD-safety mechanism, not cosmetic - don't reorder. Cap at 8: fold any entry past
// the 7th into a single grouped "Autres" slice rather than generating a 9th hue.
export const CHART_CATEGORICAL_COLORS = [
  "#3987e5", // blue
  "#008300", // green
  "#d55181", // magenta
  "#c98500", // yellow
  "#199e70", // aqua
  "#d95926", // orange
  "#9085e9", // violet
  "#e66767", // red
];
export const CHART_CATEGORICAL_CAP = CHART_CATEGORICAL_COLORS.length;
export const CHART_COLOR_OTHERS = "#6b6a66"; // muted gray for the folded "Autres" slice
