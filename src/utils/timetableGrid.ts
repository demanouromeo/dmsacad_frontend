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

// Reduces one staff member's own cells into the same TimetableGridRow shape "My Timetable" needs, so
// it can reuse the classe exporters/grid rendering unchanged. Unlike buildClasseTimetableRows, a
// staff member's cells are already unique per day/period (a teacher can't be in two places at once),
// so the day columns here are keyed the same way but each cell shows the classe name instead of a
// teacher name, since the teacher is always the same person on this grid.
export const buildStaffTimetableRows = (
  jours: Jour[],
  timeline: TimelineEntry[],
  cells: StaffCell[],
  labels: Pick<TimetableGridLabels, "breakLabel" | "freeSlotLabel">,
): TimetableGridRow[] => {
  const cellMap = new Map<string, StaffCell>();
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
      return cell ? `${cell.classe_name}\n${cell.subject_title}` : labels.freeSlotLabel;
    });

    return { kind: "period" as const, label, cells: rowCells };
  });
};
