
import axiosInstance from "@/api/axios";
import type { PageResponse } from "@/types/common/pageable";
import type {
    SectionDTO,
    SectionPayload
} from "@/types/features/demo/section";

const path = "/sections";

export const sectionApi = {
    getByCourse: async (courseId: number) => {
        const response = await axiosInstance.get<PageResponse<SectionDTO>>(
            path,
            {
                params: {
                    courseId,
                    page: 0,
                    size: 200,
                    sort: "orderIndex,asc"
                }
            }
        );
        return response.data;
    },

    create: async (data: SectionPayload) => {
        const response = await axiosInstance.post<SectionDTO>(path, data);
        return response.data;
    },

    update: async (id: number, data: SectionPayload) => {
        const response = await axiosInstance.put<SectionDTO>(
            `${path}/${id}`,
            data
        );
        return response.data;
    },

    delete: async (id: number) => {
        await axiosInstance.delete(`${path}/${id}`);
    }
};
