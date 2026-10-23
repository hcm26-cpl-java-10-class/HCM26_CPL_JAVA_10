import { taskApi } from "@/api/features/task.api";
import { FieldError } from "@/components/datatable/modal/form/FieldError";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { TaskDTO, TaskPayload, TaskPriority } from "@/types/features/task";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileText, Loader2, Save, SlidersHorizontal } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  getTaskError,
  normalizeTags,
  taskPriorityOptions,
  toTaskFormValues,
  toTaskPayload,
  validateTaskForm,
  type TaskFieldErrors,
  type TaskFormValues,
} from "../task-form.utils";
import { TaskStatusBadge } from "./TaskBadges";
import { TaskTagsInput } from "./TaskTagsInput";

interface TaskFormProps {
  projectId: string;
  task?: TaskDTO;
  onSaved: (task: TaskDTO) => void;
  onCancel: () => void;
}

function TaskField({
  name,
  label,
  required,
  errors,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`task-${name}`}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      <div id={`task-${name}-error`}>
        <FieldError errors={errors} />
      </div>
    </div>
  );
}

export function TaskForm({ projectId, task, onSaved, onCancel }: TaskFormProps) {
  const { user, activeRole } = usePermissions();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<TaskFormValues>(() => toTaskFormValues(task));
  const [draftTag, setDraftTag] = useState("");
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [submitError, setSubmitError] = useState<ReturnType<typeof getTaskError> | null>(null);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submittingRef = useRef(false);

  const tagsQuery = useQuery({
    queryKey: ["tasks", user.email, activeRole, "tags", projectId],
    queryFn: () => taskApi.getTags(projectId),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: ({ payload, requestId }: { payload: TaskPayload; requestId: string }) =>
      task ? taskApi.update(task.id, payload, requestId) : taskApi.create(payload, requestId),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(task ? "Cập nhật Task thành công." : "Tạo Task thành công.");
      onSaved(saved);
    },
    onError: (error) => {
      const result = getTaskError(error);
      setErrors(result.fieldErrors);
      setSubmitError(result);
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const changeField = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const submittedValues = {
      ...values,
      tags: normalizeTags([...values.tags, ...(draftTag.trim() ? [draftTag] : [])]),
    };
    const fieldErrors = validateTaskForm(submittedValues);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      requestAnimationFrame(() =>
        document.getElementById(`task-${Object.keys(fieldErrors)[0]}`)?.focus(),
      );
      return;
    }
    const payload = toTaskPayload(submittedValues, projectId, task);
    const fingerprint = JSON.stringify(payload);
    if (requestRef.current?.fingerprint !== fingerprint) {
      requestRef.current = { fingerprint, key: crypto.randomUUID() };
    }
    setSubmitError(null);
    submittingRef.current = true;
    saveMutation.mutate({ payload, requestId: requestRef.current.key });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5" aria-busy={saveMutation.isPending}>
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>
            {submitError.status === 409 ? "Dữ liệu đã thay đổi" : "Chưa lưu được Task"}
          </AlertTitle>
          <AlertDescription>{submitError.message}</AlertDescription>
        </Alert>
      )}
      <fieldset
        disabled={saveMutation.isPending}
        className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Thông tin công việc
            </CardTitle>
            <CardDescription>Mô tả rõ công việc để cả nhóm cùng theo dõi.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <TaskField name="title" label="Tên Task" required errors={errors.title}>
              <Input
                id="task-title"
                autoFocus
                value={values.title}
                maxLength={250}
                aria-invalid={!!errors.title?.length}
                aria-describedby={errors.title?.length ? "task-title-error" : undefined}
                placeholder="Ví dụ: Xây dựng API đăng nhập"
                onChange={(event) => changeField("title", event.target.value)}
              />
              <span className="text-right text-xs text-muted-foreground">
                {values.title.length}/250 ký tự
              </span>
            </TaskField>
            <TaskField name="description" label="Mô tả" errors={errors.description}>
              <Textarea
                id="task-description"
                value={values.description}
                rows={10}
                className="min-h-48 resize-y"
                aria-invalid={!!errors.description?.length}
                placeholder="Nội dung cần thực hiện, kết quả mong đợi..."
                onChange={(event) => changeField("description", event.target.value)}
              />
            </TaskField>
            <TaskField name="tags" label="Nhãn (Tag)" errors={errors.tags}>
              <TaskTagsInput
                value={values.tags}
                draft={draftTag}
                suggestions={tagsQuery.data ?? []}
                disabled={saveMutation.isPending}
                invalid={!!errors.tags?.length}
                onChange={(tags) => changeField("tags", tags)}
                onDraftChange={(draft) => {
                  setDraftTag(draft);
                  setErrors((current) => ({ ...current, tags: undefined }));
                }}
              />
              {tagsQuery.isError && (
                <p className="text-xs text-muted-foreground">
                  Chưa tải được nhãn có sẵn. Bạn vẫn có thể nhập nhãn mới.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nhập nhãn rồi nhấn Enter hoặc chọn nhãn có sẵn trong dự án.
              </p>
            </TaskField>
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" /> Phân công & ước lượng
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Trạng thái</span>
              <TaskStatusBadge status={task?.status ?? "TODO"} />
            </div>
            <TaskField
              name="assigneeProjectMemberId"
              label="Người thực hiện"
              errors={errors.assigneeProjectMemberId}
            >
              <Select value={values.assigneeProjectMemberId || "unassigned"} disabled>
                <SelectTrigger id="task-assigneeProjectMemberId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Chưa giao</SelectItem>
                  {values.assigneeProjectMemberId && (
                    <SelectItem value={values.assigneeProjectMemberId}>
                      Thành viên {values.assigneeProjectMemberId.slice(0, 8)}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Danh sách thành viên của dự án chưa được thiết lập.
              </p>
            </TaskField>
            <TaskField
              name="estimatedHours"
              label="Ước lượng (giờ)"
              required={!!values.assigneeProjectMemberId}
              errors={errors.estimatedHours}
            >
              <Input
                id="task-estimatedHours"
                type="number"
                min="0"
                step="any"
                value={values.estimatedHours}
                aria-invalid={!!errors.estimatedHours?.length}
                aria-describedby={
                  errors.estimatedHours?.length ? "task-estimatedHours-error" : undefined
                }
                placeholder="Ví dụ: 1.5"
                onChange={(event) => changeField("estimatedHours", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Có thể để trống khi chưa giao Task. Khi đã giao, ước lượng phải lớn hơn 0.
              </p>
            </TaskField>
            <TaskField name="priority" label="Độ ưu tiên" errors={errors.priority}>
              <Select
                value={values.priority}
                disabled={saveMutation.isPending}
                onValueChange={(value) => changeField("priority", value as TaskPriority)}
              >
                <SelectTrigger
                  id="task-priority"
                  className="w-full"
                  aria-invalid={!!errors.priority?.length}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taskPriorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TaskField>
          </CardContent>
        </Card>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={saveMutation.isPending}
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saveMutation.isPending ? "Đang lưu..." : "Lưu Task"}
        </Button>
      </div>
    </form>
  );
}
