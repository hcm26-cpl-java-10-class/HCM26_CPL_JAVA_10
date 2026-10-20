import { sessionApi } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SessionDTO } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import dayjs from "dayjs";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSessionErrorMessage } from "./session-form.utils";

interface SessionDeleteDialogProps {
  session: SessionDTO;
  onClose: () => void;
  onDeleted: () => void;
}

export function SessionDeleteDialog({ session, onClose, onDeleted }: SessionDeleteDialogProps) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => sessionApi.delete(String(session.id)),
    onSuccess: async () => {
      onDeleted();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["version-sessions"] }),
      ]);
      toast.success("Đã xóa buổi học khỏi bản lịch nháp.");
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error) && [403, 404, 409].includes(error.response?.status || 0))
        void queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
  const errorStatus = axios.isAxiosError(deleteMutation.error)
    ? deleteMutation.error.response?.status
    : undefined;
  const blocked =
    session.calendarVersionStatus !== "DRAFT" || [403, 404, 409].includes(errorStatus || 0);
  const close = () => {
    if (!deleteMutation.isPending) onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={!deleteMutation.isPending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            Xóa buổi học
          </DialogTitle>
          <DialogDescription>
            Buổi học sẽ bị xóa khỏi bản lịch nháp. Thao tác này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid min-w-0 gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Buổi học</dt>
            <dd className="break-words font-medium">{session.title}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lớp học</dt>
            <dd>{session.classCode}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bắt đầu</dt>
            <dd>{dayjs(session.startTime).format("DD/MM/YYYY HH:mm")}</dd>
          </div>
        </dl>
        {(deleteMutation.isError || session.calendarVersionStatus !== "DRAFT") && (
          <Alert variant="destructive">
            <AlertDescription>
              {session.calendarVersionStatus !== "DRAFT"
                ? "Chỉ có thể xóa buổi học thuộc bản lịch DRAFT."
                : getSessionErrorMessage(
                    deleteMutation.error,
                    "Không thể xóa buổi học. Vui lòng thử lại.",
                  )}
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={deleteMutation.isPending}
          >
            Đóng
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending || blocked}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {deleteMutation.isPending ? "Đang xóa..." : "Xác nhận xóa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
