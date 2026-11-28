import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SprintPlanningItem } from "@/types";
import {
  ArrowRight,
  CornerDownRight,
  GripVertical,
  Inbox,
  Layers,
  ShieldCheck,
} from "lucide-react";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import {
  completionRate,
  formatDate,
  formatHours,
  hoursOf,
  priorityMeta,
  sumHours,
  taskKey,
} from "./board.constants";

type GroupBy = "milestone" | "priority" | "none";
type SortBy = "priority" | "hours" | "milestone";

interface ProductBacklogPanelProps {
  items: SprintPlanningItem[];
  sprintItems: SprintPlanningItem[];
  sprintEndDate?: string | null;
  selectedIds: number[];
  disabled: boolean;
  isDropTarget: boolean;
  onToggleSelect: (id: number) => void;
  onAssign: (id: number) => void;
  onAssignSelected: () => void;
  onDragStart: (id: number) => void;
  onDragEnd: () => void;
  onDragOverPanel: () => void;
  onDragLeavePanel: (event: DragEvent<HTMLElement>) => void;
  onDropPanel: (event: DragEvent<HTMLElement>) => void;
}

const UNASSIGNED_GROUP = "Unassigned Backlog Items";

interface BacklogGroup {
  key: string;
  title: string;
  items: SprintPlanningItem[];
}

/**
 * Right column of the board: the remaining product backlog, grouped by
 * milestone (default) and sortable, plus the curricular alignment status.
 */
export function ProductBacklogPanel({
  items,
  sprintItems,
  sprintEndDate,
  selectedIds,
  disabled,
  isDropTarget,
  onToggleSelect,
  onAssign,
  onAssignSelected,
  onDragStart,
  onDragEnd,
  onDragOverPanel,
  onDragLeavePanel,
  onDropPanel,
}: ProductBacklogPanelProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("milestone");
  const [sortBy, setSortBy] = useState<SortBy>("priority");

  const groups = useMemo<BacklogGroup[]>(() => {
    const sorted = [...items].sort((a, b) => {
      if (sortBy === "hours") {
        return hoursOf(b) - hoursOf(a);
      }

      if (sortBy === "milestone") {
        const aDue = a.milestoneDueDate
          ? new Date(a.milestoneDueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bDue = b.milestoneDueDate
          ? new Date(b.milestoneDueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }

      return priorityMeta(b.priority).rank - priorityMeta(a.priority).rank;
    });

    if (groupBy === "none") {
      return [{ key: "all", title: "Product Backlog", items: sorted }];
    }

    const buckets = new Map<string, BacklogGroup>();

    for (const item of sorted) {
      const key =
        groupBy === "priority"
          ? (item.priority ?? "NONE")
          : (item.milestoneId != null
              ? `milestone-${item.milestoneId}`
              : "unassigned");

      const title =
        groupBy === "priority"
          ? `${priorityMeta(item.priority).label} priority`
          : (item.milestoneName ?? UNASSIGNED_GROUP);

      const bucket: BacklogGroup = buckets.get(key) ?? {
        key,
        title,
        items: [],
      };
      bucket.items.push(item);
      buckets.set(key, bucket);
    }

    return [...buckets.values()].sort((a, b) => {
      if (a.key === "unassigned") return 1;
      if (b.key === "unassigned") return -1;
      return 0;
    });
  }, [groupBy, items, sortBy]);

  const alignment = useMemo(() => {
    const sprintEnd = sprintEndDate ? new Date(sprintEndDate).getTime() : null;

    const milestoneItems = sprintItems.filter((item) => item.milestoneName);
    const nextMilestone = milestoneItems.sort((a, b) => {
      const aDue = a.milestoneDueDate
        ? new Date(a.milestoneDueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bDue = b.milestoneDueDate
        ? new Date(b.milestoneDueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })[0];

    const scoped = nextMilestone
      ? sprintItems.filter(
          (item) => item.milestoneId === nextMilestone.milestoneId,
        )
      : sprintItems;

    const progress = completionRate(scoped);

    const risky = sprintItems.filter((item) => {
      if (!item.milestoneDueDate || item.status === "DONE") return false;
      const due = new Date(item.milestoneDueDate).getTime();
      return sprintEnd !== null && due < sprintEnd;
    });

    return {
      label: nextMilestone?.milestoneName ?? "No milestone linked",
      dueDate: nextMilestone?.milestoneDueDate ?? null,
      percent: progress.percent,
      riskyCount: risky.length,
    };
  }, [sprintEndDate, sprintItems]);

  return (
    <section
      className={cn(
        "flex min-h-[360px] flex-col rounded-xl border bg-muted/30 transition-colors",
        isDropTarget && "border-primary bg-primary/5 ring-2 ring-primary/20",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          onDragOverPanel();
        }
      }}
      onDragLeave={(event) => onDragLeavePanel(event)}
      onDrop={(event) => onDropPanel(event)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Product &amp; Curricular Backlog
          </h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
            {items.length}
          </Badge>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {items.length} items • {formatHours(sumHours(items))}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sort by
        </span>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <SelectTrigger size="sm" className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Milestone priority</SelectItem>
            <SelectItem value="hours">Estimated hours</SelectItem>
            <SelectItem value="milestone">Milestone due date</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Group by
        </span>
        <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
          <SelectTrigger size="sm" className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="milestone">Milestone</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-8 text-xs"
          disabled={disabled || selectedIds.length === 0}
          onClick={onAssignSelected}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Assign
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2.5">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            Every backlog item is already planned in this sprint.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-1">
                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {group.items.length} items
                </span>
                <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {formatHours(sumHours(group.items))}
                </span>
              </div>

              {group.items.map((item) => {
                const itemPriority = priorityMeta(item.priority);
                const selected = selectedIds.includes(item.id);

                return (
                  <article
                    key={item.id}
                    draggable={!disabled}
                    onDragStart={(event) => {
                      if (disabled) {
                        event.preventDefault();
                        return;
                      }

                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(item.id));
                      onDragStart(item.id);
                    }}
                    onDragEnd={onDragEnd}
                    className={cn(
                      "group flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2 shadow-xs transition-colors",
                      disabled ? "opacity-60" : "hover:border-primary/40 hover:shadow-sm",
                      selected && "border-primary/60 bg-primary/5",
                    )}
                  >
                    <GripVertical
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
                        disabled ? "opacity-30" : "cursor-grab",
                      )}
                    />
                    <Checkbox
                      checked={selected}
                      disabled={disabled}
                      onCheckedChange={() => onToggleSelect(item.id)}
                      className="mt-0.5"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[11px] font-semibold text-muted-foreground">
                          {taskKey(item)}
                        </span>
                        <span
                          className={cn(
                            "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                            itemPriority.badge,
                          )}
                        >
                          <span className={cn("h-1 w-1 rounded-full", itemPriority.dot)} />
                          {itemPriority.label}
                          <span className="opacity-70">{hoursOf(item)}h</span>
                        </span>
                      </div>

                      <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                        {item.title || `Backlog item #${item.id}`}
                      </p>

                      <div className="mt-1.5 flex items-center gap-2">
                        {item.milestoneName ? (
                          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                            {item.milestoneName}
                            {item.milestoneDueDate
                              ? ` • due ${formatDate(item.milestoneDueDate)}`
                              : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                            <Layers className="h-3 w-3" />
                            No milestone
                          </span>
                        )}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={disabled}
                          title="Add to sprint backlog"
                          className="ml-auto opacity-60 transition-opacity group-hover:opacity-100"
                          onClick={() => onAssign(item.id)}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))
        )}

        <div className="mt-auto rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Curricular Alignment Status
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="truncate font-semibold text-foreground">
              {alignment.label}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">
              {alignment.percent}% met
            </span>
          </div>
          <Progress
            value={alignment.percent}
            className="mt-1.5 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-emerald-500"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {alignment.dueDate
              ? `Milestone due ${formatDate(alignment.dueDate)}. `
              : ""}
            {alignment.riskyCount > 0
              ? `${alignment.riskyCount} open item(s) have a milestone due before the sprint ends.`
              : "All open items stay within their milestone deadlines."}
          </p>
        </div>
      </div>
    </section>
  );
}
