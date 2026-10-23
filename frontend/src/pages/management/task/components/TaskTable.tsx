import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaskDTO } from "@/types/features/task";
import { ClipboardList, Loader2, Pencil, Plus } from "lucide-react";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskBadges";

interface TaskTableProps {
  tasks: TaskDTO[];
  loading: boolean;
  canEdit: boolean;
  canCreate: boolean;
  filtered: boolean;
  onEdit: (task: TaskDTO) => void;
  onCreate: () => void;
}

export function TaskTable({
  tasks,
  loading,
  canEdit,
  canCreate,
  filtered,
  onEdit,
  onCreate,
}: TaskTableProps) {
  return (
    <div className="overflow-hidden rounded-md border bg-background" aria-busy={loading}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-28">Mã Task</TableHead>
            <TableHead className="min-w-64">Công việc</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="min-w-36">Người thực hiện</TableHead>
            <TableHead className="text-right">Ước lượng</TableHead>
            <TableHead>Ưu tiên</TableHead>
            <TableHead className="min-w-40">Nhãn</TableHead>
            {canEdit && <TableHead className="w-24 text-right">Thao tác</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 8 : 7}>
                <div
                  role="status"
                  className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
                >
                  <Loader2 className="size-5 animate-spin" /> Đang tải công việc...
                </div>
              </TableCell>
            </TableRow>
          ) : tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 8 : 7}>
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <ClipboardList className="size-9 text-muted-foreground" />
                  <p className="font-medium">
                    {filtered ? "Không tìm thấy công việc phù hợp" : "Chưa có công việc"}
                  </p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {filtered
                      ? "Thử thay đổi từ khóa hoặc bộ lọc."
                      : "Tạo Task đầu tiên để bắt đầu theo dõi công việc của dự án."}
                  </p>
                  {canCreate && !filtered && (
                    <Button onClick={onCreate}>
                      <Plus className="size-4" /> Tạo Task
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground" title={task.id}>
                    {task.id.slice(0, 8).toUpperCase()}
                  </span>
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-left font-medium hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => onEdit(task)}
                    >
                      {task.title}
                    </button>
                  ) : (
                    <span className="font-medium">{task.title}</span>
                  )}
                  {task.description && (
                    <p className="mt-1 line-clamp-1 max-w-lg text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {task.assigneeProjectMemberId ? (
                    <span title={task.assigneeProjectMemberId}>
                      Thành viên {task.assigneeProjectMemberId.slice(0, 8)}
                    </span>
                  ) : (
                    "Chưa giao"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {task.estimatedHours == null ? "—" : `${task.estimatedHours} giờ`}
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell>
                  <div className="flex max-w-56 flex-wrap gap-1">
                    {task.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="max-w-32">
                        <span className="truncate">{tag}</span>
                      </Badge>
                    ))}
                    {task.tags.length > 3 && (
                      <Badge variant="outline" title={task.tags.slice(3).join(", ")}>
                        +{task.tags.length - 3}
                      </Badge>
                    )}
                    {task.tags.length === 0 && <span className="text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Sửa Task ${task.title}`}
                      onClick={() => onEdit(task)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
