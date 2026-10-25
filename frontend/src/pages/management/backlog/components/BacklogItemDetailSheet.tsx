import { sprintBacklogApi } from "@/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SprintPlanningItem } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  backlogPriorityMeta,
  backlogStatusMeta,
  formatBacklogDate,
} from "../backlog.constants";

interface BacklogItemDetailSheetProps {
  open: boolean;
  onClose: (open: boolean) => void;
  item: SprintPlanningItem | null;
  itemKey?: string;
  sprintName?: string | null;
}

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex items-start gap-4 border-b border-border/60 py-2 last:border-b-0">
    <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
      {label}
    </span>
    <div className="min-w-0 flex-1 text-sm text-foreground">{children}</div>
  </div>
);

/**
 * Read-only detail view of one backlog item, opened by clicking a row of the
 * `/backlogs` board. The row already carries the board fields; the full record
 * (assignee, dates, audit stamps) is fetched so the sheet stays complete.
 */
export function BacklogItemDetailSheet({
  open,
  onClose,
  item,
  itemKey,
  sprintName,
}: BacklogItemDetailSheetProps) {
  const detailQuery = useQuery({
    queryKey: ["sprint-backlog", "detail", item?.id ?? null],
    queryFn: () => sprintBacklogApi.getById(String(item!.id)),
    enabled: open && item?.id != null,
  });

  if (!item) {
    return null;
  }

  const detail = detailQuery.data;
  const status = backlogStatusMeta(item.status);
  const priority = backlogPriorityMeta(item.priority);
  const estimate =
    typeof (detail?.estimatedHours ?? item.estimatedHours) === "number"
      ? `${detail?.estimatedHours ?? item.estimatedHours}h`
      : "—";
  const assignee = detail?.assigneeProjectMemberId ?? null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetDescription className="font-mono text-[11px] font-semibold uppercase tracking-wide">
            {itemKey ?? `PRJ-${item.id}`}
          </SheetDescription>
          <SheetTitle className="text-lg leading-snug">
            {item.title ?? "Untitled work item"}
          </SheetTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                status.pill,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                priority.pill,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
              {priority.label}
            </span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {detailQuery.isLoading && (
            <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading the full work item…
            </p>
          )}

          <section className="rounded-lg border bg-muted/20 p-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {item.description?.trim() ||
                detail?.description?.trim() ||
                "No description yet."}
            </p>
          </section>

          <section className="mt-3 rounded-lg border p-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Details
            </h3>

            <DetailRow label="Sprint">
              {detail?.sprintName ?? sprintName ?? "Product backlog"}
            </DetailRow>
            <DetailRow label="Priority">{priority.label}</DetailRow>
            <DetailRow label="Status">{status.label}</DetailRow>
            <DetailRow label="Estimate">{estimate}</DetailRow>
            <DetailRow label="Assignee">
              {assignee != null ? `Member #${assignee}` : "Unassigned"}
            </DetailRow>
            <DetailRow label="Start time">
              {formatBacklogDate(detail?.startDate) || "—"}
            </DetailRow>
            <DetailRow label="End time">
              {formatBacklogDate(detail?.endDate) || "—"}
            </DetailRow>
            {item.sprintOrder != null && (
              <DetailRow label="Position">
                #{item.sprintOrder} in the sprint
              </DetailRow>
            )}
            <DetailRow label="Created">
              {formatBacklogDate(detail?.createdAt) || "—"}
            </DetailRow>
            <DetailRow label="Updated">
              {formatBacklogDate(detail?.updatedAt) || "—"}
            </DetailRow>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
