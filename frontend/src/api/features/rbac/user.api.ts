import type { StudentSummaryDTO, UserDTO, UserFilter } from "@/types";
import { createBaseApiService } from "../../base-service.api";
import axiosInstance from "../../axios";

const path = "/users";

const base = createBaseApiService<UserDTO, UserFilter>({ path: path });

export const userApi = Object.assign({}, base, {

    getStudents: async (): Promise<StudentSummaryDTO[]> => {
        const response = await axiosInstance.get<StudentSummaryDTO[]>(`${path}/students`);
        return response.data;
    },
});
