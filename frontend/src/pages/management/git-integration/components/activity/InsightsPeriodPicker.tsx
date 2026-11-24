import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { GitInsightsPeriod, GitInsightsRange } from "@/types/features/git-integration";
import { periodLabel } from "../../insights.utils";
import { Segmented } from "./ActivityControls";

type PresetRange = Exclude<GitInsightsRange, "custom">;

const PRESETS: Array<{ id: PresetRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "6m", label: "6 months" },
  { id: "1y", label: "1 year" },
  { id: "all", label: "All time" },
];

function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
}

/**
 * WS-GH-02: period of the Insights activity — presets ending today, "All time" (since the first
 * synchronized activity) and a custom from/to range picked in a popover.
 */
export function InsightsPeriodPicker({ period, onChange }: {
  period: GitInsightsPeriod;
  onChange: (period: GitInsightsPeriod) => void;
}) {
  const custom = period.range === "custom" && period.since && period.until;
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const today = isoDay(new Date());
  const error = !since || !until ? "Choose both days."
    : since > until ? "The start day must be on or before the end day."
      : until > today ? "The end day cannot be in the future." : null;

  function openChange(next: boolean) {
    if (next) {
      // Start from the current custom range, or the last 30 days.
      setSince(custom ? period.since! : daysAgo(29));
      setUntil(custom ? period.until! : today);
    }
    setOpen(next);
  }

  function apply() {
    if (error) return;
    onChange({ range: "custom", since, until });
    setOpen(false);
  }

  return <div className="flex max-w-full flex-wrap items-center gap-1.5">
    <Segmented<PresetRange | "">
      label="Activity period"
      value={period.range === "custom" ? "" : period.range}
      options={PRESETS}
      onChange={range => { if (range) onChange({ range }); }} />
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-pressed={!!custom}
          className={cn("inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            custom ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
              : "bg-card text-muted-foreground hover:text-foreground")}>
          <CalendarRange className="size-3.5" aria-hidden="true" />
          {custom ? periodLabel(period.since!, period.until!) : "Custom"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Custom period</p>
          <p className="text-xs text-muted-foreground">Both days are included. Long periods are grouped by week or month.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="insights-since" className="text-xs">From</Label>
            <Input id="insights-since" type="date" value={since} max={until || today} onChange={event => setSince(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insights-until" className="text-xs">To</Label>
            <Input id="insights-until" type="date" value={until} min={since || undefined} max={today}
              onChange={event => setUntil(event.target.value)} />
          </div>
        </div>
        {error && (since || until) && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" size="sm" disabled={!!error} onClick={apply}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}
