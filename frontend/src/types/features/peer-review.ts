export type PeerReviewType = "SELF" | "PEER";
export type PeerReviewStatus = "ASSIGNED" | "SUBMITTED" | "SKIPPED";

export interface PeerReviewCriterion {
  criterionName: string;
  description?: string | null;
  weightPercentage: number;
  maxPoints: number;
}

export interface PeerReviewQuestion {
  questionId: number;
  sourceQuestionId?: number | null;
  content: string;
  points: number;
  answerText: string;
  criteria: PeerReviewCriterion[];
  maxPoints: number;
  /** Reference answer / rubric; chi co khi de thi cho phep xem. */
  referenceAnswer?: string | null;
  rubric?: string | null;
}

export interface PeerReviewTarget {
  assignmentId: number;
  examId: number;
  examTitle: string;
  attemptId: number;
  attemptNumber: number;
  authorLabel: string;
  anonymous: boolean;
  status: PeerReviewStatus;
  reviewableQuestionCount: number;
  questions: PeerReviewQuestion[];
}

export interface PeerReviewAssignment {
  id: number;
  examId: number;
  examTitle: string;
  attemptId: number;
  attemptNumber: number;
  reviewType: PeerReviewType;
  status: PeerReviewStatus;
  authorLabel: string;
  anonymous: boolean;
  assignedAt?: string | null;
  dueAt?: string | null;
  submittedAt?: string | null;
  reviewableQuestionCount: number;
}

export interface PeerReviewItem {
  questionId: number;
  questionContent?: string | null;
  criterionName: string;
  weightPercentage: number;
  maxPoints: number;
  awardedPoints: number;
  comment?: string | null;
}

export interface PeerReviewFeedback {
  submissionId: number;
  assignmentId: number;
  examId: number;
  examTitle: string;
  attemptId: number;
  attemptNumber: number;
  reviewerLabel: string;
  anonymous: boolean;
  selfReview: boolean;
  overallScore?: number | null;
  maxOverallScore?: number | null;
  overallComment?: string | null;
  submittedAt?: string | null;
  items: PeerReviewItem[];
}

export interface PeerReviewSubmitItem {
  questionId: number;
  criterionName: string;
  awardedPoints: number;
  comment?: string | null;
}

export interface PeerReviewSubmitPayload {
  overallScore?: number | null;
  overallComment?: string | null;
  items: PeerReviewSubmitItem[];
}

export interface PeerReviewOverview {
  examId: number;
  selfReviewEnabled: boolean;
  peerReviewEnabled: boolean;
  peerReviewCount: number;
  eligibleAttemptCount: number;
  assignedCount: number;
  submittedCount: number;
  pendingCount: number;
  underAssignedAttemptCount: number;
}

export interface PeerReviewProgress {
  assignmentId: number;
  attemptId: number;
  attemptNumber: number;
  authorName?: string | null;
  reviewType: PeerReviewType;
  status: PeerReviewStatus;
  reviewerName?: string | null;
  assignedAt?: string | null;
  submittedAt?: string | null;
}

export const PEER_REVIEW_TYPE_LABEL: Record<PeerReviewType, string> = {
  SELF: "Self review",
  PEER: "Peer review",
};

export const PEER_REVIEW_STATUS_LABEL: Record<PeerReviewStatus, string> = {
  ASSIGNED: "Pending",
  SUBMITTED: "Submitted",
  SKIPPED: "Skipped",
};
