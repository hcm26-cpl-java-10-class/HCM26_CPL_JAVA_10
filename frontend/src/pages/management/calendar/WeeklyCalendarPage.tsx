import { getCalendarSessions, getMyCalendarSessions } from "@/api/features/calendar.api";
import { clsApi, type TrainingClass } from "@/api/features/cls.api";
import { trainerApi, type Trainer } from "@/api/features/trainer.api";
import type {
  CalendarSessionResponse,
  CalendarSessionsPage,
} from "@/api/features/calendar.api";
import { MainLayout } from "@/components/layout/MainLayout";
import type { CalendarSessionStatus } from "@/types/features/calendar";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import { useEffect, useState, useMemo } from "react";
import { topicApi } from "@/api/features/topic.api";
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
  UserCheck,
  Users,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CalendarLookupContext,
  STATUS_CLASSES,
  STATUS_LABELS,
  TIME_ZONE,
  formatCalendarTime,
} from "./components/calendarLookup";
import { SessionCard } from "./components/SessionCard";
import { SessionDetailModal } from "./components/SessionDetailModal";

const PAGE_SIZE = 100;

function getCurrentWeekStart() {
  const today = dayjs().tz(TIME_ZONE).startOf("day");
  const daysSinceMonday = (today.day() + 6) % 7;
  return today.subtract(daysSinceMonday, "day");
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

  const [systemClasses, setSystemClasses] = useState<TrainingClass[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [systemSubjects, setSystemSubjects] = useState<Array<{ id: number; code: string; name: string }>>([]);

  useEffect(() => {
    clsApi.getAllClasses().then((res) => {
      if (Array.isArray(res)) {
        setSystemClasses(res);
      }
    }).catch(() => { });

    trainerApi.list({ page: 0, size: 200 }).then((res) => {
      const list = res?.content || [];
      if (Array.isArray(list)) {
        setTrainers(list);
      }
    }).catch(() => { });

    topicApi.getPage({ page: 0, size: 100 }).then((res) => {
      const list = res?.content || [];
      if (Array.isArray(list)) {
        setSystemSubjects(list.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
        })));
      }
    }).catch(() => { });
  }, []);

  const getClassName = (classId?: number): string => {
    if (!classId) return "—";
    const found = systemClasses.find((c) => c.id === classId);
    if (found) {
      return found.name ? `[${found.code}] ${found.name}` : `[${found.code}]`;
    }
    return `Lớp #${classId}`;
  };

  const getClassCode = (classId?: number): string => {
    if (!classId) return "—";
    const found = systemClasses.find((c) => c.id === classId);
    return found?.code || `Lớp #${classId}`;
  };

  const getTrainerName = (trainerId?: number): string => {
    if (!trainerId) return "Chưa phân công";
    const found = trainers.find((t) => t.id === trainerId);
    return found?.fullName || `Trainer #${trainerId}`;
  };

  const getTopicName = (topicId?: number, sessionTitle?: string): string => {
    if (sessionTitle) {
      const match = sessionTitle.match(/^\[(.*?)\]/);
      if (match) {
        const code = match[1];
        const sub = systemSubjects.find((s) => s.code === code);
        return sub ? `[${sub.code}] ${sub.name}` : `[${code}]`;
      }
    }
    if (topicId) {
      const sub = systemSubjects.find((s) => s.id === topicId);
      return sub ? `[${sub.code}] ${sub.name}` : `Chủ đề #${topicId}`;
    }
    return "Chưa có";
  };

  const getTopicCode = (topicId?: number, sessionTitle?: string): string => {
    if (sessionTitle) {
      const match = sessionTitle.match(/^\[(.*?)\]/);
      if (match) return match[1];
    }
    if (topicId) {
      const sub = systemSubjects.find((s) => s.id === topicId);
      return sub?.code || `Topic #${topicId}`;
    }
    return "—";
  };

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
        const matchClass = `class-${s.classId}`.toLowerCase().includes(q) || String(s.classId).includes(q) || getClassCode(s.classId).toLowerCase().includes(q) || getClassName(s.classId).toLowerCase().includes(q);
        const matchTrainer = `trainer-${s.trainerId}`.toLowerCase().includes(q) || String(s.trainerId).includes(q) || getTrainerName(s.trainerId).toLowerCase().includes(q);
        const matchTopic = getTopicCode(s.topicId, s.title).toLowerCase().includes(q) || getTopicName(s.topicId, s.title).toLowerCase().includes(q);
        return matchTitle || matchLoc || matchClass || matchTrainer || matchTopic;
      }
      return true;
    });
  }, [rawSessions, keyword, classFilter, systemClasses, trainers, systemSubjects]);

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
      `"${getClassCode(s.classId)}"`,
      `"${getTopicCode(s.topicId, s.title)}"`,
      `"${getTrainerName(s.trainerId)}"`,
      `"${(s.location || "Chưa có").replace(/"/g, '""')}"`,
      `"${formatCalendarTime(s.startTime)}"`,
      `"${formatCalendarTime(s.endTime)}"`,
      `"${STATUS_LABELS[s.status] || s.status}"`,
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

    // Ô trống đệm cuối tháng để đủ bội số 7 cột
    const trailingSlots = (7 - (list.length % 7)) % 7;
    const endOfMonth = startOfMonth.endOf("month");
    for (let i = 1; i <= trailingSlots; i++) {
      const nextDate = endOfMonth.add(i, "day");
      list.push({
        dateKey: nextDate.format("YYYY-MM-DD"),
        dayNumber: nextDate.date(),
        isCurrentMonth: false,
        isToday: false,
        sessions: [],
      });
    }

    return list;
  }, [viewMode, selectedDate, sessions]);

  return (
    <CalendarLookupContext.Provider value={{ getClassName, getClassCode, getTrainerName, getTopicName, getTopicCode }}>
      <MainLayout pathName={{ calendar: "Thời khoá biểu" }}>
        <div className="w-full min-w-0 space-y-5 pb-16">
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
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${scope === "all"
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
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${scope === "mine"
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
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === "week"
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
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === "month"
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
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === "list"
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
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.6fr)_minmax(180px,1fr)_minmax(170px,1fr)_auto] rounded-xl border bg-card p-3 shadow-sm">
            {/* Tìm kiếm từ khóa */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm theo tiêu đề, phòng học, giảng viên..."
                maxLength={100}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Lọc theo Lớp */}
            <div className="flex items-center gap-1.5 min-w-0">
              <label htmlFor="calendar-class" className="text-xs text-muted-foreground shrink-0 font-medium">
                Lớp:
              </label>
              <select
                id="calendar-class"
                value={classFilter}
                onChange={(e) => updateCalendarUrl({ classId: e.target.value === "ALL" ? "" : e.target.value, page: "0" })}
                className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs font-medium truncate"
              >
                <option value="ALL">Tất cả lớp học</option>
                {systemClasses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name ? `[${c.code}] ${c.name}` : c.code}
                  </option>
                ))}
                {availableClasses
                  .filter((c) => !systemClasses.some((sc) => sc.id === c))
                  .map((c) => (
                    <option key={c} value={String(c)}>
                      {getClassName(c)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Lọc theo Trạng thái */}
            <div className="flex items-center gap-1.5 min-w-0">
              <label htmlFor="calendar-status" className="text-xs text-muted-foreground shrink-0 font-medium">
                Trạng thái:
              </label>
              <select
                id="calendar-status"
                value={statusFilter}
                onChange={(e) => updateCalendarUrl({ status: e.target.value, page: "0" })}
                className="h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="SCHEDULED">{STATUS_LABELS.SCHEDULED}</option>
                <option value="COMPLETED">{STATUS_LABELS.COMPLETED}</option>
                <option value="CANCELLED">{STATUS_LABELS.CANCELLED}</option>
              </select>
            </div>

            {/* Nút Reset bộ lọc */}
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
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

              {sessions.length === 0 && viewMode !== "list" && (
                <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  Chưa có buổi học nào trong khoảng thời gian này.
                </div>
              )}

              {/* 1. CHẾ ĐỘ XEM TUẦN (WEEK VIEW - RESPONSIVE GRID, KHÔNG CẮT CHỦ NHẬT) */}
              {viewMode === "week" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
                  {weekDays.map((day) => {
                    const daySessions = sessions
                      .filter((s) => s.startTime && s.startTime.substring(0, 10) === day.dateKey)
                      .sort(
                        (a, b) =>
                          dayjs.tz(a.startTime, TIME_ZONE).valueOf() -
                          dayjs.tz(b.startTime, TIME_ZONE).valueOf(),
                      );

                    return (
                      <section
                        key={day.dateKey}
                        className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs ${day.isToday ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                          }`}
                      >
                        <header
                          className={`border-b px-3 py-2.5 text-center ${day.isToday ? "bg-primary/10" : "bg-muted/40"
                            }`}
                        >
                          <p className="text-xs font-semibold text-muted-foreground">{day.label}</p>
                          <p className={`mt-0.5 text-base font-bold ${day.isToday ? "text-primary" : "text-foreground"}`}>
                            {day.dateLabel}
                          </p>
                          <div className="mt-1 flex items-center justify-center gap-1.5">
                            {day.isToday && (
                              <span className="text-[10px] font-bold text-primary whitespace-nowrap">● Hôm nay</span>
                            )}
                            <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border whitespace-nowrap">
                              {daySessions.length} buổi
                            </span>
                          </div>
                        </header>

                        <div className={`flex-1 p-2.5 space-y-2.5 min-h-[240px] ${day.isToday ? "bg-primary/[0.02]" : "bg-background"}`}>
                          {daySessions.length === 0 ? (
                            <div className="flex h-full min-h-[180px] flex-col items-center justify-center py-8 text-center text-muted-foreground/50">
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
                      </section>
                    );
                  })}
                </div>
              )}

              {/* 2. CHẾ ĐỘ XEM THÁNG (MONTH VIEW) */}
              {viewMode === "month" && (
                <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                  <div className="min-w-[760px]">
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
                            className={`min-h-[115px] p-2 border-b border-r ${isSunday ? "border-r-0" : ""
                              } ${!d.isCurrentMonth
                                ? "bg-muted/10 opacity-40"
                                : d.isToday
                                  ? "bg-primary/5"
                                  : "bg-card"
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <button
                                type="button"
                                onClick={() => updateCalendarUrl({ view: "week", date: d.dateKey, page: "0" })}
                                title="Xem tuần của ngày này"
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold hover:ring-2 hover:ring-primary/40 transition-all ${d.isToday
                                    ? "bg-primary text-primary-foreground"
                                    : "text-foreground"
                                  }`}
                              >
                                {d.dayNumber}
                              </button>
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
                                      className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-[10px] font-medium transition-all hover:scale-[1.02] ${STATUS_CLASSES[s.status] || "bg-muted"
                                        }`}
                                      title={`${s.title} (${dayjs.tz(s.startTime, TIME_ZONE).format("HH:mm")})`}
                                    >
                                      <strong>{dayjs.tz(s.startTime, TIME_ZONE).format("HH:mm")}</strong> {s.title}
                                    </div>
                                  }
                                />
                              ))}
                              {d.sessions.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => updateCalendarUrl({ view: "week", date: d.dateKey, page: "0" })}
                                  className="w-full text-[10px] font-semibold text-primary hover:underline text-center pt-0.5"
                                >
                                  +{d.sessions.length - 3} buổi khác
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                                {formatCalendarTime(s.startTime)}
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
                                {getClassCode(s.classId)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {getTopicCode(s.topicId, s.title)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {getTrainerName(s.trainerId)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span>{s.location || "Chưa có"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[s.status] || "bg-muted"
                                  }`}
                              >
                                {STATUS_LABELS[s.status] ?? s.status}
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
    </CalendarLookupContext.Provider>
  );
}
