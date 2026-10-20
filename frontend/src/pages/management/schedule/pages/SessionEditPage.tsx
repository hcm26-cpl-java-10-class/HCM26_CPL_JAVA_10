import { sessionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SessionDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Save, ShieldAlert } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ConflictWarningModal } from "../components/ConflictWarningModal";

const DEMO_TRAINERS = [
  { id: 1, name: "Nguyen Minh (Trainer)" },
  { id: 2, name: "Tran Thi Lan (Trainer)" },
  { id: 3, name: "Le Hoang An (Trainer)" },
];

export function SessionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<SessionDTO | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState("");

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => sessionApi.getById(String(id)),
    enabled: !!id,
  });

  useEffect(() => {
    if (sessionData) {
      setForm({
        ...sessionData,
        startTime: sessionData.startTime ? sessionData.startTime.substring(0, 16) : "",
        endTime: sessionData.endTime ? sessionData.endTime.substring(0, 16) : "",
      });
    }
  }, [sessionData]);

  const updateMutation = useMutation({
    mutationFn: (payload: SessionDTO) => sessionApi.update(String(id), payload),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      if (data.isOverridden) {
        toast.warning(`Đã cập nhật lịch với quyền Override (BR-10): ${data.overrideReason}`);
      } else {
        toast.success("Cập nhật buổi học thành công!");
      }
      navigate("/sessions");
    },
    onError: (error: any) => {
      const errorData = error?.response?.data;
      const validationErrors = errorData?.errors;

      if (validationErrors?.conflict && validationErrors.conflict.length > 0) {
        setConflictMessage(validationErrors.conflict[0]);
        setConflictModalOpen(true);
        toast.error("Phát hiện xung đột lịch học khi cập nhật!");
        return;
      }

      if (validationErrors?.endTime && validationErrors.endTime.length > 0) {
        toast.error(validationErrors.endTime[0]);
        return;
      }

      toast.error(errorData?.message || "Cập nhật buổi học thất bại.");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    const formatTime = (t: string) => (t.length === 16 ? `${t}:00` : t);

    updateMutation.mutate({
      ...form,
      startTime: formatTime(form.startTime),
      endTime: formatTime(form.endTime),
      forceOverride: false,
    });
  };

  const handleConfirmOverride = (reason: string) => {
    if (!form) return;
    const formatTime = (t: string) => (t.length === 16 ? `${t}:00` : t);

    updateMutation.mutate(
      {
        ...form,
        startTime: formatTime(form.startTime),
        endTime: formatTime(form.endTime),
        forceOverride: true,
        overrideReason: reason,
      },
      {
        onSettled: () => setConflictModalOpen(false),
      }
    );
  };

  if (isLoading || !form) {
    return (
      <MainLayout pathName={{ sessions: "Schedules", edit: "Chỉnh sửa" }}>
        <div className="p-8 text-center text-slate-500">Đang tải dữ liệu buổi học...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout pathName={{ sessions: "Schedules", edit: "Chỉnh sửa buổi học" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        {form.isOverridden && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Buổi học này đang ở trạng thái Override:</span>{" "}
              {form.overrideReason}
            </div>
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Chỉnh Sửa Buổi Học #{id}</CardTitle>
            <CardDescription>
              Cập nhật thông tin và tự động kiểm tra xung đột với các lớp khác.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form id="edit-session-form" className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="class-code">Mã lớp học</Label>
                  <Input
                    id="class-code"
                    value={form.classCode}
                    onChange={(e) => setForm((p) => p && { ...p, classCode: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="topic-name">Topic</Label>
                  <Input
                    id="topic-name"
                    value={form.topicName ?? ""}
                    onChange={(e) => setForm((p) => p && { ...p, topicName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="session-title">Tiêu đề buổi học</Label>
                <Input
                  id="session-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => p && { ...p, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="trainer-select">Giảng viên</Label>
                  <select
                    id="trainer-select"
                    value={form.trainerId}
                    onChange={(e) => {
                      const selectedId = Number(e.target.value);
                      const t = DEMO_TRAINERS.find((item) => item.id === selectedId);
                      setForm((p) => p && {
                        ...p,
                        trainerId: selectedId,
                        trainerName: t?.name ?? "Trainer",
                      });
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {DEMO_TRAINERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="room">Phòng học</Label>
                  <Input
                    id="room"
                    value={form.room ?? ""}
                    onChange={(e) => setForm((p) => p && { ...p, room: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <div className="grid gap-2">
                  <Label htmlFor="start-time" className="flex items-center gap-1.5 font-semibold">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Bắt đầu
                  </Label>
                  <Input
                    id="start-time"
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm((p) => p && { ...p, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="end-time" className="flex items-center gap-1.5 font-semibold">
                    <Clock className="h-4 w-4 text-rose-600" />
                    Kết thúc
                  </Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={form.endTime}
                    onChange={(e) => setForm((p) => p && { ...p, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Trạng thái buổi học</Label>
                  <Input
                    id="status"
                    value={form.status ?? "SCHEDULED"}
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-muted-foreground">
                    Trạng thái chỉ thay đổi qua thao tác “Đánh dấu hoàn thành” / “Hủy buổi học”
                    (API v1 sessions).
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="meeting-link">Meeting Link</Label>
                  <Input
                    id="meeting-link"
                    value={form.meetingLink ?? ""}
                    onChange={(e) => setForm((p) => p && { ...p, meetingLink: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Ghi chú sau buổi học</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((p) => p && { ...p, notes: e.target.value })}
                />
              </div>
            </form>
          </CardContent>

          <CardFooter className="flex justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/sessions")}
              disabled={updateMutation.isPending}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Quay lại
            </Button>

            <Button
              type="submit"
              form="edit-session-form"
              disabled={updateMutation.isPending}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Save className="mr-1.5 h-4 w-4" />
              {updateMutation.isPending ? "Đang lưu..." : "Cập Nhật Buổi Học"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <ConflictWarningModal
        open={conflictModalOpen}
        onClose={() => setConflictModalOpen(false)}
        conflictMessage={conflictMessage}
        onConfirmOverride={handleConfirmOverride}
        isSubmitting={updateMutation.isPending}
      />
    </MainLayout>
  );
}
