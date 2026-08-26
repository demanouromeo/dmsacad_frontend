import type { Jour, TtConfig, ClasseCell, StaffCell } from "../interfaces/Timetable";
import { computeDayTimeline, type TimelineEntry } from "./timetableTime";

export interface TimetableGridLabels {
  breakLabel: string;
  freeSlotLabel: string;
  noTeacherLabel: string;
}

export type TimetableGridRow =
  | { kind: "break"; label: string }
  | { kind: "period"; label: string; cells: string[] };

// Shared shape the Excel and PDF "export every class" builders both consume - one entry per class.
export interface ClasseTimetableExport {
  classeName: string;
  dayLabels: string[];
  rows: TimetableGridRow[];
}

// Same maxPeriods/timeline derivation TimetableGridView uses (computeDayTimeline when a tt_config
// exists, otherwise a plain numbered fallback with no times) - shared here so the Excel/PDF "export
// every class" builders below produce a timeline identical to what's shown on screen.
export const buildTimetableTimeline = (ttConfig: TtConfig | null, jours: Jour[]): TimelineEntry[] => {
  const maxPeriods = jours.reduce((max, j) => Math.max(max, j.number_of_periods), 0);
  return ttConfig
    ? computeDayTimeline(ttConfig, maxPeriods)
    : Array.from({ length: maxPeriods }, (_, i) => ({
        type: "period" as const,
        period_number: i + 1,
        start: "",
        end: "",
      }));
};

const cellKey = (jourId: number, periodNumber: number) => `${jourId}-${periodNumber}`;

// Reduces one class's cells + the shared timeline/days into plain export rows, mirroring exactly
// what TimetableGridView renders per cell (free slot placeholder both for an empty cell and for a
// day whose own number_of_periods is shorter than this timeline entry, subject+teacher otherwise,
// falling back to noTeacherLabel when a period has a subject but no staff assigned).
export const buildClasseTimetableRows = (
  jours: Jour[],
  timeline: TimelineEntry[],
  cells: ClasseCell[],
  labels: TimetableGridLabels,
): TimetableGridRow[] => {
  const cellMap = new Map<string, ClasseCell>();
  cells.forEach((c) => cellMap.set(cellKey(c.jour_id, c.period_number), c));

  return timeline.map((entry) => {
    if (entry.type === "break") {
      const range = entry.start ? ` (${entry.start} - ${entry.end})` : "";
      return { kind: "break" as const, label: `${labels.breakLabel}${range}` };
    }

    const label = entry.start
      ? `${entry.period_number} (${entry.start}-${entry.end})`
      : String(entry.period_number);

    const rowCells = jours.map((j) => {
      if (entry.period_number > j.number_of_periods) {
        return labels.freeSlotLabel;
      }
      const cell = cellMap.get(cellKey(j.jour_id, entry.period_number));
      if (!cell) {
        return labels.freeSlotLabel;
      }
      const teacher = cell.staff_id
        ? `${cell.staff_name ?? ""} ${cell.staff_surname ?? ""}`.trim()
        : labels.noTeacherLabel;
      return `${cell.subject_title}\n${teacher}`;
    });

    return { kind: "period" as const, label, cells: rowCells };
  });
};

// Days-as-rows/periods-as-columns transpose of the grid above, feeding the official single-page
// "individual time table" export (exportMyTimetablePdf/Xlsx) - a different layout from every other
// timetable view in the app (which is always periods-as-rows), matching the printed weekly-schedule
// form's own convention instead. Break columns carry which/start/end rather than a pre-formatted
// label so the caller can render them in its own document language/units (e.g. "PAUSE 10MIN").
export interface StaffWeeklyGridColumn {
  kind: "period" | "break";
  start: string;
  end: string;
  which?: 1 | 2;
}

export interface StaffWeeklyGridRow {
  dayLabel: string;
  cells: (string | null)[];
}

export const buildStaffWeeklyGrid = (
  jours: Jour[],
  timeline: TimelineEntry[],
  cells: StaffCell[],
): { columns: StaffWeeklyGridColumn[]; rows: StaffWeeklyGridRow[] } => {
  // A combined/commoncourse group legitimately places this teacher in several classes at the same
  // (jour, period) - keep every match per slot (not just the last one written) so a co-taught slot
  // lists every class instead of silently dropping all but one.
  const cellMap = new Map<string, StaffCell[]>();
  cells.forEach((c) => {
    const key = cellKey(c.jour_id, c.period_number);
    const existing = cellMap.get(key);
    if (existing) {
      existing.push(c);
    } else {
      cellMap.set(key, [c]);
    }
  });

  const columns: StaffWeeklyGridColumn[] = timeline.map((entry) =>
    entry.type === "break"
      ? { kind: "break" as const, start: entry.start, end: entry.end, which: entry.which }
      : { kind: "period" as const, start: entry.start, end: entry.end },
  );

  const rows: StaffWeeklyGridRow[] = jours.map((jour) => ({
    dayLabel: jour.label,
    cells: timeline.map((entry) => {
      if (entry.type === "break" || entry.period_number > jour.number_of_periods) {
        return null;
      }
      const matches = cellMap.get(cellKey(jour.jour_id, entry.period_number));
      if (!matches || matches.length === 0) {
        return null;
      }
      const classeNames = matches.map((m) => m.classe_name).join(", ");
      return `${classeNames}\n${matches[0].subject_title}`;
    }),
  }));

  return { columns, rows };
};

// Weekly period count per class this staff member teaches, for the export's "CLASSE / H HEBDO"
// summary row - derived from the same cells array getMyCells already returns (one row per assigned
// (jour, period)), so no extra backend query is needed for either this or heures faites below.
export interface StaffClasseHours {
  classeName: string;
  hours: number;
}

export const computeStaffClasseHours = (cells: StaffCell[]): StaffClasseHours[] => {
  const map = new Map<string, number>();
  cells.forEach((c) => map.set(c.classe_name, (map.get(c.classe_name) ?? 0) + 1));
  return Array.from(map.entries())
    .map(([classeName, hours]) => ({ classeName, hours }))
    .sort((a, b) => a.classeName.localeCompare(b.classeName));
};

// Heures dues (the staff's own weekly cap) vs. heures faites (periods actually assigned this week,
// i.e. cells.length) drive the two derived figures the export's HR header also shows.
export interface StaffHours {
  dues: number;
  faites: number;
  supplementaires: number;
  sousEmployees: number;
}

export const computeStaffHours = (cells: StaffCell[], maxPeriodsPerWeek: number): StaffHours => {
  const faites = cells.length;
  return {
    dues: maxPeriodsPerWeek,
    faites,
    supplementaires: Math.max(0, faites - maxPeriodsPerWeek),
    sousEmployees: Math.max(0, maxPeriodsPerWeek - faites),
  };
};

// Several HR fields on `staff` default to a single space rather than NULL (see the backend's own
// ALTER TABLE comments) - trims that down to a genuine empty check before falling back to a dash,
// same "—" placeholder freeSlotLabel already uses elsewhere on this grid.
export const displayOrDash = (value: string | number | null | undefined): string => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "—";
};
