import axiosInstance from "@/api/axios";
import type {
  LessonReport,
  LessonReportInbox,
  LessonReportInboxPage,
  LessonReportRequest,
  LessonReportStatus,
} from "@/types";

const base = (lessonId: number) => `/lessons/${lessonId}/reports`;

export const lessonReportApi = {
  /** Gửi báo cáo bài học có vấn đề (bắt buộc có reason). */
  create: async (lessonId: number, body: LessonReportRequest): Promise<LessonReport> => {
    const response = await axiosInstance.post<LessonReport>(base(lessonId), body);
    return response.data;
  },

  /** Hộp thư báo cáo của giảng viên (admin: tất cả). `status` bỏ trống = mọi trạng thái. */
  listInbox: async (params: {
    page?: number;
    size?: number;
    status?: LessonReportStatus;
  }): Promise<LessonReportInboxPage> => {
    const { page = 0, size = 10, status } = params;
    const response = await axiosInstance.get("/lesson-reports", {
      params: { page, size, ...(status ? { status } : {}) },
    });
    const raw = response.data ?? {};
    // Supports both the classic Spring Page and the DTO page shape ({ page: {...} }).
    const meta = raw.page && typeof raw.page === "object" ? raw.page : raw;
    return {
      content: (raw.content ?? []) as LessonReportInbox[],
      totalElements: (meta.totalElements ?? 0) as number,
      totalPages: (meta.totalPages ?? 0) as number,
      number: (meta.number ?? page) as number,
    };
  },

  resolve: async (reportId: number): Promise<LessonReportInbox> => {
    const response = await axiosInstance.patch<LessonReportInbox>(
      `/lesson-reports/${reportId}/resolve`,
    );
    return response.data;
  },
};
