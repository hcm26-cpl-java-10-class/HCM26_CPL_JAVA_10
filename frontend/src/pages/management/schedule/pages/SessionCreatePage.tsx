import { calendarVersionApi, sessionApi, sessionFormApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SessionDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ConflictWarningModal } from "../components/ConflictWarningModal";

import { SessionFormField as FormField, SessionFormFields } from "../components/SessionFormFields";
import {
  formatSessionTime,
  getTrainerName as trainerName,
  validateSessionForm,
  type SessionFormValues,
} from "../components/session-form.utils";

interface SessionForm extends SessionFormValues {
  calendarVersionId: string;
}

export function SessionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [calendarId, setCalendarId] = useState(searchParams.get("calendarId") || "");
  const [form, setForm] = useState<SessionForm>({
    calendarVersionId: searchParams.get("versionId") || "",
    topicId: "",
    trainerId: "",
    title: "",
    startTime: "",
    endTime: "",
    room: "",
    meetingLink: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [conflictMessage, setConflictMessage] = useState("");
  const [conflictOpen, setConflictOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<SessionDTO | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["session-form", "calendars"],
    queryFn: calendarVersionApi.list,
  });
  const topicsQuery = useQuery({
    queryKey: ["session-form", "topics"],
    queryFn: sessionFormApi.getTopics,
  });
  const trainersQuery = useQuery({
    queryKey: ["session-form", "trainers"],
    queryFn: sessionFormApi.getTrainers,
  });
  const selectedCalendar = calendarsQuery.data?.find(
    (calendar) => String(calendar.id) === calendarId,
  );
  const versionsQuery = useQuery({
    queryKey: ["session-form", "draft-versions", selectedCalendar?.id],
    queryFn: () => sessionFormApi.getDraftVersions(selectedCalendar!.id),
    enabled: !!selectedCalendar,
  });
  const classQuery = useQuery({
    queryKey: ["session-form", "class", selectedCalendar?.classId],
    queryFn: () => sessionFormApi.getClass(selectedCalendar!.classId),
    enabled: !!selectedCalendar,
    retry: false,
  });
  const selectedVersion = versionsQuery.data?.find(
    (version) => String(version.id) === form.calendarVersionId,
  );
  const optionQueries = [calendarsQuery, topicsQuery, trainersQuery, versionsQuery, classQuery];
  const failedQuery = optionQueries.find((query) => query.isError);
  const optionsReady =
    !!selectedCalendar &&
    !!selectedVersion &&
    !!classQuery.data?.code &&
    !!topicsQuery.data?.length &&
    !!trainersQuery.data?.length &&
    !failedQuery;

  const createMutation = useMutation({
    mutationFn: (request: SessionDTO) => sessionApi.create(request),
    onSuccess: async (session) => {
      setConflictOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["session"] }),
        queryClient.invalidateQueries({ queryKey: ["version-sessions"] }),
      ]);
      toast.success("Tạo buổi học thành công.");
      navigate(session.id ? `/sessions/${session.id}` : "/sessions");
    },
    onError: (error: unknown) => {
      const data = axios.isAxiosError(error) ? error.response?.data : undefined;
      const fieldErrors: Record<string, string[]> = data?.errors || data?.fieldErrors || {};
      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([field, messages]) => [
            field,
            messages[0] || "Dữ liệu không hợp lệ.",
          ]),
        ),
      );
      if (fieldErrors.conflict?.length) {
        setConflictMessage(fieldErrors.conflict[0]);
        setConflictOpen(true);
      } else {
        setConflictOpen(false);
      }
      setSubmitError(data?.message || "Không thể tạo buổi học. Vui lòng kiểm tra lại dữ liệu.");
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        void versionsQuery.refetch();
      }
    },
  });

  function updateField(field: keyof SessionForm, value: string) {
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
    const topic = topicsQuery.data?.find((item) => String(item.id) === form.topicId);
    const trainer = trainersQuery.data?.find((item) => String(item.id) === form.trainerId);
    if (!selectedCalendar) validation.calendarId = "Vui lòng chọn lớp học.";
    if (!selectedVersion || selectedVersion.status !== "DRAFT")
      validation.calendarVersionId = "Vui lòng chọn bản lịch DRAFT.";
    setErrors(validation);
    setSubmitError("");
    if (Object.keys(validation).length || !optionsReady || !topic?.id || !trainer?.id) return;

    const request: SessionDTO = {
      calendarVersionId: selectedVersion!.id,
      topicId: topic.id,
      topicName: topic.title,
      classCode: classQuery.data!.code,
      trainerId: trainer.id,
      trainerName: trainerName(trainer),
      title: form.title.trim(),
      startTime: formatSessionTime(form.startTime),
      endTime: formatSessionTime(form.endTime),
      room: form.room.trim() || undefined,
      meetingLink: form.meetingLink.trim() || undefined,
      isActive: true,
      forceOverride: false,
    };
    setPendingRequest(request);
    createMutation.mutate(request);
  }

  return (
    <MainLayout pathName={{ sessions: "Class Schedule", create: "Tạo buổi học" }}>
      <Card className="mx-auto w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Tạo buổi học</CardTitle>
          <CardDescription>Thêm buổi học vào bản lịch nháp của lớp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {failedQuery && (
            <Alert variant="destructive">
              <AlertTitle>Không tải được dữ liệu cho biểu mẫu</AlertTitle>
              <AlertDescription>
                <p>
                  {axios.isAxiosError(failedQuery.error)
                    ? failedQuery.error.response?.data?.message || "Vui lòng thử lại."
                    : "Vui lòng thử lại."}
                </p>
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
          {calendarsQuery.isSuccess && !calendarsQuery.data.length && (
            <Alert>
              <AlertTitle>Chưa có lịch của lớp</AlertTitle>
              <AlertDescription>
                Vui lòng tạo Calendar cho lớp trước khi thêm buổi học.
              </AlertDescription>
            </Alert>
          )}
          {selectedCalendar && versionsQuery.isSuccess && !versionsQuery.data.length && (
            <Alert>
              <AlertTitle>Chưa có bản lịch DRAFT</AlertTitle>
              <AlertDescription>
                Vui lòng tạo bản lịch nháp cho lớp này trước khi thêm buổi học.
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
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
          <form id="session-form" onSubmit={handleSubmit} autoComplete="off" noValidate>
            <fieldset disabled={createMutation.isPending} className="grid min-w-0 gap-5">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <FormField
                  id="calendar-id"
                  label="Lớp học"
                  required
                  error={errors.calendarId || errors.classCode}
                >
                  <Select
                    value={calendarId}
                    onValueChange={(value) => {
                      if (!value || value === calendarId) return;
                      setCalendarId(value);
                      updateField("calendarVersionId", "");
                      setErrors({});
                    }}
                    disabled={calendarsQuery.isPending || !calendarsQuery.data?.length}
                  >
                    <SelectTrigger
                      id="calendar-id"
                      className="w-full min-w-0"
                      aria-invalid={!!errors.calendarId}
                    >
                      <SelectValue
                        placeholder={
                          calendarsQuery.isPending ? "Đang tải lớp học..." : "Chọn lớp học"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {calendarsQuery.data?.map((calendar) => (
                        <SelectItem key={calendar.id} value={String(calendar.id)}>
                          {calendar.name} · Class #{calendar.classId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField
                  id="calendar-version-id"
                  label="Bản lịch nháp"
                  required
                  error={errors.calendarVersionId}
                >
                  <Select
                    value={selectedVersion ? form.calendarVersionId : ""}
                    onValueChange={(value) => {
                      if (value) updateField("calendarVersionId", value);
                    }}
                    disabled={
                      !selectedCalendar || versionsQuery.isPending || !versionsQuery.data?.length
                    }
                  >
                    <SelectTrigger
                      id="calendar-version-id"
                      className="w-full min-w-0"
                      aria-invalid={!!errors.calendarVersionId}
                    >
                      <SelectValue
                        placeholder={
                          selectedCalendar && versionsQuery.isPending
                            ? "Đang tải bản lịch..."
                            : "Chọn bản lịch DRAFT"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {versionsQuery.data?.map((version) => (
                        <SelectItem key={version.id} value={String(version.id)}>
                          v{version.versionNumber}
                          {version.name ? ` · ${version.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              {classQuery.data && (
                <p className="text-sm text-muted-foreground">
                  {classQuery.data.code}
                  {classQuery.data.startDate && classQuery.data.endDate
                    ? ` · Thời gian lớp: ${classQuery.data.startDate} – ${classQuery.data.endDate}`
                    : ""}
                </p>
              )}
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
            onClick={() => navigate("/sessions")}
            disabled={createMutation.isPending}
          >
            <ArrowLeft className="size-4" />
            Quay lại danh sách
          </Button>
          <Button
            type="submit"
            form="session-form"
            disabled={createMutation.isPending || !optionsReady}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {createMutation.isPending ? "Đang lưu..." : "Tạo buổi học"}
          </Button>
        </CardFooter>
      </Card>
      <ConflictWarningModal
        key={String(conflictOpen)}
        open={conflictOpen}
        onClose={() => setConflictOpen(false)}
        conflictMessage={conflictMessage}
        isSubmitting={createMutation.isPending}
        onConfirmOverride={(reason) => {
          if (pendingRequest)
            createMutation.mutate({
              ...pendingRequest,
              forceOverride: true,
              overrideReason: reason,
            });
        }}
      />
    </MainLayout>
  );
}
