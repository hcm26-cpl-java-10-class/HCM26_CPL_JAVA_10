import type { UserDTO, UserFilter } from "@/types";
import { createBaseApiService } from "../../base-service.api";
import axiosInstance from "../../axios";

const path = "/users";

const base = createBaseApiService<UserDTO, UserFilter>({ path });

export const userApi = Object.assign({}, base, {
    lockUser: async (id: string | number): Promise<void> => {
        await axiosInstance.patch(`${path}/${id}/lock`);
    },

    unlockUser: async (id: string | number): Promise<void> => {
        await axiosInstance.patch(`${path}/${id}/unlock`);
    },
});