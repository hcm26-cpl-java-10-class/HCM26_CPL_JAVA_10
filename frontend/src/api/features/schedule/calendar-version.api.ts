import axiosInstance from "@/api/axios";
import type {
    CreateCalendarVersionRequest,
    CalendarVersionResponse,
} from "@/types";

export const calendarVersionApi = {
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