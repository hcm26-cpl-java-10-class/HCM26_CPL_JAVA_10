export type LatePolicyType = "NO_LATE" | "ALLOW_LATE";
export type MilestoneStatus = "PLANNED" | "OPEN" | "CLOSED" | "CANCELLED";
export type MilestoneProjectStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

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

export interface MilestoneResubmissionPolicyRequest {
  allowed: boolean;
  maxAttempts?: number;
}

export interface CreateMilestoneRequest {
  teamId?: number;
  title: string;
  description?: string;
  deadline: string;
  mandatory: boolean;
  checklist: MilestoneChecklistItemRequest[];
  rubricSnapshotId: string;
  latePolicy: MilestoneLatePolicyRequest;
  resubmissionPolicy: MilestoneResubmissionPolicyRequest;
}

export interface MilestoneProjectOption {
  id: string;
  name: string;
  status: MilestoneProjectStatus;
}

export interface MilestoneRubricOption {
  id: string;
  name: string;
  version: string;
  criteria: MilestoneRubricCriterion[];
}

export interface MilestoneReviewerOption {
  id: string;
  displayName: string;
}

export interface MilestoneCreateOptions {
  project?: MilestoneProjectOption | null;
  rubrics: MilestoneRubricOption[];
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
  status: MilestoneStatus;
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

export interface MilestoneRubricCriterion {
  code: string;
  name: string;
  weight: number;
  maxScore: number;
  ratings: MilestoneRubricRating[];
}

export interface MilestoneRubricRating {
  level: "EXCELLENT" | "GOOD" | "FAIR" | "NOT_MET";
  percentage: number;
  description: string;
  orderIndex: number;
}

export interface MilestoneRubricDetail {
  snapshotId: string;
  name: string;
  version: string;
  criteria: MilestoneRubricCriterion[];
}

export interface MilestoneReviewerDetail {
  id: string;
  displayName: string;
}

export interface MilestoneLatePolicyDetail {
  type: LatePolicyType;
  lateUntil?: string | null;
  penaltyPercent?: number | null;
}

export interface MilestoneResubmissionPolicyDetail {
  allowed: boolean;
  maxAttempts?: number | null;
}

export interface MilestoneDetailResponse {
  id: string;
  project: MilestoneProjectOption;
  title: string;
  description?: string | null;
  deadline: string;
  tenantTimeZone: string;
  mandatory: boolean;
  status: MilestoneStatus;
  checklist: MilestoneChecklistItemResponse[];
  rubric: MilestoneRubricDetail;
  reviewer: MilestoneReviewerDetail;
  latePolicy: MilestoneLatePolicyDetail;
  resubmissionPolicy: MilestoneResubmissionPolicyDetail;
  version: number;
  createdAt: string;
  createdBy: string;
  teamId?: number;
}

export interface ArtifactDraft {
  milestoneId: string;
  status: "DRAFT";
  repositoryUrl?: string | null;
  deploymentUrl?: string | null;
  releaseNotes?: string | null;
  checklist: Record<string, boolean>;
  attachments: ArtifactAttachment[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ArtifactAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  scanStatus: "CLEAN";
  uploadedBy: string;
  uploadedAt: string;
  draftVersion: number;
}

export interface ArtifactDraftRequest {
  repositoryUrl?: string;
  deploymentUrl?: string;
  releaseNotes?: string;
  checklist: Record<string, boolean>;
  expectedVersion?: number;
}

export interface ArtifactSubmissionRequest {
  repositoryUrl?: string;
  deploymentUrl?: string;
  releaseNotes?: string;
  checklist: Record<string, boolean>;
  attachmentIds: string[];
}

export interface ArtifactSubmissionAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ArtifactSubmission {
  id: string;
  milestoneId: string;
  version: number;
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";
  repositoryUrl?: string | null;
  deploymentUrl?: string | null;
  releaseNotes?: string | null;
  checklist: Record<string, boolean>;
  attachments: ArtifactSubmissionAttachment[];
  submittedAt: string;
  submittedLate: boolean;
  latePenaltyPercent?: number | null;
}

export interface ArtifactSubmissionWorkspace {
  milestone: MilestoneDetailResponse;
  draft: ArtifactDraft | null;
  uploadPolicy: { enabled: boolean; maxBytes: number; allowedMimeTypes: string[] };
  latestSubmission: ArtifactSubmission | null;
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
  returnTo?: string;
}

export interface MilestoneListItem {
  id: string;
  teamId?: number;
  title: string;
  description?: string | null;
  deadline: string;
  status: MilestoneStatus;
  mandatory: boolean;
  rubricSnapshotId: string;
  reviewerId: string;
  latePolicyType: LatePolicyType;
  lateUntil?: string | null;
  latePenaltyPercent?: number | null;
  version: number;
  createdAt: string;
}

export interface MilestonePageResponse {
  project?: MilestoneProjectOption | null;
  content: MilestoneListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface MilestoneListParams {
  page: number;
  size: number;
  /** Optional team scope used by the workspace integration. */
  teamId?: number;
  sort?: string | string[];
  search?: string;
  status?: MilestoneStatus[];
  mandatory?: boolean;
  latePolicyType?: LatePolicyType[];
  deadlineFrom?: string;
  deadlineTo?: string;
}

/**
 * Milestone reference used by the temporary `backlog_temp` backend module.
 * Kept as a compatibility shape while backlog is migrated to the UUID-based
 * milestone module above.
 */
export type BacklogMilestoneStatus =
  | "PLANNED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export interface MilestoneOption {
  id: number;
  projectId: number;
  name: string;
  /** Name prefixed with the project, used as the selector label. */
  label: string;
  status: BacklogMilestoneStatus;
  dueDate?: string | null;
}
