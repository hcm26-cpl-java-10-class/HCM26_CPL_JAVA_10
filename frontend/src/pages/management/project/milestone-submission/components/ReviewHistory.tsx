import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubmissionReviewHistory } from "@/types";
import { ChevronDown, History } from "lucide-react";

const date = (value: string) => new Date(value).toLocaleString("en-GB");

export function ReviewHistory({ reviews }: { reviews: SubmissionReviewHistory[] }) {
  if (!reviews.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5" /> Review history</CardTitle><CardDescription>Previous decisions are grouped by immutable submission version.</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        {reviews.map((review, index) => (
          <details key={review.id} className="group rounded-xl border" open={index === 0}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Version {review.versionNumber}</span><Badge variant={review.decision === "REJECT" ? "destructive" : review.decision === "ACCEPT" ? "default" : "secondary"}>{review.decision.replace("_", " ")}</Badge><span className="text-sm text-muted-foreground">by {review.reviewerName}</span></div>
              <div className="flex items-center gap-3 text-sm"><span>{review.finalScore} pts</span><span className="text-muted-foreground">{date(review.reviewedAt)}</span><ChevronDown className="size-4 transition group-open:rotate-180" /></div>
            </summary>
            <div className="border-t p-4">
              <div className="mb-4 grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-3"><div><span className="text-muted-foreground">Raw score</span><p className="font-semibold">{review.rawScore}</p></div><div><span className="text-muted-foreground">Late penalty</span><p className="font-semibold">{review.penaltyPercent}%</p></div><div><span className="text-muted-foreground">Final score</span><p className="font-semibold">{review.finalScore}</p></div></div>
              {review.overallFeedback ? <div className="mb-4"><p className="text-sm font-medium">Overall feedback</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{review.overallFeedback}</p></div> : null}
              <div className="grid gap-2">{review.evaluations.map((evaluation) => <div key={evaluation.criterionId} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{evaluation.criterionName}</span><span>{evaluation.ratingLevel.replace("_", " ")} · {evaluation.score} pts</span></div>{evaluation.feedback ? <p className="mt-2 text-muted-foreground">{evaluation.feedback}</p> : null}</div>)}</div>
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
