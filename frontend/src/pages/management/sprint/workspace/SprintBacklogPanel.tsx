import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  MoreHorizontal,
  Search,
} from "lucide-react";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import {
  formatHours,
  hoursOf,
  priorityMeta,
  sumHours,
  taskKey,
  taskStatusMeta,
} from "./board.constants";

interface SprintBacklogPanelProps {
  title: string;
  items: SprintPlanningItem[];
  selectedIds: number[];
  disabled: boolean;
  saving: boolean;
  isDropTarget: boolean;
  onToggleSelect: (id: number) => void;
  onMove: (id: number, offset: number) => void;
  onUnassign: (id: number) => void;
  onUnassignSelected: () => void;
  onDragStart: (id: number) => void;
  onDragEnter: (id: number) => void;
  onDragEnd: () => void;
  onDragOverPanel: () => void;
  onDragLeavePanel: (event: DragEvent<HTMLElement>) => void;
  onDropPanel: (event: DragEvent<HTMLElement>) => void;
}

/**
 * Left column of the board: the ordered sprint backlog (array position =
 * priority order) with quick filters and the "drop a backlog item here" zone.
 */
export function SprintBacklogPanel({
  title,
  items,
  selectedIds,
  disabled,
  saving,
  isDropTarget,
  onToggleSelect,
  onMove,
  onUnassign,
  onUnassignSelected,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDragOverPanel,
  onDragLeavePanel,
  onDropPanel,
}: SprintBacklogPanelProps) {
  const [keyword, setKeyword] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const visibleItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items
      .map((item, index) => ({ item, order: index + 1 }))
      .filter(({ item }) => {
        if (priority !== "ALL" && item.priority !== priority) return false;
        if (status !== "ALL" && (item.status ?? "BACKLOG") !== status) return false;

        if (!normalizedKeyword) return true;

        return (
          (item.title ?? "").toLowerCase().includes(normalizedKeyword) ||
          taskKey(item).toLowerCase().includes(normalizedKeyword)
        );
      });
  }, [items, keyword, priority, status]);

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
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
            {items.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="font-semibold">
            {items.length} tasks • {formatHours(sumHours(items))}
          </span>
          <span className="text-border">|</span>
          <span>Target capacity {formatHours(sumHours(items))}</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Filter active tasks"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger size="sm" className="h-8 w-[132px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Priority: All</SelectItem>
            <SelectItem value="URGENT">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="h-8 w-[132px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Status: All</SelectItem>
            <SelectItem value="BACKLOG">To Do</SelectItem>
            <SelectItem value="SPRINT_BACKLOG">Sprint Backlog</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="DONE">Done</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          disabled={disabled || selectedIds.length === 0}
          onClick={onUnassignSelected}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Unassign
          {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            The sprint backlog is empty. Drag items here or use the + button in
            the product backlog.
          </p>
        ) : visibleItems.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            No task matches the current filters.
          </p>
        ) : (
          visibleItems.map(({ item, order }) => {
            const itemPriority = priorityMeta(item.priority);
            const itemStatus = taskStatusMeta(item.status);
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
                onDragEnter={() => {
                  if (!disabled) {
                    onDragEnter(item.id);
                  }
                }}
                onDragEnd={onDragEnd}
                className={cn(
                  "group flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2 shadow-xs transition-colors",
                  disabled
                    ? "opacity-60"
                    : "hover:border-primary/40 hover:shadow-sm",
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
                    <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                      #{order}
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
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                        itemStatus.chip,
                      )}
                    >
                      {itemStatus.label}
                    </span>
                    {item.milestoneName && (
                      <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                        {item.milestoneName}
                      </span>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="ml-auto opacity-60 transition-opacity group-hover:opacity-100"
                          disabled={disabled}
                          title="Task actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onMove(item.id, -1)}>
                          <ChevronUp className="h-4 w-4" />
                          Move up
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onMove(item.id, 1)}>
                          <ChevronDown className="h-4 w-4" />
                          Move down
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => onUnassign(item.id)}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Remove from sprint
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </article>
            );
          })
        )}

        <div
          className={cn(
            "mt-auto flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-center text-[11px] transition-colors",
            isDropTarget
              ? "border-primary bg-primary/10 text-primary"
              : "text-muted-foreground",
          )}
        >
          {saving
            ? "Saving sprint backlog…"
            : "Add Task to Sprint or Drop Backlog Item Here"}
        </div>
      </div>
    </section>
  );
}
