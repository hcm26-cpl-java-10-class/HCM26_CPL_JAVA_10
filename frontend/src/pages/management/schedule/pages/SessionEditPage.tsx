import { sessionApi, sessionFormApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { usePermissions } from "@/hooks/usePermissions";
import type { SessionDTO } from "@/types";
import { normalizeRole } from "@/utils/rbac.utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ConflictWarningModal } from "../components/ConflictWarningModal";
import { SessionFormFields } from "../components/SessionFormFields";
import {
  formatSessionTime,
  getSessionErrorMessage,
  getSessionFieldErrors,
  getTrainerName,
  toSessionForm,
  validateSessionForm,
  type SessionFormValues,
} from "../components/session-form.utils";

function SessionEditor({ session }: { session: SessionDTO }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => toSessionForm(session));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");
  const [pendingRequest, setPendingRequest] = useState<SessionDTO | null>(null);

  const topicsQuery = useQuery({
    queryKey: ["session-form", "topics"],
    queryFn: sessionFormApi.getTopics,
  });
  const trainersQuery = useQuery({
    queryKey: ["session-form", "trainers"],
    queryFn: sessionFormApi.getTrainers,
  });
  const classQuery = useQuery({
    queryKey: ["session-form", "class", session.classId],
    queryFn: () => sessionFormApi.getClass(session.classId!),
    enabled: !!session.classId,
    retry: false,
  });
  const failedQuery = [topicsQuery, trainersQuery, classQuery].find((query) => query.isError);
  const optionsReady =
    !!classQuery.data?.code &&
    !!topicsQuery.data?.length &&
    !!trainersQuery.data?.length &&
    !failedQuery;

  const updateMutation = useMutation({
    mutationFn: (request: SessionDTO) => sessionApi.update(String(session.id), request),
    onSuccess: async (updated) => {
      setConflictOpen(false);
      queryClient.setQueryData(["session", "detail", String(session.id)], updated);
      navigate("/sessions/" + session.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["version-sessions"] }),
      ]);
      toast.success("Cập nhật buổi học thành công.");
    },
    onError: (error: unknown) => {
      const fields = getSessionFieldErrors(error);
      setErrors(fields);
      setSubmitError(
        getSessionErrorMessage(error, "Không thể cập nhật buổi học. Vui lòng thử lại."),
      );
      setConflictMessage(fields.conflict || "");
      setConflictOpen(!!fields.conflict);
      if (axios.isAxiosError(error) && error.response?.status === 409)
        void queryClient.invalidateQueries({ queryKey: ["session", "detail", String(session.id)] });
    },
  });

  function updateField(field: keyof SessionFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: "",
      ...(field === "topicId" ? { topicName: "" } : {}),
      ...(field === "trainerId" ? { trainerName: "" } : {}),
      conflict: "",
    }));
    setSubmitError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSessionForm(
      form,
      topicsQuery.data || [],
      trainersQuery.data || [],
      classQuery.data,
    );
    setErrors(validation);
    setSubmitError("");
    if (Object.keys(validation).length || !optionsReady) return;
    const topic = topicsQuery.data!.find((item) => String(item.id) === form.topicId)!;
    const trainer = trainersQuery.data!.find((item) => String(item.id) === form.trainerId)!;
    const request: SessionDTO = {
      calendarVersionId: session.calendarVersionId,
      classCode: classQuery.data!.code,
      title: form.title.trim(),
      topicId: topic.id,
      topicName: topic.title,
      trainerId: trainer.id!,
      trainerName: getTrainerName(trainer),
      startTime: formatSessionTime(form.startTime),
      endTime: formatSessionTime(form.endTime),
      room: form.room.trim(),
      meetingLink: form.meetingLink.trim(),
      forceOverride: false,
    };
    setPendingRequest(request);
    updateMutation.mutate(request);
  }

  return (
    <>
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Chỉnh sửa buổi học</CardTitle>
          <CardDescription>Cập nhật thông tin buổi học trong bản lịch nháp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <span className="font-medium">{session.classCode}</span>
            <span>
              · Bản lịch{" "}
              {session.calendarVersionNumber != null
                ? "v" + session.calendarVersionNumber
                : "#" + session.calendarVersionId}
            </span>
            <Badge variant="outline">DRAFT</Badge>
          </div>
          {classQuery.data && (
            <p className="text-sm text-muted-foreground">
              Thời gian lớp: {classQuery.data.startDate} – {classQuery.data.endDate}
            </p>
          )}
          {!session.classId && (
            <Alert variant="destructive">
              <AlertDescription>Không xác định được lớp học của buổi học này.</AlertDescription>
            </Alert>
          )}
          {failedQuery && (
            <Alert variant="destructive">
              <AlertTitle>Không tải được dữ liệu cho biểu mẫu</AlertTitle>
              <AlertDescription>
                <p>Vui lòng thử lại trước khi lưu thay đổi.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    void failedQuery.refetch();
                  }}
                >
                  Thử lại
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {topicsQuery.isSuccess && !topicsQuery.data.length && (
            <Alert>
              <AlertDescription>Chưa có chủ đề đang hoạt động để lựa chọn.</AlertDescription>
            </Alert>
          )}
          {trainersQuery.isSuccess && !trainersQuery.data.length && (
            <Alert>
              <AlertDescription>
                Chưa có tài khoản giảng viên đang hoạt động để lựa chọn.
              </AlertDescription>
            </Alert>
          )}
          {optionsReady &&
            (!topicsQuery.data!.some((topic) => String(topic.id) === form.topicId) ||
              !trainersQuery.data!.some((trainer) => String(trainer.id) === form.trainerId)) && (
              <Alert>
                <AlertDescription>
                  Chủ đề hoặc giảng viên hiện tại không còn trong danh sách đang hoạt động. Vui lòng
                  chọn lại trước khi lưu.
                </AlertDescription>
              </Alert>
            )}
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <form id="edit-session-form" onSubmit={handleSubmit} autoComplete="off" noValidate>
            <fieldset disabled={updateMutation.isPending} className="grid min-w-0 gap-5">
              <SessionFormFields
                form={form}
                errors={errors}
                onChange={updateField}
                topics={topicsQuery.data || []}
                trainers={trainersQuery.data || []}
                classInfo={classQuery.data}
                topicsLoading={topicsQuery.isPending}
                trainersLoading={trainersQuery.isPending}
              />
            </fieldset>
          </form>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/sessions/" + session.id)}
            disabled={updateMutation.isPending}
          >
            <ArrowLeft className="size-4" />
            Quay lại chi tiết
          </Button>
          <Button
            type="submit"
            form="edit-session-form"
            disabled={updateMutation.isPending || !optionsReady}
          >
            {updateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </CardFooter>
      </Card>
      <ConflictWarningModal
        key={String(conflictOpen)}
        open={conflictOpen}
        onClose={() => setConflictOpen(false)}
        conflictMessage={conflictMessage}
        isSubmitting={updateMutation.isPending}
        onConfirmOverride={(reason) => {
          if (pendingRequest)
            updateMutation.mutate({
              ...pendingRequest,
              forceOverride: true,
              overrideReason: reason,
            });
        }}
      />
    </>
  );
}

export function SessionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeRole } = usePermissions();
  const validId = !!id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0;
  const sessionQuery = useQuery({
    queryKey: ["session", "detail", id],
    queryFn: () => sessionApi.getById(id!),
    enabled: validId,
    retry: false,
  });
  const session = sessionQuery.data;
  const canEdit =
    normalizeRole(activeRole) === "ADMIN" &&
    session?.calendarVersionStatus === "DRAFT" &&
    session.status === "SCHEDULED";
  let errorMessage = getSessionErrorMessage(
    sessionQuery.error,
    "Không thể tải thông tin buổi học. Vui lòng thử lại.",
  );
  if (!validId) errorMessage = "ID buổi học không hợp lệ.";
  else if (session && !canEdit)
    errorMessage =
      session.calendarVersionStatus !== "DRAFT"
        ? "Chỉ có thể sửa buổi học thuộc bản lịch DRAFT."
        : session.status !== "SCHEDULED"
          ? "Chỉ có thể sửa buổi học đang ở trạng thái SCHEDULED."
          : "Bạn không có quyền chỉnh sửa buổi học này.";

  return (
    <MainLayout
      pathName={{
        sessions: "Class Schedule",
        [id || "detail"]: "Chi tiết buổi học",
        edit: "Chỉnh sửa",
      }}
    >
      {validId && session && !sessionQuery.isError && canEdit ? (
        <SessionEditor key={session.id} session={session} />
      ) : (
        <Card className="mx-auto w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Chỉnh sửa buổi học</CardTitle>
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
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>{errorMessage}</p>
                  {validId && sessionQuery.isError && (
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
            )}
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <Button type="button" variant="outline" onClick={() => navigate("/sessions")}>
              <ArrowLeft className="size-4" />
              Quay lại danh sách
            </Button>
          </CardFooter>
        </Card>
      )}
    </MainLayout>
  );
}
