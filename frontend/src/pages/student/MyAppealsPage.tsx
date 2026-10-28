import { scoreAppealApi } from "@/api/features/score-appeal.api";
import { examApi } from "@/api/features/exam.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SCORE_APPEAL_STATUS_LABEL, type ScoreAppealDTO } from "@/types/features/score-appeal";
import { formatScore } from "@/utils/examScore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

function statusVariant(status: ScoreAppealDTO["status"]) {
  if (status === "APPROVED") return "default" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "secondary" as const;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function MyAppealsPage() {
  const queryClient = useQueryClient();
  const [attemptIdInput, setAttemptIdInput] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("attemptId") ?? "";
  });
  const [reason, setReason] = useState("");
  const [requestedScore, setRequestedScore] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<ScoreAppealDTO | null>(null);

  const myAppealsQuery = useQuery({
    queryKey: ["my-appeals"],
    queryFn: scoreAppealApi.getMyAppeals,
  });

  const myScoresQuery = useQuery({
    queryKey: ["my-exam-scores-for-appeal"],
    queryFn: examApi.getMyPublishedExamScores,
  });

  const appealedAttemptIds = new Set(
    (myAppealsQuery.data ?? []).map((a) => a.attemptId).filter((v): v is number => v != null)
  );

  const appealedExamIds = new Set(
    (myAppealsQuery.data ?? []).map((a) => a.examId).filter((v): v is number => v != null)
  );

  const appeals = myAppealsQuery.data ?? [];
  const scores = myScoresQuery.data ?? [];

  // Attempt duoc chon co the lay tu query param ?attemptId= (nut "Appeal this score")
  const selectedScore = scores.find((s) => String(s.attemptId) === attemptIdInput);
  const selectedScoreNotPublished =
    attemptIdInput !== "" && selectedScore != null && !selectedScore.resultPublished;

  const createMutation = useMutation({
    mutationFn: () => {
      const attemptId = Number(attemptIdInput);
      if (!Number.isFinite(attemptId) || attemptId <= 0)
        throw new Error("Attempt ID is invalid.");
      if (!reason.trim()) throw new Error("Appeal reason is required.");
      if (selectedScore && !selectedScore.resultPublished)
        throw new Error(
          "Results for this exam have not been published yet. Appeal is available after your teacher publishes the results.",
        );
      return scoreAppealApi.create(attemptId, {
        reason: reason.trim(),
        requestedScore: requestedScore === "" ? undefined : Number(requestedScore),
      });
    },
    onSuccess: () => {
      setAttemptIdInput("");
      setReason("");
      setRequestedScore("");
      void queryClient.invalidateQueries({ queryKey: ["my-appeals"] });
      void queryClient.invalidateQueries({ queryKey: ["my-appeals-for-scores"] });
      void queryClient.invalidateQueries({ queryKey: ["my-exam-scores-for-appeal"] });
      void queryClient.invalidateQueries({ queryKey: ["my-exam-scores"] });
      toast.success("Appeal submitted successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to submit appeal",
      );
    },
  });

  return (
    <MainLayout pathName={{ "my-appeals": "My Appeals" }}>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">My Appeals</h1>
          <p className="text-sm text-muted-foreground">
            Submit a score appeal for a graded attempt and track its review status.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit new appeal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Attempt ID
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 12"
                  value={attemptIdInput}
                  onChange={(e) => setAttemptIdInput(e.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Requested score (optional)
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 8.5"
                  value={requestedScore}
                  onChange={(e) => setRequestedScore(e.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={createMutation.isPending || selectedScoreNotPublished}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Submitting..." : "Submit appeal"}
                </Button>
              </div>
            </div>
            {selectedScoreNotPublished && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Results for “{selectedScore?.examTitle ?? `Exam #${selectedScore?.examId}`}”
                have not been published yet. You can submit an appeal once your teacher
                publishes the results.
              </p>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Reason
              <textarea
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                maxLength={2000}
                placeholder="Explain why you think your score should be reviewed..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {scores.length > 0 && (
              <div className="space-y-1.5 rounded-md bg-muted/40 p-3 text-xs">
                <p className="font-semibold text-muted-foreground">Your graded attempts (pick one to appeal)</p>
                {scores.map((s) => {
                  const alreadyAppealed = appealedAttemptIds.has(s.attemptId) || appealedExamIds.has(s.examId);
                  const notPublished = !s.resultPublished;
                  const isSelected = String(s.attemptId) === attemptIdInput;
                  return (
                    <div key={s.attemptId} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {s.examTitle || `Exam #${s.examId}`} · Attempt #{s.attemptNumber} · Score{" "}
                        {formatScore(s.finalScore ?? s.objectiveScore ?? 0)}/{formatScore(s.maxScore ?? 10)}
                        {notPublished && (
                          <span className="ml-1 text-amber-700">(not published yet)</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={alreadyAppealed || isSelected}
                        title={
                          notPublished
                            ? "Appeal is available after the teacher publishes the results"
                            : undefined
                        }
                        onClick={() => setAttemptIdInput(String(s.attemptId))}
                      >
                        {alreadyAppealed
                          ? "Appealed"
                          : isSelected
                            ? "Selected"
                            : notPublished
                              ? "Not published"
                              : "Select"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">My appeal history</h2>
          {myAppealsQuery.isLoading && <p className="text-muted-foreground">Loading...</p>}
          {myAppealsQuery.isError && (
            <p className="text-destructive">Could not load appeals.</p>
          )}
          {!myAppealsQuery.isLoading && !myAppealsQuery.isError && appeals.length === 0 && (
            <p className="text-muted-foreground">No appeals yet.</p>
          )}
          {appeals.map((appeal) => (
            <Card key={appeal.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">
                  {appeal.examTitle || `Exam #${appeal.examId ?? "-"}`} · Attempt #{appeal.attemptNumber}
                </CardTitle>
                <Badge variant={statusVariant(appeal.status)}>
                  {SCORE_APPEAL_STATUS_LABEL[appeal.status]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">Reason: <span className="text-foreground">{appeal.reason}</span></p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Old score</span>
                  <span>{appeal.oldScore ?? "-"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Requested / New score</span>
                  <span>{appeal.newScore ?? appeal.requestedScore ?? "-"}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Submitted at</span>
                  <span>{formatDate(appeal.createdAt)}</span>
                </div>
                {appeal.resolutionNote && (
                  <p className="text-muted-foreground">Reviewer note: <span className="text-foreground">{appeal.resolutionNote}</span></p>
                )}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAppeal(appeal);
                      setDialogOpen(true);
                    }}
                  >
                    View detail
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Appeal #{selectedAppeal?.id}</DialogTitle>
            <DialogDescription>
              {selectedAppeal?.examTitle || `Exam #${selectedAppeal?.examId ?? "-"}`} · Attempt #{selectedAppeal?.attemptNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedAppeal && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={statusVariant(selectedAppeal.status)}>{SCORE_APPEAL_STATUS_LABEL[selectedAppeal.status]}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span className="max-w-[60%] text-right">{selectedAppeal.reason}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Old score</span><span>{selectedAppeal.oldScore ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Requested score</span><span>{selectedAppeal.requestedScore ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">New score</span><span>{selectedAppeal.newScore ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reviewer</span><span>{selectedAppeal.reviewerName ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reviewed at</span><span>{formatDate(selectedAppeal.reviewedAt)}</span></div>
              {selectedAppeal.resolutionNote && <p className="text-muted-foreground">Note: <span className="text-foreground">{selectedAppeal.resolutionNote}</span></p>}
              <p className="text-muted-foreground">Adjustment applied: <span className="text-foreground">{selectedAppeal.adjustmentApplied ? "Yes" : "No"}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
