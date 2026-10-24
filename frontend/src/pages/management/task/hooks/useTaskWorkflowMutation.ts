import { taskApi } from "@/api/features/task.api";
import type { TaskStatus } from "@/types/features/task";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTaskError, type TaskRequestError } from "../task-form.utils";

export type TaskWorkflowAction =
  | { kind: "STATUS"; status: TaskStatus; version: number }
  | { kind: "ADD"; predecessorTaskId: string; version: number }
  | { kind: "REMOVE"; predecessorTaskId: string; version: number };

export function useTaskWorkflowMutation(taskId: string, onSuccess: () => void) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<TaskRequestError | null>(null);
  const requestRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingRef = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ action, key }: { action: TaskWorkflowAction; key: string }) => {
      if (action.kind === "STATUS") {
        return taskApi.changeStatus(
          taskId,
          { status: action.status, version: action.version },
          key,
        );
      }
      if (action.kind === "ADD") {
        return taskApi.addDependency(
          taskId,
          { predecessorTaskId: action.predecessorTaskId, version: action.version },
          key,
        );
      }
      return taskApi.removeDependency(taskId, action.predecessorTaskId, action.version, key);
    },
    onSuccess: async (_, { action }) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      const messages = {
        STATUS: "Cập nhật trạng thái thành công.",
        ADD: "Đã thêm Task tiền đề.",
        REMOVE: "Đã gỡ liên kết phụ thuộc.",
      };
      toast.success(messages[action.kind]);
      onSuccess();
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
      if (result.status === 404) {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
      return { success: false, status: result.status };
    } finally {
      pendingRef.current = false;
    }
  };

  return { execute, error, isPending: mutation.isPending, clearError: () => setError(null) };
}
