import axiosInstance from "@/api/axios";
import type {
    CalendarSummary,
    CreateCalendarVersionRequest,
    CalendarVersionResponse,
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
};