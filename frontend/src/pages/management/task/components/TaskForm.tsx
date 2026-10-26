import { taskApi } from "@/api/features/task.api";
import { taskAlertApi } from "@/api/features/task-alert.api";
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
      <div id={`task-${name}-error`} aria-live="polite">
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
  const membersQuery = useQuery({
    queryKey: ["task-alert-assignees", user.email, activeRole, projectId],
    queryFn: ({ signal }) => taskAlertApi.assignees(projectId, signal),
    retry: false, gcTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: ({ payload, requestId }: { payload: TaskPayload; requestId: string }) =>
      task ? taskApi.update(task.id, payload, requestId) : taskApi.create(payload, requestId),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(task ? "Task updated successfully." : "Task created successfully.");
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
    setSubmitError(null);
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
    submittingRef.current = true;
    saveMutation.mutate({ payload, requestId: requestRef.current.key });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5" aria-busy={saveMutation.isPending}>
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>
            {submitError.status === 409 ? "Data has changed" : "Unable to save task"}
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
              <FileText className="size-4 text-primary" /> Task details
            </CardTitle>
            <CardDescription>Describe the task so the team can track the work.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <TaskField name="title" label="Task title" required errors={errors.title}>
              <Input
                id="task-title"
                autoFocus
                value={values.title}
                aria-invalid={!!errors.title?.length}
                aria-describedby={errors.title?.length ? "task-title-error" : undefined}
                placeholder="For example: Build the login API"
                onChange={(event) => changeField("title", event.target.value)}
              />
              <span
                className={`text-right text-xs ${values.title.trim().length > 250 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {values.title.length}/250 characters
              </span>
            </TaskField>
            <TaskField name="description" label="Description" errors={errors.description}>
              <Textarea
                id="task-description"
                value={values.description}
                rows={10}
                className="min-h-48 resize-y"
                aria-invalid={!!errors.description?.length}
                aria-describedby={errors.description?.length ? "task-description-error" : undefined}
                placeholder="Describe the work and expected results..."
                onChange={(event) => changeField("description", event.target.value)}
              />
            </TaskField>
            <TaskField name="tags" label="Tags" errors={errors.tags}>
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
                  Unable to load existing tags. You can still enter new tags.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter a tag and press Enter, or select an existing project tag.
              </p>
            </TaskField>
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" /> Assignment & estimate
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Status</span>
              <TaskStatusBadge status={task?.status ?? "TODO"} />
            </div>
            <TaskField
              name="assigneeProjectMemberId"
              label="Assignee"
              errors={errors.assigneeProjectMemberId}
            >
              <Select value={values.assigneeProjectMemberId || "unassigned"}
                onValueChange={value => changeField("assigneeProjectMemberId", value === "unassigned" ? "" : value)}
                disabled={membersQuery.isPending || membersQuery.isError}>
                <SelectTrigger id="task-assigneeProjectMemberId" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {values.assigneeProjectMemberId && !membersQuery.data?.some(member => member.id === values.assigneeProjectMemberId) && (
                    <SelectItem value={values.assigneeProjectMemberId}>
                      Member {values.assigneeProjectMemberId.slice(0, 8)}
                    </SelectItem>
                  )}
                  {membersQuery.data?.map(member => <SelectItem key={member.id} value={member.id}>{member.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {membersQuery.isError ? "Project members are unavailable." : membersQuery.isPending ? "Loading project members..." : "Select an active project member."}
              </p>
            </TaskField>
            <TaskField name="deadline" label="Deadline (local time)" errors={errors.deadline}>
              <Input id="task-deadline" type="datetime-local" value={values.deadline}
                aria-invalid={!!errors.deadline?.length}
                onChange={event => changeField("deadline", event.target.value)} />
            </TaskField>
            <TaskField
              name="estimatedHours"
              label="Estimate (hours)"
              required={!!values.assigneeProjectMemberId}
              errors={errors.estimatedHours}
            >
              <Input
                id="task-estimatedHours"
                type="text"
                inputMode="decimal"
                value={values.estimatedHours}
                aria-invalid={!!errors.estimatedHours?.length}
                aria-describedby={
                  errors.estimatedHours?.length ? "task-estimatedHours-error" : undefined
                }
                placeholder="For example: 1.5"
                onChange={(event) => changeField("estimatedHours", event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional for unassigned tasks. Assigned tasks require an estimate greater than 0.
              </p>
            </TaskField>
            <TaskField name="priority" label="Priority" errors={errors.priority}>
              <Select
                value={values.priority}
                disabled={saveMutation.isPending}
                onValueChange={(value) => changeField("priority", value as TaskPriority)}
              >
                <SelectTrigger
                  id="task-priority"
                  className="w-full"
                  aria-invalid={!!errors.priority?.length}
                  aria-describedby={errors.priority?.length ? "task-priority-error" : undefined}
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
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saveMutation.isPending ? "Saving..." : "Save task"}
        </Button>
      </div>
    </form>
  );
}
