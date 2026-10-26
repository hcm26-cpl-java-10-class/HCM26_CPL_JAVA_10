import { getCalendarSessions } from "@/api/features/calendar.api";
import type {
  CalendarSessionResponse,
  CalendarSessionsPage,
} from "@/api/features/calendar.api";
import { MainLayout } from "@/components/layout/MainLayout";
import type { CalendarSessionStatus } from "@/types/features/calendar";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSearchParams } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  Search,
  Clock,
  MapPin,
  User,
  GraduationCap,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const STUDY_SLOTS = [
  { id: 1, label: "Slot 1", start: "07:00", end: "09:15" },
  { id: 2, label: "Slot 2", start: "09:30", end: "11:45" },
  { id: 3, label: "Slot 3", start: "12:30", end: "14:45" },
  { id: 4, label: "Slot 4", start: "15:00", end: "17:15" },
];
const PAGE_SIZE = 100;

const statusLabels: Record<CalendarSessionStatus, string> = {
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

const statusClasses: Record<CalendarSessionStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300",
};

function getCurrentWeekStart() {
  const today = dayjs().tz(TIME_ZONE).startOf("day");
  const daysSinceMonday = (today.day() + 6) % 7;
  return today.subtract(daysSinceMonday, "day");
}

function formatTime(value: string) {
  return dayjs.tz(value, TIME_ZONE).format("DD/MM/YYYY HH:mm");
}

function getCalendarDate(value: string | null) {
  const fallback = getCurrentWeekStart();
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }
  const parsed = dayjs(value);
  if (!parsed.isValid() || parsed.format("YYYY-MM-DD") !== value) {
    return fallback;
  }
  return dayjs.tz(`${value}T00:00:00`, TIME_ZONE);
}

// Dialog chi tiết buổi học
function SessionDetailModal({
  session,
  trigger,
}: {
  session: CalendarSessionResponse;
  trigger: React.ReactNode;
}) {
  const statusClass = statusClasses[session.status] || "bg-muted text-muted-foreground";

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${statusClass}`}
            >
              {statusLabels[session.status] ?? session.status}
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
            <p className="font-semibold text-foreground">
              {formatTime(session.startTime)}
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-card">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>Kết thúc</span>
            </div>
            <p className="font-semibold text-foreground">
              {formatTime(session.endTime)}
            </p>
          </div>
        </div>

        <dl className="divide-y rounded-lg border text-sm">
          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" /> Mã lớp
            </dt>
            <dd className="font-medium text-foreground">
              CLASS-{session.classId ? String(session.classId).padStart(2, "0") : "—"} (ID: {session.classId})
            </dd>
          </div>

          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground flex items-center gap-1.5">
              <User className="h-4 w-4" /> Giảng viên
            </dt>
            <dd className="font-medium text-foreground">
              {session.trainerId ? `Trainer ID #${session.trainerId}` : "Chưa phân công"}
            </dd>
          </div>

          <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-3">
            <dt className="text-muted-foreground">Chủ đề (Topic ID)</dt>
            <dd className="font-medium text-foreground">
              {session.topicId ? `Topic #${session.topicId}` : "Chưa có"}
            </dd>
          </div>

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

// Thẻ hiển thị buổi học trong lưới tuần
function SessionCard({ session }: { session: CalendarSessionResponse }) {
  const start = dayjs.tz(session.startTime, TIME_ZONE);
  const end = dayjs.tz(session.endTime, TIME_ZONE);
  const sameDay = start.format("YYYY-MM-DD") === end.format("YYYY-MM-DD");
  const timeLabel = sameDay
    ? `${start.format("HH:mm")}–${end.format("HH:mm")}`
    : `${start.format("DD/MM HH:mm")}–${end.format("DD/MM HH:mm")}`;

  const statusClass = statusClasses[session.status] || "bg-muted text-muted-foreground";

  return (
    <SessionDetailModal
      session={session}
      trigger={
        <article className="group cursor-pointer overflow-hidden rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-md text-left">
          <div className="flex items-center justify-between gap-1 border-b bg-muted/50 px-2 py-1">
            <span className="truncate text-[11px] font-semibold text-foreground">
              {session.location || "TBA"}
            </span>
            <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${statusClass}`}>
              {statusLabels[session.status] ?? session.status}
            </span>
          </div>

          <div className="space-y-0.5 p-2 text-[11px] leading-4">
            <p className="font-bold text-foreground line-clamp-1 group-hover:text-primary">
              {session.title || "Buổi học"}
            </p>
            <p className="text-muted-foreground">
              Lớp: <strong>#{session.classId}</strong> · Topic: <strong>#{session.topicId}</strong>
            </p>
            <p className="text-muted-foreground">
              GV: <strong>{session.trainerId ? `#${session.trainerId}` : "TBA"}</strong>
            </p>
            <p className="font-medium text-primary text-[10px] pt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeLabel}
            </p>
          </div>
        </article>
      }
    />
  );
}

export default function WeeklyCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Chế độ xem: "week" | "month" | "list"
  const viewMode = (searchParams.get("view") as "week" | "month" | "list") || "week";

  const selectedDate = getCalendarDate(searchParams.get("date"));
  const daysSinceMonday = (selectedDate.day() + 6) % 7;
  const weekStart = selectedDate.subtract(daysSinceMonday, "day");

  const rawStatus = searchParams.get("status");
  const statusFilter: CalendarSessionStatus | "ALL" =
    rawStatus === "SCHEDULED" || rawStatus === "COMPLETED" || rawStatus === "CANCELLED"
      ? rawStatus
      : "ALL";

  // Bộ lọc từ khóa (Client search)
  const [keyword, setKeyword] = useState("");
  // Bộ lọc lớp học (classId)
  const classFilter = searchParams.get("classId") || "ALL";

  const rawPage = searchParams.get("page") ?? "0";
  const parsedPage = Number(rawPage);
  const page =
    /^\d+$/.test(rawPage) && Number.isSafeInteger(parsedPage) && parsedPage <= 2147483647
      ? parsedPage
      : 0;

  const [result, setResult] = useState<CalendarSessionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Tính khoảng ngày gọi API tùy theo viewMode (không vượt quá 31 ngày theo quy định backend)
  const { from, to, dateTitle } = useMemo(() => {
    if (viewMode === "month") {
      const startOfMonth = selectedDate.startOf("month");
      const endOfMonth = selectedDate.endOf("month");
      return {
        from: startOfMonth.format("YYYY-MM-DDTHH:mm:ss"),
        to: endOfMonth.format("YYYY-MM-DDTHH:mm:ss"),
        dateTitle: `Tháng ${selectedDate.format("MM / YYYY")}`,
      };
    } else {
      // week hoặc list: xem theo khoảng 7 ngày của tuần đã chọn
      return {
        from: weekStart.format("YYYY-MM-DDTHH:mm:ss"),
        to: weekStart.add(7, "day").format("YYYY-MM-DDTHH:mm:ss"),
        dateTitle: `Tuần từ ${weekStart.format("DD/MM/YYYY")} đến ${weekStart.add(6, "day").format("DD/MM/YYYY")}`,
      };
    }
  }, [viewMode, selectedDate, weekStart]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessions() {
      setLoading(true);
      setError(null);

      try {
        const data = await getCalendarSessions(
          {
            from,
            to,
            status: statusFilter === "ALL" ? undefined : statusFilter,
            page,
            size: PAGE_SIZE,
          },
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setResult(data);
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;

        const forbidden =
          isAxiosError(requestError) && requestError.response?.status === 403;

        setError(
          forbidden
            ? "Bạn không có quyền xem lịch. Cần quyền SESSION_READ."
            : "Không tải được lịch. Kiểm tra kết nối backend rồi thử lại.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSessions();
    return () => controller.abort();
  }, [from, to, statusFilter, page, reloadKey]);

  function updateCalendarUrl(values: Record<string, string>) {
    const nextParams = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value === "") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
    }
    setSearchParams(nextParams);
  }

  function changePeriod(direction: -1 | 1) {
    if (viewMode === "month") {
      updateCalendarUrl({
        date: selectedDate.add(direction, "month").date(1).format("YYYY-MM-DD"),
        page: "0",
      });
    } else {
      updateCalendarUrl({
        date: weekStart.add(direction * 7, "day").format("YYYY-MM-DD"),
        page: "0",
      });
    }
  }

  function resetFilters() {
    setKeyword("");
    const nextParams = new URLSearchParams();
    nextParams.set("view", viewMode);
    nextParams.set("date", dayjs().tz(TIME_ZONE).format("YYYY-MM-DD"));
    setSearchParams(nextParams);
    toast.info("Đã đặt lại bộ lọc về mặc định.");
  }

  // Lọc phía client theo keyword và classId
  const rawSessions = result?.content ?? [];
  const sessions = useMemo(() => {
    return rawSessions.filter((s) => {
      if (classFilter !== "ALL" && String(s.classId) !== classFilter) {
        return false;
      }
      if (keyword.trim()) {
        const q = keyword.toLowerCase();
        const matchTitle = (s.title || "").toLowerCase().includes(q);
        const matchLoc = (s.location || "").toLowerCase().includes(q);
        const matchClass = `class-${s.classId}`.toLowerCase().includes(q) || String(s.classId).includes(q);
        const matchTrainer = `trainer-${s.trainerId}`.toLowerCase().includes(q) || String(s.trainerId).includes(q);
        return matchTitle || matchLoc || matchClass || matchTrainer;
      }
      return true;
    });
  }, [rawSessions, keyword, classFilter]);

  // Danh sách các classId có trong dữ liệu để làm filter
  const availableClasses = useMemo(() => {
    const set = new Set<number>();
    rawSessions.forEach((s) => {
      if (s.classId) set.add(s.classId);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rawSessions]);

  // Xuất file CSV
  function handleExportCsv() {
    if (sessions.length === 0) {
      toast.error("Không có buổi học nào để xuất file!");
      return;
    }

    const headers = [
      "ID Buổi",
      "Tiêu đề",
      "Mã Lớp",
      "Mã Môn (Topic ID)",
      "Mã Giảng viên",
      "Phòng học / Địa điểm",
      "Thời gian Bắt đầu",
      "Thời gian Kết thúc",
      "Trạng thái",
    ];

    const rows = sessions.map((s) => [
      s.id,
      `"${(s.title || "").replace(/"/g, '""')}"`,
      `"CLASS-${String(s.classId).padStart(2, "0")}"`,
      s.topicId ?? "",
      s.trainerId ?? "",
      `"${(s.location || "Chưa có").replace(/"/g, '""')}"`,
      `"${formatTime(s.startTime)}"`,
      `"${formatTime(s.endTime)}"`,
      `"${statusLabels[s.status] || s.status}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Thoi_khoa_bieu_${viewMode}_${selectedDate.format("YYYYMMDD")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Đã xuất ${sessions.length} buổi học ra file CSV thành công!`);
  }

  function getSessionsInRange(start: string, end: string) {
    const rangeStart = dayjs.tz(start, TIME_ZONE).valueOf();
    const rangeEnd = dayjs.tz(end, TIME_ZONE).valueOf();
    return sessions.filter((session) => {
      const sessionStart = dayjs.tz(session.startTime, TIME_ZONE).valueOf();
      const sessionEnd = dayjs.tz(session.endTime, TIME_ZONE).valueOf();
      return sessionStart < rangeEnd && sessionEnd > rangeStart;
    });
  }

  function getOutsideSlotSessions(dateKey: string) {
    const nextDateKey = dayjs
      .tz(`${dateKey}T00:00:00`, TIME_ZONE)
      .add(1, "day")
      .format("YYYY-MM-DD");

    const daySessions = getSessionsInRange(
      `${dateKey}T00:00:00`,
      `${nextDateKey}T00:00:00`,
    );

    return daySessions.filter((session) => {
      return !STUDY_SLOTS.some((slot) => {
        const slotStart = dayjs.tz(`${dateKey}T${slot.start}:00`, TIME_ZONE).valueOf();
        const slotEnd = dayjs.tz(`${dateKey}T${slot.end}:00`, TIME_ZONE).valueOf();
        const sessionStart = dayjs.tz(session.startTime, TIME_ZONE).valueOf();
        const sessionEnd = dayjs.tz(session.endTime, TIME_ZONE).valueOf();
        return sessionStart < slotEnd && sessionEnd > slotStart;
      });
    });
  }

  // Danh sách các ngày trong tuần (Mon - Sun)
  const weekDays = [
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
    "Chủ nhật",
  ].map((label, index) => {
    const date = weekStart.add(index, "day");
    return {
      label,
      dateKey: date.format("YYYY-MM-DD"),
      dateLabel: date.format("DD/MM"),
      isToday: date.format("YYYY-MM-DD") === dayjs().tz(TIME_ZONE).format("YYYY-MM-DD"),
    };
  });

  // Danh sách các ngày trong tháng (Month View Grid)
  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    const startOfMonth = selectedDate.startOf("month");
    const daysInMonth = selectedDate.daysInMonth();
    const firstDayOfWeek = (startOfMonth.day() + 6) % 7; // Thứ Hai = 0

    const list: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      sessions: CalendarSessionResponse[];
    }> = [];

    // Ô trống đệm đầu tháng
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = startOfMonth.subtract(firstDayOfWeek - i, "day");
      list.push({
        dateKey: prevDate.format("YYYY-MM-DD"),
        dayNumber: prevDate.date(),
        isCurrentMonth: false,
        isToday: false,
        sessions: [],
      });
    }

    // Các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
      const curDate = startOfMonth.date(day);
      const dateKey = curDate.format("YYYY-MM-DD");
      const daySessions = sessions.filter((s) => {
        if (!s.startTime) return false;
        return s.startTime.substring(0, 10) === dateKey;
      });

      list.push({
        dateKey,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateKey === dayjs().tz(TIME_ZONE).format("YYYY-MM-DD"),
        sessions: daySessions,
      });
    }

    return list;
  }, [viewMode, selectedDate, sessions]);

  return (
    <MainLayout pathName={{ calendar: "Thời khoá biểu" }}>
      <div className="space-y-5 pb-12">
        {/* Header hàng đầu: Tiêu đề & Nút xuất file */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Thời khóa biểu & Lịch học
              </h1>
              <Badge variant="outline" className="text-xs font-semibold text-primary">
                FAMS Timetable
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span>{dateTitle}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs font-medium"
              title="Xuất danh sách buổi học ra file CSV"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Xuất Excel (CSV)
            </Button>
          </div>
        </div>

        {/* Thanh điều khiển thứ 2: Chuyển View Mode & Điều hướng ngày */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
          {/* Tab chuyển chế độ xem: Tuần | Tháng | Danh sách */}
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => updateCalendarUrl({ view: "week" })}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Xem Tuần
            </button>
            <button
              type="button"
              onClick={() => updateCalendarUrl({ view: "month" })}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              Xem Tháng
            </button>
            <button
              type="button"
              onClick={() => updateCalendarUrl({ view: "list" })}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListIcon className="h-4 w-4" />
              Danh sách buổi
            </button>
          </div>

          {/* Cụm điều hướng: Trước, Hôm nay, Sau, Chọn ngày */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => changePeriod(-1)}
              className="h-8 gap-1 px-2.5 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              {viewMode === "month" ? "Tháng trước" : "Tuần trước"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                updateCalendarUrl({
                  date: dayjs().tz(TIME_ZONE).format("YYYY-MM-DD"),
                  page: "0",
                });
              }}
              className="h-8 px-3 text-xs font-semibold"
            >
              Hôm nay
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => changePeriod(1)}
              className="h-8 gap-1 px-2.5 text-xs"
            >
              {viewMode === "month" ? "Tháng sau" : "Tuần sau"}
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="relative">
              <input
                type="date"
                value={selectedDate.format("YYYY-MM-DD")}
                onChange={(event) => {
                  const val = event.target.value;
                  if (val) {
                    updateCalendarUrl({ date: val, page: "0" });
                  }
                }}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Thanh Bộ lọc nâng cao & Tìm kiếm */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4 rounded-xl border bg-card p-3 shadow-sm">
          {/* Tìm kiếm từ khóa */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tiêu đề, phòng, GV..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Lọc theo Lớp */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="calendar-class" className="text-xs text-muted-foreground shrink-0 font-medium">
              Lớp:
            </label>
            <select
              id="calendar-class"
              value={classFilter}
              onChange={(e) => updateCalendarUrl({ classId: e.target.value === "ALL" ? "" : e.target.value, page: "0" })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
              <option value="ALL">Tất cả lớp học</option>
              {availableClasses.map((c) => (
                <option key={c} value={String(c)}>
                  CLASS-{String(c).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Trạng thái */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="calendar-status" className="text-xs text-muted-foreground shrink-0 font-medium">
              Trạng thái:
            </label>
            <select
              id="calendar-status"
              value={statusFilter}
              onChange={(e) => updateCalendarUrl({ status: e.target.value, page: "0" })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SCHEDULED">{statusLabels.SCHEDULED}</option>
              <option value="COMPLETED">{statusLabels.COMPLETED}</option>
              <option value="CANCELLED">{statusLabels.CANCELLED}</option>
            </select>
          </div>

          {/* Nút Reset bộ lọc */}
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Đặt lại bộ lọc
            </Button>
          </div>
        </div>

        {/* Trạng thái Loading / Error */}
        {loading && (
          <div className="rounded-xl border bg-card p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em]" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Đang tải dữ liệu thời khóa biểu...
            </p>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-destructive">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((p) => p + 1)}
              className="h-8 text-xs"
            >
              Thử lại
            </Button>
          </div>
        )}

        {/* NỘI DUNG CHÍNH THEO VIEW MODE */}
        {!loading && !error && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Hiển thị <strong>{sessions.length}</strong> buổi học phù hợp{" "}
                {keyword ? `(lọc theo "${keyword}")` : ""}
              </span>
              <span>Múi giờ chuẩn: <strong>Asia/Ho_Chi_Minh (UTC+7)</strong></span>
            </div>

            {/* 1. CHẾ ĐỘ XEM TUẦN (WEEK VIEW) */}
            {viewMode === "week" && (
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <table className="w-full min-w-[1200px] table-fixed border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th scope="col" className="w-28 border-b border-r p-3 text-center text-xs font-semibold text-muted-foreground">
                        Khung giờ (Slot)
                      </th>
                      {weekDays.map((day) => (
                        <th
                          key={day.dateKey}
                          scope="col"
                          className={`border-b border-r p-3 text-center last:border-r-0 ${
                            day.isToday ? "bg-primary/10" : ""
                          }`}
                        >
                          <p className="text-xs font-semibold text-muted-foreground">{day.label}</p>
                          <p className={`mt-0.5 text-base font-bold ${day.isToday ? "text-primary" : "text-foreground"}`}>
                            {day.dateLabel}
                          </p>
                          <p className="min-h-3 text-[10px] font-bold text-primary">
                            {day.isToday ? "● Hôm nay" : "\u00A0"}
                          </p>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {STUDY_SLOTS.map((slot) => (
                      <tr key={slot.id} className="border-b last:border-b-0">
                        <th scope="row" className="border-r bg-muted/20 px-2 py-4 text-center align-top">
                          <p className="text-xs font-bold text-foreground">{slot.label}</p>
                          <p className="mt-1 text-[11px] font-normal text-muted-foreground">
                            {slot.start}–{slot.end}
                          </p>
                        </th>

                        {weekDays.map((day) => {
                          const slotSessions = getSessionsInRange(
                            `${day.dateKey}T${slot.start}:00`,
                            `${day.dateKey}T${slot.end}:00`,
                          );

                          return (
                            <td
                              key={day.dateKey}
                              className={`border-r p-1.5 align-top last:border-r-0 ${
                                day.isToday ? "bg-primary/[0.02]" : ""
                              }`}
                            >
                              <div className="min-h-20 space-y-1.5">
                                {slotSessions.length === 0 ? (
                                  <p className="py-6 text-center text-xs text-muted-foreground/30">—</p>
                                ) : (
                                  slotSessions.map((session) => (
                                    <SessionCard key={String(session.id)} session={session} />
                                  ))
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Dòng ngoài slot */}
                    {weekDays.some((day) => getOutsideSlotSessions(day.dateKey).length > 0) && (
                      <tr className="border-t bg-muted/5">
                        <th scope="row" className="border-r bg-muted/30 px-2 py-4 text-center align-top">
                          <p className="text-xs font-bold text-foreground">Ngoài slot</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">Khung giờ khác</p>
                        </th>
                        {weekDays.map((day) => (
                          <td key={day.dateKey} className="border-r p-1.5 align-top last:border-r-0">
                            <div className="space-y-1.5">
                              {getOutsideSlotSessions(day.dateKey).map((session) => (
                                <SessionCard key={String(session.id)} session={session} />
                              ))}
                            </div>
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. CHẾ ĐỘ XEM THÁNG (MONTH VIEW) */}
            {viewMode === "month" && (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
                  <div className="p-2.5 border-r">Thứ Hai</div>
                  <div className="p-2.5 border-r">Thứ Ba</div>
                  <div className="p-2.5 border-r">Thứ Tư</div>
                  <div className="p-2.5 border-r">Thứ Năm</div>
                  <div className="p-2.5 border-r">Thứ Sáu</div>
                  <div className="p-2.5 border-r">Thứ Bảy</div>
                  <div className="p-2.5">Chủ nhật</div>
                </div>

                <div className="grid grid-cols-7 auto-rows-fr">
                  {monthDays.map((d, index) => {
                    const isSunday = (index + 1) % 7 === 0;
                    return (
                      <div
                        key={d.dateKey + index}
                        className={`min-h-[110px] p-2 border-b border-r ${
                          isSunday ? "border-r-0" : ""
                        } ${
                          !d.isCurrentMonth
                            ? "bg-muted/10 opacity-40"
                            : d.isToday
                              ? "bg-primary/5"
                              : "bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              d.isToday
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {d.dayNumber}
                          </span>
                          {d.sessions.length > 0 && (
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {d.sessions.length} buổi
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {d.sessions.slice(0, 3).map((s) => (
                            <SessionDetailModal
                              key={s.id}
                              session={s}
                              trigger={
                                <div
                                  className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition-all hover:scale-[1.02] ${
                                    statusClasses[s.status] || "bg-muted"
                                  }`}
                                  title={`${s.title} (${dayjs.tz(s.startTime, TIME_ZONE).format("HH:mm")})`}
                                >
                                  <strong>{dayjs.tz(s.startTime, TIME_ZONE).format("HH:mm")}</strong> {s.title}
                                </div>
                              }
                            />
                          ))}
                          {d.sessions.length > 3 && (
                            <p className="text-[9px] font-medium text-primary text-center">
                              +{d.sessions.length - 3} buổi khác
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. CHẾ ĐỘ XEM DANH SÁCH (LIST VIEW) */}
            {viewMode === "list" && (
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Tiêu đề buổi học</th>
                      <th className="px-4 py-3">Lớp</th>
                      <th className="px-4 py-3">Chủ đề (Topic)</th>
                      <th className="px-4 py-3">Giảng viên</th>
                      <th className="px-4 py-3">Phòng học</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-muted-foreground">
                          Không tìm thấy buổi học nào phù hợp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              {formatTime(s.startTime)}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              đến {dayjs.tz(s.endTime, TIME_ZONE).format("HH:mm")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-foreground">{s.title || "Buổi học"}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              CLASS-{String(s.classId).padStart(2, "0")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            Topic #{s.topicId}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {s.trainerId ? `Trainer #${s.trainerId}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span>{s.location || "Chưa có"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${
                                statusClasses[s.status] || "bg-muted"
                              }`}
                            >
                              {statusLabels[s.status] ?? s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <SessionDetailModal
                              session={s}
                              trigger={
                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary hover:text-primary">
                                  <Eye className="h-3.5 w-3.5" />
                                  Xem
                                </Button>
                              }
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
