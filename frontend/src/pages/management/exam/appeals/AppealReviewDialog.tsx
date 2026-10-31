import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { scoreAppealApi } from "@/api/features/score-appeal.api";
import type { ScoreAppealDTO } from "@/types/features/score-appeal";
import { formatScore } from "@/utils/examScore";

interface AppealReviewDialogProps {
    appeal: ScoreAppealDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed?: () => void;
}

export default function AppealReviewDialog({
  appeal,
  open,
  onOpenChange,
    onReviewed,
}: AppealReviewDialogProps) {
  const [newScore, setNewScore] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  useEffect(() => {
    if (appeal) {
      setNewScore(appeal.newScore != null ? String(appeal.newScore) : "");
      setResolutionNote(appeal.resolutionNote ?? "");
    }
  }, [appeal]);

  const reviewMutation = useMutation({
    mutationFn: async (decision: "APPROVE" | "REJECT") => {
      if (!appeal) throw new Error("Appeal not found");
      if (decision === "REJECT" && !resolutionNote.trim()) {
        throw new Error("Please enter a resolution note when rejecting an appeal.");
      }
      return scoreAppealApi.review(appeal.id, {
        decision,
        newScore: decision === "APPROVE" && newScore !== "" ? Number(newScore) : undefined,
        resolutionNote: resolutionNote.trim() || undefined,
      });
    },
    onSuccess: (updated) => {
      toast.success(
        updated.status === "APPROVED"
          ? "Appeal approved"
          : "Appeal rejected",
      );
      onOpenChange(false);
      onReviewed?.();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || "Failed to review the appeal");
    },
  });

  const isPending = reviewMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Score Appeal Review</DialogTitle>
          <DialogDescription>
            {appeal?.examTitle || (appeal ? `Exam #${appeal.examId}` : "")}
          </DialogDescription>
        </DialogHeader>

        {appeal && (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-2">
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Student</span>
                <p className="font-medium">{appeal.studentName || "-"}</p>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Attempt</span>
                <p className="font-medium">#{appeal.attemptNumber}</p>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Current Score</span>
                <p className="font-medium">{formatScore(appeal.oldScore)}</p>
              </div>
              <div className="flex justify-between sm:block">
                <span className="text-muted-foreground">Requested Score</span>
                <p className="font-medium">
                  {appeal.requestedScore != null ? formatScore(appeal.requestedScore) : "-"}
                </p>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Appeal Reason</p>
              <p className="mt-1 whitespace-pre-wrap">{appeal.reason}</p>
            </div>

            {appeal.status !== "PENDING" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                This appeal has already been processed and the decision can no longer be changed.
              </div>
            )}

            {appeal.status === "PENDING" && (
              <>
                <label className="grid gap-1.5 font-medium">
                  New Score (leave blank to keep the current score)
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="e.g. 8.5"
                    value={newScore}
                    onChange={(e) => setNewScore(e.target.value)}
                  />
                </label>

                <label className="grid gap-1.5 font-medium">
                  Resolution Note <span className="text-xs text-muted-foreground">(required when rejecting)</span>
                  <Textarea
                    rows={3}
                    placeholder="Explain why you approve or reject this appeal..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Close
          </Button>
          {appeal?.status === "PENDING" && (
            <>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => reviewMutation.mutate("REJECT")}
              >
                {isPending ? "Processing..." : "Reject"}
              </Button>
              <Button disabled={isPending} onClick={() => reviewMutation.mutate("APPROVE")}>
                {isPending ? "Processing..." : "Approve"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
