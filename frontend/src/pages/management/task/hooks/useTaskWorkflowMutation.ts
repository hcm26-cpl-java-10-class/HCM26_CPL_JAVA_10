import { taskApi } from "@/api/features/task.api";
import type { TaskStatus } from "@/types/features/task";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTaskError, type TaskRequestError } from "../task-form.utils";

export type TaskWorkflowAction =
  | { kind: "STATUS"; status: TaskStatus; version: number }
  | { kind: "DELETE"; version: number };

export function useTaskWorkflowMutation(
  taskId: string,
  onSuccess: (action: TaskWorkflowAction) => void,
  onSettled?: (action: TaskWorkflowAction) => void,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<TaskRequestError | null>(null);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingRef = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ action, key }: { action: TaskWorkflowAction; key: string }) => {
      if (action.kind === "DELETE") {
        return taskApi.delete(taskId, action.version, key);
      }
      return taskApi.changeStatus(taskId, { status: action.status, version: action.version }, key);
    },
    onSuccess: async (_, { action }) => {
      if (action.kind === "DELETE") {
        toast.success("Subtask deleted successfully.");
        onSuccess(action);
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] === "tasks" && query.queryKey.includes(taskId),
        });
        await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        await queryClient.invalidateQueries({ queryKey: ["backlog-subtasks"] });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["backlog-subtasks"] });
      toast.success("Subtask status updated successfully.");
      onSuccess(action);
    },
  });

  const execute = async (
    action: TaskWorkflowAction,
  ): Promise<{ success: boolean; status?: number }> => {
    if (pendingRef.current) return { success: false };
    const fingerprint = JSON.stringify({ taskId, ...action });
    if (requestRef.current?.fingerprint !== fingerprint) {
      requestRef.current = { fingerprint, key: crypto.randomUUID() };
    }
    pendingRef.current = true;
    setError(null);
    try {
      await mutation.mutateAsync({ action, key: requestRef.current.key });
      return { success: true };
    } catch (cause) {
      const result = getTaskError(cause);
      setError(result);
      if (action.kind === "DELETE") {
        toast.error(Object.values(result.fieldErrors).flat()[0] ?? result.message);
      }
      if (result.status === 404 || (action.kind === "DELETE" && result.status !== undefined)) {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        void queryClient.invalidateQueries({ queryKey: ["backlog-subtasks"] });
      }
      return { success: false, status: result.status };
    } finally {
      pendingRef.current = false;
      onSettled?.(action);
    }
  };

  return { execute, error, isPending: mutation.isPending, clearError: () => setError(null) };
}
