import { sessionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole } from "@/utils/rbac.utils";
import axios from "axios";
import dayjs from "dayjs";
import { ArrowLeft, ExternalLink, Loader2, Pen, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SessionDeleteDialog } from "../components/SessionDeleteDialog";

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}

function formatDate(value?: string) {
  return value && dayjs(value).isValid() ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—";
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeRole, hasPermission } = usePermissions();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const validId = !!id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const sessionQuery = useQuery({
    queryKey: ["session", "detail", id],
    queryFn: () => sessionApi.getById(id!),
    enabled: validId,
    retry: false,
  });
  const session = sessionQuery.data;
  const canManageDraft =
    !sessionQuery.isError &&
    session?.calendarVersionStatus === "DRAFT" &&
    normalizeRole(activeRole) === "ADMIN";
  const errorStatus = axios.isAxiosError(sessionQuery.error)
    ? sessionQuery.error.response?.status
    : undefined;
  let errorMessage = "Không thể tải thông tin buổi học. Vui lòng thử lại.";
  if (!validId) errorMessage = "ID buổi học không hợp lệ.";
  else if (errorStatus === 404) errorMessage = "Không tìm thấy buổi học hoặc buổi học đã bị xóa.";
  else if (errorStatus === 403) errorMessage = "Bạn không có quyền xem buổi học này.";
  const meetingLink = session?.meetingLink?.trim();
  const canOpenMeetingLink = !!meetingLink && /^https?:\/\//i.test(meetingLink);

  return (
    <MainLayout pathName={{ sessions: "Class Schedule", [id || "detail"]: "Chi tiết buổi học" }}>
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="break-words">{session?.title || "Chi tiết buổi học"}</CardTitle>
              <CardDescription className="mt-2">
                {session
                  ? `Thông tin buổi học #${session.id}`
                  : "Thông tin lập lịch và trạng thái buổi học."}
              </CardDescription>
            </div>
            {session && (
              <Badge
                variant={
                  session.status === "CANCELLED"
                    ? "destructive"
                    : session.status === "COMPLETED"
                      ? "default"
                      : "secondary"
                }
              >
                {session.status === "COMPLETED"
                  ? "Đã hoàn thành"
                  : session.status === "CANCELLED"
                    ? "Đã hủy"
                    : "Đã lên lịch"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {validId && sessionQuery.isPending ? (
            <div
              role="status"
              className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Đang tải thông tin buổi học...
            </div>
          ) : !validId || sessionQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                <p>{errorMessage}</p>
                {validId && errorStatus !== 403 && errorStatus !== 404 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      void sessionQuery.refetch();
                    }}
                  >
                    Thử lại
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ) : session ? (
            <div className="space-y-6 text-sm">
              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailField label="Lớp học">{session.classCode || "—"}</DetailField>
                <DetailField label="Bản lịch">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {session.calendarVersionNumber != null
                      ? `v${session.calendarVersionNumber}`
                      : session.calendarVersionId != null
                        ? `#${session.calendarVersionId}`
                        : "—"}
                    {session.calendarVersionStatus && (
                      <Badge variant="outline">{session.calendarVersionStatus}</Badge>
                    )}
                  </span>
                </DetailField>
                <DetailField label="Chủ đề">{session.topicName || "—"}</DetailField>
                <DetailField label="Giảng viên">{session.trainerName || "—"}</DetailField>
                <DetailField label="Bắt đầu">{formatDate(session.startTime)}</DetailField>
                <DetailField label="Kết thúc">{formatDate(session.endTime)}</DetailField>
                <DetailField label="Phòng học">{session.room || "—"}</DetailField>
                <DetailField label="Link học trực tuyến">
                  {canOpenMeetingLink ? (
                    <a
                      href={meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-start gap-1.5 text-primary underline underline-offset-4"
                    >
                      <span className="break-all">{meetingLink}</span>
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                    </a>
                  ) : (
                    meetingLink || "—"
                  )}
                </DetailField>
              </dl>
              <div className="space-y-4 border-t pt-5">
                <div>
                  <h3 className="mb-2 font-medium">Ghi chú</h3>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">
                    {session.notes || "Chưa có ghi chú."}
                  </p>
                </div>
                {session.cancelReason && (
                  <div>
                    <h3 className="mb-2 font-medium">Lý do hủy</h3>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {session.cancelReason}
                    </p>
                  </div>
                )}
                {session.isOverridden && (
                  <div>
                    <h3 className="mb-2 font-medium">Lý do cho phép trùng lịch</h3>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      {session.overrideReason || "—"}
                    </p>
                  </div>
                )}
              </div>
              <dl className="grid gap-5 border-t pt-5 sm:grid-cols-2">
                <DetailField label="Ngày tạo">{formatDate(session.createdAt)}</DetailField>
                <DetailField label="Người tạo">
                  {session.createdBy != null ? `#${session.createdBy}` : "—"}
                </DetailField>
                <DetailField label="Cập nhật gần nhất">{formatDate(session.updatedAt)}</DetailField>
                <DetailField label="Người cập nhật">
                  {session.updatedBy != null ? `#${session.updatedBy}` : "—"}
                </DetailField>
              </dl>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate("/sessions")}>
            <ArrowLeft className="size-4" />
            Quay lại danh sách
          </Button>
          {canManageDraft && (
            <div className="flex flex-wrap gap-2">
              {hasPermission("SESSION_UPDATE") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/sessions/" + id + "/edit")}
                >
                  <Pen className="size-4" />
                  Chỉnh sửa
                </Button>
              )}
              {hasPermission("SESSION_DELETE") && (
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4" />
                  Xóa buổi học
                </Button>
              )}
            </div>
          )}
        </CardFooter>
      </Card>
      {deleteOpen && session && (
        <SessionDeleteDialog
          session={session}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            navigate("/sessions", { replace: true });
          }}
        />
      )}
    </MainLayout>
  );
}
