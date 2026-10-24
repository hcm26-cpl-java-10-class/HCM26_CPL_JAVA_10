import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { EntityCardRendererProps } from "@/types";
import type { TaskDTO } from "@/types/features/task";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskBadges";

export function TaskCard({
  row,
  isSelected,
  onSelect,
  onView,
  renderRowActions,
  visibleFields,
}: EntityCardRendererProps) {
  const task = row as TaskDTO;
  const visible = (name: string) => visibleFields.some((field) => field.name === name);
  return (
    <Card className="min-w-0 gap-4 py-4">
      <CardHeader className="gap-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(task.id)}
            aria-label={`Select task ${task.title}`}
          />
          {visible("id") && (
            <span className="font-mono text-xs text-muted-foreground" title={task.id}>
              {task.id.slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>
        <button
          type="button"
          className="line-clamp-2 break-words text-left text-sm font-semibold leading-relaxed hover:text-primary"
          onClick={() => onView(task)}
        >
          {task.title}
        </button>
        <div className="flex flex-wrap gap-2">
          {visible("status") && <TaskStatusBadge status={task.status} />}
          {visible("priority") && <TaskPriorityBadge priority={task.priority} />}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 text-sm">
        {visible("assigneeProjectMemberId") && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Assignee</span>
            <span>
              {task.assigneeProjectMemberId
                ? `Member ${task.assigneeProjectMemberId.slice(0, 8)}`
                : "Unassigned"}
            </span>
          </div>
        )}
        {visible("estimatedHours") && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Estimate</span>
            <span>{task.estimatedHours == null ? "—" : `${task.estimatedHours} hours`}</span>
          </div>
        )}
        {visible("tags") && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="max-w-full">
                <span className="truncate">{tag}</span>
              </Badge>
            ))}
          </div>
        )}
        {visible("updatedAt") && (
          <p className="text-xs text-muted-foreground">
            Updated: {new Date(task.updatedAt).toLocaleString("en-US")}
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-1 border-t px-4 pt-3">
        {renderRowActions?.(task)}
      </CardFooter>
    </Card>
  );
}
