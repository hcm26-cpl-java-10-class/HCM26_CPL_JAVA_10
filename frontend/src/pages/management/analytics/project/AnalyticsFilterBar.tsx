import { useState } from "react";
import { AlertTriangle, Filter, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ProjectAnalyticsFilters,
  ProjectAnalyticsItemType,
  ProjectAnalyticsRequestFilters,
  ProjectAnalyticsScope,
} from "@/types/features/project-analytics";
import {
  analyticsFilterKeys,
  hasAnalyticsFilters,
  itemTypeLabels,
  scopeLabels,
} from "./analytics-filters";

interface AnalyticsFilterBarProps {
  /** Filter echo of the last successfully loaded payload (drives the options). */
  filters: ProjectAnalyticsFilters;
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

/**
 * US-ANL-002: the Scope / Sprint / Date range / Work item type filter bar.
 *
 * The controls edit a local draft; nothing is queried until the user presses
 * Apply (AC03), which writes the draft into the URL. The server echo fills the
 * values the user did not choose, so the dropdown shows the sprint the backend
 * resolved by default. Rejected filters (AC04) keep the draft untouched and
 * highlight the offending control while the charts keep the previous payload.
 */
export function AnalyticsFilterBar({
  filters,
  applied,
  fieldErrors,
  isFetching,
  onApply,
  onReset,
}: AnalyticsFilterBarProps) {
  const base: Draft = {
    scope: applied.scope ?? filters.scope,
    sprintId: applied.sprintId ?? filters.sprintId ?? undefined,
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
  const activeCount = analyticsFilterKeys.filter(key => {
    const value = applied[key];
    return value !== undefined && value !== null && value !== "";
  }).length;
  const appliedSprint = filters.sprints.find(item => item.sprintId === filters.sprintId);
  const dateError = fieldErrors.startDate ?? fieldErrors.endDate;

  return (
    <section aria-label="Analytics filters" className="rounded-xl border bg-card p-3.5 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Filter className="size-3.5" />Filters
        </span>
        <Badge variant="outline" className="text-[10px]">
          {activeCount > 0 ? `${activeCount} applied` : "Project defaults"}
        </Badge>
        {filters.backlogItemCount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {filters.backlogItemCount} product backlog {filters.backlogItemCount === 1 ? "item" : "items"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
            disabled={!hasAnalyticsFilters(applied)} onClick={onReset}>
            <RotateCcw className="size-3.5" />Reset
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => onApply({
              scope: draft.scope,
              sprintId: draft.scope === "SPRINT" ? draft.sprintId : undefined,
              itemType: draft.itemType,
              startDate: draft.startDate || undefined,
              endDate: draft.endDate || undefined,
            })}>
            {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <SlidersHorizontal className="size-3.5" />}
            Apply
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-1.5">
          <Label htmlFor="analytics-scope" className="text-[11px] font-medium text-muted-foreground">Scope</Label>
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
            <SelectTrigger id="analytics-scope" aria-label="Scope"
              aria-invalid={!!fieldErrors.scope}
              className={fieldErrors.scope ? "w-full border-destructive" : "w-full"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(scopeLabels) as ProjectAnalyticsScope[]).map(value => (
                <SelectItem key={value} value={value}>{scopeLabels[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.scope && <p role="alert" className="text-[11px] font-medium text-destructive">{fieldErrors.scope}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="analytics-sprint" className="text-[11px] font-medium text-muted-foreground">Sprint</Label>
          <Select value={draft.sprintId === undefined ? "none" : String(draft.sprintId)}
            disabled={draft.scope !== "SPRINT" || filters.sprints.length === 0}
            onValueChange={value => update({ sprintId: value === "none" ? undefined : Number(value) })}>
            <SelectTrigger id="analytics-sprint" aria-label="Sprint"
              aria-invalid={!!fieldErrors.sprintId}
              className={fieldErrors.sprintId ? "w-full border-destructive" : "w-full"}>
              <SelectValue placeholder="Select a sprint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Active / latest sprint</SelectItem>
              {filters.sprints.map(item => (
                <SelectItem key={item.sprintId} value={String(item.sprintId)}>
                  {item.name} · {item.workItemCount} {item.workItemCount === 1 ? "item" : "items"}
                  {item.status ? ` · ${item.status}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.sprintId
            ? <p role="alert" className="text-[11px] font-medium text-destructive">{fieldErrors.sprintId}</p>
            : draft.scope !== "SPRINT" && (
              <p className="text-[11px] leading-4 text-muted-foreground">Only used when the scope is a sprint.</p>
            )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="analytics-from" className="text-[11px] font-medium text-muted-foreground">Start date</Label>
          <Input id="analytics-from" type="date" value={draft.startDate}
            aria-invalid={!!dateError || invertedRange}
            className={dateError || invertedRange ? "border-destructive" : undefined}
            onChange={event => update({ startDate: event.target.value })} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="analytics-to" className="text-[11px] font-medium text-muted-foreground">End date</Label>
          <Input id="analytics-to" type="date" value={draft.endDate}
            aria-invalid={!!dateError || invertedRange}
            className={dateError || invertedRange ? "border-destructive" : undefined}
            onChange={event => update({ endDate: event.target.value })} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="analytics-type" className="text-[11px] font-medium text-muted-foreground">Work item type</Label>
          <Select value={draft.itemType}
            onValueChange={value => update({ itemType: value as ProjectAnalyticsItemType })}>
            <SelectTrigger id="analytics-type" aria-label="Work item type"
              aria-invalid={!!fieldErrors.itemType}
              className={fieldErrors.itemType ? "w-full border-destructive" : "w-full"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(filters.itemTypes.length > 0 ? filters.itemTypes : ["ALL", "STORY", "BUG", "TASK"] as ProjectAnalyticsItemType[])
                .map(value => <SelectItem key={value} value={value}>{itemTypeLabels[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          {fieldErrors.itemType && <p role="alert" className="text-[11px] font-medium text-destructive">{fieldErrors.itemType}</p>}
        </div>
      </div>

      {(dateError || invertedRange || fieldErrors.filters) && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {dateError ?? fieldErrors.filters ?? "The end date must be on or after the start date."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" aria-label="Applied analytics filters">
        <Badge variant="secondary" className="rounded-md px-2 py-1 text-[11px] font-normal">
          {scopeLabels[filters.scope]}
        </Badge>
        {filters.scope === "SPRINT" && appliedSprint && (
          <Badge variant="secondary" className="rounded-md px-2 py-1 text-[11px] font-normal">
            Sprint: {appliedSprint.name}
          </Badge>
        )}
        <Badge variant="secondary" className="rounded-md px-2 py-1 text-[11px] font-normal">
          {itemTypeLabels[filters.itemType]}
        </Badge>
        {(filters.startDate || filters.endDate) && (
          <Badge variant="secondary" className="rounded-md px-2 py-1 text-[11px] font-normal">
            {filters.startDate ?? "earliest"} → {filters.endDate ?? "today"}
          </Badge>
        )}
      </div>
    </section>
  );
}
