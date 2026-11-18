import { peerReviewApi } from "@/api/features/peer-review.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PEER_REVIEW_STATUS_LABEL,
  PEER_REVIEW_TYPE_LABEL,
  type PeerReviewProgress,
} from "@/types/features/peer-review";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Lock, UserPlus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function statusVariant(status: PeerReviewProgress["status"]) {
  if (status === "SUBMITTED") return "default" as const;
  if (status === "SKIPPED") return "secondary" as const;
  return "outline" as const;
}

export default function PeerReviewOverviewPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(examId);

  const overviewQuery = useQuery({
    queryKey: ["peer-review-overview", id],
    queryFn: () => peerReviewApi.getOverview(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const progressQuery = useQuery({
    queryKey: ["peer-review-progress", id],
    queryFn: () => peerReviewApi.getProgress(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const assignMutation = useMutation({
    mutationFn: () => peerReviewApi.assign(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["peer-review-overview", id] });
      void queryClient.invalidateQueries({ queryKey: ["peer-review-progress", id] });
      toast.success(
        `Assigned ${result.assignedCount} review(s): ${result.submittedCount} submitted, ${result.pendingCount} pending`
      );
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        err?.response?.data?.message || err?.message || "Could not assign reviewers"
      );
    },
  });

  const overview = overviewQuery.data;
  const rows = progressQuery.data ?? [];
  const status = isAxiosError(overviewQuery.error)
    ? overviewQuery.error.response?.status
    : undefined;

  return (
    <MainLayout pathName={{ exams: "Assessments", "peer-reviews": "Peer review" }}>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
        <Button variant="outline" onClick={() => navigate("/exams")}>
          <ArrowLeft className="size-4" />
          Back to assessments
        </Button>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Peer &amp; self review</h1>
          <p className="text-sm text-muted-foreground">
            Assign reviewers among the students who submitted this exam. Reviews are stored
            separately and never change the official score.
          </p>
        </header>

        {overviewQuery.isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}

        {overviewQuery.isError && (
          <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center dark:bg-transparent">
            <CardContent className="space-y-2">
              <Lock className="mx-auto size-8 text-slate-400" />
              <CardTitle className="text-base">
                {status === 403
                  ? "You do not have access to peer review"
                  : "Could not load the review overview"}
              </CardTitle>
            </CardContent>
          </Card>
        )}

        {overview && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Assignment status</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Self review {overview.selfReviewEnabled ? "on" : "off"} · Peer review{" "}
                  {overview.peerReviewEnabled ? `on (${overview.peerReviewCount} per submission)` : "off"}
                </p>
              </div>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending || overview.eligibleAttemptCount === 0}
              >
                <UserPlus className="size-4" />
                {assignMutation.isPending ? "Đang phân công..." : "Assign reviewers"}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <Stat label="Submitted attempts" value={overview.eligibleAttemptCount} />
              <Stat label="Assignments" value={overview.assignedCount} />
              <Stat label="Reviews submitted" value={overview.submittedCount} />
              <Stat
                label="Still pending"
                value={overview.pendingCount}
                highlight={overview.pendingCount > 0}
              />
            </CardContent>
            {overview.underAssignedAttemptCount > 0 && (
              <CardContent>
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40">
                  {overview.underAssignedAttemptCount} submission(s) still have fewer reviewers than
                  required. There may not be enough students who submitted this exam.
                </p>
              </CardContent>
            )}
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Assignments</h2>
          {progressQuery.isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
          {progressQuery.isError && (
            <p className="text-sm text-destructive">Could not load the assignment list.</p>
          )}
          {!progressQuery.isLoading && !progressQuery.isError && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No reviewer has been assigned yet.
            </p>
          )}

          {rows.length > 0 && (
            <Card>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Author</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.assignmentId}>
                        <TableCell>
                          {row.authorName || "-"} (#{row.attemptNumber})
                        </TableCell>
                        <TableCell>{PEER_REVIEW_TYPE_LABEL[row.reviewType]}</TableCell>
                        <TableCell>{row.reviewerName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.status)}>
                            {PEER_REVIEW_STATUS_LABEL[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(row.assignedAt)}</TableCell>
                        <TableCell>{formatDate(row.submittedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </MainLayout>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight ? "text-xl font-semibold text-amber-600" : "text-xl font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}
