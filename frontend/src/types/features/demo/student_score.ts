import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface StudentScoreColumnDTO {
  key?: string;
  name?: string;
  label?: string;
  value?: number | string | null;
}

export interface StudentScoreDTO extends BaseDTO {
  studentCode?: string;
  studentName?: string;
  studentEmail?: string;
  className?: string;
  scores?: Record<string, number | string | null> | StudentScoreColumnDTO[];
  scoreColumns?: StudentScoreColumnDTO[];
  overallScore?: number;
  status?: "DRAFT" | "REVIEWED" | "RELEASED" | "ADJUSTED";
  releasedAt?: string;
  approvedBy?: string;
  adjustmentLog?: string;
}

export interface StudentScoreFilter extends BaseFilter {
  studentCode?: string;
  studentName?: string;
  className?: string;
}
