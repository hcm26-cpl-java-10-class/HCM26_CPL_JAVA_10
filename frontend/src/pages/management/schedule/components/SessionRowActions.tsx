import { sessionApi } from "@/api";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SessionDTO, SessionStatus } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, Loader2, MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MAX_CANCEL_REASON_LENGTH = 500;
const SESSION_QUERY_KEY = ["session"] as const;

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          fieldErrors?: Record<string, string[]>;
          errors?: Record<string, string[]>;
        }
      | undefined;

    const fieldErrors = data?.fieldErrors ?? data?.errors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors)[0] : undefined;
    if (Array.isArray(firstFieldError) && firstFieldError.length > 0) {
      return firstFieldError[0];
    }

    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

interface SessionRowActionsProps {
  session: SessionDTO;
}

/**
 * Extra row actions for the /sessions page:
 * - PATCH /api/sessions/{id}/status  (complete / reset to scheduled)
 * - POST  /api/sessions/{id}/cancel  (with mandatory cancel reason)
 */
export function SessionRowActions({ session }: SessionRowActionsProps) {
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const sessionId = session.id;
  const status = session.status ?? "SCHEDULED";

  const invalidateSessions = () => queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: SessionStatus) => sessionApi.changeStatus(sessionId as number, nextStatus),
    onSuccess: async (updated) => {
      await invalidateSessions();
      toast.success(`Đã cập nhật trạng thái: ${updated.status ?? "—"}.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Không thể cập nhật trạng thái buổi học."));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      sessionApi.cancel(sessionId as number, {
        cancelReason: reason,
        version: session.version,
      }),
    onSuccess: async () => {
      await invalidateSessions();
      toast.success("Đã hủy buổi học.");
      setCancelOpen(false);
      setCancelReason("");
      setCancelError(null);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Không thể hủy buổi học.");
      setCancelError(message);
      toast.error(message);
    },
  });

  const handleConfirmCancel = () => {
    const reason = cancelReason.trim();

    if (!reason) {
      setCancelError("Vui lòng nhập lý do hủy buổi học.");
      return;
    }

    if (reason.length > MAX_CANCEL_REASON_LENGTH) {
      setCancelError(`Lý do hủy không được vượt quá ${MAX_CANCEL_REASON_LENGTH} ký tự.`);
      return;
    }

    setCancelError(null);
    cancelMutation.mutate(reason);
  };

  const openCancelDialog = () => {
    setCancelError(null);
    setCancelReason("");
    setCancelOpen(true);
  };

  const isBusy = statusMutation.isPending || cancelMutation.isPending;

  return (
    <PermissionGate permission="SESSION_UPDATE">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!sessionId || isBusy}
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <MoreHorizontal className="size-3.5 text-muted-foreground" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Trạng thái buổi học
          </DropdownMenuLabel>

          {status !== "COMPLETED" && status !== "CANCELLED" && (
            <DropdownMenuItem
              onSelect={() => statusMutation.mutate("COMPLETED")}
              disabled={statusMutation.isPending}
            >
              <CheckCircle2 className="mr-2 size-4 text-emerald-600" />
              Đánh dấu hoàn thành
            </DropdownMenuItem>
          )}

          {status === "COMPLETED" && (
            <DropdownMenuItem
              onSelect={() => statusMutation.mutate("SCHEDULED")}
              disabled={statusMutation.isPending}
            >
              <RotateCcw className="mr-2 size-4 text-muted-foreground" />
              Đặt lại: Đã lên lịch
            </DropdownMenuItem>
          )}

          {status === "SCHEDULED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={openCancelDialog}
                className="text-red-600 focus:text-red-600"
              >
                <XCircle className="mr-2 size-4" />
                Hủy buổi học…
              </DropdownMenuItem>
            </>
          )}

          {status === "CANCELLED" && (
            <DropdownMenuLabel className="max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">
              Đã hủy
              {session.cancelReason ? ` — ${session.cancelReason}` : "."}
            </DropdownMenuLabel>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (cancelMutation.isPending) return;
          setCancelOpen(open);
          if (!open) {
            setCancelError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="size-4 text-red-600" />
              </span>
              Hủy buổi học
            </DialogTitle>
            <DialogDescription>
              Buổi học “{session.title || session.classCode}” sẽ chuyển sang trạng thái{" "}
              <span className="font-medium text-destructive">Đã hủy</span>. Thao tác này không
              thể hoàn tác.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`cancel-reason-${sessionId}`}>
              Lý do hủy <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={`cancel-reason-${sessionId}`}
              value={cancelReason}
              onChange={(event) => {
                setCancelReason(event.target.value);
                if (cancelError) setCancelError(null);
              }}
              placeholder="Ví dụ: Giảng viên bận đột xuất, lớp nghỉ lễ…"
              maxLength={MAX_CANCEL_REASON_LENGTH}
              rows={4}
              disabled={cancelMutation.isPending}
              aria-invalid={!!cancelError}
            />
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-destructive">{cancelError ?? ""}</p>
              <p className="shrink-0 text-xs text-muted-foreground">
                {cancelReason.length}/{MAX_CANCEL_REASON_LENGTH}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Đóng
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang hủy…
                </>
              ) : (
                <>
                  <XCircle className="mr-2 size-4" />
                  Xác nhận hủy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
