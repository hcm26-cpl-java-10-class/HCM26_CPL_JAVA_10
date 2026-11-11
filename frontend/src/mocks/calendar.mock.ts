import type { CalendarSession } from "@/types/features/calendar";

export const calendarSessionsMock: CalendarSession[] = [
  {
    id: "SES001",
    title: "Java — Lập trình hướng đối tượng",
    className: "HCM26_CPL_JAVA_10",
    subjectName: "Java",
    trainerName: "Giảng viên mẫu A",
    location: "Phòng A101",
    startTime: "2026-10-15T08:00:00+07:00",
    endTime: "2026-10-15T10:00:00+07:00",
    status: "SCHEDULED",
  },
  {
    id: "SES002",
    title: "SQL — Truy vấn dữ liệu",
    className: "HCM26_CPL_JAVA_10",
    subjectName: "SQL",
    trainerName: "Giảng viên mẫu B",
    location: "Phòng B202",
    startTime: "2026-10-16T13:00:00+07:00",
    endTime: "2026-10-16T15:00:00+07:00",
    status: "CANCELLED",
  },
];