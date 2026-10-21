import axiosInstance from "@/api/axios";
import type {
    CalendarSummary,
    CreateCalendarVersionRequest,
    CalendarVersionResponse,
    CalendarVersionFilter,
    ConflictCheckResult,
    SpringPage,
    UpdateCalendarVersionRequest,
} from "@/types";

export const calendarVersionApi = {
    list: async (): Promise<CalendarSummary[]> => {
        const response =
            await axiosInstance.get<CalendarSummary[]>("/calendars");

        return response.data;
    },

    create: async (
        calendarId: number,
        request: CreateCalendarVersionRequest,
    ): Promise<CalendarVersionResponse> => {
        const response = await axiosInstance.post<CalendarVersionResponse>(
            `/calendars/${calendarId}/versions`,
            request,
        );

        return response.data;
    },

    getVersions: async (
        calendarId: number,
        page: number,
        size: number,
        filter: CalendarVersionFilter,
    ): Promise<SpringPage<CalendarVersionResponse>> => {
        const response = await axiosInstance.get<
            SpringPage<CalendarVersionResponse>
    >(`/calendars/${calendarId}/versions`, {
        params: {
            page,
            size,
            ...filter,
        },
    });
    return response.data;
},

    update: async (
        calendarId: number,
        versionId: number,
        request: UpdateCalendarVersionRequest,
    ): Promise<CalendarVersionResponse> => {
        const response = await axiosInstance.patch<CalendarVersionResponse>(
            `/calendars/${calendarId}/versions/${versionId}`,
            request,
        );

        return response.data;
    },

    delete: async (
        calendarId: number,
        versionId: number,
    ): Promise<void> => {
        await axiosInstance.delete(
            `/calendars/${calendarId}/versions/${versionId}`,
        );
    },

    checkConflicts: async (
        versionId: number,
    ): Promise<ConflictCheckResult> => {
        const response = await axiosInstance.get<ConflictCheckResult>(
            `/calendar-versions/${versionId}/conflicts`,
        );

        return response.data;
    },

    activate: async (
        calendarId: number,
        versionId: number,
    ): Promise<CalendarVersionResponse> => {
        const response = await axiosInstance.post<CalendarVersionResponse>(
            `/calendars/${calendarId}/versions/${versionId}/activate`,
        );

        return response.data;
    },

};
