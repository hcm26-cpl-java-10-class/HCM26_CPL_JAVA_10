import { getCalendarSessions, getMyCalendarSessions } from "@/api/features/calendar.api";
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
import { useSearchParams, Link } from "react-router-dom";
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
  UserCheck,
  Users,
  GraduationCap,
  Eye,
  FileEdit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIME_ZONE = "Asia/Ho_Chi_Minh";
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

// Thẻ hiển thị buổi học trong lưới tuần (Dynamic Session Card)
function SessionCard({
  session,
  sessionIndex,
}: {
  session: CalendarSessionResponse;
  sessionIndex?: number;
}) {
  const start = dayjs.tz(session.startTime, TIME_ZONE);
  const end = dayjs.tz(session.endTime, TIME_ZONE);
  const sameDay = start.format("YYYY-MM-DD") === end.format("YYYY-MM-DD");
  const timeLabel = sameDay
    ? `${start.format("HH:mm")} – ${end.format("HH:mm")}`
    : `${start.format("DD/MM HH:mm")} – ${end.format("DD/MM HH:mm")}`;

  const durationHours = end.diff(start, "minute") / 60;
  const durationText =
    durationHours > 0
      ? durationHours % 1 === 0
        ? `${durationHours}h`
        : `${durationHours.toFixed(1)}h`
      : "";

  const statusClass = statusClasses[session.status] || "bg-muted text-muted-foreground";

  return (
    <SessionDetailModal
      session={session}
      trigger={
        <article className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/80 bg-card p-2.5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md text-left">
          {/* Top header: Session index & Time Badge */}
          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-border/60">
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{timeLabel}</span>
              {durationText && (
                <span className="text-[10px] font-normal text-muted-foreground">({durationText})</span>
              )}
            </div>
            {typeof sessionIndex === "number" && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                Ca {sessionIndex}
              </span>
            )}
          </div>

          {/* Main content */}
          <div className="pt-2 space-y-1.5 text-xs">
            <h4 className="font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {session.title || "Buổi học đào tạo"}
            </h4>

            <div className="space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <GraduationCap className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">
                  Lớp #{session.classId} {session.topicId ? `· Topic #${session.topicId}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate font-medium text-foreground/80">
                  {session.trainerId ? `Trainer #${session.trainerId}` : "Chưa gán Trainer"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{session.location || "Chưa xếp phòng"}</span>
              </div>
            </div>

            {/* Bottom status */}
            <div className="pt-1 flex items-center justify-between border-t border-border/40">
              <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold border ${statusClass}`}>
                {statusLabels[session.status] ?? session.status}
              </span>
              <span className="text-[10px] text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-0.5">
                Chi tiết <ChevronRight className="h-3 w-3" />
              </span>
            </div>
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

  // Phạm vi xem: "all" (Tất cả lịch) | "mine" (Lịch cá nhân)
  const scope = (searchParams.get("scope") as "all" | "mine") || "all";

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
        const queryParams = {
          from,
          to,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          classId: classFilter !== "ALL" ? Number(classFilter) : undefined,
          page,
          size: PAGE_SIZE,
        };

        const data =
          scope === "mine"
            ? await getMyCalendarSessions(queryParams, controller.signal)
            : await getCalendarSessions(queryParams, controller.signal);

        if (!controller.signal.aborted) {
          setResult(data);
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;

        const forbidden =
          isAxiosError(requestError) && requestError.response?.status === 403;
        const unauthorized =
          isAxiosError(requestError) && requestError.response?.status === 401;

        if (unauthorized) {
          setError("Vui lòng đăng nhập để xem lịch cá nhân của bạn.");
        } else if (forbidden) {
          setError("Bạn không có quyền xem lịch. Cần quyền SESSION_READ.");
        } else {
          setError("Không tải được lịch. Kiểm tra kết nối backend rồi thử lại.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSessions();
    return () => controller.abort();
  }, [from, to, statusFilter, classFilter, scope, page, reloadKey]);

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

  // Tải dữ liệu mẫu minh họa cho tuần hiện tại (khi backend chưa seed data hoặc offline)
  function loadSampleSessions() {
    const monday = weekStart;
    const sampleData: CalendarSessionResponse[] = [
      {
        id: 101,
        title: "[L2_JA_JS] Java SE / OOP Fundamentals (Lecture)",
        startTime: monday.hour(8).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.hour(10).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Room 302 (F-Town 1)",
        isActive: true,
      },
      {
        id: 102,
        title: "[L2_JA_JS] Java OOP Practice Lab & Exercises",
        startTime: monday.hour(10).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.hour(12).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Lab 4 (F-Town 1)",
        isActive: true,
      },
      {
        id: 103,
        title: "[L2_JA_JS] Java Collection Framework & Generics",
        startTime: monday.hour(13).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.hour(17).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Lab 4 (F-Town 1)",
        isActive: true,
      },
      {
        id: 104,
        title: "[L2_JA_JS] Exception Handling & Clean Code Principles",
        startTime: monday.add(1, "day").hour(8).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.add(1, "day").hour(10).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Room 302 (F-Town 1)",
        isActive: true,
      },
      {
        id: 105,
        title: "[L2_JA_JS] Hands-on Coding Assignment #1",
        startTime: monday.add(1, "day").hour(10).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.add(1, "day").hour(12).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Lab 4 (F-Town 1)",
        isActive: true,
      },
      {
        id: 106,
        title: "[L2_JA_JS] Progress Assessment & Code Review",
        startTime: monday.add(2, "day").hour(13).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.add(2, "day").hour(17).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Room 302 (F-Town 1)",
        isActive: true,
      },
      {
        id: 107,
        title: "[L2_JA_JS] JDBC Database Connectivity & DAO Pattern",
        startTime: monday.add(3, "day").hour(8).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        endTime: monday.add(3, "day").hour(12).minute(0).second(0).format("YYYY-MM-DDTHH:mm:ss"),
        status: "SCHEDULED",
        classId: 1,
        topicId: 1,
        trainerId: 45,
        location: "Room 302 (F-Town 1)",
        isActive: true,
      },
    ];

    setResult({
      content: sampleData,
      totalElements: sampleData.length,
      totalPages: 1,
      size: sampleData.length,
      number: 0,
      first: true,
      last: true,
    });
    setError(null);
    toast.success("Đã nạp 7 buổi học mẫu minh họa cho tuần này!");
  }

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
              {scope === "mine" && (
                <Badge className="bg-primary/15 text-primary border-primary/30 text-xs font-semibold">
                  <UserCheck className="mr-1 h-3 w-3" /> Lịch cá nhân
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span>{dateTitle}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/calendar/adjust">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
              >
                <FileEdit className="h-4 w-4 text-primary" />
                Điều chỉnh lịch (Adjust Calendar)
              </Button>
            </Link>
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

        {/* Thanh điều khiển thứ 2: Phạm vi (Tất cả / Của tôi), Chuyển View Mode & Điều hướng ngày */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tab chuyển phạm vi: Tất cả lịch | Lịch của tôi */}
            <div className="inline-flex rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => updateCalendarUrl({ scope: "all", page: "0" })}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  scope === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Tất cả lịch
              </button>
              <button
                type="button"
                onClick={() => updateCalendarUrl({ scope: "mine", page: "0" })}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  scope === "mine"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                Lịch của tôi
              </button>
            </div>

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
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((p) => p + 1)}
                className="h-8 text-xs"
              >
                Thử lại
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={loadSampleSessions}
                className="h-8 text-xs bg-primary text-primary-foreground gap-1.5 shadow-sm"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Xem dữ liệu mẫu minh họa (Demo Sessions)
              </Button>
            </div>
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

            {/* 1. CHẾ ĐỘ XEM TUẦN (WEEK VIEW - DYNAMIC SESSIONS FLOW) */}
            {viewMode === "week" && (
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <div className="min-w-[1100px]">
                  {/* Header 7 ngày trong tuần */}
                  <div className="grid grid-cols-7 border-b bg-muted/40 divide-x divide-border">
                    {weekDays.map((day) => {
                      const daySessionsCount = sessions.filter(
                        (s) => s.startTime && s.startTime.substring(0, 10) === day.dateKey,
                      ).length;

                      return (
                        <div
                          key={day.dateKey}
                          className={`p-3 text-center transition-colors ${
                            day.isToday ? "bg-primary/10" : ""
                          }`}
                        >
                          <p className="text-xs font-semibold text-muted-foreground">{day.label}</p>
                          <p
                            className={`mt-0.5 text-base font-bold ${
                              day.isToday ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {day.dateLabel}
                          </p>
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            {day.isToday && (
                              <span className="text-[10px] font-bold text-primary">● Hôm nay</span>
                            )}
                            <span className="rounded-full bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border">
                              {daySessionsCount} buổi
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Lưới 7 cột ngày - hiển thị các Sessions động theo thời gian thực */}
                  <div className="grid grid-cols-7 divide-x divide-border min-h-[480px] bg-background">
                    {weekDays.map((day) => {
                      const daySessions = sessions
                        .filter(
                          (s) => s.startTime && s.startTime.substring(0, 10) === day.dateKey,
                        )
                        .sort(
                          (a, b) =>
                            dayjs.tz(a.startTime, TIME_ZONE).valueOf() -
                            dayjs.tz(b.startTime, TIME_ZONE).valueOf(),
                        );

                      return (
                        <div
                          key={day.dateKey}
                          className={`p-2 space-y-2 flex flex-col transition-colors ${
                            day.isToday ? "bg-primary/[0.02]" : ""
                          }`}
                        >
                          {daySessions.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-muted-foreground/40">
                              <CalendarIcon className="h-6 w-6 stroke-1 mb-1.5 opacity-40" />
                              <span className="text-xs">Không có buổi học</span>
                            </div>
                          ) : (
                            daySessions.map((session, index) => (
                              <SessionCard
                                key={String(session.id || index)}
                                session={session}
                                sessionIndex={index + 1}
                              />
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
