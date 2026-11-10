import { useLocation } from "react-router-dom";
import type { ReviewDecision, SubmissionDetail } from "@/types";

/** Summary of a review that was just saved, carried in router state back to the page the reviewer came from. */
export interface ReviewOutcome {
  reviewSubmissionId: string;
  decision: ReviewDecision;
  finalScore: number | null;
  totalMaxScore: number | null;
  versionNumber: number;
  milestoneTitle: string;
  teamName: string;
}

export function latestReview(submission: SubmissionDetail) {
  return [...submission.reviews].sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0] ?? null;
}

export function outcomeOf(submission: SubmissionDetail, decision: ReviewDecision): ReviewOutcome {
  const review = latestReview(submission);
  return {
    reviewSubmissionId: submission.id,
    decision: review?.decision ?? decision,
    finalScore: review?.finalScore ?? null,
    totalMaxScore: submission.rubric?.totalMaxScore ?? null,
    versionNumber: review?.versionNumber ?? submission.currentVersionNumber,
    milestoneTitle: submission.milestoneTitle,
    teamName: submission.teamName,
  };
}

export function useReviewOutcome(): ReviewOutcome | null {
  const state = useLocation().state as { reviewOutcome?: ReviewOutcome } | null;
  return state?.reviewOutcome ?? null;
}

/** Review page (`/review`) is for grading only; the plain detail URL shows the result and history. */
export const reviewPath = (submissionId: string) => `/milestone-submissions/${submissionId}/review`;
export const resultPath = (submissionId: string) => `/milestone-submissions/${submissionId}`;
