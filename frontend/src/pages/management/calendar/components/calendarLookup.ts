import { createContext, useContext } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { CalendarSessionStatus } from "@/types/features/calendar";

dayjs.extend(utc);
dayjs.extend(timezone);

export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export const STATUS_LABELS: Record<CalendarSessionStatus, string> = {
  SCHEDULED: "Đã lên lịch",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

export const STATUS_CLASSES: Record<CalendarSessionStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300",
};

export function formatCalendarTime(value: string) {
  return dayjs.tz(value, TIME_ZONE).format("DD/MM/YYYY HH:mm");
}

export interface CalendarLookupContextType {
  getClassName: (classId?: number) => string;
  getClassCode: (classId?: number) => string;
  getTrainerName: (trainerId?: number) => string;
  getTopicName: (topicId?: number, sessionTitle?: string) => string;
  getTopicCode: (topicId?: number, sessionTitle?: string) => string;
}

export const CalendarLookupContext = createContext<CalendarLookupContextType>({
  getClassName: (id) => (id ? `Lớp #${id}` : "—"),
  getClassCode: (id) => (id ? `Lớp #${id}` : "—"),
  getTrainerName: (id) => (id ? `Trainer #${id}` : "Chưa phân công"),
  getTopicName: (id, title) => {
    const match = title?.match(/^\[(.*?)\]/);
    if (match) return `[${match[1]}]`;
    return id ? `Chủ đề #${id}` : "Chưa có";
  },
  getTopicCode: (id, title) => {
    const match = title?.match(/^\[(.*?)\]/);
    if (match) return match[1];
    return id ? `Topic #${id}` : "—";
  },
});

export const useCalendarLookup = () => useContext(CalendarLookupContext);
