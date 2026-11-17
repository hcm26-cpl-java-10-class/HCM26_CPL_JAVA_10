import type { CalendarSessionResponse } from "@/api/features/calendar.api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Clock, GraduationCap, MapPin, User } from "lucide-react";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  formatCalendarTime,
  useCalendarLookup,
} from "./calendarLookup";

export function SessionDetailModal({
  session,
  trigger,
}: {
  session: CalendarSessionResponse;
  trigger: React.ReactNode;
}) {
  const { getClassName, getTrainerName, getTopicName } = useCalendarLookup();
  const statusClass = STATUS_CLASSES[session.status] || "bg-muted text-muted-foreground";

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
              {STATUS_LABELS[session.status] ?? session.status}
            </span>
            <span className="text-xs text-muted-foreground">ID: #{session.id}</span>
          </div>
          <DialogTitle className="mt-1 text-xl font-bold leading-tight">
            {session.title || "Buổi học không có tiêu đề"}
          </DialogTitle>
          <DialogDescription>
            Chi tiết thời gian và thông tin lớp học theo giờ Việt Nam.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Địa điểm / Phòng học:</span>
          </div>
          <p className="mt-1 text-lg font-bold text-foreground">
            {session.location || "Chưa xếp phòng (Trực tuyến / TBA)"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3 bg-card">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Bắt đầu</span>
            </div>
            <p className="font-semibold text-foreground">{formatCalendarTime(session.startTime)}</p>
          </div>
          <div className="rounded-lg border p-3 bg-card">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Kết thúc</span>
            </div>
            <p className="font-semibold text-foreground">{formatCalendarTime(session.endTime)}</p>
          </div>
        </div>

        <dl className="divide-y rounded-lg border text-sm">
          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" /> Lớp học
            </dt>
            <dd className="font-medium text-foreground">{getClassName(session.classId)}</dd>
          </div>

          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <User className="h-4 w-4" /> Giảng viên
            </dt>
            <dd className="font-medium text-foreground">{getTrainerName(session.trainerId)}</dd>
          </div>

          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground">Chủ đề (Topic)</dt>
            <dd className="font-medium text-foreground">{getTopicName(session.topicId, session.title)}</dd>
          </div>

          {session.note && (
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
              <dt className="text-muted-foreground">Ghi chú</dt>
              <dd className="font-medium text-foreground break-words">{session.note}</dd>
            </div>
          )}

          {session.cancelReason && (
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3 bg-red-50/50 dark:bg-red-950/20">
              <dt className="text-red-600 dark:text-red-400 font-medium">Lý do hủy</dt>
              <dd className="font-medium text-red-700 dark:text-red-300 break-words">{session.cancelReason}</dd>
            </div>
          )}

          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground">Kích hoạt</dt>
            <dd className="font-medium text-foreground">
              {session.isActive ? "Đang hiệu lực" : "Ngừng hiệu lực"}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}

