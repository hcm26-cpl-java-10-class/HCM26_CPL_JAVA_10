import type { ProjectTemplateVersionDTO } from "@/types/features/project-template-version";
import type { JsonValue } from "@/types/common/json";

export type AIReviewFindingCategory =
  | "PROJECT_TEMPLATE"
  | "MODULE"
  | "MILESTONE"
  | "BACKLOG"
  | "RUBRIC"
  | "DOCUMENT";

export type AIReviewFindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AIReviewFindingStatus = "OPEN" | "ACCEPTED" | "DISMISSED" | "RESOLVED";
export type AIReviewSuggestionCapability = "AUTO_EDITABLE" | "MANUAL_REQUIRED";
export type AIReviewSuggestionStatus = "PENDING" | "APPROVED" | "REJECTED" | "APPLIED" | "INVALID";

export interface AIReviewFinding {
  findingId: number;
  category: AIReviewFindingCategory;
  severity: AIReviewFindingSeverity;
  status: AIReviewFindingStatus;
  title: string;
  description: string;
  recommendation: string | null;
  suggestionCapability: AIReviewSuggestionCapability;
  suggestionCapabilityReason: string;
  targetType: string | null;
  targetId: string | null;
  targetSnapshotId?: number | null;
  targetCode?: string | null;
  targetName?: string | null;
}

export interface AIReviewReportListItem {
  reportId: number;
  snapshotId: number;
  status: "COMPLETED" | "STALE" | string;
  summary: string | null;
  createdAt: string;
}

export interface AIReviewReportDetail extends AIReviewReportListItem {
  templateId: number;
  findings: AIReviewFinding[];
}

export interface AIReviewSuggestion {
  suggestionId: number;
  findingId: number;
  templateId: number;
  sourceSnapshotId: number;
  targetType: string;
  targetId: string;
  rationale: string;
  changes: JsonValue;
  status: AIReviewSuggestionStatus;
  validationErrors: string[];
  rejectionReason: string | null;
  appliedSnapshotId: number | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIReviewSuggestionApplyResponse {
  suggestion: AIReviewSuggestion;
  snapshot: ProjectTemplateVersionDTO | null;
}
