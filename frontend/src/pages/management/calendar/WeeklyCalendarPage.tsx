import { getCalendarSessions } from "@/api/features/calendar.api";
import type { CalendarSessionsPage } from "@/api/features/calendar.api";
import { MainLayout } from "@/components/layout/MainLayout";
import type { CalendarSessionStatus } from "@/types/features/calendar";
import { isAxiosError } from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useEffect, useState } from "react";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIME_ZONE = "Asia/Ho_Chi_Minh";
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

export default function WeeklyCalendarPage() {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);
  const [statusFilter, setStatusFilter] = useState<
    CalendarSessionStatus | "ALL"
  >("ALL");
  const [page, setPage] = useState(0);
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

  function changeWeek(offset: number) {
    setPage(0);
    setWeekStart((previous) => previous.add(offset, "day"));
  }

  const sessions = result?.content ?? [];
  const buttonClass =
    "rounded-md border px-4 py-2 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <MainLayout pathName={{ calendar: "Thời khóa biểu" }}>
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
              setPage(0);
              setWeekStart(getCurrentWeekStart());
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="calendar-status" className="text-sm font-medium">
            Trạng thái
          </label>

          <select
            id="calendar-status"
            value={statusFilter}
            onChange={(event) => {
              setPage(0);
              setStatusFilter(
                event.target.value as CalendarSessionStatus | "ALL",
              );
            }}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="SCHEDULED">{statusLabels.SCHEDULED}</option>
            <option value="COMPLETED">{statusLabels.COMPLETED}</option>
            <option value="CANCELLED">{statusLabels.CANCELLED}</option>
          </select>
        </div>

        <p className="text-sm text-muted-foreground">
          Dữ liệu từ backend — thời gian theo múi giờ Việt Nam. Backend hiện
          cung cấp ID lớp, chủ đề và giảng viên; tên sẽ được bổ sung khi có dữ
          liệu liên kết.
        </p>

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

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3">Buổi học</th>
                    <th className="p-3">ID giảng viên</th>
                    <th className="p-3">Bắt đầu</th>
                    <th className="p-3">Kết thúc</th>
                    <th className="p-3">Phòng</th>
                    <th className="p-3">Trạng thái</th>
                  </tr>
                </thead>

                <tbody>
                  {sessions.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-muted-foreground"
                      >
                        {statusFilter === "ALL"
                          ? "Không có buổi học trong tuần này."
                          : "Không có buổi học phù hợp với trạng thái đã chọn trong tuần này."}
                      </td>
                    </tr>
                  )}

                  {sessions.map((session) => (
                    <tr key={String(session.id)} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{session.title}</p>
                        <p className="text-muted-foreground">
                          ID lớp: {session.classId} · ID chủ đề:{" "}
                          {session.topicId}
                        </p>
                      </td>
                      <td className="p-3">{session.trainerId}</td>
                      <td className="p-3">{formatTime(session.startTime)}</td>
                      <td className="p-3">{formatTime(session.endTime)}</td>
                      <td className="p-3">{session.location || "Chưa có"}</td>
                      <td className="p-3">
                        {statusLabels[session.status] ?? session.status}
                      </td>
                    </tr>
                  ))}
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
