import { taskApi } from "@/api/features/task.api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePermissions } from "@/hooks/usePermissions";
import type { TaskDTO } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getTaskError, type TaskRequestError } from "../task-form.utils";
import type { TaskWorkflowAction } from "../hooks/useTaskWorkflowMutation";
import { TaskStatusBadge } from "./TaskBadges";
import { TaskMutationError } from "./TaskMutationError";

interface TaskDependencyDialogProps {
  task: TaskDTO;
  pending: boolean;
  error: TaskRequestError | null;
  onClose: () => void;
  onReload: () => void;
  onClearError: () => void;
  onSubmit: (action: TaskWorkflowAction) => Promise<{ success: boolean; status?: number }>;
}

export function TaskDependencyDialog({
  task,
  pending,
  error,
  onClose,
  onReload,
  onClearError,
  onSubmit,
}: TaskDependencyDialogProps) {
  const { user, activeRole } = usePermissions();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<TaskDTO | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const optionsQuery = useQuery({
    queryKey: [
      "tasks",
      user.email,
      activeRole,
      "dependency-options",
      task.id,
      task.predecessorTaskIds,
      appliedSearch,
      page,
    ],
    queryFn: () =>
      taskApi.getPage({ page, size: 8, sort: "title,asc" }, appliedSearch, {
        projectId: task.projectId,
        excludeIds: [task.id, ...(task.predecessorTaskIds ?? [])],
      }),
    retry: false,
  });
  const options = optionsQuery.data?.content ?? [];

  const submit = async () => {
    if (!selected || pending) return;
    const result = await onSubmit({
      kind: "ADD",
      predecessorTaskId: selected.id,
      version: task.version,
    });
    if (result.status === 404) setSelected(null);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add prerequisite</DialogTitle>
          <DialogDescription>
            Select a task that must be Done before "{task.title}" can start.
            {task.status !== "TODO" && " Only completed prerequisites can be added after a task has started."}
          </DialogDescription>
        </DialogHeader>
        <TaskMutationError error={error} onReload={onReload} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search prerequisite tasks"
            className="pl-9"
            autoFocus
            disabled={pending}
            value={search}
            placeholder="Search by title or description..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {optionsQuery.isFetching ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" /> Loading task...
          </div>
        ) : optionsQuery.isError ? (
          <div role="alert" className="grid gap-3 text-sm text-destructive">
            <p>{getTaskError(optionsQuery.error).message}</p>
            <Button variant="outline" onClick={() => void optionsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : options.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No matching tasks found.
          </p>
        ) : (
          <RadioGroup
            value={selected?.id ?? ""}
            disabled={pending}
            aria-label="Prerequisites"
            aria-invalid={!!error?.fieldErrors.predecessorTaskId?.length}
            onValueChange={(id) => {
              setSelected(options.find((option) => option.id === id) ?? null);
              onClearError();
            }}
          >
            {options.map((option) => (
              <Label
                key={option.id}
                htmlFor={`dependency-${option.id}`}
                className={`flex items-center gap-3 rounded-lg border p-3 ${task.status !== "TODO" && option.status !== "DONE" ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${selected?.id === option.id ? "border-primary bg-accent" : ""}`}
              >
                <RadioGroupItem
                  id={`dependency-${option.id}`}
                  value={option.id}
                  disabled={pending || (task.status !== "TODO" && option.status !== "DONE")}
                />
                <span className="min-w-0 flex-1 break-words text-sm leading-relaxed">
                  {option.title}
                </span>
                <TaskStatusBadge status={option.status} />
              </Label>
            ))}
          </RadioGroup>
        )}
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {page + 1}/{Math.max(1, optionsQuery.data?.totalPages ?? 0)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page of prerequisites"
              disabled={pending || optionsQuery.isFetching || page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page of prerequisites"
              disabled={
                pending ||
                optionsQuery.isFetching ||
                page + 1 >= (optionsQuery.data?.totalPages ?? 0)
              }
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        {selected && (
          <p className="text-sm">
            Selected: <strong>{selected.title}</strong>
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !selected} onClick={() => void submit()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Adding..." : "Add dependency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
