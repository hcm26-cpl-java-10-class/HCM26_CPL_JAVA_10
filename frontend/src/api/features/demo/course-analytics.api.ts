import axiosInstance from "@/api/axios";
import type {
  ActivityResponse,
  CourseAnalyticsGranularity,
  CourseExamAnalyticsResponse,
  CourseRatingRankItem,
  CourseReviewAnalyticsResponse,
  LessonFunnelResponse,
  TrendResponse,
} from "@/types";

const path = "/reports";

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
};
