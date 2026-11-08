import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewDecision, RubricRatingLevel, SubmissionDetail } from "@/types";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SubmissionEvidence } from "./SubmissionEvidence";
import { describeResubmissionBlock } from "@/utils/resubmission.utils";

type Draft = Record<string, { ratingLevel?: RubricRatingLevel; feedback: string }>;
const FEEDBACK_MAX = 500;
// Mirrors backend rules: length is checked on the trimmed value; blank text counts as empty.
const feedbackLengthError = (value: string) => value.trim().length > FEEDBACK_MAX ? `Feedback must not exceed ${FEEDBACK_MAX} characters` : undefined;
type Stage = "submission" | "evaluate" | "decision";
export interface ReviewFormError { message?: string; errors?: Record<string, string[]>; status?: number }

export function SubmissionReviewForm({ submission, pending, apiError, onReview, onDirtyChange, onEdit, onReload }: {
  submission: SubmissionDetail;
  pending: boolean;
  apiError?: ReviewFormError | null;
  onReview: (decision: ReviewDecision, values: Draft, checklist: Record<string, boolean>, overallFeedback?: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onEdit: () => void;
  onReload: () => void;
}) {
  const [stage, setStage] = useState<Stage>("submission");
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => Object.fromEntries(submission.rubric.criteria.map(item => [item.id, { feedback: "" }])));
  // Student self-attestation is evidence, not reviewer acceptance.
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => Object.fromEntries(submission.currentVersion.checklist.filter(item => item.id).map(item => [item.id as string, false])));
  const [overallFeedback, setOverallFeedback] = useState("");
  const [dirty, setDirty] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const ordered = useMemo(() => [...submission.rubric.criteria].sort((a, b) => a.orderIndex - b.orderIndex), [submission]);
  const criterion = ordered[active];
  const isChecklist = active === ordered.length;
  const checked = Object.values(checklist).filter(Boolean).length;
  const evaluated = ordered.filter(item => Boolean(draft[item.id]?.ratingLevel)).length;
  const conflict = apiError?.status === 409 || apiError?.status === 412;

  useEffect(() => { onDirtyChange(dirty && submission.status === "SUBMITTED"); }, [dirty, submission.status, onDirtyChange]);
  const focusField = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());
  const goToError = (key: string) => {
    if (key.startsWith("criterion:")) {
      const [, id, field] = key.split(":");
      setStage("evaluate"); setActive(Math.max(0, ordered.findIndex(item => item.id === id)));
      focusField(field === "feedback" ? `feedback-${id}` : `rating-${id}`);
    } else if (key === "checklist") {
      setStage("evaluate"); setActive(ordered.length); focusField("review-checklist");
    } else if (key === "overallFeedback") { setStage("decision"); focusField("overall-feedback"); }
    else setStage("decision");
  };
  const serverErrors: Record<string, string> = {};
  Object.entries(apiError?.errors ?? {}).forEach(([key, messages]) => {
    const match = key.match(/^criteria\[(\d+)\]\.(ratingLevel|feedback|criterionId)$/);
    if (match) {
      const item = submission.rubric.criteria[Number(match[1])];
      if (item) serverErrors[`criterion:${item.id}:${match[2] === "feedback" ? "feedback" : "rating"}`] = messages[0];
    } else if (key.startsWith("checklist")) serverErrors.checklist = messages[0];
    else if (key === "overallFeedback" || key === "decision") serverErrors[key] = messages[0];
  });
  const errors = { ...serverErrors, ...localErrors };
  const errorLabel = (key: string) => key.startsWith("criterion:")
    ? `${ordered.find(item => item.id === key.split(":")[1])?.name ?? "Criterion"} · ${key.endsWith("feedback") ? "feedback" : "rating"}`
    : key === "checklist" ? "Acceptance checklist" : key === "overallFeedback" ? "Overall feedback" : "Decision";
  const setFieldError = (key: string, message?: string) => setLocalErrors(current => {
    if (message) return current[key] === message ? current : { ...current, [key]: message };
    if (!(key in current)) return current;
    const next = { ...current }; delete next[key]; return next;
  });
  const clearError = (key: string) => setLocalErrors(current => { const next = { ...current }; delete next[key]; return next; });
  const markDirty = () => { setDirty(true); onEdit(); };
  const toDecision = () => {
    const missing = ordered.find(item => !draft[item.id]?.ratingLevel);
    if (missing) { const key = `criterion:${missing.id}:rating`; setLocalErrors({ [key]: "Select a rating before continuing" }); goToError(key); return; }
    setLocalErrors({}); setStage("decision");
  };
  const requestDecision = (next: ReviewDecision) => {
    const nextErrors: Record<string, string> = {};
    ordered.forEach(item => {
      const value = draft[item.id];
      if (!value?.ratingLevel) nextErrors[`criterion:${item.id}:rating`] = "Select a rating";
      if (next !== "ACCEPT" && !value?.feedback.trim()) nextErrors[`criterion:${item.id}:feedback`] = `Feedback is required when you ${next === "REJECT" ? "reject" : "request changes"}`;
      const lengthError = feedbackLengthError(value?.feedback ?? "");
      if (lengthError) nextErrors[`criterion:${item.id}:feedback`] = lengthError;
    });
    if (next === "ACCEPT" && submission.currentVersion.checklist.some(item => item.mandatory && !checklist[item.id as string])) nextErrors.checklist = "Check every required item before accepting";
    if (next === "REQUEST_CHANGES" && !overallFeedback.trim()) nextErrors.overallFeedback = "Revision instructions are required";
    const overallLengthError = feedbackLengthError(overallFeedback);
    if (overallLengthError) nextErrors.overallFeedback = overallLengthError;
    setLocalErrors(nextErrors);
    const first = Object.keys(nextErrors)[0];
    if (first) { goToError(first); return; }
    setDecision(next);
  };

  return <>
    <nav aria-label="Review progress" className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-2">
      {(["submission", "evaluate", "decision"] as Stage[]).map((entry, index) => <button key={entry} type="button" disabled={pending} onClick={() => entry === "decision" ? toDecision() : setStage(entry)} className={`rounded-lg px-2 py-2 text-left text-sm transition ${entry === stage ? "bg-sky-100 font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "text-muted-foreground hover:bg-muted"}`} aria-current={entry === stage ? "step" : undefined}><span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border text-xs">{index + 1}</span>{entry === "submission" ? "Submission" : entry === "evaluate" ? "Evaluate" : "Decision"}</button>)}
    </nav>
    {apiError || Object.keys(errors).length ? <Alert variant="destructive"><AlertCircle /><AlertTitle>{conflict ? "Submission changed while reviewing" : "Review needs attention"}</AlertTitle><AlertDescription><p>{conflict ? "Reload the latest version before submitting another review. Your draft remains visible until you reload." : apiError?.message ?? "Correct the highlighted fields."}</p>{Object.entries(errors).map(([key, message]) => <button key={key} type="button" className="text-left underline" onClick={() => goToError(key)}>{errorLabel(key)}: {message}</button>)}{conflict ? <Button type="button" size="sm" variant="outline" onClick={onReload}>Load latest version</Button> : null}</AlertDescription></Alert> : null}
    {stage === "submission" ? <div className="grid gap-4"><SubmissionEvidence submission={submission} /><Card><CardHeader><CardTitle className="text-base">Before you evaluate</CardTitle><CardDescription>Open the evidence links and compare the submitted work with each rubric criterion.</CardDescription></CardHeader><CardContent><Button type="button" onClick={() => setStage("evaluate")}>Start evaluation <ArrowRight className="size-4" /></Button></CardContent></Card></div> : null}
    {stage !== "submission" ? <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="min-w-0 space-y-4">
      {stage === "evaluate" ? <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>Evaluate submission</CardTitle><CardDescription>{evaluated}/{ordered.length} criteria rated · {submission.rubric.name}</CardDescription></div><Badge variant="secondary">{isChecklist ? "Checklist" : `Criterion ${active + 1} of ${ordered.length}`}</Badge></div></CardHeader><CardContent className="grid gap-5">
        <div className="flex flex-wrap gap-2" aria-label="Rubric criteria">{ordered.map((item, index) => <Button key={item.id} type="button" size="sm" variant={active === index ? "default" : "outline"} onClick={() => setActive(index)}>{index + 1}. <span className="max-w-32 truncate">{item.name}</span>{draft[item.id]?.ratingLevel ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : null}<span className="sr-only">{draft[item.id]?.ratingLevel ? "rated" : "not rated"}</span></Button>)}<Button type="button" size="sm" variant={isChecklist ? "default" : "outline"} onClick={() => setActive(ordered.length)}>Checklist {checked}/{submission.currentVersion.checklist.length}</Button></div>
        {criterion && !isChecklist ? <section key={criterion.id} className="grid gap-4 rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{criterion.name}</h3><p className="mt-1 text-sm text-muted-foreground">{criterion.description || criterion.code}</p></div><span className="text-sm text-muted-foreground">{criterion.maxScore} pts · {criterion.weight}% weight</span></div><div className="grid gap-2"><Label htmlFor={`rating-${criterion.id}`}>Rating</Label><select id={`rating-${criterion.id}`} className="h-11 w-full rounded-lg border bg-background px-3 text-sm" value={draft[criterion.id]?.ratingLevel ?? ""} aria-invalid={Boolean(errors[`criterion:${criterion.id}:rating`])} disabled={pending} onChange={event => { setDraft(current => ({ ...current, [criterion.id]: { ...current[criterion.id], ratingLevel: event.target.value as RubricRatingLevel } })); markDirty(); clearError(`criterion:${criterion.id}:rating`); }}><option value="">Select rating</option>{[...criterion.ratings].sort((a, b) => a.orderIndex - b.orderIndex).map(rating => <option key={rating.id} value={rating.level}>{rating.level.replaceAll("_", " ")} · {rating.percentage}%</option>)}</select>{errors[`criterion:${criterion.id}:rating`] ? <p className="text-sm text-destructive">{errors[`criterion:${criterion.id}:rating`]}</p> : null}{criterion.ratings.find(rating => rating.level === draft[criterion.id]?.ratingLevel)?.description ? <p className="text-sm text-muted-foreground">{criterion.ratings.find(rating => rating.level === draft[criterion.id]?.ratingLevel)?.description}</p> : null}</div><div className="grid gap-2"><div className="flex justify-between gap-2"><Label htmlFor={`feedback-${criterion.id}`}>Criterion feedback <span className="font-normal text-muted-foreground">(required for Reject / Request changes)</span></Label><span className={`text-xs ${(draft[criterion.id]?.feedback.trim().length ?? 0) > FEEDBACK_MAX ? "font-medium text-destructive" : "text-muted-foreground"}`}>{draft[criterion.id]?.feedback.trim().length ?? 0}/{FEEDBACK_MAX}</span></div><Textarea id={`feedback-${criterion.id}`} rows={3} className="field-sizing-fixed h-28 min-h-28 max-h-28 resize-none overflow-y-auto break-words" maxLength={FEEDBACK_MAX + 1} value={draft[criterion.id]?.feedback ?? ""} aria-invalid={Boolean(errors[`criterion:${criterion.id}:feedback`])} aria-describedby={errors[`criterion:${criterion.id}:feedback`] ? `feedback-${criterion.id}-error` : undefined} disabled={pending} placeholder="Explain the rating and what should improve" onChange={event => { const value = event.target.value; setDraft(current => ({ ...current, [criterion.id]: { ...current[criterion.id], feedback: value } })); markDirty(); setFieldError(`criterion:${criterion.id}:feedback`, feedbackLengthError(value)); }} onBlur={event => setFieldError(`criterion:${criterion.id}:feedback`, feedbackLengthError(event.target.value) ?? (errors[`criterion:${criterion.id}:feedback`] && !event.target.value.trim() ? errors[`criterion:${criterion.id}:feedback`] : undefined))} />{errors[`criterion:${criterion.id}:feedback`] ? <p id={`feedback-${criterion.id}-error`} className="text-sm text-destructive">{errors[`criterion:${criterion.id}:feedback`]}</p> : null}</div></section> : null}
        {isChecklist ? <section id="review-checklist" tabIndex={-1} className="grid gap-3 rounded-xl border p-4"><h3 className="font-semibold">Acceptance checklist</h3><p className="text-sm text-muted-foreground">Check items you verified yourself. Required items must be checked to accept.</p>{submission.currentVersion.checklist.map((item, index) => <label key={item.id ?? index} className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3"><Checkbox checked={Boolean(item.id && checklist[item.id])} disabled={pending || !item.id} onCheckedChange={value => { if (item.id) { setChecklist(current => ({ ...current, [item.id as string]: value === true })); markDirty(); clearError("checklist"); } }} /><span className="min-w-0 break-words text-sm"><span className="font-medium">{item.content}</span>{item.mandatory ? <Badge variant="outline" className="ml-2 border-amber-300 text-amber-800 dark:text-amber-300">Required</Badge> : null}</span></label>)}{!submission.currentVersion.checklist.length ? <p className="text-sm text-muted-foreground">No checklist items for this version.</p> : null}{errors.checklist ? <p className="text-sm text-destructive">{errors.checklist}</p> : null}</section> : null}
      </CardContent></Card> : null}
      {stage === "decision" ? <Card><CardHeader><CardTitle>Review your decision</CardTitle><CardDescription>Version {submission.currentVersionNumber} · {evaluated}/{ordered.length} criteria rated · {checked}/{submission.currentVersion.checklist.length} checklist items checked</CardDescription></CardHeader><CardContent className="grid gap-5"><div className="grid gap-2">{ordered.map((item, index) => <button key={item.id} type="button" onClick={() => { setStage("evaluate"); setActive(index); }} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"><span className="min-w-0 truncate">{item.name}</span><span className="shrink-0 font-medium">{draft[item.id]?.ratingLevel?.replaceAll("_", " ") || "Not rated"}</span></button>)}</div><button type="button" onClick={() => { setStage("evaluate"); setActive(ordered.length); }} className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted">Acceptance checklist · {checked}/{submission.currentVersion.checklist.length} checked</button>{submission.currentVersion.late ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Submitted late · {submission.currentVersion.penaltyPercent}% penalty</p> : null}<div className="grid gap-2"><div className="flex justify-between gap-2"><Label htmlFor="overall-feedback">Overall feedback <span className="font-normal text-muted-foreground">(required for Request changes)</span></Label><span className={`text-xs ${overallFeedback.trim().length > FEEDBACK_MAX ? "font-medium text-destructive" : "text-muted-foreground"}`}>{overallFeedback.trim().length}/{FEEDBACK_MAX}</span></div><Textarea id="overall-feedback" rows={4} className="field-sizing-fixed h-32 min-h-32 max-h-32 resize-none overflow-y-auto break-words" maxLength={FEEDBACK_MAX + 1} value={overallFeedback} disabled={pending} aria-invalid={Boolean(errors.overallFeedback)} placeholder="Summarize the decision and any revision instructions" onChange={event => { setOverallFeedback(event.target.value); markDirty(); setFieldError("overallFeedback", feedbackLengthError(event.target.value)); }} />{errors.overallFeedback ? <p className="text-sm text-destructive">{errors.overallFeedback}</p> : null}</div><div className="grid gap-2 border-t pt-4"><h3 className="font-semibold">Choose a decision</h3><div className="flex flex-wrap gap-2">{submission.availableActions.reject ? <Button type="button" variant="destructive" disabled={pending || conflict} onClick={() => requestDecision("REJECT")}><XCircle className="size-4" /> Reject</Button> : null}{submission.availableActions.requestChanges ? <Button type="button" variant="outline" disabled={pending || conflict} onClick={() => requestDecision("REQUEST_CHANGES")}><RotateCcw className="size-4" /> Request changes</Button> : <p className="w-full text-sm text-amber-700 dark:text-amber-300">Request changes is unavailable: {describeResubmissionBlock(submission)}</p>}{submission.availableActions.accept ? <Button type="button" disabled={pending || conflict} onClick={() => requestDecision("ACCEPT")}><CheckCircle2 className="size-4" /> Accept</Button> : null}</div></div></CardContent></Card> : null}
      <div className="sticky bottom-2 z-20 flex flex-wrap justify-between gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur"><Button type="button" variant="outline" disabled={pending} onClick={() => stage === "decision" ? setStage("evaluate") : active > 0 ? setActive(active - 1) : setStage("submission")}><ArrowLeft className="size-4" /> Back</Button>{stage === "evaluate" ? <Button type="button" disabled={pending} onClick={() => isChecklist ? toDecision() : setActive(active + 1)}>{isChecklist ? "Review decision" : "Next"}<ArrowRight className="size-4" /></Button> : null}</div>
    </div><aside className="order-first min-w-0 lg:order-last lg:sticky lg:top-4"><SubmissionEvidence submission={submission} compact /></aside></div> : null}
    <ConfirmDialog open={decision !== null} title={decision === "ACCEPT" ? "Accept this submission?" : decision === "REJECT" ? "Reject this submission?" : "Request a new version?"} description={<span>Version {submission.currentVersionNumber} · {submission.milestoneTitle}. {decision === "REJECT" ? "The milestone will be marked failed." : decision === "REQUEST_CHANGES" ? "The student can submit a new version if allowed." : "The submission will be accepted."}</span>} confirmLabel={decision === "ACCEPT" ? "Confirm acceptance" : decision === "REJECT" ? "Confirm rejection" : "Request changes"} loadingLabel="Saving review..." destructive={decision === "REJECT"} loading={pending} onCancel={() => !pending && setDecision(null)} onConfirm={() => { if (decision && !pending) onReview(decision, draft, checklist, overallFeedback.trim() || undefined); }} />
  </>;
}
