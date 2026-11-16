import { peerReviewApi } from "@/api/features/peer-review.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PEER_REVIEW_STATUS_LABEL,
  PEER_REVIEW_TYPE_LABEL,
  type PeerReviewAssignment,
} from "@/types/features/peer-review";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowRight, ClipboardCheck, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function statusVariant(status: PeerReviewAssignment["status"]) {
  if (status === "SUBMITTED") return "default" as const;
  if (status === "SKIPPED") return "secondary" as const;
  return "outline" as const;
}

export default function PeerReviewListPage() {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["my-peer-review-assignments"],
    queryFn: peerReviewApi.getMyAssignments,
  });

  const assignments = query.data ?? [];
  const pending = assignments.filter((a) => a.status === "ASSIGNED");
  const errorStatus = isAxiosError(query.error) ? query.error.response?.status : undefined;

  return (
    <MainLayout pathName={{ "peer-reviews": "Peer review" }}>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Peer &amp; self review</h1>
          <p className="text-sm text-muted-foreground">
            Review other students&apos; essay answers (and your own) following the question rubric.
            Reviews never change the official score.
          </p>
        </header>

        {query.isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}

        {query.isError && (
          <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center dark:bg-transparent">
            <CardContent className="space-y-2">
              <Lock className="mx-auto size-8 text-slate-400" />
              <CardTitle className="text-base">
                {errorStatus === 403
                  ? "You do not have access to peer review"
                  : "Could not load review assignments"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {errorStatus === 403
                  ? "Peer review is not enabled for your account."
                  : "Please try again later."}
              </p>
            </CardContent>
          </Card>
        )}

        {!query.isLoading && !query.isError && assignments.length === 0 && (
          <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center dark:bg-transparent">
            <CardContent className="space-y-2">
              <ClipboardCheck className="mx-auto size-8 text-slate-400" />
              <CardTitle className="text-base">No review assignments yet</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your teacher has not assigned any peer or self review for you so far.
              </p>
            </CardContent>
          </Card>
        )}

        {pending.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {pending.length} review{pending.length === 1 ? "" : "s"} waiting for you.
          </p>
        )}

        <section className="space-y-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {assignment.examTitle || `Exam #${assignment.examId}`}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {PEER_REVIEW_TYPE_LABEL[assignment.reviewType]} · Attempt #
                    {assignment.attemptNumber} · Author: {assignment.authorLabel} · Assigned{" "}
                    {formatDate(assignment.assignedAt)}
                  </p>
                </div>
                <Badge variant={statusVariant(assignment.status)}>
                  {PEER_REVIEW_STATUS_LABEL[assignment.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {assignment.reviewableQuestionCount} essay question
                  {assignment.reviewableQuestionCount === 1 ? "" : "s"} to review.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/student/reviews/${assignment.id}`)}
                >
                  {assignment.status === "SUBMITTED" ? "View my review" : "Start review"}
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </MainLayout>
  );
}
