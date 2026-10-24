import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SprintPlanningItem, TaskStatus } from "@/types";
import {
  ChevronDown,
  ClipboardList,
  Loader2,
  TriangleAlert,
  User,
} from "lucide-react";
import type { DragEvent } from "react";
import {
  TASK_STATUS_ORDER,
  backlogPriorityMeta,
  backlogStatusMeta,
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
  onStatusChange: (item: SprintPlanningItem, status: TaskStatus) => void;
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
  const overdue = item.status !== "DONE" && isOverdue(dueDate);
  const date = formatBacklogDate(dueDate);
  const estimate =
    typeof item.estimatedHours === "number" ? `${item.estimatedHours}h` : "-";

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

      <ClipboardList className="h-4 w-4 shrink-0 text-emerald-600" />

      <span className="w-16 shrink-0 truncate font-mono text-[11px] font-semibold text-muted-foreground">
        {itemKey}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {item.title ?? "Untitled work item"}
      </span>

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
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground"
        title="Unassigned"
      >
        <User className="h-3 w-3" />
      </span>
    </div>
  );
}
