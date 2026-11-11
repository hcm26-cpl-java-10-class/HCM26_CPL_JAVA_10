import axiosInstance from "@/api/axios";
import type {
    ScheduleValidationRequest,
    ScheduleValidationResponse,
} from "@/types/features/schedule-validation";

export const scheduleValidationApi = {
    validate: async (
        versionId: number,
        request: ScheduleValidationRequest,
    ): Promise<ScheduleValidationResponse> => {
        const response = await axiosInstance.post<ScheduleValidationResponse>(
            `/schedule-versions/${versionId}/validations`,
            request,
        );
        return response.data;
    },
};
