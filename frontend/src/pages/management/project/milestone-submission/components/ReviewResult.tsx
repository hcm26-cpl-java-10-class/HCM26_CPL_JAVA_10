import { ChevronDown, Clock, Info, MessageSquareText } from "lucide-react";
import type { SubmissionDetail, SubmissionReviewHistory } from "@/types";
import { cn } from "@/lib/utils";
import { latestReview } from "../review-outcome";
import { decisionStyles, formatScore, ratingTones } from "./review-decision";

const date = (value: string) => new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * Read-only outcome of a submission: the latest decision expanded first and earlier decisions as a compact timeline.
 * The page header carries the submission context and the evidence button, so nothing here repeats it.
 */
export function ReviewResult({ submission }: { submission: SubmissionDetail }) {
  const latest = latestReview(submission);
  const earlier = submission.reviews
    .filter(review => review.id !== latest?.id)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  const maxScores = new Map(submission.rubric.criteria.map(criterion => [criterion.id, criterion.maxScore]));
  const total = submission.rubric.totalMaxScore;

  return (
    <div className="grid min-w-0 gap-3">
      {latest ? (
        <ReviewCard review={latest} totalMaxScore={total} maxScores={maxScores} />
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <p><span className="font-medium">{statusTitle(submission)}</span>
            <span className="text-muted-foreground"> · {statusHint(submission)}</span></p>
        </div>
      )}

      {earlier.length > 0 && (
        <section className="grid gap-1.5">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Clock className="size-3.5" /> Earlier reviews ({earlier.length})
          </h2>
          <ol className="divide-y rounded-lg border bg-card">
            {earlier.map(review => {
              const style = decisionStyles[review.decision];
              return (
                <li key={review.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm hover:bg-muted/40">
                      <span className="font-medium">v{review.versionNumber}</span>
                      <span className={cn("rounded-full border px-2 text-xs font-medium", style.pill)}>{style.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatScore(review.finalScore)}/{formatScore(total)} pts
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">{review.reviewerName} · {date(review.reviewedAt)}</span>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t bg-muted/20 p-3">
                      <ScoreLine review={review} className="mb-2" />
                      <ReviewBody review={review} maxScores={maxScores} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

function statusTitle(submission: SubmissionDetail) {
  if (submission.teamId == null) return "Shared master assessment is read-only";
  if (submission.status === "SUBMITTED") return "Awaiting review";
  return "No review recorded yet";
}

function statusHint(submission: SubmissionDetail) {
  if (submission.teamId == null) return "Master milestones are assessed at class level.";
  if (submission.status === "SUBMITTED") return `Assigned reviewer: ${submission.assignedReviewerName || "not assigned"}.`;
  return `Current status: ${submission.status.replaceAll("_", " ").toLowerCase()}.`;
}

/** Raw score and late penalty, the inputs of the final score. */
function ScoreLine({ review, className }: { review: SubmissionReviewHistory; className?: string }) {
  return (
    <p className={cn("text-[11px] text-muted-foreground tabular-nums", className)}>
      Raw {formatScore(review.rawScore)}
      {" · "}
      {review.penaltyPercent > 0
        ? <span className="text-rose-600 dark:text-rose-400">−{formatScore(review.penaltyPercent)}% late</span>
        : "no late penalty"}
    </p>
  );
}

function ReviewCard({ review, totalMaxScore, maxScores }: {
  review: SubmissionReviewHistory; totalMaxScore: number; maxScores: Map<string, number>;
}) {
  const style = decisionStyles[review.decision];
  const Icon = style.icon;
  return (
    <section aria-label="Latest review" className="overflow-hidden rounded-xl border bg-card">
      <header className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2.5", style.banner)}>
        <Icon className={cn("size-5 shrink-0", style.icon_color)} aria-hidden="true" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-semibold">{style.label} · Version {review.versionNumber}</p>
          <p className="text-xs text-muted-foreground">{review.reviewerName} · {date(review.reviewedAt)}</p>
        </div>
        <div className="text-right leading-tight">
          <p className="text-xl font-semibold tabular-nums">
            {formatScore(review.finalScore)}<span className="text-sm font-normal text-muted-foreground">/{formatScore(totalMaxScore)}</span>
          </p>
          <ScoreLine review={review} />
        </div>
      </header>
      <div className="p-3">
        <ReviewBody review={review} maxScores={maxScores} />
      </div>
    </section>
  );
}

function ReviewBody({ review, maxScores }: { review: SubmissionReviewHistory; maxScores: Map<string, number> }) {
  const evaluations = [...review.evaluations].sort((a, b) => a.orderIndex - b.orderIndex);
  return (
    <div className="grid gap-2.5">
      {review.overallFeedback && (
        <div className="rounded-r-md border-l-2 border-sky-300 bg-sky-50/40 px-3 py-1.5 dark:border-sky-800 dark:bg-sky-950/20">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><MessageSquareText className="size-3.5" /> Overall feedback</p>
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed">{review.overallFeedback}</p>
        </div>
      )}
      {evaluations.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {evaluations.map(evaluation => {
            const max = maxScores.get(evaluation.criterionId);
            return (
              <li key={evaluation.criterionId} className="px-3 py-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 flex-1 break-words font-medium">{evaluation.criterionName}</span>
                  <span className={cn("rounded-full border px-2 text-[11px] font-medium", ratingTones[evaluation.ratingLevel] ?? "border-border text-muted-foreground")}>
                    {evaluation.ratingLevel.replaceAll("_", " ")}
                  </span>
                  <span className="min-w-14 shrink-0 text-right text-xs font-medium tabular-nums">
                    {formatScore(evaluation.score)}{max != null ? `/${formatScore(max)}` : ""}
                  </span>
                </div>
                {evaluation.feedback && (
                  <p className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs text-muted-foreground">{evaluation.feedback}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
