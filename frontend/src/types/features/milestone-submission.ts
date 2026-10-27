import type { RubricRatingLevel } from "./rubric";

export type SubmissionStatus = "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";
export type MilestoneExecutionStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "FAILED";
export type ReviewDecision = "ACCEPT" | "REJECT" | "REQUEST_CHANGES";
export type SubmissionArtifactType = "REPOSITORY" | "DOCUMENTATION" | "DEMO" | "OTHER";

export interface SubmissionListItem {
  id: string;
  projectId: string;
  milestoneId: string;
  milestoneTitle: string;
  mandatory: boolean;
  teamId: string;
  teamName: string;
  studentName: string;
  reviewerName: string;
  status: SubmissionStatus;
  executionStatus: MilestoneExecutionStatus;
  currentVersionNumber: number;
  submissionAttempts: number;
  deadline: string;
  submittedAt?: string | null;
  late: boolean;
  penaltyPercent: number;
  lockVersion: number;
  checklistCompleted: number;
  checklistTotal: number;
}

export interface SubmissionPage {
  content: SubmissionListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SubmissionListParams {
  projectId?: string;
  page: number;
  size: number;
  search?: string;
  status?: SubmissionStatus;
  executionStatus?: MilestoneExecutionStatus;
  mandatory?: boolean;
  late?: boolean;
  sort?: string;
  bucket?: "PENDING" | "REVIEWED" | "ALL";
}

export interface SubmissionVersionDetail {
  id: string;
  versionNumber: number;
  title: string;
  notes?: string | null;
  submissionUrl?: string | null;
  status: SubmissionStatus;
  submittedAt?: string | null;
  submittedBy: string;
  late: boolean;
  penaltyPercent: number;
  artifacts: SubmissionArtifact[];
  checklist: SubmissionChecklistSnapshot[];
}

export interface SubmissionArtifact {
  id?: string | null;
  type: SubmissionArtifactType;
  name: string;
  url: string;
  orderIndex: number;
}

export interface SubmissionChecklistSnapshot {
  id?: string | null;
  sourceChecklistItemId?: string | null;
  content: string;
  mandatory: boolean;
  completed: boolean;
  evidenceNote?: string | null;
  orderIndex: number;
}

export interface SubmissionRubricRating {
  id: string;
  level: RubricRatingLevel;
  percentage: number;
  description: string;
  orderIndex: number;
}

export interface SubmissionRubricCriterion {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  weight: number;
  maxScore: number;
  orderIndex: number;
  ratings: SubmissionRubricRating[];
}

export interface SubmissionReviewEvaluation {
  criterionId: string;
  criterionCode: string;
  criterionName: string;
  ratingId: string;
  ratingLevel: string;
  ratingPercentage: number;
  score: number;
  feedback?: string | null;
  orderIndex: number;
}

export interface SubmissionReviewHistory {
  id: string;
  submissionVersionId: string;
  versionNumber: number;
  decision: ReviewDecision;
  reviewerName: string;
  rawScore: number;
  penaltyPercent: number;
  finalScore: number;
  reviewedAt: string;
  overallFeedback?: string | null;
  evaluations: SubmissionReviewEvaluation[];
}

export interface SubmissionDetail {
  id: string;
  projectId: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneDescription?: string | null;
  mandatory: boolean;
  teamId: string;
  teamName: string;
  studentId: string;
  studentName: string;
  assignedReviewerId: string;
  assignedReviewerName: string;
  status: SubmissionStatus;
  executionStatus: MilestoneExecutionStatus;
  currentVersionNumber: number;
  submissionAttempts: number;
  allowResubmission: boolean;
  maxSubmissionAttempts?: number | null;
  deadline: string;
  latePolicyType: "NO_LATE" | "ALLOW_LATE";
  lateUntil?: string | null;
  latePenaltyPercent?: number | null;
  lockVersion: number;
  currentVersion: SubmissionVersionDetail;
  versions: SubmissionVersionDetail[];
  rubric: { versionId: string; name: string; version: string; totalMaxScore: number; criteria: SubmissionRubricCriterion[] };
  reviews: SubmissionReviewHistory[];
  availableActions: Record<"accept" | "reject" | "requestChanges" | "createNextVersion" | "submit", boolean>;
}

export interface ReviewSubmissionRequest {
  decision: ReviewDecision;
  expectedVersion: number;
  criteria: Array<{ criterionId: string; ratingLevel: RubricRatingLevel; feedback?: string }>;
  checklist: Array<{ checklistItemId: string; completed: boolean }>;
  overallFeedback?: string;
}

export interface SaveSubmissionDraftRequest {
  title: string;
  notes?: string;
  submissionUrl?: string;
  artifacts: Array<{ type: SubmissionArtifactType; name: string; url: string }>;
}
