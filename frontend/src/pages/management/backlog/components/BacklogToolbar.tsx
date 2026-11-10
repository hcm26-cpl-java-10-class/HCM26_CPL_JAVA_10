import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { BacklogPriority, BacklogStatus } from "@/types";
import {
  Filter,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import {
  PRIORITY_FILTER_OPTIONS,
  TASK_STATUS_ORDER,
  backlogStatusMeta,
} from "../backlog.constants";

interface BacklogToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  statusFilter: BacklogStatus | "ALL";
  onStatusFilterChange: (value: BacklogStatus | "ALL") => void;
  priorityFilter: BacklogPriority | "ALL";
  onPriorityFilterChange: (value: BacklogPriority | "ALL") => void;
  allCollapsed: boolean;
  onToggleCollapseAll: () => void;
  canCreateSprint: boolean;
  onCreateSprint: () => void;
  currentUser?: { initials: string; label: string } | null;
}

/** Search, filters and section actions of the `/backlogs` page. */
export function BacklogToolbar({
  keyword,
  onKeywordChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  allCollapsed,
  onToggleCollapseAll,
  canCreateSprint,
  onCreateSprint,
  currentUser,
}: BacklogToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-[260px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Search backlog"
          className="h-9 pl-8 text-sm"
        />
      </div>

      {currentUser && (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-rose-500 text-[10px] font-semibold text-white"
          title={currentUser.label}
        >
          {currentUser.initials}
        </span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilterChange(value as BacklogStatus | "ALL")
            }
          >
            <DropdownMenuRadioItem value="ALL">
              All statuses
            </DropdownMenuRadioItem>
            {TASK_STATUS_ORDER.map((status) => (
              <DropdownMenuRadioItem key={status} value={status}>
                {backlogStatusMeta(status).label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={priorityFilter}
            onValueChange={(value) =>
              onPriorityFilterChange(value as BacklogPriority | "ALL")
            }
          >
            <DropdownMenuRadioItem value="ALL">
              All priorities
            </DropdownMenuRadioItem>
            {PRIORITY_FILTER_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-9 w-9"
          onClick={onToggleCollapseAll}
          aria-label={allCollapsed ? "Expand all" : "Collapse all"}
          title={allCollapsed ? "Expand all" : "Collapse all"}
        >
          {allCollapsed ? (
            <Maximize2 className="h-4 w-4" />
          ) : (
            <Minimize2 className="h-4 w-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-9 w-9"
              aria-label="Backlog actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled={!canCreateSprint} onClick={onCreateSprint}>
              <Plus className="h-4 w-4" />
              Create sprint
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
