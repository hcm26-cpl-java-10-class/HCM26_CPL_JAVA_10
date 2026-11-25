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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { scoreAppealApi } from "@/api/features/score-appeal.api";
import StudentSubmissionView from "@/components/features/exam/StudentSubmissionView";
import type { ScoreAppealDTO } from "@/types/features/score-appeal";
import { formatScore } from "@/utils/examScore";

interface AppealReviewDialogProps {
  appeal: ScoreAppealDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed?: () => void;
}

const INTEGRITY_EVENT_LABEL: Record<string, string> = {
  TAB_HIDDEN: "Tab hidden",
  WINDOW_BLUR: "Window blurred",
  FULLSCREEN_EXIT: "Fullscreen exited",
  COPY: "Copy",
  CUT: "Cut",
  PASTE: "Paste",
  CONTEXT_MENU: "Context menu",
  DEVTOOLS_KEY: "Developer tools shortcut",
  PRINT_ATTEMPT: "Print attempt",
  MULTI_SESSION: "Multiple sessions",
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function IntegrityBadge({
  integrity,
}: {
  integrity?: { flagged: boolean; totalViolations: number; antiCheatEnabled: boolean };
}) {
  if (!integrity) return null;
  // Co vi pham thi luon canh bao, ke ca khi bai thi khong bat anti-cheat.
  if (integrity.flagged) {
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="size-3" />
        Flagged - Suspected Cheating ({integrity.totalViolations} violation
        {integrity.totalViolations === 1 ? "" : "s"})
      </Badge>
    );
  }
  if (!integrity.antiCheatEnabled) {
    return (
      <Badge variant="outline" className="gap-1">
        <ShieldOff className="size-3" />
        Anti-cheat not enabled
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-800">
      <ShieldCheck className="size-3" />
      No integrity issues
    </Badge>
  );
}

function IntegrityPanel({ attemptId }: { attemptId: number | null }) {
  const eventsQuery = useQuery({
    queryKey: ["appeal-integrity-events", attemptId],
    queryFn: () => scoreAppealApi.getIntegrityEvents(attemptId as number),
    enabled: attemptId != null,
  });

  if (eventsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading integrity events...</p>;
  }
  if (eventsQuery.isError) {
    return (
      <p className="rounded-md border border-destructive p-3 text-sm text-destructive">
        Could not load the integrity events for this attempt.
      </p>
    );
  }

  const events = eventsQuery.data ?? [];
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No integrity events recorded for this attempt.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Occurred At</th>
            <th className="px-3 py-2 font-medium">Away (s)</th>
            <th className="px-3 py-2 font-medium">Detail</th>
            <th className="px-3 py-2 font-medium">IP</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {events.map((event) => (
            <tr key={event.id} className="align-top">
              <td className="px-3 py-2 font-medium">
                {INTEGRITY_EVENT_LABEL[event.type] ?? event.type}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {formatDateTime(event.occurredAt)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{event.durationSeconds ?? "-"}</td>
              <td className="px-3 py-2 text-muted-foreground">{event.detail ?? "-"}</td>
              <td className="px-3 py-2 text-muted-foreground">{event.ipAddress ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AppealReviewDialog({
  appeal,
  open,
  onOpenChange,
  onReviewed,
}: AppealReviewDialogProps) {
  const [newScore, setNewScore] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [activeTab, setActiveTab] = useState("review");

  useEffect(() => {
    if (appeal) {
      setNewScore(appeal.newScore != null ? String(appeal.newScore) : "");
      setResolutionNote(appeal.resolutionNote ?? "");
    }
    setActiveTab("review");
  }, [appeal]);

  const submissionQuery = useQuery({
    queryKey: ["appeal-submission", appeal?.attemptId],
    queryFn: () => scoreAppealApi.getSubmission(appeal?.attemptId as number),
    enabled: open && appeal?.attemptId != null,
  });

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
      toast.success(updated.status === "APPROVED" ? "Appeal approved" : "Appeal rejected");
      onOpenChange(false);
      onReviewed?.();
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || "Failed to review the appeal");
    },
  });

  const isPending = reviewMutation.isPending;
  const integrity = submissionQuery.data?.integrity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl lg:max-w-5xl">
        <DialogHeader className="px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <DialogTitle>Score Appeal Review</DialogTitle>
              <DialogDescription className="break-words">
                {appeal
                  ? [
                      appeal.examTitle || `Assessment #${appeal.examId}`,
                      `Attempt #${appeal.attemptNumber}`,
                      appeal.studentName || "-",
                    ].join(" · ")
                  : ""}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <IntegrityBadge integrity={integrity} />
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <div className="px-6">
            <TabsList>
              <TabsTrigger value="review">Appeal Review</TabsTrigger>
              <TabsTrigger value="submission">
                <FileText className="size-4" />
                Student Submission
              </TabsTrigger>
              <TabsTrigger value="integrity">Integrity</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="review" className="mt-0 space-y-3 text-sm">
              {appeal && (
                <>
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
                        Resolution Note{" "}
                        <span className="text-xs text-muted-foreground">(required when rejecting)</span>
                        <Textarea
                          rows={3}
                          placeholder="Explain why you approve or reject this appeal..."
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="submission" className="mt-0">
              {submissionQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading student submission...</p>
              )}
              {submissionQuery.isError && (
                <p className="rounded-md border border-destructive p-3 text-sm text-destructive">
                  Could not load the student submission. The attempt may not have been submitted yet.
                </p>
              )}
              {submissionQuery.data && (
                <StudentSubmissionView review={submissionQuery.data.review} revealAnswers />
              )}
            </TabsContent>

            <TabsContent value="integrity" className="mt-0">
              {submissionQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading integrity report...</p>
              )}
              {submissionQuery.isError && (
                <p className="rounded-md border border-destructive p-3 text-sm text-destructive">
                  Could not load the integrity report for this attempt.
                </p>
              )}
              {submissionQuery.data && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <IntegrityBadge integrity={integrity} />
                    {integrity?.flagged && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangle className="size-3.5 text-destructive" />
                        Review the student answers before deciding this appeal.
                      </span>
                    )}
                  </div>

                  {integrity && integrity.totalViolations > 0 && (
                    <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-muted-foreground">Total violations</span>
                        <p className="font-medium">{integrity.totalViolations}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tab switches</span>
                        <p className="font-medium">{integrity.tabSwitchCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Copy / paste</span>
                        <p className="font-medium">{integrity.copyPasteCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fullscreen exits</span>
                        <p className="font-medium">{integrity.fullscreenExitCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shortcut attempts</span>
                        <p className="font-medium">{integrity.shortcutCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Multiple sessions</span>
                        <p className="font-medium">{integrity.multiSessionCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Away time (s)</span>
                        <p className="font-medium">{integrity.totalAwaySeconds}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Window blurred</span>
                        <p className="font-medium">{integrity.windowBlurCount}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Context menu</span>
                        <p className="font-medium">{integrity.contextMenuCount}</p>
                      </div>
                    </div>
                  )}

                  <IntegrityPanel attemptId={appeal?.attemptId ?? null} />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="-mx-6 -mb-0 shrink-0 border-t bg-muted/30 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
            onClick={() => void submissionQuery.refetch()}
            disabled={submissionQuery.isFetching || activeTab === "review"}
          >
            <RefreshCw className="size-4" />
            {submissionQuery.isFetching ? "Refreshing..." : "Refresh"}
          </Button>
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
