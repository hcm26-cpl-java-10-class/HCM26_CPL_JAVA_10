import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { SessionCancelDTO, SessionDTO, SessionFilter } from "@/types";

const path = "/sessions";

const base = createBaseApiService<SessionDTO, SessionFilter>({
    path,
});

export const sessionApi = Object.assign({}, base, {
    cancelSession: async (id: string | number, data: SessionCancelDTO): Promise<SessionDTO> => {
        const res = await axiosInstance.patch<SessionDTO>(`${path}/${id}/cancel`, data);
        return res.data;
    },
});