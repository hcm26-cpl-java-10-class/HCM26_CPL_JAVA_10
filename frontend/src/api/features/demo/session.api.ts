import { createBaseApiService, type BaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
    PageResponse,
    Pagination,
    SessionCancelDTO,
    SessionDTO,
    SessionDuplicateDTO,
    SessionFilter,
    SessionRescheduleDTO,
} from "@/types";

const path = "/sessions";
const CLASS_SESSIONS_PAGE_SIZE = 200;

const base: BaseApiService<SessionDTO, SessionFilter> = createBaseApiService<SessionDTO, SessionFilter>({
    path,
});

interface DateRange {
    from?: string;
    to?: string;
}

const isDateRange = (value: unknown): value is DateRange =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The generic table filter widgets produce a {from, to} range for "startTime"; the backend filters on the
 * LocalDateTime parameters fromDate (startTime >=) and toDate (endTime <=). Everything else passes through.
 */
export function normalizeSessionFilter(filter?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!filter) return filter;

    const { startTime, ...rest } = filter;
    const normalized: Record<string, unknown> = { ...rest };

    if (isDateRange(startTime)) {
        if (startTime.from) normalized.fromDate = `${startTime.from}T00:00:00`;
        if (startTime.to) normalized.toDate = `${startTime.to}T23:59:59`;
    }

    return normalized;
}

export const sessionApi = Object.assign({}, base, {
    getPage: (pagination: Pagination, search?: string, filter?: SessionFilter | Record<string, unknown>) =>
        base.getPage(pagination, search, normalizeSessionFilter(filter as Record<string, unknown> | undefined) as SessionFilter | undefined),

    cancelSession: async (id: string | number, data: SessionCancelDTO): Promise<SessionDTO> => {
        const res = await axiosInstance.patch<SessionDTO>(`${path}/${id}/cancel`, data);
        return res.data;
    },

    completeSession: async (id: string | number): Promise<SessionDTO> => {
        const res = await axiosInstance.patch<SessionDTO>(`${path}/${id}/complete`);
        return res.data;
    },

    rescheduleSession: async (id: string | number, data: SessionRescheduleDTO): Promise<SessionDTO> => {
        const res = await axiosInstance.patch<SessionDTO>(`${path}/${id}/reschedule`, data);
        return res.data;
    },

    duplicateSession: async (id: string | number, data: SessionDuplicateDTO): Promise<SessionDTO> => {
        const res = await axiosInstance.post<SessionDTO>(`${path}/${id}/duplicate`, data);
        return res.data;
    },

    /** Every session of one class in chronological order; pages are followed until the last one. */
    getAllByClass: async (classId: number): Promise<SessionDTO[]> => {
        const sessions: SessionDTO[] = [];

        for (let page = 0; ; page += 1) {
            const params = new URLSearchParams({
                classId: String(classId),
                page: String(page),
                size: String(CLASS_SESSIONS_PAGE_SIZE),
            });
            params.append("sort", "startTime,asc");
            params.append("sort", "id,asc");

            const res = await axiosInstance.get<PageResponse<SessionDTO>>(path, { params });
            sessions.push(...(res.data.content ?? []));

            if (page + 1 >= (res.data.totalPages ?? 0)) {
                return sessions;
            }
        }
    },
    createBatch: async (sessions: SessionDTO[]): Promise<SessionDTO[]> => {
        const response = await axiosInstance.post<SessionDTO[]>(`${path}/batch`, sessions);
        return response.data;
    },
    deleteByClassId: async (classId: number | string): Promise<void> => {
        await axiosInstance.delete(`${path}/class/${classId}`);
    },
});