export type RubricVersionStatus = "DRAFT" | "PUBLISHED";
export type RubricRatingLevel = "EXCELLENT" | "GOOD" | "FAIR" | "NOT_MET";

export interface RubricRatingInput {
  level: RubricRatingLevel;
  description: string;
}

export interface RubricCriterionInput {
  code: string;
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  orderIndex: number;
  ratings: RubricRatingInput[];
}

export interface SaveRubricDraftRequest {
  name: string;
  description?: string;
  criteria: RubricCriterionInput[];
}

export interface RubricCriterion extends RubricCriterionInput {
  id: string;
  ratings: RubricRating[];
}

export interface RubricRating extends RubricRatingInput {
  id: string;
  percentage: number;
  orderIndex: number;
}

export interface RubricVersion {
  id: string;
  versionNumber: number;
  name: string;
  description?: string | null;
  status: RubricVersionStatus;
  totalMaxScore: number;
  criteria: RubricCriterion[];
  milestoneUsageCount: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lockVersion: number;
}

export interface RubricDetail {
  id: string;
  name: string;
  description?: string | null;
  versions: RubricVersion[];
  createdAt: string;
  updatedAt: string;
  lockVersion: number;
}

export interface RubricListItem {
  id: string;
  rowId: string;
  name: string;
  description?: string | null;
  versionCount: number;
  hasDraft: boolean;
  latestVersionId: string;
  latestVersionNumber: number;
  latestStatus: RubricVersionStatus;
  totalMaxScore: number;
  criteriaCount: number;
  milestoneUsageCount: number;
  updatedAt: string;
}

export interface RubricPage {
  content: RubricListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RubricListParams {
  page: number;
  size: number;
  sort?: string | string[];
  search?: string;
  status?: RubricVersionStatus;
}
