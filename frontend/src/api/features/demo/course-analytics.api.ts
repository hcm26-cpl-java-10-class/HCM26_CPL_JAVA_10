import axiosInstance from "@/api/axios";
import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";
import type {
  ActivityResponse,
  ContentQualityResponse,
  CourseAnalyticsGranularity,
  CourseComparisonResponse,
  CourseExamAnalyticsResponse,
  CourseRankingResponse,
  CourseRatingRankItem,
  CourseReviewAnalyticsResponse,
  DepartmentAnalyticsResponse,
  LessonFunnelResponse,
  StudyTimeResponse,
  TrendResponse,
} from "@/types";

const path = "/reports";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Gọi API export Excel và tải file về máy.
 * Backend trả `Content-Disposition` kèm tên file nên tên file luôn khớp với
 * tên file mà backend sinh ra.
 */
const downloadExcel = async (
  url: string,
  params: Record<string, unknown>,
  fallbackName: string,
) => {
  const response = await axiosInstance.get(url, {
    params,
    responseType: "blob",
  });

  const filename =
    getFilenameFromHeader(response.headers["content-disposition"]) ??
    fallbackName;

  downloadBlob(new Blob([response.data], { type: XLSX_MIME }), filename);
  return filename;
};

export const courseAnalyticsApi = {
  /** 1. Phễu học tập theo từng bài + mức tụt giữa các bài. */
  getLessonFunnel: async (courseId: number): Promise<LessonFunnelResponse> => {
    const response = await axiosInstance.get<LessonFunnelResponse>(
      `${path}/courses/${courseId}/lesson-funnel`,
    );
    return response.data;
  },

  /** 2. Đăng ký mới / bài hoàn thành / chứng chỉ theo thời gian. */
  getTrend: async (
    courseId: number,
    params: {
      from?: string;
      to?: string;
      granularity?: CourseAnalyticsGranularity;
    } = {},
  ): Promise<TrendResponse> => {
    const response = await axiosInstance.get<TrendResponse>(
      `${path}/courses/${courseId}/trend`,
      { params },
    );
    return response.data;
  },

  /** 3. Active / inactive / chưa bắt đầu + học viên có nguy cơ bỏ học. */
  getActivity: async (
    courseId: number,
    params: { inactiveDays?: number; limit?: number } = {},
  ): Promise<ActivityResponse> => {
    const response = await axiosInstance.get<ActivityResponse>(
      `${path}/courses/${courseId}/activity`,
      { params },
    );
    return response.data;
  },

  /** 4a. Điểm trung bình + phân bố 1-5 sao của một khóa học. */
  getReviewAnalytics: async (
    courseId: number,
  ): Promise<CourseReviewAnalyticsResponse> => {
    const response = await axiosInstance.get<CourseReviewAnalyticsResponse>(
      `${path}/courses/${courseId}/review-analytics`,
    );
    return response.data;
  },

  /** 4b. Xếp hạng rating giữa các khóa học. */
  getCourseRatingRanking: async (): Promise<CourseRatingRankItem[]> => {
    const response = await axiosInstance.get<CourseRatingRankItem[]>(
      `${path}/course-ratings`,
    );
    return response.data;
  },

  /** 5. Thống kê điểm / tỉ lệ đạt của các bài thi thuộc khóa học. */
  getExamAnalytics: async (courseId: number): Promise<CourseExamAnalyticsResponse> => {
    const response = await axiosInstance.get<CourseExamAnalyticsResponse>(
      `${path}/courses/${courseId}/exam-analytics`,
    );
    return response.data;
  },

  /** 6. Số học viên / tỉ lệ hoàn thành / điểm thi theo phòng ban. */
  getDepartmentAnalytics: async (
    courseId?: number,
  ): Promise<DepartmentAnalyticsResponse> => {
    const response = await axiosInstance.get<DepartmentAnalyticsResponse>(
      `${path}/department-analytics`,
      { params: courseId ? { courseId } : {} },
    );
    return response.data;
  },

  /** 7. Xếp hạng khóa học theo học viên / hoàn thành / rating / bỏ học. */
  getCourseRanking: async (): Promise<CourseRankingResponse> => {
    const response = await axiosInstance.get<CourseRankingResponse>(
      `${path}/course-ranking`,
    );
    return response.data;
  },

  /** 8. Bài học bị báo lỗi, lý do, câu hỏi chưa trả lời, thời gian phản hồi. */
  getContentQuality: async (courseId: number): Promise<ContentQualityResponse> => {
    const response = await axiosInstance.get<ContentQualityResponse>(
      `${path}/courses/${courseId}/content-quality`,
    );
    return response.data;
  },

  /** 9. Số giờ học của từng học viên trong khóa học. */
  getStudyTime: async (courseId: number): Promise<StudyTimeResponse> => {
    const response = await axiosInstance.get<StudyTimeResponse>(
      `${path}/courses/${courseId}/study-time`,
    );
    return response.data;
  },

  /**
   * 10. So sánh TOÀN BỘ các khóa học qua từng module của Course Analytics.
   * Trả về số liệu của tất cả khóa học + thứ hạng theo từng module + nhận định.
   */
  getCourseComparison: async (
    params: {
      from?: string;
      to?: string;
      granularity?: CourseAnalyticsGranularity;
      inactiveDays?: number;
    } = {},
  ): Promise<CourseComparisonResponse> => {
    const response = await axiosInstance.get<CourseComparisonResponse>(
      `${path}/course-comparison`,
      { params },
    );
    return response.data;
  },

  // =====================================================================
  // Export Excel
  // =====================================================================

  /** Export tổng: gom TẤT CẢ analytics của khóa học vào 1 file Excel nhiều sheet. */
  exportAll: async (
    courseId: number,
    params: {
      from?: string;
      to?: string;
      granularity?: CourseAnalyticsGranularity;
      inactiveDays?: number;
    } = {},
  ) =>
    downloadExcel(
      `${path}/export/all`,
      { courseId, ...params },
      `course-analytics-all-${courseId}.xlsx`,
    ),

  /** Export riêng phễu học tập. */
  exportLessonFunnel: async (courseId: number) =>
    downloadExcel(
      `${path}/export/lesson-funnel`,
      { courseId },
      `course-analytics-funnel-${courseId}.xlsx`,
    ),

  /** Export riêng xu hướng theo thời gian. */
  exportTrend: async (
    courseId: number,
    params: {
      from?: string;
      to?: string;
      granularity?: CourseAnalyticsGranularity;
    } = {},
  ) =>
    downloadExcel(
      `${path}/export/trend`,
      { courseId, ...params },
      `course-analytics-trend-${courseId}.xlsx`,
    ),

  /** Export riêng mức độ hoạt động (theo đúng ngưỡng không hoạt động đang chọn). */
  exportActivity: async (
    courseId: number,
    params: { inactiveDays?: number } = {},
  ) =>
    downloadExcel(
      `${path}/export/activity`,
      { courseId, ...params },
      `course-analytics-activity-${courseId}.xlsx`,
    ),

  /** Export riêng đánh giá. */
  exportReviews: async (courseId: number) =>
    downloadExcel(
      `${path}/export/reviews`,
      { courseId },
      `course-analytics-reviews-${courseId}.xlsx`,
    ),

  /** Export riêng phòng ban. */
  exportDepartments: async (courseId?: number) =>
    downloadExcel(
      `${path}/export/departments`,
      courseId ? { courseId } : {},
      `course-analytics-departments.xlsx`,
    ),

  /** Export riêng bảng xếp hạng khóa học. */
  exportCourseRanking: async () =>
    downloadExcel(
      `${path}/export/course-ranking`,
      {},
      `course-analytics-course-ranking.xlsx`,
    ),

  /** Export riêng chất lượng nội dung + Q&A. */
  exportContentQuality: async (courseId: number) =>
    downloadExcel(
      `${path}/export/content-quality`,
      { courseId },
      `course-analytics-content-quality-${courseId}.xlsx`,
    ),

  /** Export riêng kết quả bài thi. */
  exportExams: async (courseId: number) =>
    downloadExcel(
      `${path}/export/exams`,
      { courseId },
      `course-analytics-exams-${courseId}.xlsx`,
    ),

  /** Export riêng số giờ học của học viên. */
  exportStudyTime: async (courseId: number) =>
    downloadExcel(
      `${path}/export/study-time`,
      { courseId },
      `course-analytics-study-time-${courseId}.xlsx`,
    ),
};
