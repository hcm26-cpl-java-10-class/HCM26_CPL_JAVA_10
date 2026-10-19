import axiosInstance from "@/api/axios";
import type { CalendarSessionStatus } from "@/types/features/calendar";

// Cấu trúc backend hiện tại, tách riêng với kiểu dữ liệu hiển thị.
export interface CalendarSessionResponse {
  id: number;
  isActive: boolean;
  classId: number;
  topicId: number;
  trainerId: number;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  status: CalendarSessionStatus;
}

export interface CalendarSessionsPage {
  content: CalendarSessionResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface CalendarSessionsQuery {
  from: string;
  to: string;
  status?: CalendarSessionStatus;
  page?: number;
  size?: number;
}

export async function getCalendarSessions(
  params: CalendarSessionsQuery,
  signal?: AbortSignal,
): Promise<CalendarSessionsPage> {
  const response = await axiosInstance.get<CalendarSessionsPage>(
    "/calendar/sessions",
    {
      params,
      signal,
    },
  );

  return response.data;
}