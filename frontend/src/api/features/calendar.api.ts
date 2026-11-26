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
  note?: string | null;
  cancelReason?: string | null;
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
  classId?: number;
  trainerId?: number;
  topicId?: number;
  location?: string;
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

export async function getMyCalendarSessions(
  params: CalendarSessionsQuery,
  signal?: AbortSignal,
): Promise<CalendarSessionsPage> {
  const response = await axiosInstance.get<CalendarSessionsPage>(
    "/calendar/my-sessions",
    {
      params,
      signal,
    },
  );

  return response.data;
}

const CALENDAR_FETCH_PAGE_SIZE = 200;
const CALENDAR_FETCH_CONCURRENCY = 4;

function createAbortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) {
    return signal.reason;
  }
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

/**
 * Loads every page of calendar sessions for a period while preserving filters, scope,
 * deterministic page order, bounded concurrency, and abort signal so week/month/list
 * views, search, and CSV export always cover the full selected period without truncation.
 */
export async function fetchAllCalendarSessions(
  scope: "all" | "mine",
  params: Omit<CalendarSessionsQuery, "page">,
  signal?: AbortSignal,
): Promise<CalendarSessionsPage> {
  if (signal?.aborted) {
    throw createAbortError(signal);
  }

  const fetcher = scope === "mine" ? getMyCalendarSessions : getCalendarSessions;
  const pageSize = Math.min(Math.max(params.size ?? CALENDAR_FETCH_PAGE_SIZE, 1), 200);

  const firstPage = await fetcher({ ...params, page: 0, size: pageSize }, signal);
  const totalPages = Math.max(firstPage.totalPages ?? 1, 1);
  if (totalPages <= 1 || firstPage.last) {
    return firstPage;
  }

  const pageResults: CalendarSessionResponse[][] = new Array(totalPages);
  pageResults[0] = firstPage.content ?? [];

  const batchController = new AbortController();
  const onParentAbort = () => batchController.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      batchController.abort(signal.reason);
    } else {
      signal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  let nextPage = 1;
  let firstError: unknown = null;

  async function worker() {
    while (true) {
      if (batchController.signal.aborted) {
        return;
      }
      const page = nextPage++;
      if (page >= totalPages) {
        return;
      }
      try {
        const pageData = await fetcher(
          { ...params, page, size: pageSize },
          batchController.signal,
        );
        pageResults[page] = pageData.content ?? [];
      } catch (err) {
        if (firstError === null) {
          firstError = err;
          batchController.abort(err);
        }
        return;
      }
    }
  }

  try {
    const workerCount = Math.min(CALENDAR_FETCH_CONCURRENCY, totalPages - 1);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } finally {
    signal?.removeEventListener("abort", onParentAbort);
  }

  if (signal?.aborted) {
    throw createAbortError(signal);
  }
  if (firstError !== null) {
    throw firstError;
  }

  const allContent = pageResults.flat();

  return {
    ...firstPage,
    content: allContent,
    number: 0,
    size: allContent.length,
    first: true,
    last: true,
  };
}
