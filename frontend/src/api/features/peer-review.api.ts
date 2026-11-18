import axiosInstance from "@/api/axios";
import type {
  PeerReviewAssignment,
  PeerReviewFeedback,
  PeerReviewOverview,
  PeerReviewProgress,
  PeerReviewSubmitPayload,
  PeerReviewTarget,
} from "@/types/features/peer-review";

export const peerReviewApi = {
  /** Danh sach viec cham duoc gan cho nguoi dung hien tai. */
  getMyAssignments: async (): Promise<PeerReviewAssignment[]> => {
    const response = await axiosInstance.get<PeerReviewAssignment[]>("/exams/reviews/my");
    return response.data;
  },

  /** Chi tiet bai lam duoc cham (tac gia bi an danh neu de thi bat an danh). */
  getTarget: async (assignmentId: number): Promise<PeerReviewTarget> => {
    const response = await axiosInstance.get<PeerReviewTarget>(
      `/exams/reviews/my/${assignmentId}`
    );
    return response.data;
  },

  /** Nop phieu cham. */
  submit: async (
    assignmentId: number,
    payload: PeerReviewSubmitPayload
  ): Promise<PeerReviewFeedback> => {
    const response = await axiosInstance.post<PeerReviewFeedback>(
      `/exams/reviews/${assignmentId}/submit`,
      payload
    );
    return response.data;
  },

  /** Feedback nhan duoc cho mot bai lam cua chinh minh. */
  getFeedbackForAttempt: async (attemptId: number): Promise<PeerReviewFeedback[]> => {
    const response = await axiosInstance.get<PeerReviewFeedback[]>(
      `/exams/attempts/${attemptId}/reviews`
    );
    return response.data;
  },

  /** Feedback nhan duoc cho tat ca bai lam cua chinh minh. */
  getMyFeedback: async (): Promise<PeerReviewFeedback[]> => {
    const response = await axiosInstance.get<PeerReviewFeedback[]>("/exams/reviews/my-feedback");
    return response.data;
  },

  /** Giao vien / admin phan cong reviewer. */
  assign: async (examId: number): Promise<PeerReviewOverview> => {
    const response = await axiosInstance.post<PeerReviewOverview>(
      `/exams/${examId}/reviews/assign`
    );
    return response.data;
  },

  /** Giao vien / admin xem tien do phan cong. */
  getOverview: async (examId: number): Promise<PeerReviewOverview> => {
    const response = await axiosInstance.get<PeerReviewOverview>(
      `/exams/${examId}/reviews/overview`
    );
    return response.data;
  },

  /** Giao vien / admin xem bang tien do tung phan cong. */
  getProgress: async (examId: number): Promise<PeerReviewProgress[]> => {
    const response = await axiosInstance.get<PeerReviewProgress[]>(
      `/exams/${examId}/reviews/progress`
    );
    return response.data;
  },
};
