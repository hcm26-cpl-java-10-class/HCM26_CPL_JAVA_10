import type { UserDTO, UserFilter } from "@/types";
import axiosInstance from "../../axios";
import { createBaseApiService } from "../../base-service.api";

const path = "/users";

const base = createBaseApiService<UserDTO, UserFilter>({ path: path });

export const userApi = Object.assign({}, base, {
  /** Khóa tài khoản: PATCH /users/{id}/lock (chỉ ADMIN). */
  lock: async (id: string | number): Promise<void> => {
    await axiosInstance.patch(`${path}/${id}/lock`);
  },

  /** Mở khóa tài khoản: PATCH /users/{id}/unlock (chỉ ADMIN). */
  unlock: async (id: string | number): Promise<void> => {
    await axiosInstance.patch(`${path}/${id}/unlock`);
  },
});
