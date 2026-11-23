import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  ScheduleVersionDTO,
  ScheduleVersionFilter,
  ScheduleVersionValidationResult,
} from "@/types";

const path = "/schedule-versions";

const base = createBaseApiService<ScheduleVersionDTO, ScheduleVersionFilter>({
  path: path,
});

export const scheduleVersionApi = Object.assign({}, base, {
  /** Lấy danh sách tất cả các phiên bản của lớp (sắp xếp tăng dần theo versionNumber) */
  getVersionsByClass: async (classId: string | number): Promise<ScheduleVersionDTO[]> => {
    const response = await axiosInstance.get<ScheduleVersionDTO[]>(
      `${path}/classes/${classId}`
    );
    return response.data;
  },

  /** Lấy phiên bản ACTIVE hiện hành của lớp */
  getActiveVersion: async (classId: string | number): Promise<ScheduleVersionDTO> => {
    const response = await axiosInstance.get<ScheduleVersionDTO>(
      `${path}/classes/${classId}/active`
    );
    return response.data;
  },

  /** Tạo bản DRAFT rỗng mới cho lớp */
  createDraft: async (classId: string | number, note?: string): Promise<ScheduleVersionDTO> => {
    const response = await axiosInstance.post<ScheduleVersionDTO>(
      `${path}/classes/${classId}/draft`,
      { note }
    );
    return response.data;
  },

  /** Clone phiên bản nguồn sang DRAFT mới */
  cloneVersion: async (id: number | string, note?: string): Promise<ScheduleVersionDTO> => {
    const response = await axiosInstance.post<ScheduleVersionDTO>(
      `${path}/${id}/clone`,
      { note }
    );
    return response.data;
  },

  /** Kiểm tra xung đột lịch cho toàn bộ phiên bản */
  validateVersion: async (id: number | string): Promise<ScheduleVersionValidationResult> => {
    const response = await axiosInstance.post<ScheduleVersionValidationResult>(
      `${path}/${id}/validate`,
      {}
    );
    return response.data;
  },

  /** Kích hoạt phiên bản DRAFT thành ACTIVE (yêu cầu lý do kích hoạt) */
  activateVersion: async (
    id: number | string,
    activationReason: string
  ): Promise<ScheduleVersionDTO> => {
    const response = await axiosInstance.post<ScheduleVersionDTO>(
      `${path}/${id}/activate`,
      { activationReason }
    );
    return response.data;
  },

  /** Lấy lịch sử phiên bản của lớp (mới nhất trước) */
  getHistory: async (classId: string | number): Promise<ScheduleVersionDTO[]> => {
    const response = await axiosInstance.get<ScheduleVersionDTO[]>(
      `${path}/classes/${classId}/history`
    );
    return response.data;
  },

  /** Xóa phiên bản nháp (DRAFT) */
  deleteDraft: async (id: number | string): Promise<void> => {
    await axiosInstance.delete(`${path}/${id}`);
  },
});
