import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../../i18n/useLanguage";
import { datePickerTranslations } from "../../i18n/translations";

interface DatePickerInputProps {
  // Plain "YYYY-MM-DD" (or "") in and out - same wire format the native <input type="date"> this
  // replaces already used, so callers backed by a free-form varchar column (see StaffDetailsDialog)
  // don't need to change how they store/send the value.
  value: string;
  onChange: (value: string) => void;
  className?: string;
  title?: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

const parseIso = (value: string): { y: number; m: number; d: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
};

const PANEL_WIDTH = 296;
const PANEL_HEIGHT_ESTIMATE = 380;

type PanelMode = "days" | "months";

// Custom calendar replacing the browser's native <input type="date"> popup, which renders in a
// platform shadow tree no CSS in this app can reach (Firefox allows none of it, Chrome only the
// small trailing icon) - so a "modern, polished" calendar has to be hand-built rather than styled.
// Positioned with `fixed` coordinates read from the trigger's own bounding rect - but plain `fixed`
// wasn't enough on its own: daisyUI's `.modal-box` sets `scale`/`translate` for its open animation,
// and per spec any of those (like `transform`) makes an ancestor a new containing block for its
// `position: fixed` descendants - so a picker opened from inside a dialog was being positioned
// relative to the (scaled, overflow-clipped) modal box instead of the viewport, and could render
// off-screen/clipped for a field lower in a tall form. Portaling the panel out to the nearest
// ancestor `<dialog>` (a sibling of `.modal-box`, not a descendant of it - `.modal` itself has no
// transform/scale) sidesteps that entirely while staying inside the dialog's own top-layer so it
// still paints above the backdrop; falls back to `document.body` when there's no enclosing dialog.
const DatePickerInput = ({ value, onChange, className = "", title }: DatePickerInputProps) => {
  const [language] = useLanguage();
  const t = datePickerTranslations[language];
  const locale = language === "fr" ? "fr-FR" : "en-US";

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("days");
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const today = new Date();
  const parsed = parseIso(value);
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    const p = parseIso(value);
    setViewYear(p?.y ?? today.getFullYear());
    setViewMonth(p?.m ?? today.getMonth());
    setMode("days");

    setPortalTarget(triggerRef.current?.closest("dialog") ?? document.body);

    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openBelow = spaceBelow >= PANEL_HEIGHT_ESTIMATE || spaceBelow >= spaceAbove;
      const rawTop = openBelow ? rect.bottom + 6 : rect.top - PANEL_HEIGHT_ESTIMATE - 6;
      const top = Math.max(8, Math.min(rawTop, window.innerHeight - 8));
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8));
      setCoords({ top, left });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleScroll = (e: Event) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectDay = (y: number, m: number, d: number) => {
    onChange(toIso(y, m, d));
    setIsOpen(false);
  };

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    // 2023-01-02 is a known Monday - format that reference week so the header always starts Monday
    // regardless of the locale's own default first-of-week convention.
    const label = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(2023, 0, 2 + i),
    );
    return label.replace(/\.$/, "");
  });

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(viewYear, viewMonth, 1),
  );

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const leadingBlanks = (firstWeekday + 6) % 7;
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevMonthYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  interface Cell {
    day: number;
    y: number;
    m: number;
    inMonth: boolean;
  }
  const cells: Cell[] = [];
  for (let i = leadingBlanks; i > 0; i--) {
    cells.push({ day: prevMonthDays - i + 1, y: prevMonthYear, m: prevMonth, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, y: viewYear, m: viewMonth, inMonth: true });
  }
  let trailing = 1;
  while (cells.length < 42) {
    cells.push({ day: trailing, y: nextMonthYear, m: nextMonth, inMonth: false });
    trailing += 1;
  }

  const monthGridLabels = Array.from({ length: 12 }, (_, m) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(viewYear, m, 1)),
  );

  const isSameDay = (y: number, m: number, d: number, ref: { y: number; m: number; d: number } | null) =>
    !!ref && ref.y === y && ref.m === m && ref.d === d;

  const displayValue = parsed
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
        new Date(parsed.y, parsed.m, parsed.d),
      )
    : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
        className={`input flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={displayValue ? "" : "opacity-40"}>{displayValue || t.placeholder}</span>
        <Calendar className="w-4 h-4 opacity-50 shrink-0" />
      </button>

      {isOpen &&
        portalTarget &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="z-999 rounded-2xl border border-base-content/10 bg-base-100 shadow-2xl p-3 select-none"
          >
            {mode === "days" ? (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label={t.chooseMonth}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("months")}
                    className="btn btn-ghost btn-xs font-semibold capitalize px-2"
                  >
                    {monthLabel}
                  </button>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    className="btn btn-ghost btn-xs btn-circle"
                    aria-label={t.chooseMonth}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-y-1 px-1">
                  {weekdayLabels.map((label) => (
                    <div
                      key={label}
                      className="h-7 flex items-center justify-center text-[11px] font-medium uppercase tracking-wide opacity-45"
                    >
                      {label}
                    </div>
                  ))}
                  {cells.map((cell, idx) => {
                    const isToday = isSameDay(cell.y, cell.m, cell.day, {
                      y: today.getFullYear(),
                      m: today.getMonth(),
                      d: today.getDate(),
                    });
                    const isSelected = isSameDay(cell.y, cell.m, cell.day, parsed);
                    return (
                      <button
                        key={`${cell.y}-${cell.m}-${cell.day}-${idx}`}
                        type="button"
                        onClick={() => selectDay(cell.y, cell.m, cell.day)}
                        className={[
                          "h-9 w-9 mx-auto flex items-center justify-center rounded-full text-sm transition-colors",
                          isSelected
                            ? "bg-primary text-primary-content font-semibold shadow-sm"
                            : isToday
                              ? "ring-1 ring-primary text-primary font-semibold hover:bg-primary/10"
                              : cell.inMonth
                                ? "hover:bg-base-200"
                                : "opacity-30 hover:bg-base-200",
                        ].join(" ")}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-content/10 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setIsOpen(false);
                    }}
                    className="btn btn-ghost btn-xs text-error"
                  >
                    {t.clear}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectDay(today.getFullYear(), today.getMonth(), today.getDate())}
                    className="btn btn-ghost btn-xs text-primary"
                  >
                    {t.today}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y - 1)}
                    className="btn btn-ghost btn-xs btn-circle"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-sm">{viewYear}</span>
                  <button
                    type="button"
                    onClick={() => setViewYear((y) => y + 1)}
                    className="btn btn-ghost btn-xs btn-circle"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 px-1">
                  {monthGridLabels.map((label, m) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setViewMonth(m);
                        setMode("days");
                      }}
                      className={[
                        "h-9 rounded-lg text-sm capitalize transition-colors",
                        m === viewMonth
                          ? "bg-primary text-primary-content font-semibold"
                          : "hover:bg-base-200",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>,
          portalTarget,
        )}
    </>
  );
};

export default DatePickerInput;
