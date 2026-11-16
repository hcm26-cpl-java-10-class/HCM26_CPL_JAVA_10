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

export const DEFAULT_TRAINER_NAMES: Record<number, string> = {
  1: "Nguyễn Ngọc Tân (Trainer)",
  2: "Nguyễn Mạnh Hoàng (Trainer)",
  3: "Nguyễn Văn Thắng (Trainer)",
  4: "Nguyễn Tuấn Danh (Trainer)",
  5: "Huỳnh Tấn Phát (Trainer)",
};

export const DEFAULT_TOPIC_NAMES: Record<string, string> = {
  JAVA_CORE: "Lập trình Java căn bản & OOP",
  SPRING_BOOT: "Lập trình Web Backend với Spring Boot",
  DATABASE_SQL: "Cơ sở dữ liệu & Thiết kế CSDL SQL",
  REACT_FRONTEND: "Lập trình Giao diện Web với ReactJS",
  DEVOPS_BASIC: "DevOps & CI/CD căn bản",
  TESTING_QA: "Kiểm thử phần mềm & Đảm bảo chất lượng QA",
};

export const DEFAULT_TOPIC_ID_MAP: Record<number, { code: string; name: string }> = {
  1: { code: "JAVA_CORE", name: "Lập trình Java căn bản & OOP" },
  2: { code: "SPRING_BOOT", name: "Lập trình Web Backend với Spring Boot" },
  3: { code: "DATABASE_SQL", name: "Cơ sở dữ liệu & Thiết kế CSDL SQL" },
  4: { code: "REACT_FRONTEND", name: "Lập trình Giao diện Web với ReactJS" },
  5: { code: "DEVOPS_BASIC", name: "DevOps & CI/CD căn bản" },
  6: { code: "TESTING_QA", name: "Kiểm thử phần mềm & Đảm bảo chất lượng QA" },
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
  getClassName: (id) =>
    id === 1
      ? "[LOCAL_JAVA_01] Lớp Chuyên sâu Java Backend (K26)"
      : id === 2
        ? "[LOCAL_JAVA_02] Lớp Lập trình Fullstack Java Web (K26)"
        : id
          ? `Lớp #${id}`
          : "—",
  getClassCode: (id) => (id === 1 ? "LOCAL_JAVA_01" : id === 2 ? "LOCAL_JAVA_02" : id ? `Lớp #${id}` : "—"),
  getTrainerName: (id) => (id ? DEFAULT_TRAINER_NAMES[id] || `Trainer #${id}` : "Chưa phân công"),
  getTopicName: (id, title) => {
    const match = title?.match(/^\[(.*?)\]/);
    if (match && DEFAULT_TOPIC_NAMES[match[1]]) {
      return `[${match[1]}] ${DEFAULT_TOPIC_NAMES[match[1]]}`;
    }
    if (id && DEFAULT_TOPIC_ID_MAP[id]) {
      return `[${DEFAULT_TOPIC_ID_MAP[id].code}] ${DEFAULT_TOPIC_ID_MAP[id].name}`;
    }
    return id ? `Chủ đề #${id}` : "Chưa có";
  },
  getTopicCode: (id, title) => {
    const match = title?.match(/^\[(.*?)\]/);
    if (match) return match[1];
    if (id && DEFAULT_TOPIC_ID_MAP[id]) {
      return DEFAULT_TOPIC_ID_MAP[id].code;
    }
    return id ? `Topic #${id}` : "—";
  },
});

export const useCalendarLookup = () => useContext(CalendarLookupContext);

