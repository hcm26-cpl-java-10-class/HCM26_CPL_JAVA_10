export type LatePolicyType = "NO_LATE" | "ALLOW_LATE";

export interface MilestoneChecklistItemRequest {
  content: string;
  mandatory: boolean;
  orderIndex: number;
}

export interface MilestoneLatePolicyRequest {
  type: LatePolicyType;
  lateUntil?: string;
  penaltyPercent?: number;
}

export interface CreateMilestoneRequest {
  title: string;
  description?: string;
  deadline: string;
  mandatory: boolean;
  checklist: MilestoneChecklistItemRequest[];
  rubricSnapshotId: string;
  reviewerId: string;
  latePolicy: MilestoneLatePolicyRequest;
}

export interface MilestoneProjectOption {
  id: string;
  name: string;
  status: string;
}

export interface MilestoneRubricOption {
  id: string;
  name: string;
  version: string;
}

export interface MilestoneReviewerOption {
  id: string;
  displayName: string;
}

export interface MilestoneCreateOptions {
  project: MilestoneProjectOption;
  rubrics: MilestoneRubricOption[];
  reviewers: MilestoneReviewerOption[];
}

export interface MilestoneChecklistItemResponse {
  id: string;
  content: string;
  mandatory: boolean;
  completed: boolean;
  orderIndex: number;
}

export interface MilestoneResponse {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  deadline: string;
  mandatory: boolean;
  status: string;
  rubricSnapshotId: string;
  reviewerId: string;
  latePolicyType: LatePolicyType;
  lateUntil?: string | null;
  latePenaltyPercent?: number | null;
  version: number;
  createdAt: string;
  createdBy: string;
  checklist: MilestoneChecklistItemResponse[];
}

export interface MilestoneApiError {
  status?: number;
  code?: string;
  message?: string;
  errors?: Record<string, string[]>;
  correlationId?: string;
  timestamp?: string;
}

export interface MilestoneDetailRouteState {
  projectName?: string;
  rubricName?: string;
  rubricVersion?: string;
  reviewerName?: string;
}
