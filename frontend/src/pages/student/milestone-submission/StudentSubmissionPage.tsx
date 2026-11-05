import { milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SaveSubmissionDraftRequest, SubmissionArtifactType, SubmissionDetail } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, ExternalLink, Link2, Plus, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { SubmissionStatusBadge } from "@/pages/management/project/milestone-submission/components/SubmissionStatusBadge";

type ArtifactDraft = { type: SubmissionArtifactType; name: string; url: string };

function SubmissionVersionHistory({ item }: { item: SubmissionDetail }) {
  const versions = [...item.versions].sort((left, right) => right.versionNumber - left.versionNumber);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history ({versions.length})</CardTitle>
        <CardDescription>Each submission version is preserved with its own status and review outcome.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {versions.map((version) => {
          const versionReviews = item.reviews.filter((review) => review.versionNumber === version.versionNumber);
          return (
            <section key={version.id} className="grid gap-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Version {version.versionNumber}: {version.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {version.submittedAt
                      ? `Submitted ${new Date(version.submittedAt).toLocaleString()}`
                      : "Draft · not submitted"}
                    {version.submittedBy ? ` · ${version.submittedBy}` : ""}
                  </p>
                </div>
                <SubmissionStatusBadge status={version.status} />
              </div>
              {version.notes ? <p className="whitespace-pre-wrap text-sm">{version.notes}</p> : null}
              {version.artifacts.length ? (
                <ul className="grid gap-1 text-sm">
                  {version.artifacts.map((artifact, index) => (
                    <li key={artifact.id ?? `${version.id}-${index}`} className="break-all">
                      <span className="font-medium">{artifact.name || artifact.type}: </span>
                      <a className="text-primary underline" href={artifact.url} target="_blank" rel="noreferrer">{artifact.url}</a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No artifact links.</p>}
              {version.late ? (
                <p className="text-sm text-amber-700">Submitted late · {version.penaltyPercent}% penalty</p>
              ) : null}
              {versionReviews.map((review) => (
                <div key={review.id} className="rounded-md bg-muted/50 p-3 text-sm">
                  <p className="font-medium">
                    Review: {review.decision === "ACCEPT" ? "Accepted" : review.decision === "REJECT" ? "Rejected" : "Changes requested"}
                    {review.reviewerName ? ` · ${review.reviewerName}` : ""}
                    {review.reviewedAt ? ` · ${new Date(review.reviewedAt).toLocaleString()}` : ""}
                  </p>
                  {review.overallFeedback ? <p className="mt-1 whitespace-pre-wrap">{review.overallFeedback}</p> : null}
                  {review.evaluations.filter((evaluation) => evaluation.feedback).map((evaluation) => (
                    <p key={evaluation.criterionId} className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      <span className="font-medium">{evaluation.criterionName}: </span>{evaluation.feedback}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function toForm(item: SubmissionDetail): SaveSubmissionDraftRequest {
  return {
    title: item.currentVersion.title,
    notes: item.currentVersion.notes ?? "",
    submissionUrl: item.currentVersion.submissionUrl ?? undefined,
    artifacts: item.currentVersion.artifacts.map(({ type, name, url }) => ({ type, name, url })),
  };
}

export function StudentSubmissionPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const client = useQueryClient();
  const submitKey = useRef<string | null>(null);
  const query = useQuery({ queryKey: ["student-submission", submissionId], queryFn: () => milestoneSubmissionApi.getMyDetail(submissionId as string), enabled: Boolean(submissionId), retry: false });
  const [form, setForm] = useState<SaveSubmissionDraftRequest | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => { if (query.data?.status === "DRAFT") setForm(toForm(query.data)); }, [query.data?.id, query.data?.currentVersion.id, query.data?.status]);

  const store = (data: SubmissionDetail) => {
    client.setQueryData(["student-submission", submissionId], data);
    client.setQueryData(["milestone-submissions", submissionId], data);
    void client.invalidateQueries({ queryKey: ["milestone-submissions"] });
    void client.invalidateQueries({ queryKey: ["my-milestone-submissions"] });
  };
  const saveDraft = useMutation({
    mutationFn: ({ item, payload }: { item: SubmissionDetail; payload: SaveSubmissionDraftRequest }) =>
      milestoneSubmissionApi.updateMyDraft(item.id, item.currentVersion.id, payload),
    onSuccess: (data) => { store(data); setForm(toForm(data)); toast.success("Draft saved"); },
    onError: () => toast.error("Could not save this draft"),
  });
  const submit = useMutation({
    mutationFn: async ({ item, payload }: { item: SubmissionDetail; payload: SaveSubmissionDraftRequest }) => {
      await milestoneSubmissionApi.updateMyDraft(item.id, item.currentVersion.id, payload);
      submitKey.current ??= crypto.randomUUID();
      return milestoneSubmissionApi.submitMine(item.id, submitKey.current);
    },
    onSuccess: (data) => { store(data); submitKey.current = null; setConfirmSubmit(false); toast.success("Submission sent to reviewer"); },
    onError: () => toast.error("Could not submit this version"),
  });

  if (query.isLoading) return <MainLayout pathName={{ student: "Student", submission: "Submission" }}><Skeleton className="mx-auto h-[600px] max-w-5xl" /></MainLayout>;
  if (!query.data || query.isError) return <MainLayout pathName={{ student: "Student", submission: "Submission" }}><Alert variant="destructive"><AlertCircle /><AlertTitle>Submission could not be loaded</AlertTitle></Alert></MainLayout>;
  const item = query.data;
  const latestFeedback = item.reviews[0];
  const artifactPath = item.projectId
    ? `/projects/${item.projectId}/milestones/${item.milestoneId}/submit?reviewSubmissionId=${item.id}`
    : `/teams/${item.teamId}/milestones/${item.milestoneId}/submit`;

  if (item.status === "CHANGES_REQUESTED") return (
    <MainLayout pathName={{ student: "Student", submission: item.milestoneTitle }}>
      <div className="mx-auto grid max-w-5xl gap-5">
        <Button variant="ghost" className="w-fit" onClick={() => navigate("/student/milestone-submissions")}><ArrowLeft className="size-4" /> Back to My Submissions</Button>
        <Alert className="border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"><RotateCcw /><AlertTitle>Changes requested by reviewer</AlertTitle><AlertDescription>Version {item.currentVersionNumber} is preserved. Review the feedback and prepare version {item.currentVersionNumber + 1} before resubmission closes.</AlertDescription></Alert>
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.milestoneTitle}</CardTitle><CardDescription>{item.teamName} · Version {item.currentVersionNumber}</CardDescription></div><SubmissionStatusBadge status={item.status} /></div></CardHeader><CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-2"><CalendarClock className="size-4" /> Deadline: {new Date(item.deadline).toLocaleString()}</span>{item.lateUntil ? <span>Late policy closes: {new Date(item.lateUntil).toLocaleString()}</span> : null}<span>Attempt: {item.submissionAttempts}{item.maxSubmissionAttempts ? `/${item.maxSubmissionAttempts}` : ""}</span></CardContent></Card>
        {latestFeedback ? <Card className="border-amber-500/40"><CardHeader><CardTitle>Review feedback</CardTitle><CardDescription className="whitespace-pre-wrap text-foreground">{latestFeedback.overallFeedback || "Review the criterion-level feedback below."}</CardDescription></CardHeader><CardContent className="grid gap-2">{latestFeedback.evaluations.filter((value) => value.feedback).map((value) => <div key={value.criterionId} className="rounded-lg bg-muted/50 p-3"><p className="font-medium">{value.criterionName}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{value.feedback}</p></div>)}</CardContent></Card> : null}
        <SubmissionVersionHistory item={item} />
        <Card><CardHeader><CardTitle>Prepare version {item.currentVersionNumber + 1}</CardTitle><CardDescription>The artifact form creates a new version and preserves the reviewed version.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{item.availableActions.createNextVersion ? "You can still resubmit within the allowed window and attempt limit." : "The resubmission window is closed or the attempt limit has been reached."}</p><Button disabled={!item.availableActions.createNextVersion} onClick={() => navigate(artifactPath)}><RotateCcw className="size-4" /> Prepare resubmission</Button></CardContent></Card>
      </div>
    </MainLayout>
  );

  if (item.status !== "DRAFT" || !form) return (
    <MainLayout pathName={{ student: "Student", submission: item.milestoneTitle }}>
      <div className="mx-auto grid max-w-5xl gap-5"><Button variant="ghost" className="w-fit" onClick={() => navigate("/student/milestone-submissions")}><ArrowLeft className="size-4" /> Back to My Submissions</Button><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.milestoneTitle}</CardTitle><CardDescription>Version {item.currentVersionNumber} is read-only because it has been submitted.</CardDescription></div><SubmissionStatusBadge status={item.status} /></div></CardHeader><CardContent className="grid gap-4 text-sm"><p className="whitespace-pre-wrap"><strong>Summary:</strong> {item.currentVersion.notes || "—"}</p>{item.product ? <div className="grid gap-2 rounded-lg border p-3"><p><strong>Repository:</strong> {item.product.repositoryUrl ? <a className="text-primary underline" href={item.product.repositoryUrl} target="_blank" rel="noreferrer">{item.product.repositoryUrl} <ExternalLink className="inline size-3" /></a> : "—"}</p><p><strong>Deployment:</strong> {item.product.deploymentUrl ? <a className="text-primary underline" href={item.product.deploymentUrl} target="_blank" rel="noreferrer">{item.product.deploymentUrl} <ExternalLink className="inline size-3" /></a> : "—"}</p><p><strong>Release notes:</strong> {item.product.releaseNotes || "—"}</p><p><strong>Attachments:</strong> {item.product.attachments.length}</p></div> : null}</CardContent></Card>{latestFeedback ? <Card><CardHeader><CardTitle>Latest feedback</CardTitle><CardDescription className="whitespace-pre-wrap">{latestFeedback.overallFeedback || "No overall feedback was provided."}</CardDescription></CardHeader></Card> : null}<SubmissionVersionHistory item={item} /></div>
    </MainLayout>
  );

  const validate = () => {
    if (!form.title.trim()) return "Submission title is required";
    if (!form.artifacts.length || form.artifacts.some((value) => !value.name.trim() || !value.url.trim())) return "Add at least one complete artifact link";
    return undefined;
  };
  const updateArtifact = (index: number, patch: Partial<ArtifactDraft>) => setForm((current) => current && ({ ...current, artifacts: current.artifacts.map((value, position) => position === index ? { ...value, ...patch } : value) }));

  return (
    <MainLayout pathName={{ student: "Student", submission: item.milestoneTitle }}>
      <div className="mx-auto grid max-w-5xl gap-5">
        <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Back</Button>
        <Card className="border-primary/20"><CardHeader><div className="flex flex-wrap justify-between gap-3"><div><CardTitle>{item.milestoneTitle}</CardTitle><CardDescription>Student submission · Version {item.currentVersionNumber} · Attempt {item.submissionAttempts + 1}{item.maxSubmissionAttempts ? `/${item.maxSubmissionAttempts}` : ""}</CardDescription></div><SubmissionStatusBadge status={item.status} /></div></CardHeader></Card>
        {error ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Check the submission</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        <Card><CardHeader><CardTitle>Submission content</CardTitle><CardDescription>Save as draft at any time. Only “Submit to reviewer” locks this version.</CardDescription></CardHeader><CardContent className="grid gap-4"><div className="grid gap-2"><Label>Submission title</Label><Input maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div><div className="grid gap-2"><Label>Summary of work and changes</Label><Textarea rows={5} maxLength={2000} value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div></CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Artifacts</CardTitle><CardDescription>Add repository, documentation and demo links.</CardDescription></div><Button variant="outline" size="sm" onClick={() => setForm({ ...form, artifacts: [...form.artifacts, { type: "OTHER", name: "", url: "" }] })}><Plus className="size-4" /> Add link</Button></div></CardHeader><CardContent className="grid gap-3">{form.artifacts.length ? form.artifacts.map((artifact, index) => <div key={index} className="grid gap-3 rounded-xl border p-3 md:grid-cols-[170px_1fr_1.4fr_auto]"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={artifact.type} onChange={(event) => updateArtifact(index, { type: event.target.value as SubmissionArtifactType })}><option value="REPOSITORY">Repository</option><option value="DOCUMENTATION">Documentation</option><option value="DEMO">Demo</option><option value="OTHER">Other</option></select><Input value={artifact.name} placeholder="Artifact name" onChange={(event) => updateArtifact(index, { name: event.target.value })} /><Input type="url" value={artifact.url} placeholder="https://..." onChange={(event) => updateArtifact(index, { url: event.target.value })} /><Button variant="ghost" size="icon" aria-label="Remove artifact" onClick={() => setForm({ ...form, artifacts: form.artifacts.filter((_, position) => position !== index) })}><Trash2 className="size-4" /></Button></div>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Link2 className="mx-auto mb-2 size-6" />No artifact links yet.</div>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Acceptance checklist</CardTitle><CardDescription>These criteria are assessed and checked by the reviewer after submission.</CardDescription></CardHeader><CardContent className="grid gap-3">{item.currentVersion.checklist.map((checklist, index) => <div key={checklist.id ?? index} className="rounded-xl border p-3"><span className="font-medium">{checklist.content}</span>{checklist.mandatory ? <span className="ml-2 text-sm text-muted-foreground">Required</span> : null}</div>)}</CardContent></Card>
        <SubmissionVersionHistory item={item} />
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end"><Button variant="outline" disabled={saveDraft.isPending || submit.isPending} onClick={() => { const issue = validate(); setError(issue); if (!issue) saveDraft.mutate({ item, payload: form }); }}><Save className="size-4" /> {saveDraft.isPending ? "Saving..." : "Save draft"}</Button><Button disabled={saveDraft.isPending || submit.isPending} onClick={() => { const issue = validate(); setError(issue); if (!issue) setConfirmSubmit(true); }}><Send className="size-4" /> Submit to reviewer</Button></div>
      </div>
      <ConfirmDialog open={confirmSubmit} title={`Submit version ${item.currentVersionNumber} to reviewer?`} description="The version becomes immutable and a new review round starts. Late penalty is calculated at submission time." confirmLabel="Submit to reviewer" loadingLabel="Submitting..." destructive={false} loading={submit.isPending} onCancel={() => !submit.isPending && setConfirmSubmit(false)} onConfirm={() => submit.mutate({ item, payload: form })} />
    </MainLayout>
  );
}
