import type { StudentSummaryDTO, UserDTO, UserFilter } from "@/types";
import { createBaseApiService } from "../../base-service.api";
import axiosInstance from "../../axios";

const path = "/users";

const base = createBaseApiService<UserDTO, UserFilter>({ path: path });

export const userApi = Object.assign({}, base, {
    getPage: async (pagination: any, search?: string, filter?: any) => {
        const modifiedPagination = { ...pagination };
        if (modifiedPagination.sort) {
            const mapSort = (s: string) => (typeof s === "string" ? s.replace("fullName", "firstName") : s);
            modifiedPagination.sort = Array.isArray(modifiedPagination.sort)
                ? modifiedPagination.sort.map(mapSort)
                : mapSort(modifiedPagination.sort);
        }

        const response = await base.getPage(modifiedPagination, search, filter);
        if (response && Array.isArray(response.content)) {
            response.content = response.content.map((u: any) => ({
                ...u,
                fullName: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" "),
            }));
        }
        return response;
    },

    getById: async (id: string) => {
        const u = await base.getById(id);
        if (u) {
            return {
                ...u,
                fullName: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(" "),
            };
        }
        return u;
    },

    create: async (data: any) => {
        const payload = { ...data };
        if (payload.fullName && !payload.firstName) {
            const parts = payload.fullName.trim().split(" ");
            payload.firstName = parts[0] || "";
            payload.lastName = parts.slice(1).join(" ") || "";
        }
        return base.create(payload);
    },

    update: async (id: string, data: any) => {
        const payload = { ...data };
        if (payload.fullName && !payload.firstName) {
            const parts = payload.fullName.trim().split(" ");
            payload.firstName = parts[0] || "";
            payload.lastName = parts.slice(1).join(" ") || "";
        }
        return base.update(id, payload);
    },

    /** Kh├│a t├ái khoß║ún: PATCH /users/{id}/lock (chß╗ë ADMIN). */
    lock: async (id: string | number): Promise<void> => {
        await axiosInstance.patch(`${path}/${id}/lock`);
    },

    /** Mß╗ƒ kh├│a t├ái khoß║ún: PATCH /users/{id}/unlock (chß╗ë ADMIN). */
    unlock: async (id: string | number): Promise<void> => {
        await axiosInstance.patch(`${path}/${id}/unlock`);
    },

    getStudents: async (): Promise<StudentSummaryDTO[]> => {
        const response = await axiosInstance.get<StudentSummaryDTO[]>(`${path}/students`);
        return response.data;
    },
});
