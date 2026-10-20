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
import { useEffect, useState } from "react";

import { useSearchParams } from "react-router-dom";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const STUDY_SLOTS = [
  { id: 1, label: "Slot 1", start: "07:00", end: "09:15" },
  { id: 2, label: "Slot 2", start: "09:30", end: "11:45" },
  { id: 3, label: "Slot 3", start: "12:30", end: "14:45" },
  { id: 4, label: "Slot 4", start: "15:00", end: "17:15" },
];
const PAGE_SIZE = 20;

const statusLabels: Record<CalendarSessionStatus, string> = {
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

function getCurrentWeekStart() {
  const today = dayjs().tz(TIME_ZONE).startOf("day");
  const daysSinceMonday = (today.day() + 6) % 7;

  return today.subtract(daysSinceMonday, "day");
}

// Backend hiện trả LocalDateTime, được hiểu là giờ Việt Nam.
function formatTime(value: string) {
  return dayjs.tz(value, TIME_ZONE).format("DD/MM/YYYY HH:mm");
}
function SessionCard({ session }: { session: CalendarSessionResponse }) {
  const start = dayjs.tz(session.startTime, TIME_ZONE);
  const end = dayjs.tz(session.endTime, TIME_ZONE);
  const sameDay = start.format("YYYY-MM-DD") === end.format("YYYY-MM-DD");

  const timeLabel = sameDay
    ? `${start.format("HH:mm")}–${end.format("HH:mm")}`
    : `${start.format("DD/MM HH:mm")}–${end.format("DD/MM HH:mm")}`;

  const statusClass =
    session.status === "SCHEDULED"
      ? "bg-blue-100 text-blue-900"
      : session.status === "COMPLETED"
        ? "bg-green-100 text-green-900"
        : "bg-red-100 text-red-900";

  return (
    <article className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center gap-1 border-b bg-muted px-2 py-1">
        <span className="text-[11px] text-muted-foreground">Phòng</span>
        <strong className="min-w-0 break-words text-sm">
          {session.location || "Chưa có"}
        </strong>
      </div>

      <div className="space-y-0.5 px-2 py-1 text-[11px] leading-4">
        <p>
          <span className="text-muted-foreground">ID chủ đề: </span>
          <strong>{session.topicId}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">ID lớp: </span>
          <strong>{session.classId}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">ID GV: </span>
          {session.trainerId}
        </p>
        <p
          className="font-medium"
          title={`${formatTime(session.startTime)} đến ${formatTime(session.endTime)}`}
        >
          {timeLabel}
        </p>
      </div>

      <div
        className={`border-t px-2 py-1 text-center text-[11px] font-semibold leading-4 ${statusClass}`}
      >
        {statusLabels[session.status] ?? session.status}
      </div>
    </article>
  );
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

  const selectedDate = getCalendarDate(searchParams.get("date"));
  const daysSinceMonday = (selectedDate.day() + 6) % 7;
  const weekStart = selectedDate.subtract(daysSinceMonday, "day");

  const rawStatus = searchParams.get("status");
  const statusFilter: CalendarSessionStatus | "ALL" =
    rawStatus === "SCHEDULED" ||
    rawStatus === "COMPLETED" ||
    rawStatus === "CANCELLED"
      ? rawStatus
      : "ALL";

  const rawPage = searchParams.get("page") ?? "0";
  const parsedPage = Number(rawPage);
  const page =
    /^\d+$/.test(rawPage) &&
    Number.isSafeInteger(parsedPage) &&
    parsedPage <= 2147483647
      ? parsedPage
      : 0;

  const [result, setResult] = useState<CalendarSessionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const from = weekStart.format("YYYY-MM-DDTHH:mm:ss");
  const to = weekStart.add(7, "day").format("YYYY-MM-DDTHH:mm:ss");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSessions() {
      setLoading(true);
      setError(null);
      setResult(null);

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
        if (controller.signal.aborted) {
          return;
        }

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
      nextParams.set(key, value);
    }

    setSearchParams(nextParams);
  }

  function changeWeek(offset: number) {
    updateCalendarUrl({
      date: weekStart.add(offset, "day").format("YYYY-MM-DD"),
      page: "0",
    });
  }

  function setPage(value: number | ((previous: number) => number)) {
    const nextPage = typeof value === "function" ? value(page) : value;

    updateCalendarUrl({
      page: String(Math.max(0, nextPage)),
    });
  }
  const sessions = result?.content ?? [];
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
        const slotStart = dayjs
          .tz(`${dateKey}T${slot.start}:00`, TIME_ZONE)
          .valueOf();
        const slotEnd = dayjs
          .tz(`${dateKey}T${slot.end}:00`, TIME_ZONE)
          .valueOf();

        const sessionStart = dayjs.tz(session.startTime, TIME_ZONE).valueOf();
        const sessionEnd = dayjs.tz(session.endTime, TIME_ZONE).valueOf();

        return sessionStart < slotEnd && sessionEnd > slotStart;
      });
    });
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
      isToday:
        date.format("YYYY-MM-DD") ===
        dayjs().tz(TIME_ZONE).format("YYYY-MM-DD"),
    };
  });
  const buttonClass =
    "rounded-md border px-4 py-2 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <MainLayout pathName={{ calendar: "Thời khoá biểu" }} defaultSidebarHidden>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Thời khóa biểu</h1>

        <p className="text-sm text-muted-foreground">
          Tuần từ {weekStart.format("DD/MM/YYYY")} đến{" "}
          {weekStart.add(6, "day").format("DD/MM/YYYY")}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            onClick={() => changeWeek(-7)}
          >
            Tuần trước
          </button>

          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              updateCalendarUrl({
                date: dayjs().tz(TIME_ZONE).format("YYYY-MM-DD"),
                page: "0",
              });
            }}
          >
            Hôm nay
          </button>

          <button
            type="button"
            className={buttonClass}
            onClick={() => changeWeek(7)}
          >
            Tuần sau
          </button>

          <label className="flex items-center gap-2 text-sm">
            <span>Chọn ngày</span>

            <input
              type="date"
              value={selectedDate.format("YYYY-MM-DD")}
              onChange={(event) => {
                const value = event.target.value;

                if (!value) {
                  return;
                }

                updateCalendarUrl({
                  date: value,
                  page: "0",
                });
              }}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="calendar-status" className="text-sm font-medium">
            Trạng thái
          </label>

          <select
            id="calendar-status"
            value={statusFilter}
            onChange={(event) => {
              updateCalendarUrl({
                status: event.target.value,
                page: "0",
              });
            }}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="SCHEDULED">{statusLabels.SCHEDULED}</option>
            <option value="COMPLETED">{statusLabels.COMPLETED}</option>
            <option value="CANCELLED">{statusLabels.CANCELLED}</option>
          </select>
        </div>

        {loading && (
          <p role="status" className="p-4 text-center">
            Đang tải lịch...
          </p>
        )}

        {!loading && error && (
          <div role="alert" className="space-y-3 rounded-md border p-4">
            <p>{error}</p>
            <button
              type="button"
              className={buttonClass}
              onClick={() => setReloadKey((previous) => previous + 1)}
            >
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && result && (
          <>
            <p role="status" className="text-sm text-muted-foreground">
              Hiển thị {sessions.length} / {result.totalElements} buổi học phù
              hợp
            </p>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1200px] table-fixed border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th
                      scope="col"
                      className="w-28 border-b border-r p-3 text-center text-sm"
                    >
                      Slot
                    </th>

                    {weekDays.map((day) => (
                      <th
                        key={day.dateKey}
                        scope="col"
                        className={`border-b border-r p-3 text-center last:border-r-0 ${
                          day.isToday ? "bg-blue-50" : ""
                        }`}
                      >
                        <p className="text-sm font-semibold">{day.label}</p>
                        <p
                          className={`mt-1 text-lg font-bold ${
                            day.isToday ? "text-blue-700" : ""
                          }`}
                        >
                          {day.dateLabel}
                        </p>
                        <p className="mt-1 min-h-4 text-xs font-medium text-blue-700">
                          {day.isToday ? "Hôm nay" : "\u00A0"}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {STUDY_SLOTS.map((slot) => (
                    <tr key={slot.id} className="border-b last:border-b-0">
                      <th
                        scope="row"
                        className="border-r bg-muted/40 px-2 py-5 text-center align-top"
                      >
                        <p className="text-sm font-bold">{slot.label}</p>
                        <p className="mt-2 text-xs font-normal text-muted-foreground">
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
                            className={`border-r p-2 align-top last:border-r-0 ${
                              day.isToday ? "bg-blue-50/30" : "bg-muted/10"
                            }`}
                          >
                            <div className="min-h-16 space-y-1">
                              {slotSessions.length === 0 ? (
                                <p className="py-8 text-center text-xs text-muted-foreground">
                                  —
                                </p>
                              ) : (
                                slotSessions.map((session) => (
                                  <SessionCard
                                    key={String(session.id)}
                                    session={session}
                                  />
                                ))
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {weekDays.some(
                    (day) => getOutsideSlotSessions(day.dateKey).length > 0,
                  ) && (
                    <tr className="border-t">
                      <th
                        scope="row"
                        className="border-r bg-muted/40 px-2 py-5 text-center align-top"
                      >
                        <p className="text-sm font-bold">Ngoài slot</p>
                        <p className="mt-2 text-xs font-normal text-muted-foreground">
                          Giờ khác
                        </p>
                      </th>

                      {weekDays.map((day) => (
                        <td
                          key={day.dateKey}
                          className="border-r p-2 align-top last:border-r-0"
                        >
                          <div className="space-y-2">
                            {getOutsideSlotSessions(day.dateKey).map(
                              (session) => (
                                <SessionCard
                                  key={String(session.id)}
                                  session={session}
                                />
                              ),
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {result.totalPages > 1 && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={result.first}
                  onClick={() => setPage((previous) => previous - 1)}
                >
                  Trang trước
                </button>

                <span className="text-sm">
                  Trang {result.number + 1} / {result.totalPages}
                </span>

                <button
                  type="button"
                  className={buttonClass}
                  disabled={result.last}
                  onClick={() => setPage((previous) => previous + 1)}
                >
                  Trang sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
