import { useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ProjectAnalyticsFilters,
  ProjectAnalyticsItemType,
  ProjectAnalyticsRequestFilters,
  ProjectAnalyticsScope,
  ProjectAnalyticsWindow,
} from "@/types/features/project-analytics";
import {
  itemTypeLabels,
  scopeLabels,
} from "./analytics-filters";

interface AnalyticsFilterBarProps {
  /** Filter echo of the last successfully loaded payload (drives the options). */
  filters: ProjectAnalyticsFilters;
  /** Effective chart window, shown when the user did not pick dates. */
  dateWindow: ProjectAnalyticsWindow;
  /** Filters currently applied in the URL. */
  applied: ProjectAnalyticsRequestFilters;
  /** Field keyed 422 messages from the API (AC04). */
  fieldErrors: Record<string, string>;
  isFetching: boolean;
  onApply: (next: ProjectAnalyticsRequestFilters) => void;
  onReset: () => void;
}

interface Draft {
  scope: ProjectAnalyticsScope;
  sprintId?: number;
  itemType: ProjectAnalyticsItemType;
  startDate: string;
  endDate: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatDay(value: string, withYear: boolean) {
  const parsed = parseIsoDate(value);
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}${withYear ? ` ${parsed.getFullYear()}` : ""}`;
}

/** `10 Nov – 16 Nov 2024` when both bounds share a year. */
function rangeLabel(start?: string | null, end?: string | null) {
  if (!start && !end) return "Any date";
  if (!start) return `Until ${formatDay(end!, true)}`;
  if (!end) return `From ${formatDay(start, true)}`;

  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
}

/**
 * US-ANL-002: the Scope / Sprint / Date range filter strip.
 *
 * The controls edit a local draft; nothing is queried until the user presses
 * Apply (AC03), which writes the draft into the URL. The server echo fills the
 * values the user did not choose, so the sprint shown is the one the backend
 * resolved by default. Rejected filters (AC04) keep the draft untouched and
 * highlight the offending control while the charts keep the previous payload.
 */
export function AnalyticsFilterBar({
  filters,
  dateWindow,
  applied,
  fieldErrors,
  isFetching,
  onApply,
  onReset,
}: AnalyticsFilterBarProps) {
  const base: Draft = {
    scope: applied.scope ?? filters.scope,
    sprintId: applied.sprintId ?? filters.sprintId ?? filters.defaultSprintId ?? undefined,
    itemType: applied.itemType ?? filters.itemType,
    startDate: applied.startDate ?? "",
    endDate: applied.endDate ?? "",
  };
  const signature = JSON.stringify(base);
  const [snapshot, setSnapshot] = useState(signature);
  const [draft, setDraft] = useState<Draft>(base);
  // Re-seed the draft when the applied filters (or the server echo) change,
  // without an effect: React's "adjust state during render" pattern.
  if (snapshot !== signature) {
    setSnapshot(signature);
    setDraft(base);
  }

  const update = (changes: Partial<Draft>) => setDraft(current => ({ ...current, ...changes }));
  const invertedRange = !!draft.startDate && !!draft.endDate && draft.startDate > draft.endDate;
  const dateError = fieldErrors.startDate ?? fieldErrors.endDate;
  const sprintValue = draft.sprintId === undefined ? "none" : String(draft.sprintId);
  const shownStart = draft.startDate || dateWindow.startDate;
  const shownEnd = draft.endDate || dateWindow.endDate;
  const hasDateDraft = !!draft.startDate || !!draft.endDate;

  return (
    <section aria-label="Analytics filters" className="rounded-xl border bg-muted/30 px-3 py-2.5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-foreground">Scope:</span>
        <Select value={draft.scope} onValueChange={value => {
          const scope = value as ProjectAnalyticsScope;
          update({
            scope,
            sprintId: scope === "SPRINT"
              ? draft.sprintId ?? filters.sprintId ?? filters.defaultSprintId
                ?? filters.sprints[filters.sprints.length - 1]?.sprintId
              : undefined,
          });
        }}>
          <SelectTrigger id="analytics-scope" aria-label="Scope" aria-invalid={!!fieldErrors.scope}
            className={fieldErrors.scope ? "h-8 w-[150px] border-destructive bg-background text-xs" : "h-8 w-[150px] bg-background text-xs"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(scopeLabels) as ProjectAnalyticsScope[]).map(value => (
              <SelectItem key={value} value={value}>{scopeLabels[value]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sprintValue}
          onValueChange={value => {
            const sprintId = value === "none" ? undefined : Number(value);
            update({ sprintId, scope: sprintId === undefined ? draft.scope : "SPRINT" });
          }}>
          <SelectTrigger id="analytics-sprint" aria-label="Sprint" aria-invalid={!!fieldErrors.sprintId}
            className={fieldErrors.sprintId ? "h-8 w-[100px] border-destructive bg-background text-xs" : "h-8 w-[100px] bg-background text-xs"}>
            <SelectValue placeholder="Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">All sprints</SelectItem>
            {filters.sprints.map(item => (
              <SelectItem key={item.sprintId} value={String(item.sprintId)}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-1 font-medium text-foreground">Date</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" aria-label="Date range"
              className={(dateError || invertedRange) ? "h-8 gap-1.5 border-destructive bg-background px-2.5 text-xs font-normal" : "h-8 gap-1.5 bg-background px-2.5 text-xs font-normal"}>
              <CalendarDays className="size-3.5 text-muted-foreground" />
              {rangeLabel(shownStart, shownEnd)}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            <p className="text-xs font-semibold">Date window</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="analytics-from" className="text-[11px] text-muted-foreground">From</Label>
                <Input id="analytics-from" type="date" value={draft.startDate}
                  aria-invalid={!!dateError || invertedRange}
                  className={dateError || invertedRange ? "border-destructive" : undefined}
                  onChange={event => update({ startDate: event.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="analytics-to" className="text-[11px] text-muted-foreground">To</Label>
                <Input id="analytics-to" type="date" value={draft.endDate}
                  aria-invalid={!!dateError || invertedRange}
                  className={dateError || invertedRange ? "border-destructive" : undefined}
                  onChange={event => update({ endDate: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="analytics-type" className="text-[11px] text-muted-foreground">Work item type</Label>
              <Select value={draft.itemType}
                onValueChange={value => update({ itemType: value as ProjectAnalyticsItemType })}>
                <SelectTrigger id="analytics-type" aria-label="Work item type" aria-invalid={!!fieldErrors.itemType}
                  className={fieldErrors.itemType ? "w-full border-destructive" : "w-full"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(filters.itemTypes.length > 0 ? filters.itemTypes : ["ALL", "STORY", "BUG", "TASK"] as ProjectAnalyticsItemType[])
                    .map(value => <SelectItem key={value} value={value}>{itemTypeLabels[value]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasDateDraft && (
              <Button type="button" variant="ghost" size="sm" className="h-7 w-full text-[11px]"
                onClick={() => update({ startDate: "", endDate: "" })}>
                Use the default window
              </Button>
            )}
            <p className="text-[10px] leading-4 text-muted-foreground">
              {rangeLabel(shownStart, shownEnd)} · leave a bound empty to use the project default.
            </p>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={onReset}>
            <RotateCcw className="size-3.5" />Reset
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1.5 bg-blue-600 text-xs text-white hover:bg-blue-700"
            onClick={() => onApply({
              scope: draft.scope,
              sprintId: draft.scope === "SPRINT" ? draft.sprintId : undefined,
              itemType: draft.itemType,
              startDate: draft.startDate || undefined,
              endDate: draft.endDate || undefined,
            })}>
            {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Apply
          </Button>
        </div>
      </div>

      {(fieldErrors.scope || fieldErrors.sprintId || fieldErrors.itemType || dateError || invertedRange || fieldErrors.filters) && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {fieldErrors.scope ?? fieldErrors.sprintId ?? fieldErrors.itemType ?? dateError
            ?? fieldErrors.filters ?? "The end date must be on or after the start date."}
        </p>
      )}
    </section>
  );
}
