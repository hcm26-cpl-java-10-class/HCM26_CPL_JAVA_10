import { studySessionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { StudySessionDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, Ban, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

function getErrorMessage(
  error: unknown,
  fallback = "Unable to cancel the study session.",
): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallback;
  }

  const status = error.response?.status;
  const response = error.response?.data;
  const validationError = Object.values(response?.errors ?? {}).flat().join(", ");
  const message = validationError || response?.message;

  if (status === 400) {
    return `400: ${message || fallback}`;
  }
  if (status === 403) {
    return `403: ${message || "You do not have permission to update this study session."}`;
  }
  if (status === 409) {
    return `409: ${message || "This study session can no longer be updated."}`;
  }

  return message || fallback;
}

function getStatusLabel(status?: StudySessionDTO["status"]): string {
  switch (status) {
    case "CANCELLED":
      return "Đã hủy";
    case "COMPLETED":
      return "Đã hoàn thành";
    case "SCHEDULED":
      return "Đã lên lịch";
    default:
      return "Không xác định";
  }
}

export function StudySessionDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");

  const sessionQuery = useQuery({
    queryKey: ["study-session", "detail", id],
    queryFn: () => studySessionApi.getById(id as string),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => studySessionApi.cancel(id as string, reason.trim()),
    onSuccess: async (updatedSession) => {
      queryClient.setQueryData(["study-session", "detail", id], updatedSession);
      await queryClient.invalidateQueries({ queryKey: ["study-session"] });
      setDialogOpen(false);
      setReason("");
      toast.success("Buổi học đã được hủy.");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => studySessionApi.complete(id as string, completionNotes.trim()),
    onSuccess: async (updatedSession) => {
      queryClient.setQueryData(["study-session", "detail", id], updatedSession);
      await queryClient.invalidateQueries({ queryKey: ["study-session"] });
      setCompletionDialogOpen(false);
      setCompletionNotes("");
      toast.success("Buổi học đã được hoàn thành.");
    },
  });

  const session = sessionQuery.data;
  const canCancel = session?.status === "SCHEDULED";
  const canComplete = session?.status === "SCHEDULED";

  if (!id) {
    return (
      <MainLayout pathName={{ "study-sessions": "Buổi học", detail: "Chi tiết" }}>
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Thiếu mã buổi học</CardTitle>
            <CardDescription>Không xác định được buổi học cần xem.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate("/study-sessions")}>
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </Button>
          </CardFooter>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout pathName={{ "study-sessions": "Buổi học", detail: "Chi tiết" }}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Chi tiết buổi học</CardTitle>
          <CardDescription>Thông tin buổi học #{id}.</CardDescription>
        </CardHeader>

        {sessionQuery.isLoading ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">Đang tải thông tin buổi học...</p>
          </CardContent>
        ) : sessionQuery.isError ? (
          <CardContent>
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(sessionQuery.error)}
            </p>
          </CardContent>
        ) : session ? (
          <CardContent className="grid gap-4 text-sm">
            <div className="grid gap-1">
              <span className="font-medium text-muted-foreground">Trạng thái</span>
              <div>
                <Badge variant={session.status === "CANCELLED" ? "destructive" : "secondary"}>
                  {getStatusLabel(session.status)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Tiêu đề</span>
                <span className="font-semibold">{session.title || "-"}</span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Môn học</span>
                <span>{session.subjectName || "-"}</span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Ngày học</span>
                <span>{session.sessionDate || "-"}</span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Thời gian</span>
                <span>
                  {session.startTime || "-"} - {session.endTime || "-"}
                </span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Phòng</span>
                <span>{session.room || "-"}</span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Giảng viên</span>
                <span>{session.lecturer || "-"}</span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Loại buổi học</span>
                <span>{session.type || "-"}</span>
              </div>
            </div>

            {session.description && (
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Mô tả</span>
                <p className="leading-6">{session.description}</p>
              </div>
            )}

            {session.cancelReason && (
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Lý do hủy</span>
                <p className="leading-6">{session.cancelReason}</p>
              </div>
            )}

            {session.notes && (
              <div className="grid gap-1">
                <span className="font-medium text-muted-foreground">Ghi chú hoàn thành</span>
                <p className="leading-6">{session.notes}</p>
              </div>
            )}
          </CardContent>
        ) : null}

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/study-sessions")}>
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          {canCancel && (
            <PermissionGate permission="STUDY_SESSION_UPDATE">
              <Button variant="destructive" onClick={() => setDialogOpen(true)}>
                <Ban className="h-4 w-4" />
                Hủy buổi
              </Button>
            </PermissionGate>
          )}
          {canComplete && (
            <PermissionGate permission="STUDY_SESSION_UPDATE">
              <Button
                onClick={() => {
                  completeMutation.reset();
                  setCompletionNotes("");
                  setCompletionDialogOpen(true);
                }}
              >
                <CheckCircle className="h-4 w-4" />
                Hoàn thành buổi học
              </Button>
            </PermissionGate>
          )}
        </CardFooter>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (cancelMutation.isPending) {
            return;
          }
          setDialogOpen(open);
          if (open) {
            cancelMutation.reset();
          } else {
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy buổi học</DialogTitle>
            <DialogDescription>
              Nhập lý do hủy. Thông tin này sẽ được lưu cùng buổi học.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="cancel-reason" className="font-medium">
              Lý do hủy
            </label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              disabled={cancelMutation.isPending}
              aria-invalid={cancelMutation.isError}
              placeholder="Nhập lý do (tối đa 500 ký tự)"
            />
            <p className="text-xs text-muted-foreground">{reason.length}/500</p>
            {cancelMutation.isError && (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(cancelMutation.error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Đóng
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={!reason.trim() || reason.length > 500 || cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Đang hủy..." : "Xác nhận hủy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={completionDialogOpen}
        onOpenChange={(open) => {
          if (completeMutation.isPending) {
            return;
          }
          setCompletionDialogOpen(open);
          if (open) {
            completeMutation.reset();
          } else {
            setCompletionNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hoàn thành buổi học</DialogTitle>
            <DialogDescription>
              Xác nhận hoàn thành buổi học. Bạn có thể thêm ghi chú hoặc để trống.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="completion-notes" className="font-medium">
              Ghi chú hoàn thành (không bắt buộc)
            </label>
            <Textarea
              id="completion-notes"
              value={completionNotes}
              onChange={(event) => setCompletionNotes(event.target.value)}
              maxLength={1000}
              disabled={completeMutation.isPending}
              aria-invalid={completeMutation.isError}
              placeholder="Nhập ghi chú (tối đa 1000 ký tự)"
            />
            <p className="text-xs text-muted-foreground">{completionNotes.length}/1000</p>
            {completeMutation.isError && (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(
                  completeMutation.error,
                  "Không thể hoàn thành buổi học.",
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompletionDialogOpen(false)}
              disabled={completeMutation.isPending}
            >
              Đóng
            </Button>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completionNotes.length > 1000 || completeMutation.isPending}
            >
              {completeMutation.isPending ? "Đang hoàn thành..." : "Xác nhận hoàn thành"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
