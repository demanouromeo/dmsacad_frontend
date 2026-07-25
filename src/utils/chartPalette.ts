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
