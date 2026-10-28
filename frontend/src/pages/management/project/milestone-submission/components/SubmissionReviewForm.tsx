import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewDecision, SubmissionDetail, RubricRatingLevel } from "@/types";
import { AlertCircle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Draft = Record<string, { ratingLevel?: RubricRatingLevel; feedback: string }>;

export interface ReviewFormError { message?: string; errors?: Record<string, string[]> }

export function SubmissionReviewForm({ submission, pending, apiError, onReview }: {
  submission: SubmissionDetail;
  pending: boolean;
  apiError?: ReviewFormError | null;
  onReview: (decision: ReviewDecision, values: Draft, checklist: Record<string, boolean>, overallFeedback?: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(
    submission.rubric.criteria.map((item) => [item.id, { feedback: "" }]),
  ));
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => Object.fromEntries(
    submission.currentVersion.checklist.filter((item) => item.id).map((item) => [item.id as string, item.completed]),
  ));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const ordered = useMemo(() => [...submission.rubric.criteria].sort((a, b) => a.orderIndex - b.orderIndex), [submission]);
  const evaluated = ordered.filter((item) => draft[item.id]?.ratingLevel).length;

  useEffect(() => {
    if (submission.status !== "SUBMITTED") setDecision(null);
  }, [submission.status]);

  const requestDecision = (next: ReviewDecision) => {
    const errors: Record<string, string> = {};
    ordered.forEach((item) => {
      const value = draft[item.id];
      if (!value?.ratingLevel) errors[`${item.id}.rating`] = "Select a rating";
      if (next !== "ACCEPT" && !value?.feedback.trim()) errors[`${item.id}.feedback`] = "Please enter feedback";
      if ((value?.feedback.length ?? 0) > 500) errors[`${item.id}.feedback`] = "Feedback must not exceed 500 characters";
    });
    if (next === "REQUEST_CHANGES" && !overallFeedback.trim()) errors.overallFeedback = "Revision instructions are required";
    if (overallFeedback.length > 500) errors.overallFeedback = "Feedback must not exceed 500 characters";
    if (next === "ACCEPT" && submission.currentVersion.checklist.some((item) => item.mandatory && !checklist[item.id as string])) {
      errors.checklist = "Check every required acceptance item before accepting";
    }
    setLocalErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(`criterion-${Object.keys(errors)[0].split(".")[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (next === "ACCEPT") onReview(next, draft, checklist, overallFeedback.trim() || undefined);
    else setDecision(next);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><CardTitle>Rubric evaluation</CardTitle><CardDescription>{submission.rubric.name} · {submission.rubric.version}. Evaluate every criterion before making a decision.</CardDescription></div>
            <span className="text-sm font-medium">{evaluated}/{ordered.length} evaluated</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {apiError ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Review could not be saved</AlertTitle><AlertDescription>{apiError.errors?.decision?.[0] ?? apiError.message ?? "Check the highlighted fields and try again."}</AlertDescription></Alert> : null}
          {ordered.map((criterion, index) => {
            const value = draft[criterion.id] ?? { feedback: "" };
            const serverFeedback = apiError?.errors?.[`criteria[${index}].feedback`]?.[0];
            const feedbackError = localErrors[`${criterion.id}.feedback`] ?? serverFeedback;
            return (
              <section id={`criterion-${criterion.id}`} key={criterion.id} className="scroll-mt-24 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold">{index + 1}. {criterion.name}</p><p className="mt-1 text-sm text-muted-foreground">{criterion.description || criterion.code}</p></div>
                  <div className="text-right text-sm"><p className="font-medium">{criterion.maxScore} points</p><p className="text-xs text-muted-foreground">{criterion.weight}% weight</p></div>
                </div>
                <select
                  className="mt-4 h-11 w-full rounded-lg border bg-background px-3 text-sm"
                  value={value.ratingLevel ?? ""}
                  disabled={pending || submission.status !== "SUBMITTED"}
                  aria-invalid={Boolean(localErrors[`${criterion.id}.rating`])}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, [criterion.id]: { ...value, ratingLevel: event.target.value as RubricRatingLevel } }));
                    setLocalErrors((current) => { const next = { ...current }; delete next[`${criterion.id}.rating`]; return next; });
                  }}
                >
                  <option value="">Select rating</option>
                  {[...criterion.ratings].sort((a, b) => a.orderIndex - b.orderIndex).map((rating) => <option key={rating.id} value={rating.level}>{rating.level.replace("_", " ")} · {rating.percentage}% · {rating.description}</option>)}
                </select>
                {localErrors[`${criterion.id}.rating`] ? <p className="mt-2 text-sm text-destructive">{localErrors[`${criterion.id}.rating`]}</p> : null}
                <div className="mt-4 grid gap-2">
                  <div className="flex justify-between gap-2"><Label htmlFor={`feedback-${criterion.id}`}>Criterion feedback</Label><span className={`text-xs ${value.feedback.length > 500 ? "text-destructive" : "text-muted-foreground"}`}>{value.feedback.length}/500</span></div>
                  <Textarea id={`feedback-${criterion.id}`} rows={3} value={value.feedback} disabled={pending || submission.status !== "SUBMITTED"} aria-invalid={Boolean(feedbackError)} placeholder="Explain what was met and what needs attention"
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, [criterion.id]: { ...value, feedback: event.target.value } }));
                      setLocalErrors((current) => { const next = { ...current }; delete next[`${criterion.id}.feedback`]; return next; });
                    }} />
                  {feedbackError ? <p className="text-sm text-destructive">{feedbackError}</p> : null}
                </div>
              </section>
            );
          })}
          <section className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Acceptance checklist</h3><p className="mt-1 text-sm text-muted-foreground">Verify each item against the submitted artifacts. Required items must be checked to accept.</p></div><span className="text-sm font-medium">{Object.values(checklist).filter(Boolean).length}/{submission.currentVersion.checklist.length} checked</span></div>
            <div className="mt-4 grid gap-3">{submission.currentVersion.checklist.map((item, index) => <label key={item.id ?? index} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={Boolean(checklist[item.id as string])} disabled={pending || submission.status !== "SUBMITTED" || !item.id} onCheckedChange={(checked) => item.id && setChecklist((current) => ({ ...current, [item.id as string]: checked === true }))} /><span><span className="font-medium">{item.content}</span>{item.mandatory ? <span className="ml-2 text-sm text-muted-foreground">Required</span> : null}</span></label>)}</div>
            {localErrors.checklist || apiError?.errors?.checklist?.[0] ? <p className="mt-3 text-sm text-destructive">{localErrors.checklist ?? apiError?.errors?.checklist?.[0]}</p> : null}
          </section>
          <section className="rounded-xl border p-4">
            <div className="flex justify-between gap-2"><Label htmlFor="overall-feedback">Revision instructions <span className="font-normal text-muted-foreground">(required for Request Changes)</span></Label><span className={`text-xs ${overallFeedback.length > 500 ? "text-destructive" : "text-muted-foreground"}`}>{overallFeedback.length}/500</span></div>
            <Textarea id="overall-feedback" className="mt-3" rows={4} maxLength={501} disabled={pending} value={overallFeedback} aria-invalid={Boolean(localErrors.overallFeedback || apiError?.errors?.overallFeedback?.[0])} placeholder="Summarize exactly what the student must revise" onChange={(event) => { setOverallFeedback(event.target.value); setLocalErrors((current) => { const next = { ...current }; delete next.overallFeedback; return next; }); }} />
            {localErrors.overallFeedback || apiError?.errors?.overallFeedback?.[0] ? <p className="mt-2 text-sm text-destructive">{localErrors.overallFeedback ?? apiError?.errors?.overallFeedback?.[0]}</p> : null}
          </section>
        </CardContent>
      </Card>

      {submission.status === "SUBMITTED" ? (
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Button variant="destructive" disabled={pending || !submission.availableActions.reject} onClick={() => requestDecision("REJECT")}><XCircle className="size-4" /> Reject submission</Button>
          <Button variant="outline" disabled={pending || !submission.availableActions.requestChanges} onClick={() => requestDecision("REQUEST_CHANGES")}><RotateCcw className="size-4" /> Request student revision</Button>
          <Button disabled={pending || !submission.availableActions.accept} onClick={() => requestDecision("ACCEPT")}><CheckCircle2 className="size-4" /> {pending ? "Saving..." : "Accept submission"}</Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={decision !== null}
        title={decision === "REJECT" ? "Reject this submission?" : "Request a new version?"}
        description={decision === "REJECT"
          ? "This is final: the submission becomes Rejected and the milestone becomes Failed."
          : "The current version stays immutable and the student can create exactly one next draft version."}
        confirmLabel={decision === "REJECT" ? "Reject submission" : "Request changes"}
        loadingLabel="Saving review..."
        destructive={decision === "REJECT"}
        loading={pending}
        onCancel={() => !pending && setDecision(null)}
        onConfirm={() => decision && onReview(decision, draft, checklist, overallFeedback.trim() || undefined)}
      />
    </>
  );
}
