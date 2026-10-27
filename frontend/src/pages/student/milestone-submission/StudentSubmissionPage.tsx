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
        <Button variant="ghost" className="w-fit" onClick={() => navigate("/student/milestone-submissions")}><ArrowLeft className="size-4" /> Quay lại bài nộp của tôi</Button>
        <Alert className="border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"><RotateCcw /><AlertTitle>Reviewer yêu cầu chỉnh sửa</AlertTitle><AlertDescription>Version {item.currentVersionNumber} được giữ nguyên. Hãy đọc feedback và chuẩn bị Version {item.currentVersionNumber + 1} trước khi cửa sổ nộp lại đóng.</AlertDescription></Alert>
        <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.milestoneTitle}</CardTitle><CardDescription>{item.teamName} · Version {item.currentVersionNumber}</CardDescription></div><SubmissionStatusBadge status={item.status} /></div></CardHeader><CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-2"><CalendarClock className="size-4" /> Deadline: {new Date(item.deadline).toLocaleString("vi-VN")}</span>{item.lateUntil ? <span>Late policy đóng: {new Date(item.lateUntil).toLocaleString("vi-VN")}</span> : null}<span>Lần nộp: {item.submissionAttempts}{item.maxSubmissionAttempts ? `/${item.maxSubmissionAttempts}` : ""}</span></CardContent></Card>
        {latestFeedback ? <Card className="border-amber-500/40"><CardHeader><CardTitle>Hướng dẫn chỉnh sửa</CardTitle><CardDescription className="whitespace-pre-wrap text-foreground">{latestFeedback.overallFeedback || "Hãy xử lý các feedback theo từng tiêu chí bên dưới."}</CardDescription></CardHeader><CardContent className="grid gap-2">{latestFeedback.evaluations.filter((value) => value.feedback).map((value) => <div key={value.criterionId} className="rounded-lg bg-muted/50 p-3"><p className="font-medium">{value.criterionName}</p><p className="whitespace-pre-wrap text-sm text-muted-foreground">{value.feedback}</p></div>)}</CardContent></Card> : null}
        <Card><CardHeader><CardTitle>Chuẩn bị Version {item.currentVersionNumber + 1}</CardTitle><CardDescription>Form artifact sẽ tạo sản phẩm mới; version đã review không bị thay đổi.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{item.availableActions.createNextVersion ? "Bạn vẫn còn thời gian và lượt nộp lại." : "Cửa sổ nộp lại đã đóng hoặc đã hết số lần nộp."}</p><Button disabled={!item.availableActions.createNextVersion} onClick={() => navigate(artifactPath)}><RotateCcw className="size-4" /> Chuẩn bị bài nộp lại</Button></CardContent></Card>
      </div>
    </MainLayout>
  );

  if (item.status !== "DRAFT" || !form) return (
    <MainLayout pathName={{ student: "Student", submission: item.milestoneTitle }}>
      <div className="mx-auto grid max-w-5xl gap-5"><Button variant="ghost" className="w-fit" onClick={() => navigate("/student/milestone-submissions")}><ArrowLeft className="size-4" /> Quay lại bài nộp của tôi</Button><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{item.milestoneTitle}</CardTitle><CardDescription>Version {item.currentVersionNumber} chỉ đọc vì đã được nộp.</CardDescription></div><SubmissionStatusBadge status={item.status} /></div></CardHeader><CardContent className="grid gap-4 text-sm"><p className="whitespace-pre-wrap"><strong>Ghi chú:</strong> {item.currentVersion.notes || "—"}</p>{item.product ? <div className="grid gap-2 rounded-lg border p-3"><p><strong>Repository:</strong> {item.product.repositoryUrl ? <a className="text-primary underline" href={item.product.repositoryUrl} target="_blank" rel="noreferrer">{item.product.repositoryUrl} <ExternalLink className="inline size-3" /></a> : "—"}</p><p><strong>Deployment:</strong> {item.product.deploymentUrl ? <a className="text-primary underline" href={item.product.deploymentUrl} target="_blank" rel="noreferrer">{item.product.deploymentUrl} <ExternalLink className="inline size-3" /></a> : "—"}</p><p><strong>Release notes:</strong> {item.product.releaseNotes || "—"}</p><p><strong>Tệp đính kèm:</strong> {item.product.attachments.length}</p></div> : null}</CardContent></Card>{latestFeedback ? <Card><CardHeader><CardTitle>Feedback gần nhất</CardTitle><CardDescription className="whitespace-pre-wrap">{latestFeedback.overallFeedback || "Không có feedback tổng quan."}</CardDescription></CardHeader></Card> : null}</div>
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
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end"><Button variant="outline" disabled={saveDraft.isPending || submit.isPending} onClick={() => { const issue = validate(); setError(issue); if (!issue) saveDraft.mutate({ item, payload: form }); }}><Save className="size-4" /> {saveDraft.isPending ? "Saving..." : "Save draft"}</Button><Button disabled={saveDraft.isPending || submit.isPending} onClick={() => { const issue = validate(); setError(issue); if (!issue) setConfirmSubmit(true); }}><Send className="size-4" /> Submit to reviewer</Button></div>
      </div>
      <ConfirmDialog open={confirmSubmit} title={`Submit version ${item.currentVersionNumber} to reviewer?`} description="The version becomes immutable and a new review round starts. Late penalty is calculated at submission time." confirmLabel="Submit to reviewer" loadingLabel="Submitting..." destructive={false} loading={submit.isPending} onCancel={() => !submit.isPending && setConfirmSubmit(false)} onConfirm={() => submit.mutate({ item, payload: form })} />
    </MainLayout>
  );
}
