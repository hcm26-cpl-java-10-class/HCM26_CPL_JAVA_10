import { sessionApi } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { SessionDTO } from "@/types";
import { getApiErrorCorrelationId, getApiErrorMessage } from "@/utils/api-error.utils";
import { ADMIN_ROLE } from "@/utils/rbac.utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Info, Loader2, NotebookPen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_NOTES_LENGTH = 2000;
const MAX_REASON_LENGTH = 500;
const SESSION_QUERY_KEY = ["session"] as const;

type TargetStatus = "KEEP" | "COMPLETED" | "CANCELLED";

const createIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-notes-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

interface SessionNotesDialogProps {
  session: SessionDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * T2 / US-F15-02 — "Cập nhật notes" trên trang /sessions.
 *
 * Gọi `PATCH /api/v1/sessions/{id}/notes` (kèm `If-Match` + `Idempotency-Key`).
 * `updatedBy`/`updatedAt` do server ghi (BR-SES-06) nên không có input cho client.
 */
export function SessionNotesDialog({ session, open, onOpenChange }: SessionNotesDialogProps) {
  const queryClient = useQueryClient();
  const { activeRole } = usePermissions();
  const isAdmin = activeRole === ADMIN_ROLE;

  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<TargetStatus>("KEEP");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  const sessionId = session?.id;
  const currentStatus = session?.status ?? "SCHEDULED";
  const canTransition = currentStatus === "SCHEDULED";

  useEffect(() => {
    if (!open) return;
    setNotes(session?.notes ?? "");
    setTarget("KEEP");
    setReason("");
    setError(null);
    // Mỗi lần mở dialog là một thao tác mới: key mới để không replay kết quả cũ.
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [open, session?.id, session?.notes]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!sessionId) throw new Error("Thiếu mã buổi học.");

      return sessionApi.updateNotes(
        sessionId,
        {
          status: target === "KEEP" ? undefined : target,
          // Chuỗi rỗng = chủ động xóa ghi chú (backend chuẩn hóa thành null).
          notes: notes.trim(),
          reason: target === "CANCELLED" ? reason.trim() : null,
          version: session?.version ?? null,
        },
        { idempotencyKey: idempotencyKeyRef.current, version: session?.version ?? null }
      );
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      const replayed = result.idempotentReplay ? " (kết quả trả lại từ lần gửi trước)" : "";
      toast.success(
        `Đã lưu ghi chú${result.historyId ? " và ghi nhận lịch sử trạng thái" : ""}${replayed}.`,
        {
          description: result.updatedAt
            ? `Cập nhật lúc ${dayjs(result.updatedAt).format("DD/MM/YYYY HH:mm:ss")}${
                result.updatedBy ? ` · người cập nhật #${result.updatedBy}` : ""
              }`
            : undefined,
        }
      );
      onOpenChange(false);
    },
    onError: (mutationError) => {
      const message = getApiErrorMessage(mutationError, "Không thể cập nhật ghi chú buổi học.");
      const correlationId = getApiErrorCorrelationId(mutationError);
      setError(correlationId ? `${message} (correlationId: ${correlationId})` : message);
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    const trimmedNotes = notes.trim();
    const originalNotes = (session?.notes ?? "").trim();

    if (trimmedNotes.length > MAX_NOTES_LENGTH) {
      setError(`Ghi chú không được vượt quá ${MAX_NOTES_LENGTH} ký tự.`);
      return;
    }

    if (target === "CANCELLED" && !reason.trim()) {
      setError("Vui lòng nhập lý do hủy buổi học.");
      return;
    }

    if (trimmedNotes === originalNotes && target === "KEEP") {
      setError("Không có thay đổi nào để lưu.");
      return;
    }

    setError(null);
    mutation.mutate();
  };

  const lastUpdate = session?.updatedAt
    ? `Cập nhật gần nhất: ${dayjs(session.updatedAt).format("DD/MM/YYYY HH:mm:ss")}${
        session.updatedBy ? ` · người cập nhật #${session.updatedBy}` : ""
      }`
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
              <NotebookPen className="size-4 text-primary" />
            </span>
            Cập nhật ghi chú
          </DialogTitle>
          <DialogDescription>
            Ghi chú cho buổi học “{session?.title || session?.classCode || "—"}”. Có thể kèm chuyển
            trạng thái; hệ thống tự ghi người cập nhật, thời điểm và lịch sử bất biến.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`session-notes-${sessionId}`}>Ghi chú</Label>
            <Textarea
              id={`session-notes-${sessionId}`}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Ví dụ: Đã dạy bù phần OOP, lớp nghỉ giữa giờ 15 phút…"
              maxLength={MAX_NOTES_LENGTH}
              rows={4}
              disabled={mutation.isPending}
            />
            <div className="flex justify-end">
              <p className="text-xs text-muted-foreground">
                {notes.length}/{MAX_NOTES_LENGTH}
              </p>
            </div>
          </div>

          {canTransition && (
            <div className="grid gap-2">
              <Label htmlFor={`session-status-${sessionId}`}>Trạng thái sau khi lưu</Label>
              <Select
                value={target}
                onValueChange={(value) => {
                  setTarget(value as TargetStatus);
                  if (value !== "CANCELLED") setReason("");
                  if (error) setError(null);
                }}
                disabled={mutation.isPending}
              >
                <SelectTrigger id={`session-status-${sessionId}`} className="w-full">
                  <SelectValue placeholder="Giữ nguyên trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KEEP">Giữ nguyên trạng thái</SelectItem>
                  <SelectItem value="COMPLETED">Hoàn thành buổi học</SelectItem>
                  {isAdmin && <SelectItem value="CANCELLED">Hủy buổi học</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}

          {target === "CANCELLED" && (
            <div className="grid gap-2">
              <Label htmlFor={`session-reason-${sessionId}`}>
                Lý do hủy <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id={`session-reason-${sessionId}`}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ví dụ: Giảng viên bận đột xuất, lớp nghỉ lễ…"
                maxLength={MAX_REASON_LENGTH}
                rows={3}
                disabled={mutation.isPending}
              />
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground">
                  {reason.length}/{MAX_REASON_LENGTH}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Người cập nhật và thời điểm do hệ thống tự ghi (không gửi từ client).
              {lastUpdate ? ` ${lastUpdate}.` : ""}
            </span>
          </div>

          <p className="min-h-5 text-xs text-destructive">{error ?? ""}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Đóng
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Đang lưu…
              </>
            ) : (
              "Lưu ghi chú"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
