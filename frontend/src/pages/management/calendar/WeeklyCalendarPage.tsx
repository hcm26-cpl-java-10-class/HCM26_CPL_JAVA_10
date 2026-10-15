import { MainLayout } from "@/components/layout/MainLayout";
import { calendarSessionsMock } from "@/mocks/calendar.mock";
import type { CalendarSessionStatus } from "@/types/features/calendar";

import { useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIME_ZONE = "Asia/Ho_Chi_Minh";

function getCurrentWeekStart() {
  const today = dayjs().tz(TIME_ZONE).startOf("day");
  const daysSinceMonday = (today.day() + 6) % 7;

  return today.subtract(daysSinceMonday, "day");
}

const statusLabels: Record<CalendarSessionStatus, string> = {
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

function formatTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function WeeklyCalendarPage() {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);

  const nextWeekStart = weekStart.add(7, "day");

  const weeklySessions = calendarSessionsMock
    .filter((session) => {
      const sessionStart = Date.parse(session.startTime);
      const sessionEnd = Date.parse(session.endTime);

      return (
        sessionStart < nextWeekStart.valueOf() &&
        sessionEnd > weekStart.valueOf()
      );
    })
    .sort(
      (left, right) => Date.parse(left.startTime) - Date.parse(right.startTime),
    );

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
            className="rounded-md border px-4 py-2 hover:bg-muted"
            onClick={() => {
              setWeekStart((previous) => previous.subtract(7, "day"));
            }}
          >
            Tuần trước
          </button>

          <button
            type="button"
            className="rounded-md border px-4 py-2 hover:bg-muted"
            onClick={() => {
              setWeekStart(getCurrentWeekStart());
            }}
          >
            Hôm nay
          </button>

          <button
            type="button"
            className="rounded-md border px-4 py-2 hover:bg-muted"
            onClick={() => {
              setWeekStart((previous) => previous.add(7, "day"));
            }}
          >
            Tuần sau
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Dữ liệu mẫu — thời gian hiển thị theo múi giờ Việt Nam.
        </p>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3">Buổi học</th>
                <th className="p-3">Giảng viên</th>
                <th className="p-3">Bắt đầu</th>
                <th className="p-3">Kết thúc</th>
                <th className="p-3">Phòng</th>
                <th className="p-3">Trạng thái</th>
              </tr>
            </thead>

            <tbody>
              {weeklySessions.length === 0 && (
  <tr>
    <td
      colSpan={6}
      className="p-6 text-center text-muted-foreground"
    >
      Không có buổi học trong tuần này.
    </td>
  </tr>
)}

              {weeklySessions.map((session) => (
                <tr key={session.id} className="border-t">
                  <td className="p-3">
                    <p className="font-medium">{session.title}</p>
                    <p className="text-muted-foreground">
                      {session.className} · {session.subjectName}
                    </p>
                  </td>

                  <td className="p-3">{session.trainerName}</td>
                  <td className="p-3">{formatTime(session.startTime)}</td>
                  <td className="p-3">{formatTime(session.endTime)}</td>
                  <td className="p-3">{session.location}</td>
                  <td className="p-3">{statusLabels[session.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
