import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
    CloneVersionRequest,
    CreateDraftRequest,
    ScheduleVersionDTO,
    ScheduleVersionFilter,
} from "@/types";

const path = "/schedule-versions";

const base = createBaseApiService<ScheduleVersionDTO, ScheduleVersionFilter>({
    path,
});

export const scheduleVersionApi = Object.assign({}, base, {
    /**
     * Tạo một phiên bản nháp rỗng cho lớp học
     */
    createDraft: async (classId: string, data?: CreateDraftRequest): Promise<ScheduleVersionDTO> => {
        const res = await axiosInstance.post<ScheduleVersionDTO>(`${path}/classes/${classId}/draft`, data || {});
        return res.data;
    },

    /**
     * Clone một phiên bản sang bản nháp mới
     */
    cloneVersion: async (id: string | number, data?: CloneVersionRequest): Promise<ScheduleVersionDTO> => {
        const res = await axiosInstance.post<ScheduleVersionDTO>(`${path}/${id}/clone`, data || {});
        return res.data;
    },

    /**
     * Lấy tất cả các phiên bản lịch của một lớp
     */
    getVersionsByClass: async (classId: string): Promise<ScheduleVersionDTO[]> => {
        const res = await axiosInstance.get<ScheduleVersionDTO[]>(`${path}/classes/${classId}`);
        return res.data;
    },

    /**
     * Lấy phiên bản ACTIVE đang áp dụng của lớp
     */
    getActiveVersion: async (classId: string): Promise<ScheduleVersionDTO> => {
        const res = await axiosInstance.get<ScheduleVersionDTO>(`${path}/classes/${classId}/active`);
        return res.data;
    },

    /**
     * Kiểm tra quyền sửa (Guard kiểm tra trạng thái DRAFT)
     */
    getEditableStatus: async (id: string | number): Promise<ScheduleVersionDTO> => {
        const res = await axiosInstance.get<ScheduleVersionDTO>(`${path}/${id}/editable`);
        return res.data;
    },

    /**
     * Xem toàn bộ lịch sử các phiên bản của lớp
     */
    getHistory: async (classId: string): Promise<ScheduleVersionDTO[]> => {
        const res = await axiosInstance.get<ScheduleVersionDTO[]>(`${path}/classes/${classId}/history`);
        return res.data;
    },

    /**
     * Xóa bản nháp DRAFT
     */
    deleteDraft: async (id: string | number): Promise<void> => {
        await axiosInstance.delete(`${path}/${id}`);
    },

    /**
     * Kích hoạt phiên bản lịch học (DRAFT -> ACTIVE)
     */
    activateVersion: async (id: string | number): Promise<ScheduleVersionDTO> => {
        const res = await axiosInstance.post<ScheduleVersionDTO>(`${path}/${id}/activate`);
        return res.data;
    },
});
