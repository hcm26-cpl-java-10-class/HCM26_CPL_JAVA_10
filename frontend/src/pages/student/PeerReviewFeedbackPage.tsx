import { peerReviewApi } from "@/api/features/peer-review.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PeerReviewFeedback } from "@/types/features/peer-review";
import { formatScore } from "@/utils/examScore";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Lock, MessageSquareText } from "lucide-react";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function FeedbackCard({ feedback }: { feedback: PeerReviewFeedback }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {feedback.examTitle || `Exam #${feedback.examId}`}
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Attempt #{feedback.attemptNumber} · Reviewer: {feedback.reviewerLabel} · Submitted{" "}
            {formatDate(feedback.submittedAt)}
          </p>
        </div>
        {feedback.selfReview ? (
          <Badge variant="secondary">Self review</Badge>
        ) : feedback.anonymous ? (
          <Badge variant="outline">Anonymous</Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {feedback.overallScore != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Overall review score</span>
            <span className="font-medium">
              {formatScore(feedback.overallScore)}
              {feedback.maxOverallScore != null ? ` / ${formatScore(feedback.maxOverallScore)}` : ""}
            </span>
          </div>
        )}

        {feedback.overallComment && (
          <div className="rounded-md border bg-muted/40 p-2">
            <p className="text-xs font-medium text-muted-foreground">Overall comment</p>
            <p className="mt-1 whitespace-pre-wrap">{feedback.overallComment}</p>
          </div>
        )}

        {feedback.items.length === 0 && !feedback.overallComment && (
          <p className="text-muted-foreground">No comment was left for this review.</p>
        )}

        {feedback.items.map((item, index) => (
          <div key={`${item.questionId}-${item.criterionName}-${index}`} className="rounded-md border p-3">
            {item.questionContent && (
              <p className="text-xs font-medium text-muted-foreground">{item.questionContent}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{item.criterionName}</span>
              <span className="text-sm">
                {formatScore(item.awardedPoints)} / {formatScore(item.maxPoints)}
              </span>
            </div>
            {item.comment && (
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.comment}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PeerReviewFeedbackPage() {
  const query = useQuery({
    queryKey: ["peer-review-feedback"],
    queryFn: peerReviewApi.getMyFeedback,
    retry: false,
  });

  const feedbacks = query.data ?? [];
  const status = isAxiosError(query.error) ? query.error.response?.status : undefined;

  return (
    <MainLayout pathName={{ feedback: "Feedback" }}>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Feedback</h1>
          <p className="text-sm text-muted-foreground">
            Self review and peer review feedback you received for your submissions. Feedback is
            available once your teacher publishes the results.
          </p>
        </header>

        {query.isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}

        {query.isError && (
          <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center dark:bg-transparent">
            <CardContent className="space-y-2">
              <Lock className="mx-auto size-8 text-slate-400" />
              <CardTitle className="text-base">
                {status === 403
                  ? "Feedback is not available yet"
                  : "Could not load feedback"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {status === 403
                  ? "Your teacher has not published the results for these assessments yet."
                  : "Please try again later."}
              </p>
            </CardContent>
          </Card>
        )}

        {!query.isLoading && !query.isError && feedbacks.length === 0 && (
          <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center dark:bg-transparent">
            <CardContent className="space-y-2">
              <MessageSquareText className="mx-auto size-8 text-slate-400" />
              <CardTitle className="text-base">No feedback yet</CardTitle>
              <p className="text-sm text-muted-foreground">
                You will see self review and peer review feedback here once it is available.
              </p>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          {feedbacks.map((feedback) => (
            <FeedbackCard key={feedback.submissionId} feedback={feedback} />
          ))}
        </section>
      </div>
    </MainLayout>
  );
}
