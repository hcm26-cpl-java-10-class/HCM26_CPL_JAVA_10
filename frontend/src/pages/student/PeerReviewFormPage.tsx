import { peerReviewApi } from "@/api/features/peer-review.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type PeerReviewSubmitItem,
  type PeerReviewTarget,
} from "@/types/features/peer-review";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Lock, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const criterionKey = (questionId: number, criterionName: string) =>
  `${questionId}|${criterionName}`;

export default function PeerReviewFormPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(assignmentId);

  // scores: "<questionId>|<criterionName>" -> awarded points (as typed string)
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [overallScore, setOverallScore] = useState("");
  const [overallComment, setOverallComment] = useState("");

  const query = useQuery({
    queryKey: ["peer-review-target", id],
    queryFn: () => peerReviewApi.getTarget(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const target: PeerReviewTarget | undefined = query.data;

  const maxTotal = useMemo(
    () =>
      (target?.questions ?? []).reduce((sum, q) => sum + (q.maxPoints ?? 0), 0),
    [target]
  );

  const awardedTotal = useMemo(
    () =>
      (target?.questions ?? []).reduce((sum, q) => {
        const questionSum = (q.criteria ?? []).reduce((inner, criterion) => {
          const raw = scores[criterionKey(q.questionId, criterion.criterionName)];
          const value = raw === undefined || raw === "" ? 0 : Number(raw);
          return inner + (Number.isFinite(value) ? value : 0);
        }, 0);
        return sum + questionSum;
      }, 0),
    [target, scores]
  );

  const submitMutation = useMutation({
    mutationFn: () => {
      const items: PeerReviewSubmitItem[] = [];
      for (const question of target?.questions ?? []) {
        for (const criterion of question.criteria ?? []) {
          const key = criterionKey(question.questionId, criterion.criterionName);
          const raw = scores[key];
          const awarded = raw === undefined || raw === "" ? 0 : Number(raw);
          items.push({
            questionId: question.questionId,
            criterionName: criterion.criterionName,
            awardedPoints: Number.isFinite(awarded) ? awarded : 0,
            comment: comments[key]?.trim() ? comments[key].trim() : null,
          });
        }
      }
      return peerReviewApi.submit(id, {
        overallScore: overallScore.trim() === "" ? null : Number(overallScore),
        overallComment: overallComment.trim() ? overallComment.trim() : null,
        items,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-peer-review-assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["peer-review-target", id] });
      void queryClient.invalidateQueries({ queryKey: ["peer-review-feedback"] });
      toast.success("Review submitted");
      navigate("/student/reviews");
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
        message?: string;
      };
      const fieldError = err?.response?.data?.errors
        ? (Object.values(err.response.data.errors).flat()[0] as string | undefined)
        : undefined;
      toast.error(
        err?.response?.status === 409
          ? "This review has already been submitted."
          : fieldError ||
            err?.response?.data?.message ||
            err?.message ||
            "Could not submit the review"
      );
    },
  });

  const status = isAxiosError(query.error) ? query.error.response?.status : undefined;
  const alreadySubmitted = target?.status === "SUBMITTED";

  return (
    <MainLayout pathName={{ "peer-reviews": "Peer review" }}>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <Button variant="outline" onClick={() => navigate("/student/reviews")}>
          <ArrowLeft className="size-4" />
          Back to reviews
        </Button>

        {query.isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}

        {query.isError && (
          <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center dark:bg-transparent">
            <CardContent className="space-y-2">
              <Lock className="mx-auto size-8 text-slate-400" />
              <CardTitle className="text-base">
                {status === 403
                  ? "You are not allowed to open this review"
                  : status === 404
                    ? "Review assignment not found"
                    : "Could not load the submission"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {status === 403
                  ? "Only the assigned reviewer can open this submission."
                  : "Please try again later."}
              </p>
            </CardContent>
          </Card>
        )}

        {target && (
          <>
            <header className="space-y-1">
              <h1 className="text-2xl font-bold">{target.examTitle}</h1>
              <p className="text-sm text-muted-foreground">
                Attempt #{target.attemptNumber} · Author: {target.authorLabel}
                {target.anonymous ? " (anonymous)" : ""}
              </p>
            </header>

            {target.questions.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  This submission has no essay answer to review.
                </CardContent>
              </Card>
            )}

            {target.questions.map((question) => (
              <Card key={question.questionId}>
                <CardHeader>
                  <CardTitle className="text-base">{question.content}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Question points: {question.points} · Review points: {question.maxPoints}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Answer</p>
                    <p className="mt-1 whitespace-pre-wrap">{question.answerText}</p>
                  </div>

                  {question.referenceAnswer && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/40">
                      <p className="text-xs font-medium text-muted-foreground">Reference answer</p>
                      <p className="mt-1 whitespace-pre-wrap">{question.referenceAnswer}</p>
                    </div>
                  )}
                  {question.rubric && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/40">
                      <p className="text-xs font-medium text-muted-foreground">Rubric</p>
                      <p className="mt-1 whitespace-pre-wrap">{question.rubric}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {question.criteria.map((criterion) => {
                      const key = criterionKey(question.questionId, criterion.criterionName);
                      return (
                        <div key={key} className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <p className="text-sm font-medium">{criterion.criterionName}</p>
                            {criterion.description && (
                              <p className="text-xs text-muted-foreground">
                                {criterion.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Weight {criterion.weightPercentage}% · Max {criterion.maxPoints}
                            </p>
                          </div>
                          <label className="grid gap-1.5 text-sm font-medium">
                            Points
                            <Input
                              type="number"
                              min={0}
                              max={criterion.maxPoints}
                              step="0.25"
                              disabled={alreadySubmitted}
                              value={scores[key] ?? ""}
                              onChange={(event) =>
                                setScores((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium sm:col-span-3">
                            Comment (optional)
                            <Textarea
                              rows={2}
                              disabled={alreadySubmitted}
                              value={comments[key] ?? ""}
                              onChange={(event) =>
                                setComments((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {target.questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overall feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="grid gap-1.5 text-sm font-medium">
                      Overall score (optional, max {maxTotal})
                      <Input
                        type="number"
                        min={0}
                        max={maxTotal}
                        step="0.25"
                        className="w-40"
                        value={overallScore}
                        onChange={(event) => setOverallScore(event.target.value)}
                      />
                    </label>
                    <Badge variant="secondary">
                      Awarded: {awardedTotal} / {maxTotal}
                    </Badge>
                  </div>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Overall comment
                    <Textarea
                      rows={4}
                      value={overallComment}
                      onChange={(event) => setOverallComment(event.target.value)}
                    />
                  </label>
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || alreadySubmitted}
                  >
                    <Send className="size-4" />
                    {submitMutation.isPending ? "Đang gửi..." : "Submit review"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    A review can only be submitted once. The result is stored separately and never
                    changes the official score.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
