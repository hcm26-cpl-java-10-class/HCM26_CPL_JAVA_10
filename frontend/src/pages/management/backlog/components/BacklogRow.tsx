import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { BacklogStatus, SprintPlanningItem } from "@/types";
import {
  ChevronDown,
  Loader2,
  Milestone as MilestoneIcon,
  TriangleAlert,
  User,
} from "lucide-react";
import type { DragEvent } from "react";
import {
  TASK_STATUS_ORDER,
  backlogPriorityMeta,
  backlogStatusMeta,
  backlogWorkTypeMeta,
  canMoveToStatus,
  formatBacklogDate,
  isOverdue,
} from "../backlog.constants";

interface BacklogRowProps {
  item: SprintPlanningItem;
  itemKey: string;
  selected: boolean;
  canEditTask: boolean;
  busy: boolean;
  dueDate?: string | null;
  draggable: boolean;
  onToggleSelect: (id: number) => void;
  onStatusChange: (item: SprintPlanningItem, status: BacklogStatus) => void;
  onOpenDetail: (item: SprintPlanningItem) => void;
  onDragStartItem: (id: number) => void;
  onDragEndItem: () => void;
}

/**
 * One backlog line: type icon, key, title, status pill, due date, estimate and
 * assignee slot. Mirrors the project backlog mock-up.
 */
export function BacklogRow({
  item,
  itemKey,
  selected,
  canEditTask,
  busy,
  dueDate,
  draggable,
  onToggleSelect,
  onStatusChange,
  onOpenDetail,
  onDragStartItem,
  onDragEndItem,
}: BacklogRowProps) {
  const status = backlogStatusMeta(item.status);
  const priority = backlogPriorityMeta(item.priority);
  const workType = backlogWorkTypeMeta(item.workType);
  const WorkTypeIcon = workType.icon;
  // The due date of the item wins; boxes without a per-item date keep the
  // sprint end date as a fallback, like the project mock-up.
  const dueDateValue = item.endDate ?? dueDate;
  const overdue = item.status !== "DONE" && isOverdue(dueDateValue);
  const date = formatBacklogDate(dueDateValue);
  const estimate =
    typeof item.estimatedHours === "number" ? `${item.estimatedHours}h` : "-";
  const assignee = item.assigneeProjectMemberId ?? null;

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!draggable) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(item.id));
    onDragStartItem(item.id);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={onDragEndItem}
      onClick={() => onOpenDetail(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail(item);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View details of ${item.title ?? "work item"}`}
      className={cn(
        "group flex items-center gap-2 bg-card px-3 py-1.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      <span onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(item.id)}
          aria-label="Select work item"
        />
      </span>

      <span
        className={cn("shrink-0", workType.iconClass)}
        title={`Work type: ${workType.label}`}
      >
        <WorkTypeIcon className="h-4 w-4" />
      </span>

      <span className="w-24 shrink-0 truncate font-mono text-[11px] font-semibold text-muted-foreground">
        {itemKey}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {item.title ?? "Untitled work item"}
      </span>

      {/* Milestone link (UFR-PRJ-003-02). */}
      {item.milestoneName && (
        <span
          className="hidden max-w-40 shrink-0 items-center gap-1 truncate rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 lg:inline-flex dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
          title={
            item.milestoneDueDate
              ? `Milestone deadline: ${formatBacklogDate(item.milestoneDueDate)}`
              : item.milestoneName
          }
        >
          <MilestoneIcon className="h-3 w-3" />
          <span className="truncate">{item.milestoneName}</span>
        </span>
      )}

      {/* Priority and status are separate pills: keep a real gap between them. */}
      <div className="flex shrink-0 items-center gap-4">
        <span
          className={cn(
            "hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex",
            priority.pill,
          )}
          title={`Priority: ${priority.label}`}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", priority.dot)} />
          {priority.label}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!canEditTask || busy}>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                status.pill,
                (!canEditTask || busy) && "cursor-default",
              )}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : status.label}
              {canEditTask && !busy && (
                <ChevronDown className="h-3 w-3 opacity-70" />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            {TASK_STATUS_ORDER.map((value) => {
              const option = backlogStatusMeta(value);

              return (
                <DropdownMenuItem
                  key={value}
                  disabled={!canMoveToStatus(item.status, value)}
                  onClick={() => onStatusChange(item, value)}
                >
                  <span className={cn("h-2 w-2 rounded-full", option.dot)} />
                  {option.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <span
        className={cn(
          "flex w-16 shrink-0 items-center justify-end gap-1 text-[11px] text-muted-foreground",
          overdue && "text-amber-600",
        )}
      >
        {overdue && <TriangleAlert className="h-3 w-3" />}
        {date || "-"}
      </span>

      <span className="w-8 shrink-0 text-center text-[11px] text-muted-foreground">
        {estimate}
      </span>

      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
          assignee != null
            ? "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
            : "bg-muted text-muted-foreground",
        )}
        title={assignee != null ? `Assignee #${assignee}` : "Unassigned"}
      >
        {assignee != null ? assignee : <User className="h-3 w-3" />}
      </span>
    </div>
  );
}
