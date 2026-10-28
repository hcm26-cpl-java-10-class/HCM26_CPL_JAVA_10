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
  /** Khóa tài khoản: PATCH /users/{id}/lock (chỉ ADMIN). */
  lock: async (id: string | number): Promise<void> => {
    await axiosInstance.patch(`${path}/${id}/lock`);
  },

  /** Mở khóa tài khoản: PATCH /users/{id}/unlock (chỉ ADMIN). */
  unlock: async (id: string | number): Promise<void> => {
    await axiosInstance.patch(`${path}/${id}/unlock`);
  },
});
