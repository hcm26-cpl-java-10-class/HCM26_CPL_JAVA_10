import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface SessionDateTimePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
}

export function SessionDateTimePicker({
  id,
  label,
  value,
  onChange,
  min,
  max,
  invalid,
}: SessionDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const minDate = min?.slice(0, 10);
  const maxDate = max?.slice(0, 10);
  const candidate = date && time ? date + "T" + time : "";
  const inRange =
    !!candidate &&
    (!min || candidate >= min.slice(0, 16)) &&
    (!max || candidate <= max.slice(0, 16));
  const firstDay = month.startOf("month").subtract(month.day(), "day");

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) {
      let nextDate = value.slice(0, 10) || dayjs().format("YYYY-MM-DD");
      if (!value && minDate && nextDate < minDate) nextDate = minDate;
      if (!value && maxDate && nextDate > maxDate) nextDate = maxDate;
      let nextTime = value.slice(11, 16) || "08:00";
      if (!value && nextDate === minDate && min && nextTime < min.slice(11, 16))
        nextTime = min.slice(11, 16);
      if (!value && nextDate === maxDate && max && nextTime > max.slice(11, 16))
        nextTime = max.slice(11, 16);
      setDate(nextDate);
      setTime(nextTime);
      setMonth(dayjs(nextDate).startOf("month"));
    }
    setOpen(nextOpen);
  }

  function confirm() {
    if (!inRange) return;
    onChange(candidate);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={invalid ? id + "-error" : undefined}
          className={cn(
            "w-full min-w-0 justify-between px-3 font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span>{value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "Select date and time"}</span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={label}
        collisionPadding={16}
        className="w-80 max-w-[calc(100vw-2rem)] space-y-3"
      >
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            disabled={!!minDate && month.format("YYYY-MM") <= minDate.slice(0, 7)}
            onClick={() => setMonth(month.subtract(1, "month"))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-medium" aria-live="polite">
            {month.format("MMMM YYYY")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            disabled={!!maxDate && month.format("YYYY-MM") >= maxDate.slice(0, 7)}
            onClick={() => setMonth(month.add(1, "month"))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day} className="py-1 text-muted-foreground">
              {day}
            </span>
          ))}
          {Array.from({ length: 42 }, (_, index) => {
            const day = firstDay.add(index, "day");
            const dayValue = day.format("YYYY-MM-DD");
            const disabled = !!((minDate && dayValue < minDate) || (maxDate && dayValue > maxDate));
            return (
              <Button
                key={dayValue}
                type="button"
                size="icon-sm"
                variant={dayValue === date ? "default" : "ghost"}
                aria-label={day.format("DD/MM/YYYY")}
                aria-pressed={dayValue === date}
                disabled={disabled}
                className={cn(
                  "w-full text-xs",
                  day.month() !== month.month() && "text-muted-foreground",
                )}
                onClick={() => {
                  setDate(dayValue);
                  if (day.month() !== month.month()) setMonth(day.startOf("month"));
                }}
              >
                {day.date()}
              </Button>
            );
          })}
        </div>
        <div className="grid gap-2 border-t pt-3">
          <Label htmlFor={id + "-picker-time"}>Hour & Minute</Label>
          <Input
            id={id + "-picker-time"}
            type="time"
            step={60}
            value={time}
            min={date === minDate ? min?.slice(11, 16) : undefined}
            max={date === maxDate ? max?.slice(11, 16) : undefined}
            onChange={(event) => setTime(event.target.value.slice(0, 5))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirm();
              }
            }}
          />
          {candidate && !inRange && (
            <p role="alert" className="text-xs text-destructive">
              Selected time is outside the allowed range.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" size="sm" disabled={!inRange} onClick={confirm}>
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
