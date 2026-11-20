import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  ExternalLink,
  Gauge,
  UserRound,
} from "lucide-react";
import { projectAnalyticsApi } from "@/api/features/project-analytics.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  assigneeInitialsOf,
  backlogStatusMeta,
} from "@/pages/management/backlog/backlog.constants";
import type { BacklogStatus } from "@/types";
import type {
  ProjectAnalyticsDrillDownChart,
  ProjectAnalyticsDrillDownItem,
  ProjectAnalyticsDrillDownTarget,
  ProjectAnalyticsRequestFilters,
} from "@/types/features/project-analytics";
import { WidgetInlineError } from "./analytics-chart-ui";

const CHART_META: Record<ProjectAnalyticsDrillDownChart, {
  title: string;
  dateCaption: string;
  seriesOptions: ReadonlyArray<{ value?: string; label: string }>;
}> = {
  creation: {
    title: "Work item creation trend",
    dateCaption: "Created on",
    seriesOptions: [
      { value: undefined, label: "All" },
      { value: "done", label: "Done" },
      { value: "todo", label: "To Do" },
    ],
  },
  "cycle-time": {
    title: "Work item cycle time",
    dateCaption: "Completed on",
    seriesOptions: [],
  },
  "lead-time": {
    title: "Work item lead time",
    dateCaption: "Completed on",
    seriesOptions: [
      { value: undefined, label: "All types" },
      { value: "story", label: "Story" },
      { value: "subtask", label: "Subtask" },
      { value: "task", label: "Task" },
    ],
  },
  completion: {
    title: "Work item completion trend",
    dateCaption: "Completed on",
    seriesOptions: [
      { value: undefined, label: "All types" },
      { value: "subtask", label: "Subtask" },
      { value: "story", label: "Story" },
      { value: "task", label: "Task" },
    ],
  },
};

const WORK_TYPE_STYLE: Record<string, { label: string; className: string }> = {
  STORY: {
    label: "Story",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  },
  SUBTASK: {
    label: "Subtask",
    className: "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800 dark:bg-lime-950/50 dark:text-lime-300",
  },
  TASK: {
    label: "Task",
    className: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
  },
  BUG: {
    label: "Bug",
    className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  },
};

function workTypeBadge(type: string) {
  return WORK_TYPE_STYLE[type.toUpperCase()] ?? {
    label: type,
    className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };
}

function formatDays(value: number | null) {
  return typeof value === "number" ? `${value.toFixed(1)}d` : "—";
}

/**
 * US-ANL-008 AC03: slide-over drawer listing the exact work items behind a
 * clicked bar segment or line marker (Task Code, Title, Type, Assignee, Status,
 * Cycle/Lead Days) with links to open the UFR-PRJ-004 task detail sheet.
 */
export function AnalyticsDrillDownDrawer({
  projectId,
  appliedFilters,
  target,
  onChangeTarget,
  onClose,
  onOpenWorkItem,
}: {
  projectId: number;
  appliedFilters: ProjectAnalyticsRequestFilters;
  target: ProjectAnalyticsDrillDownTarget | null;
  onChangeTarget: (next: ProjectAnalyticsDrillDownTarget) => void;
  onClose: () => void;
  onOpenWorkItem: (item: ProjectAnalyticsDrillDownItem) => void;
}) {
  const open = target !== null;

  const query = useQuery({
    queryKey: ["project-analytics-drill-down", projectId, appliedFilters, target],
    queryFn: ({ signal }) => projectAnalyticsApi.drillDown(projectId, target!, appliedFilters, signal),
    enabled: open && projectId > 0,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const meta = target ? CHART_META[target.chart] : null;
  const items = query.data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose(); }}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-sm font-semibold tracking-tight">
              {meta?.title ?? "Work item drill-down"}
            </SheetTitle>
            {!query.isPending && !query.isError && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] tabular-nums">
                {items.length} {items.length === 1 ? "item" : "items"}
              </Badge>
            )}
          </div>
          <SheetDescription className="flex flex-wrap items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>
              {meta?.dateCaption ?? "Date"} <strong className="font-semibold text-foreground">{target?.date}</strong>
            </span>
          </SheetDescription>

          {target && meta && meta.seriesOptions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter drill-down series">
              {meta.seriesOptions.map(option => {
                const active = (target.series ?? undefined) === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeTarget({ ...target, series: option.value })}
                    className={cn(
                      "cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {query.isPending ? (
            <div className="space-y-3" role="status" aria-label="Loading work items">
              {[0, 1, 2, 3].map(key => (
                <div key={key} className="space-y-2 rounded-xl border p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-3">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.isError ? (
            <WidgetInlineError
              message="Could not load the work items for this date. Please try again."
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-8 text-center">
              <p className="text-xs font-medium text-foreground">No matching work items</p>
              <p className="text-[11px] text-muted-foreground">
                No work items match this date and series in the active analytics scope.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {items.map(item => {
                const typeMeta = workTypeBadge(item.workType);
                const status = backlogStatusMeta(item.status as BacklogStatus);
                const statusTone = item.status === "TODO"
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  : status.pill;
                const initials = assigneeInitialsOf(item.assigneeName);
                const highlightCycle = target?.chart === "cycle-time";
                const highlightLead = target?.chart === "lead-time";

                return (
                  <li
                    key={`${item.workType}-${item.id}`}
                    className="rounded-xl border bg-card p-3.5 shadow-2xs transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                          {item.taskCode}
                        </span>
                        <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", typeMeta.className)}>
                          {typeMeta.label}
                        </span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", statusTone)}>
                          {status.label}
                        </span>
                      </div>
                      {item.backlogItemId != null && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-[11px] text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40"
                          onClick={() => onOpenWorkItem(item)}
                        >
                          Open detail
                          <ExternalLink className="size-3" />
                        </Button>
                      )}
                    </div>

                    <p className="mt-1.5 text-xs font-medium leading-5 text-foreground">
                      {item.title ?? "Untitled work item"}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        {item.assigneeName ? (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-foreground">
                            {initials}
                          </span>
                        ) : (
                          <UserRound className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                        )}
                        <span className="truncate">{item.assigneeName ?? "Unassigned"}</span>
                        {item.sprintName && (
                          <span className="text-[10px] text-muted-foreground/80">· {item.sprintName}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                            highlightCycle
                              ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              : "bg-muted/60 text-muted-foreground",
                          )}
                        >
                          <Clock className="size-3" aria-hidden="true" />
                          Cycle: {formatDays(item.cycleDays)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]",
                            highlightLead
                              ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                              : "bg-muted/60 text-muted-foreground",
                          )}
                        >
                          <Gauge className="size-3" aria-hidden="true" />
                          Lead: {formatDays(item.leadDays)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
