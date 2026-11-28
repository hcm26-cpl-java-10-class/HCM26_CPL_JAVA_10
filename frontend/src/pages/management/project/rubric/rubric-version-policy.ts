import type { RubricVersionStatus } from "@/types";

export const canEditRubricVersion = (status: RubricVersionStatus) => status === "DRAFT";
export const canDeleteRubricVersion = (status: RubricVersionStatus) => status === "DRAFT";
export const canPublishRubricVersion = (status: RubricVersionStatus) => status === "DRAFT";
export const canUseRubricVersionInMilestone = (status: RubricVersionStatus) => status === "PUBLISHED";
export const canCreateDraftFromVersion = (status: RubricVersionStatus) => status === "PUBLISHED";
