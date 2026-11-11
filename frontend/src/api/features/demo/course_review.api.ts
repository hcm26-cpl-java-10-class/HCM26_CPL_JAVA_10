import axiosInstance from "@/api/axios";
import type { PageResponse, Pagination } from "@/types";
import type {
  CourseReviewRequest,
  CourseReviewResponse,
  CourseReviewSummary,
  CourseReviewEligibility 
} from "@/types";

const path = (courseId: number) => `/courses/${courseId}/reviews`;

export const courseReviewApi = {
  getReviews: async (
    courseId: number,
    pagination: Pagination = { page: 0, size: 10 },
  ): Promise<PageResponse<CourseReviewResponse>> => {
    const response = await axiosInstance.get<PageResponse<CourseReviewResponse>>(
      path(courseId),
      { params: pagination },
    );
    return response.data;
  },

  getSummary: async (courseId: number): Promise<CourseReviewSummary> => {
    const response = await axiosInstance.get<CourseReviewSummary>(
      `${path(courseId)}/summary`,
    );
    return response.data;
  },

  getEligibility: async (courseId: number): Promise<CourseReviewEligibility> => {
    const response = await axiosInstance.get<CourseReviewEligibility>(
      `${path(courseId)}/eligibility`,
    );
    return response.data;
  },

  createReview: async (
    courseId: number,
    data: CourseReviewRequest,
  ): Promise<CourseReviewResponse> => {
    const response = await axiosInstance.post<CourseReviewResponse>(
      path(courseId),
      data,
    );
    return response.data;
  },

  updateMyReview: async (
    courseId: number,
    data: CourseReviewRequest,
  ): Promise<CourseReviewResponse> => {
    const response = await axiosInstance.put<CourseReviewResponse>(
      `${path(courseId)}/me`,
      data,
    );
    return response.data;
  },
};