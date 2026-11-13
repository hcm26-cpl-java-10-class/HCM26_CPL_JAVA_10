import type { RubricRatingLevel } from "@/types";

/** Minimal criterion shape shared by rubric versions and milestone rubric snapshots. */
export interface RubricCriterionView {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  weight: number;
  maxScore: number;
  ratings?: Array<{
    id?: string;
    level: RubricRatingLevel;
    percentage: number;
    description?: string | null;
    orderIndex: number;
  }>;
}

export const criterionKey = (criterion: RubricCriterionView) => criterion.id || criterion.code;
