export type ScoreAppealStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ScoreAppealDTO {
  id: number;
  examId: number | null;
  examTitle: string | null;
  attemptId: number | null;
  attemptNumber: number;
  studentId: number | null;
  studentName: string | null;
  reason: string;
  requestedScore: number | null;
  status: ScoreAppealStatus;
  oldScore: number | null;
  newScore: number | null;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  adjustmentApplied: boolean;
  createdAt: string | null;
}

export interface ScoreAppealCreateRequest {
  reason: string;
  requestedScore?: number;
}

export type ScoreAppealDecision = "APPROVE" | "REJECT";

export interface ScoreAppealReviewRequest {
  decision: ScoreAppealDecision;
  newScore?: number;
  resolutionNote?: string;
}

export interface ScoreAppealAdjustmentDTO {
  id: number;
  appealId: number | null;
  attemptId: number | null;
  oldScore: number | null;
  newScore: number | null;
  reason: string;
  actorId: number | null;
  actorName: string | null;
  action: "SCORE_ADJUSTED" | "APPEAL_APPROVED_NO_CHANGE";
  createdAt: string | null;
}

export const SCORE_APPEAL_STATUS_LABEL: Record<ScoreAppealStatus, string> = {
  PENDING: "Chờ xử lý",
  APPROVED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
};

/** Nhãn tiếng Anh dùng cho giao diện quản lý của giáo viên / admin. */
export const SCORE_APPEAL_STATUS_LABEL_EN: Record<ScoreAppealStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
