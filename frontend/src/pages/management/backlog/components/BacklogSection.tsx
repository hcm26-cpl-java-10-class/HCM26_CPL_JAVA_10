import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  BacklogAssigneeOption,
  BacklogStatus,
  SprintPlanningItem,
} from "@/types";
import { ChevronDown } from "lucide-react";
import type { DragEvent, ReactNode } from "react";
import { backlogItemKey } from "../backlog.constants";
import { BacklogRow } from "./BacklogRow";

interface BacklogSectionProps {
  title: ReactNode;
  meta?: ReactNode;
  items: SprintPlanningItem[];
  itemKeyPrefix: string;
  selectedIds: number[];
  collapsed: boolean;
  canEditTask: boolean;
  busyItemId: number | null;
  counts?: { todo: number; inProgress: number; done: number };
  actions?: ReactNode;
  /**
   * Rendered BELOW the box, left aligned (e.g. the Jira style "+ Create" row).
   * It is intentionally outside the bordered `<section>` so the box only wraps
   * the work items.
   */
  footer?: ReactNode;
  emptyMessage: string;
  dueDate?: string | null;
  /** Team members of the board, resolved to the initials avatar of a row. */
  assignees?: BacklogAssigneeOption[];
  draggable: boolean;
  isDropTarget: boolean;
  onToggleCollapse: () => void;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onStatusChange: (item: SprintPlanningItem, status: BacklogStatus) => void;
  onOpenDetail: (item: SprintPlanningItem) => void;
  onDragStartItem: (id: number) => void;
  onDragEndItem: () => void;
  onDragOverSection: () => void;
  onDragLeaveSection: (event: DragEvent<HTMLElement>) => void;
  onDropSection: (event: DragEvent<HTMLElement>) => void;
}

const countStyles = {
  todo: "text-slate-500",
  inProgress: "text-sky-600",
  done: "text-emerald-600",
} as const;

/**
 * Collapsible backlog group (a sprint, or the product backlog) rendered as a
 * flat list of work item rows.
 */
export function BacklogSection({
  title,
  meta,
  items,
  itemKeyPrefix,
  selectedIds,
  collapsed,
  canEditTask,
  busyItemId,
  counts,
  actions,
  footer,
  emptyMessage,
  dueDate,
  assignees = [],
  draggable,
  isDropTarget,
  onToggleCollapse,
  onToggleSelectAll,
  onToggleSelect,
  onStatusChange,
  onOpenDetail,
  onDragStartItem,
  onDragEndItem,
  onDragOverSection,
  onDragLeaveSection,
  onDropSection,
}: BacklogSectionProps) {
  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <section
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border bg-card",
          isDropTarget && "border-primary bg-primary/5 ring-2 ring-primary/20",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          if (draggable) {
            onDragOverSection();
          }
        }}
        onDragLeave={(event) => onDragLeaveSection(event)}
        onDrop={(event) => onDropSection(event)}
      >
        <header className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all work items"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 text-muted-foreground"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand section" : "Collapse section"}
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                collapsed && "-rotate-90",
              )}
            />
          </Button>

          <h3 className="truncate text-sm font-semibold text-foreground">
            {title}
          </h3>

          {meta && (
            <span className="text-xs text-muted-foreground">{meta}</span>
          )}

          <span className="text-xs text-muted-foreground">
            ({items.length} work items)
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {counts && (
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded border bg-background px-1.5 text-[11px] font-semibold",
                    countStyles.todo,
                  )}
                  title="To Do"
                >
                  {counts.todo}
                </span>
                <span
                  className={cn(
                    "rounded border bg-background px-1.5 text-[11px] font-semibold",
                    countStyles.inProgress,
                  )}
                  title="In Progress"
                >
                  {counts.inProgress}
                </span>
                <span
                  className={cn(
                    "rounded border bg-background px-1.5 text-[11px] font-semibold",
                    countStyles.done,
                  )}
                  title="Done"
                >
                  {counts.done}
                </span>
              </div>
            )}

            {actions}
          </div>
        </header>

        {!collapsed && (
          <div className="flex flex-col divide-y divide-border/70">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              items.map((item) => (
                <BacklogRow
                  key={item.id}
                  item={item}
                  itemKey={backlogItemKey(itemKeyPrefix, item)}
                  selected={selectedIds.includes(item.id)}
                  canEditTask={canEditTask}
                  busy={busyItemId === item.id}
                  dueDate={dueDate}
                  assignees={assignees}
                  draggable={draggable}
                  onToggleSelect={onToggleSelect}
                  onStatusChange={onStatusChange}
                  onOpenDetail={onOpenDetail}
                  onDragStartItem={onDragStartItem}
                  onDragEndItem={onDragEndItem}
                />
              ))
            )}
          </div>
        )}
      </section>

      {!collapsed && footer && <div className="px-1">{footer}</div>}
    </div>
  );
}
