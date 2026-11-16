import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { sprintBacklogApi } from "@/api/features/sprint_backlog.api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ProjectAnalyticsItemType, ProjectAnalyticsScope, ProjectAnalyticsWindow } from "@/types/features/project-analytics";
import type { SprintBacklogDTO } from "@/types";
import {
  assigneeInitialsOf,
  backlogStatusMeta,
  projectKeyOf,
} from "@/pages/management/backlog/backlog.constants";

interface CurrentWindowWorkItemsProps {
  projectId: number;
  projectCode?: string | null;
  projectName?: string | null;
  scope: ProjectAnalyticsScope;
  sprintId?: number | null;
  itemType: ProjectAnalyticsItemType;
  dateWindow: ProjectAnalyticsWindow;
  backlogHref: string;
}

function matchesScope(item: SprintBacklogDTO, scope: ProjectAnalyticsScope, sprintId?: number | null) {
  if (scope === "BACKLOG") return item.sprintId == null;
  if (scope === "SPRINT") return sprintId == null || item.sprintId === sprintId;
  return true;
}

/**
 * Current window work items beneath the charts.
 *
 * The list reuses the sprint backlog read API so the analytics view stays
 * read-only: it only shows the title, status, estimate and assignee of the
 * items that belong to the applied scope.
 */
export function CurrentWindowWorkItems({
  projectId,
  projectCode,
  projectName,
  scope,
  sprintId,
  itemType,
  dateWindow,
  backlogHref,
}: CurrentWindowWorkItemsProps) {
  const itemsQuery = useQuery({
    queryKey: ["analytics-window-work-items", projectId, scope, sprintId, itemType, dateWindow.startDate, dateWindow.endDate],
    queryFn: () => sprintBacklogApi.getPage(
      { page: 0, size: 200, sort: ["id,desc"] },
      undefined,
      {
        ids: [],
        projectId,
        ...(scope === "SPRINT" && sprintId != null ? { sprintId } : {}),
        ...(itemType !== "ALL" ? { workType: itemType } : {}),
      },
    ),
    enabled: projectId > 0,
    retry: false,
    staleTime: 30_000,
  });

  const items = (itemsQuery.data?.content ?? [])
    .filter(item => matchesScope(item, scope, sprintId))
    .filter(item => itemType === "ALL" || item.workType === itemType);
  const prefix = projectCode?.trim() || projectKeyOf(projectName);

  return (
    <section aria-label="Current window work items" className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold tracking-tight">Current Window Work Items</h2>
          {!itemsQuery.isPending && (
            <Badge variant="outline" className="h-5 min-w-5 justify-center rounded-md px-1.5 text-[10px] tabular-nums">
              {items.length}
            </Badge>
          )}
        </div>
        <Link to={backlogHref} className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
          View backlog <ChevronRight className="size-3.5" />
        </Link>
      </header>

      {itemsQuery.isPending ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : itemsQuery.isError ? (
        <p className="px-4 py-4 text-[11px] text-muted-foreground">Work items could not be loaded for this window.</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-4 text-[11px] text-muted-foreground">No work items in this window.</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto">
          {items.map(item => {
            const status = backlogStatusMeta(item.status);
            const statusTone = item.status === "TODO"
              ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
              : status.pill;
            const estimate = typeof item.estimatedHours === "number" ? `${item.estimatedHours}h` : null;
            const initials = assigneeInitialsOf(item.assigneeDisplayName);
            return (
              <li key={item.id ?? item.title ?? "work-item"} className="flex items-center gap-3 px-4 py-2.5">
                <span className="shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">
                  {prefix}-{item.id}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {item.title ?? "Untitled work item"}
                </span>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", statusTone)}>
                  {status.label}
                </span>
                <span className="hidden w-8 shrink-0 text-right text-[10px] text-muted-foreground sm:block">
                  {estimate ?? "—"}
                </span>
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground"
                  title={item.assigneeDisplayName ?? "Unassigned"}>
                  {initials || "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
