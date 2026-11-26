import type { SubmissionDetail } from "@/types";

type ResubmissionInfo = Pick<
  SubmissionDetail,
  "resubmissionBlockedReason" | "resubmissionBlockedMessage" | "submissionAttempts" | "maxSubmissionAttempts"
>;

/** Explains why changes can't be requested / a new version can't be created. */
export function describeResubmissionBlock(item: ResubmissionInfo): string {
  switch (item.resubmissionBlockedReason) {
    case "ATTEMPT_LIMIT_REACHED":
      return `The submission attempt limit has been reached (${item.submissionAttempts}/${item.maxSubmissionAttempts ?? item.submissionAttempts} attempts used).`;
    case "RESUBMISSION_DISABLED":
      return "Resubmission is disabled for this milestone.";
    case "MILESTONE_NOT_OPEN":
      return "The milestone is not open (unpublished, closed or cancelled).";
    case "MILESTONE_INACTIVE":
      return "The milestone has been deactivated.";
    case "MILESTONE_NOT_UNDER_REVIEW":
      return "The milestone is not waiting for review.";
    case "PROJECT_NOT_ACTIVE":
      return "The project is not active.";
    default:
      return item.resubmissionBlockedMessage ?? "Resubmission is not available for this milestone.";
  }
}
