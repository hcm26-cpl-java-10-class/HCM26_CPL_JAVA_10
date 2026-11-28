import { useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  WEEKDAYS, addDays, addMonths, diffDays, endOfMonth, firstOfMonth, formatLongDate, formatMonth, isWeekend, isYmd, weekdayIndex,
} from "../milestone-date.utils";

/* ---------- Calendar grid ---------- */

interface CalendarProps {
  selected?: string;
  /** Earliest selectable date (inclusive). */
  min?: string;
  today: string;
  /** Highlights the span between two dates (e.g. start → deadline). */
  range?: { from?: string; to?: string };
  /** Small labelled marker on a date (e.g. "Start"). */
  marker?: { date: string; label: string };
  onSelect: (date: string) => void;
  labelledBy?: string;
}

function MilestoneCalendar({ selected, min, today, range, marker, onSelect, labelledBy }: CalendarProps) {
  const initial = isYmd(selected) ? selected : min && min > today ? min : today;
  const [focused, setFocused] = useState(initial);
  const [view, setView] = useState(firstOfMonth(initial));
  const gridRef = useRef<HTMLDivElement>(null);

  const disabled = (day: string) => !!min && day < min;
  const moveFocus = (day: string) => {
    setFocused(day);
    setView(firstOfMonth(day));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus());
  };
  const changeMonth = (delta: number) => {
    const next = addMonths(view, delta);
    setView(next);
    setFocused(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in moves) moveFocus(addDays(focused, moves[event.key]));
    else if (event.key === "PageUp") moveFocus(addMonths(focused, -1));
    else if (event.key === "PageDown") moveFocus(addMonths(focused, 1));
    else if (event.key === "Home") moveFocus(addDays(focused, -weekdayIndex(focused)));
    else if (event.key === "End") moveFocus(addDays(focused, 6 - weekdayIndex(focused)));
    else return;
    event.preventDefault();
  };

  const gridStart = addDays(view, -weekdayIndex(view));
  const lastOfView = endOfMonth(view);
  const weeks = Math.ceil((diffDays(gridStart, lastOfView) + 1) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));
  const focusTarget = days.includes(focused) && focused.startsWith(view.slice(0, 7)) ? focused : view;
  const rangeFrom = range?.from && range?.to && range.from <= range.to ? range.from : undefined;
  const rangeTo = rangeFrom ? range?.to : undefined;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Previous month" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold text-foreground" aria-live="polite">{formatMonth(view)}</p>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Next month" onClick={() => changeMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((label, index) => (
          <span key={label} role="columnheader" className={cn("pb-1 text-center text-[11px] font-medium uppercase", index >= 5 ? "text-muted-foreground/60" : "text-muted-foreground")}>{label}</span>
        ))}
        {days.map((day) => {
          const outside = !day.startsWith(view.slice(0, 7));
          const isSelected = day === selected;
          const inRange = !!rangeFrom && !!rangeTo && day >= rangeFrom && day <= rangeTo;
          const isRangeEdge = inRange && (day === rangeFrom || day === rangeTo);
          const isDisabled = disabled(day);
          return (
            <div key={day} role="gridcell" aria-selected={isSelected}
              className={cn("relative flex justify-center",
                inRange && "bg-indigo-50 dark:bg-indigo-950/40",
                inRange && day === rangeFrom && "rounded-l-md",
                inRange && day === rangeTo && "rounded-r-md")}>
              <button type="button" data-day={day}
                tabIndex={day === focusTarget ? 0 : -1}
                disabled={isDisabled}
                aria-current={day === today ? "date" : undefined}
                aria-label={`${formatLongDate(day)}${marker?.date === day ? ` (${marker.label})` : ""}`}
                onClick={() => { setFocused(day); onSelect(day); }}
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  "hover:bg-accent hover:text-accent-foreground",
                  outside && "text-muted-foreground/50",
                  isWeekend(day) && !outside && !isSelected && "text-muted-foreground",
                  day === today && !isSelected && "font-semibold text-indigo-700 ring-1 ring-indigo-300 dark:text-indigo-300 dark:ring-indigo-700",
                  isRangeEdge && !isSelected && "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200",
                  isSelected && "bg-indigo-600 font-semibold text-white hover:bg-indigo-600 hover:text-white dark:bg-indigo-500",
                  isDisabled && "pointer-events-none line-through opacity-35",
                )}>
                {Number(day.slice(8))}
                {marker?.date === day && !isSelected ? <span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-indigo-500" /> : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Shared trigger ---------- */

interface TriggerProps {
  id: string;
  placeholder: string;
  display?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  icon: typeof CalendarDays;
}

function triggerClass(invalid?: boolean) {
  return cn(
    "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
    "data-[state=open]:border-indigo-400 data-[state=open]:ring-[3px] data-[state=open]:ring-indigo-200/60 dark:data-[state=open]:ring-indigo-900/60",
    invalid && "border-destructive ring-destructive/20 dark:ring-destructive/40",
  );
}

function TriggerContent({ placeholder, display, icon: Icon }: Pick<TriggerProps, "placeholder" | "display" | "icon">) {
  return (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn("truncate", !display && "text-muted-foreground")}>{display ?? placeholder}</span>
    </>
  );
}

/* ---------- Start date picker ---------- */

interface StartDatePickerProps extends Omit<TriggerProps, "display" | "icon" | "placeholder"> {
  value?: string;
  min: string;
  today: string;
  deadlineDate?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function StartDatePicker({ id, value, min, today, deadlineDate, onChange, onBlur, invalid, describedBy, disabled }: StartDatePickerProps) {
  const [open, setOpen] = useState(false);
  const select = (day: string) => { onChange(day); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) onBlur?.(); }}>
      <PopoverTrigger asChild>
        <button id={id} type="button" disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} aria-haspopup="dialog" className={triggerClass(invalid)}>
          <TriggerContent icon={CalendarDays} placeholder="Select start date" display={isYmd(value) ? formatLongDate(value) : undefined} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <p id={`${id}-calendar-label`} className="sr-only">Choose start date</p>
        <MilestoneCalendar selected={value} min={min} today={today} labelledBy={`${id}-calendar-label`}
          range={{ from: value, to: deadlineDate }} marker={deadlineDate ? { date: deadlineDate, label: "Deadline" } : undefined}
          onSelect={select} />
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Starts at 00:00</span>
          <Button type="button" size="sm" variant="outline" disabled={today < min} onClick={() => select(today)}>Today</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Deadline (date + time) picker ---------- */

const TIME_PRESETS = ["08:00", "12:00", "17:00", "23:59"];
const DEFAULT_DEADLINE_TIME = "23:59";

interface DeadlinePickerProps extends Omit<TriggerProps, "display" | "icon" | "placeholder"> {
  /** "YYYY-MM-DDTHH:mm" in the device time zone (same format as datetime-local). */
  value?: string;
  min: string;
  today: string;
  startDate?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function DeadlinePicker({ id, value, min, today, startDate, onChange, onBlur, invalid, describedBy, disabled }: DeadlinePickerProps) {
  const [open, setOpen] = useState(false);
  const date = value && isYmd(value.slice(0, 10)) ? value.slice(0, 10) : undefined;
  const time = value && /^\d{2}:\d{2}/.test(value.slice(11)) ? value.slice(11, 16) : DEFAULT_DEADLINE_TIME;
  const set = (nextDate: string, nextTime = time) => onChange(`${nextDate}T${nextTime}`);
  const quickRanges = isYmd(startDate)
    ? [
        { label: "+1 week", date: addDays(startDate, 7) },
        { label: "+2 weeks", date: addDays(startDate, 14) },
        { label: "End of month", date: endOfMonth(startDate) === startDate ? endOfMonth(addMonths(startDate, 1)) : endOfMonth(startDate) },
      ]
    : [];

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) onBlur?.(); }}>
      <PopoverTrigger asChild>
        <button id={id} type="button" disabled={disabled} aria-invalid={invalid} aria-describedby={describedBy} aria-haspopup="dialog" className={triggerClass(invalid)}>
          <TriggerContent icon={Clock} placeholder="Select deadline"
            display={date ? `${formatLongDate(date)} · ${time}` : undefined} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
        <div className="grid gap-3 sm:grid-cols-[auto_11rem]">
          <div>
            <p id={`${id}-calendar-label`} className="sr-only">Choose deadline date</p>
            <MilestoneCalendar selected={date} min={min} today={today} labelledBy={`${id}-calendar-label`}
              range={{ from: startDate, to: date }} marker={isYmd(startDate) ? { date: startDate, label: "Start" } : undefined}
              onSelect={(day) => set(day)} />
          </div>
          <div className="grid content-start gap-3 border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-time`} className="text-xs font-medium text-muted-foreground">Time</label>
              <Input id={`${id}-time`} type="time" value={time} disabled={!date} className="h-8"
                onChange={(event) => { if (date && event.target.value) set(date, event.target.value); }} />
              <div className="grid grid-cols-2 gap-1.5">
                {TIME_PRESETS.map((preset) => (
                  <Button key={preset} type="button" size="sm" variant="outline" disabled={!date}
                    aria-pressed={time === preset}
                    className={cn("h-7 text-xs tabular-nums", time === preset && "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200")}
                    onClick={() => date && set(date, preset)}>
                    {preset}
                  </Button>
                ))}
              </div>
            </div>
            {quickRanges.length ? (
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">From start date</span>
                {quickRanges.map((item) => (
                  <Button key={item.label} type="button" size="sm" variant="ghost" disabled={item.date < min}
                    className={cn("h-7 justify-between text-xs", date === item.date && "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200")}
                    onClick={() => set(item.date)}>
                    <span>{item.label}</span>
                    <span className="text-muted-foreground tabular-nums">{item.date.slice(8)}/{item.date.slice(5, 7)}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Pick a start date to get quick ranges.</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Your device time</span>
          <Button type="button" size="sm" disabled={!date} onClick={() => { setOpen(false); onBlur?.(); }}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
