import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SprintDTO, SprintStatus } from "@/types";
import {
  ChevronDown,
  ClipboardList,
  ListPlus,
  Loader2,
  Pencil,
  Play,
  Plus,
  CheckCheck,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  formatDate,
  sprintStatusMeta,
  sprintTimeline,
} from "./board.constants";

interface SprintWorkspaceHeaderProps {
  sprint: SprintDTO | null;
  sprints: SprintDTO[];
  onSelectSprint: (id: number) => void;
  projectLabel: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  statusUpdating: boolean;
  onOpenCreateSprint: () => void;
  onAddBacklogItem: () => void;
  onOpenPlanning: () => void;
  onEditScope: () => void;
  onChangeStatus: (status: SprintStatus) => void;
  onDeleteSprint: () => void;
  tabs: ReactNode;
}

/**
 * Project workspace header: project key ribbon, sprint switcher, sprint level
 * actions and the section tabs of the `/sprints` page.
 */
export function SprintWorkspaceHeader({
  sprint,
  sprints,
  onSelectSprint,
  projectLabel,
  canCreate,
  canUpdate,
  canDelete,
  statusUpdating,
  onOpenCreateSprint,
  onAddBacklogItem,
  onOpenPlanning,
  onEditScope,
  onChangeStatus,
  onDeleteSprint,
  tabs,
}: SprintWorkspaceHeaderProps) {
  const status = sprintStatusMeta(sprint?.status);
  const timeline = sprintTimeline(sprint?.startDate, sprint?.endDate);
  const sprintIndex = sprint
    ? sprints.findIndex((item) => item.id === sprint.id) + 1
    : 0;

  const canStart = sprint?.status === "PLANNED";
  const canComplete = sprint?.status === "ACTIVE";

  return (
    <header className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary">
              {projectLabel}
            </Badge>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Sprint Workspace
            </span>
          </div>

          <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-foreground">
            {sprint?.name ?? "Sprint Workspace"}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>
              {formatDate(sprint?.startDate)} – {formatDate(sprint?.endDate)}
            </span>
            {timeline && (
              <>
                <span className="text-border">•</span>
                <span className="font-medium text-foreground/80">
                  Day {timeline.day} of {timeline.totalDays}
                </span>
              </>
            )}
            <span className="text-border">•</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                status.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>

            {sprints.length > 0 && (
              <>
                <span className="text-border">•</span>
                <Select
                  value={sprint?.id != null ? String(sprint.id) : ""}
                  onValueChange={(value) => onSelectSprint(Number(value))}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-6 w-auto gap-1 border-dashed px-2 text-[11px] font-medium"
                  >
                    <SelectValue placeholder="Select sprint">
                      {`Sprint ${sprintIndex > 0 ? sprintIndex : 1} of ${sprints.length}`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {sprints.map((item, index) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        Sprint {index + 1} of {sprints.length} —{" "}
                        {item.name ?? `#${item.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Button size="sm" onClick={onOpenCreateSprint}>
              <Plus className="h-4 w-4" />
              Create Sprint
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onAddBacklogItem}>
            <ListPlus className="h-4 w-4" />
            Add Backlog Item
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!sprint}>
                Sprint Actions
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sprint scope</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onOpenPlanning}>
                <ClipboardList className="h-4 w-4" />
                Open planning board
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canUpdate} onSelect={onEditScope}>
                <Pencil className="h-4 w-4" />
                Edit sprint scope
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={!canUpdate || !canStart || statusUpdating}
                onSelect={() => onChangeStatus("ACTIVE")}
              >
                {statusUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start sprint
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canUpdate || !canComplete || statusUpdating}
                onSelect={() => onChangeStatus("COMPLETED")}
              >
                {statusUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Complete sprint
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!canDelete}
                onSelect={onDeleteSprint}
              >
                <Trash2 className="h-4 w-4" />
                Delete sprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-3 px-3">{tabs}</div>
    </header>
  );
}
