import type { TtConfig } from "../interfaces/Timetable";

export type TimelineEntry =
  | { type: "period"; period_number: number; start: string; end: string }
  | { type: "break"; which: 1 | 2; start: string; end: string };

const parseStartTime = (startTime: string): number => {
  const match = /^(\d{2})h(\d{2})$/.exec(startTime);
  if (!match) {
    return 0;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatMinutes = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}H${String(m).padStart(2, "0")}`;
};

// Walks a day's periods from tt_config.start_time, inserting break1 right after
// number_of_period_before_break1_start periods and break2 after a further
// number_of_period_before_break2_start periods past the end of break1 - matches the worked example in
// the tt_config columns' own DB comments (see changes.md).
export const computeDayTimeline = (config: TtConfig, numberOfPeriods: number): TimelineEntry[] => {
  const entries: TimelineEntry[] = [];
  let t = parseStartTime(config.start_time);

  for (let p = 1; p <= numberOfPeriods; p++) {
    const start = t;
    t += config.period_duration;
    entries.push({ type: "period", period_number: p, start: formatMinutes(start), end: formatMinutes(t) });

    if (p === config.number_of_period_before_break1_start) {
      const breakStart = t;
      t += config.duration_break1;
      entries.push({ type: "break", which: 1, start: formatMinutes(breakStart), end: formatMinutes(t) });
    } else if (p - config.number_of_period_before_break1_start === config.number_of_period_before_break2_start) {
      const breakStart = t;
      t += config.duration_break2;
      entries.push({ type: "break", which: 2, start: formatMinutes(breakStart), end: formatMinutes(t) });
    }
  }

  return entries;
};
