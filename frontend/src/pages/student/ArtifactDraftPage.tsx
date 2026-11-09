import { milestoneApi, milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactSubmissionPreviewDialog } from "./components/ArtifactSubmissionPreviewDialog";
import { ArtifactSubmissionReference } from "./components/ArtifactSubmissionReference";
import styles from "./components/ArtifactSubmissionLayout.module.css";
import { ArtifactReviewStatusBadge } from "./components/ArtifactReviewStatusBadge";
import { formatTenantDateTime, getMilestoneApiError } from "@/pages/management/project/milestone/milestone.utils";
import { countReleaseNoteCharacters, RELEASE_NOTES_MAX_CHARACTERS, releaseNotesWithinLimit } from "@/lib/release-notes";
import { artifactFormSource } from "@/lib/artifact-form-source";
import type { ArtifactAttachment, ArtifactDraftRequest, ArtifactSubmission, ArtifactSubmissionRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, FileUp, RotateCcw, Save, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

type PendingArtifactSubmission = { key: string; payload: ArtifactSubmissionRequest };

const artifactFieldName: Record<string, string> = {
  repositoryUrl: "Repository URL",
  deploymentUrl: "Deployment URL",
  releaseNotes: "Release notes",
  checklist: "Acceptance checklist",
  expectedVersion: "Draft version",
};

export default function ArtifactDraftPage() {
  const { projectId, milestoneId } = useParams<{ projectId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  const queryClient = useQueryClient();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [releaseNotesError, setReleaseNotesError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<ArtifactAttachment[]>([]);
  const [draftVersion, setDraftVersion] = useState<number | undefined>();
  const [reviewing, setReviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState(() => Date.now());
  const [restoredPending, setRestoredPending] = useState<PendingArtifactSubmission | null>(null);
  const [saved, setSaved] = useState(false);
  const [submission, setSubmission] = useState<ArtifactSubmission | null>(null);
  const idempotencyKey = useRef<string | undefined>(undefined);
  const pendingSubmission = useRef<PendingArtifactSubmission | null>(null);
  const [initializedFormScope, setInitializedFormScope] = useState<string | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);

  const pendingStorageKey = projectId && milestoneId
    ? "artifact-submit-pending:" + projectId + ":" + milestoneId
    : null;
  const reviewSubmissionId = searchParams.get("reviewSubmissionId");

  const reviewSubmissionQuery = useQuery({
    queryKey: ["student-submission", reviewSubmissionId],
    queryFn: () => milestoneSubmissionApi.getMyDetail(reviewSubmissionId as string),
    enabled: Boolean(reviewSubmissionId),
    retry: false,
  });

  const workspaceQuery = useQuery({
    queryKey: ["artifact-submission-workspace", projectId, milestoneId],
    queryFn: () => milestoneApi.getArtifactWorkspace(projectId as string, milestoneId as string),
    enabled: Boolean(projectId && milestoneId),
    retry: false,
  });

  useEffect(() => {
    pendingSubmission.current = restoredPending;
    idempotencyKey.current = restoredPending?.key;
  }, [restoredPending, initializedFormScope]);

  if (workspaceQuery.data && initializedFormScope !== pendingStorageKey) {
    setInitializedFormScope(pendingStorageKey);
    const { draft, milestone } = workspaceQuery.data;
    let pending: PendingArtifactSubmission | null = null;
    if (pendingStorageKey) {
      try {
        const raw = sessionStorage.getItem(pendingStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PendingArtifactSubmission>;
          if (typeof parsed.key === "string" && parsed.payload) {
            pending = { key: parsed.key, payload: parsed.payload };
          }
        }
      } catch {
        try { sessionStorage.removeItem(pendingStorageKey); } catch { /* Storage may be disabled by the browser. */ }
      }
    }
    if (pending?.key && pending.payload) {
      setRestoredPending(pending);
      setRepositoryUrl(pending.payload.repositoryUrl ?? "");
      setDeploymentUrl(pending.payload.deploymentUrl ?? "");
      setReleaseNotes(pending.payload.releaseNotes ?? "");
      setDraftVersion(draft?.version);
      setAttachments(draft?.attachments ?? []);
      setChecklist(Object.fromEntries(milestone.checklist.map((item) => [
        item.id, pending.payload.checklist?.[item.id] ?? false,
      ])));
      setSubmission(workspaceQuery.data.latestSubmission);
      setReviewing(true);
    } else {
    setRestoredPending(null);
    const source = artifactFormSource(draft, workspaceQuery.data.latestSubmission);
    setRepositoryUrl(source?.repositoryUrl ?? "");
    setDeploymentUrl(source?.deploymentUrl ?? "");
    setReleaseNotes(source?.releaseNotes ?? "");
    setDraftVersion(draft?.version);
    setAttachments(draft?.attachments ?? []);
    setChecklist(Object.fromEntries(milestone.checklist.map((item) => [item.id, source === draft ? draft?.checklist[item.id] ?? false : false])));
    setSubmission(workspaceQuery.data.latestSubmission);
    }
  }

  const saveMutation = useMutation({
    mutationFn: (payload: ArtifactDraftRequest) => milestoneApi.saveArtifactDraft(projectId as string, milestoneId as string, payload),
    onSuccess: async (draft) => {
      setDraftVersion(draft.version);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["artifact-submission-workspace", projectId, milestoneId] });
      const teamId = workspaceQuery.data?.milestone.teamId;
      if (teamId) {
        navigate(`/student/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`);
      }
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => milestoneApi.uploadArtifact(projectId as string, milestoneId as string, file),
    onSuccess: (attachment) => {
      setAttachments((current) => [...current, attachment]);
      setDraftVersion(attachment.draftVersion);
    },
  });

  const submissionMutation = useMutation({
    onSettled: () => { submittingRef.current = false; },
    mutationFn: ({ payload, key }: { payload: ArtifactSubmissionRequest; key: string }) =>
      milestoneApi.submitArtifact(projectId as string, milestoneId as string, payload, key),
    onSuccess: (result) => {
      queryClient.setQueryData<Awaited<ReturnType<typeof milestoneApi.getArtifactWorkspace>>>(["artifact-submission-workspace", projectId, milestoneId], current => current ? { ...current, canSubmit: false, latestSubmission: result, milestone: { ...current.milestone, lifecycleStatus: "SUBMITTED" } } : current);
      setSubmission(result);
      setReviewing(false);
      idempotencyKey.current = undefined;
      pendingSubmission.current = null;
      if (pendingStorageKey) {
        try { sessionStorage.removeItem(pendingStorageKey); } catch { /* Storage may be disabled by the browser. */ }
      }
      void queryClient.invalidateQueries({ queryKey: ["my-milestone-submissions"] });
      if (reviewSubmissionId) void queryClient.invalidateQueries({ queryKey: ["student-submission", reviewSubmissionId] });
    },
  });

  const milestone = workspaceQuery.data?.milestone;
  if (workspaceQuery.isPending) return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", submit: "Submit artifact" }}><div className="mx-auto grid max-w-5xl gap-5"><Skeleton className="h-32" /><Skeleton className="h-72" /><Skeleton className="h-48" /></div></MainLayout>;

  if (workspaceQuery.isError || !milestone) {
    const error = getMilestoneApiError(workspaceQuery.error);
    const title = error.status === 401 ? "Your session has expired" : error.status === 403 ? "You do not have access to this milestone" : error.status === 404 ? "Milestone not found" : "Could not load milestone details or draft";
    const description = error.status === 401 ? "Sign in again, then reopen this page." : error.status === 403 ? "Return to the previous page or request access to this project." : error.status === 404 ? "This milestone does not exist in the selected project." : "The data could not be loaded, so the form is unavailable. Try again.";
    return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", submit: "Submit artifact" }}>
      <Alert variant="destructive" className="mx-auto max-w-3xl"><AlertCircle /><AlertTitle>{title}</AlertTitle><AlertDescription>{description}
        <div className="mt-4 flex gap-2"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Go back</Button>{error.status !== 403 && error.status !== 404 && <Button onClick={() => void workspaceQuery.refetch()}>Try again</Button>}</div>
      </AlertDescription></Alert>
    </MainLayout>;
  }

  const submitDraft = () => {
    if (!releaseNotesWithinLimit(releaseNotes)) {
      setReleaseNotesError(`Release notes cannot exceed ${RELEASE_NOTES_MAX_CHARACTERS} characters.`);
      return;
    }
    setReleaseNotesError(null);
    setSaved(false);
    saveMutation.mutate({ repositoryUrl: repositoryUrl.trim() || undefined, deploymentUrl: deploymentUrl.trim() || undefined,
      releaseNotes: releaseNotes.trim() || undefined, checklist, expectedVersion: draftVersion });
  };

  const submitOfficially = () => {
    if (submittingRef.current || submissionMutation.isPending || saveMutation.isPending || uploadMutation.isPending || !workspaceQuery.data.canSubmit) return;
    if (!releaseNotesWithinLimit(releaseNotes)) {
      setReleaseNotesError(`Release notes cannot exceed ${RELEASE_NOTES_MAX_CHARACTERS} characters.`);
      return;
    }
    setReleaseNotesError(null);
    if (!pendingSubmission.current) {
      const key = idempotencyKey.current ?? crypto.randomUUID();
      idempotencyKey.current = key;
      const payload: ArtifactSubmissionRequest = {
        repositoryUrl: repositoryUrl.trim() || undefined,
        deploymentUrl: deploymentUrl.trim() || undefined,
        releaseNotes: releaseNotes.trim() || undefined,
        checklist,
        attachmentIds: attachments.map((attachment) => attachment.id),
      };
      pendingSubmission.current = { key, payload };
      if (pendingStorageKey) {
        try { sessionStorage.setItem(pendingStorageKey, JSON.stringify(pendingSubmission.current)); }
        catch { /* The same key and payload are still retained for retries in the active page. */ }
      }
    }
    submittingRef.current = true;
    submissionMutation.mutate({
      key: pendingSubmission.current.key,
      payload: pendingSubmission.current.payload,
    });
  };

  const markSubmissionEdited = () => {
    idempotencyKey.current = undefined;
    pendingSubmission.current = null;
    if (pendingStorageKey) {
      try { sessionStorage.removeItem(pendingStorageKey); } catch { /* Storage may be disabled by the browser. */ }
    }
    submissionMutation.reset();
  };

  const markDraftEdited = () => {
    setSaved(false);
    if (saveMutation.isError) saveMutation.reset();
  };

  const saveError = saveMutation.isError ? getMilestoneApiError(saveMutation.error) : null;
  const submissionError = submissionMutation.isError ? getMilestoneApiError(submissionMutation.error) : null;
  const reviewStatus = submission?.status === "SUBMITTED" && milestone.lifecycleStatus === "SUBMITTED" ? "SUBMITTED" : reviewSubmissionQuery.data?.status ?? submission?.status ?? milestone.lifecycleStatus;
  const canSaveDraft = !submissionMutation.isPending && !saveMutation.isPending && !uploadMutation.isPending && releaseNotesWithinLimit(releaseNotes) && ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus);

  return <MainLayout pathName={{ projects: "Projects", [projectId ?? "project"]: milestone.project.name, milestones: "Milestones", [milestone.id]: milestone.title, submit: "Submit artifact" }} contentClassName="bg-slate-50/80 dark:bg-background">
    <main className={styles.shell}>
      <header className="mb-5 space-y-4">
        <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground" onClick={() => workspaceId ? navigate('/management/workspaces/' + encodeURIComponent(workspaceId) + '?tab=artifacts') : navigate(-1)}><ArrowLeft className="size-4" /> Back to workspace</Button>
        <div className="flex flex-col items-start gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2"><h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">Submit artifact</h1><h2 className="break-words text-base font-medium [overflow-wrap:anywhere]">{milestone.title}</h2><p className="break-words text-sm leading-relaxed text-muted-foreground">{milestone.description || "Prepare your team's deliverable for review."}</p></div>
          <div className="flex flex-col items-start gap-3 sm:items-end"><ArtifactReviewStatusBadge status={reviewStatus} /><p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-3.5 shrink-0" />Deadline: {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</p><Button asChild size="sm" variant="outline"><Link to="/student/milestone-submissions"><Eye className="size-4" /> My submissions</Link></Button></div>
        </div>
      </header>
      <div className={styles.layout}>
      <section className="min-w-0 space-y-4" aria-label="Artifact submission form">
        {workspaceQuery.data.draft && artifactFormSource(workspaceQuery.data.draft, workspaceQuery.data.latestSubmission) === workspaceQuery.data.draft && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:bg-blue-950/30 dark:text-blue-100"><p className="font-medium">Saved draft loaded - Draft v{workspaceQuery.data.draft.version}</p><p className="mt-1 text-xs">Saved {formatTenantDateTime(workspaceQuery.data.draft.updatedAt, milestone.tenantTimeZone)}. Continue editing below.</p></div>}
        {reviewSubmissionQuery.data?.status === "CHANGES_REQUESTED" && <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><RotateCcw /><AlertTitle>Changes requested - Preparing version {reviewSubmissionQuery.data.currentVersionNumber + 1}</AlertTitle><AlertDescription><p className="whitespace-pre-wrap break-words">{reviewSubmissionQuery.data.reviews[0]?.overallFeedback || "Update your work based on the reviewer's feedback."}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => navigate('/student/milestone-submissions/' + reviewSubmissionQuery.data?.id)}>View full feedback</Button></AlertDescription></Alert>}
        {!workspaceQuery.data.canSubmit && !submission && <Alert><AlertCircle /><AlertTitle>Submissions are not open</AlertTitle><AlertDescription>You can prepare and submit an artifact while the milestone is in progress, or resubmit after a reviewer requests changes within the allowed submission window.</AlertDescription></Alert>}
      {saved && <Alert><CheckCircle2 /><AlertTitle>Draft saved</AlertTitle><AlertDescription>Status: DRAFT. This is not an official submission yet.</AlertDescription></Alert>}
      {saveError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Draft could not be saved</AlertTitle><AlertDescription>
        <p>{saveError.status === 422 ? "Some fields are invalid. Correct the details below and save again; your current entries have been kept." : saveError.message || "Try again. Your current entries are still on this page."}</p>
        {saveError.errors && <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(saveError.errors).flatMap(([field, messages]) => messages.map((message, index) => <li key={`${field}-${index}`}><strong>{artifactFieldName[field] ?? field}:</strong> {message}</li>))}</ul>}
      </AlertDescription></Alert>}
      {uploadMutation.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Upload failed</AlertTitle><AlertDescription>{getMilestoneApiError(uploadMutation.error).message || "Try again or choose another file. Your other entries have been kept."}</AlertDescription></Alert>}
      {submission && <Alert><CheckCircle2 /><AlertTitle>Previously submitted - Version {submission.version}</AlertTitle><AlertDescription>
        {formatTenantDateTime(submission.submittedAt, milestone.tenantTimeZone)}.
        {submission.submittedLate ? " Submitted late" + (submission.latePenaltyPercent == null ? "." : ` (${submission.latePenaltyPercent}% penalty).`) : " Submitted on time."}
        {" "}See the review status above for the evaluation outcome.
      </AlertDescription></Alert>}
      {submissionError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Submission failed</AlertTitle><AlertDescription>
        <p>{submissionError.status === 422 ? "Review and correct the validation errors below, then try again." : submissionError.status === 401 ? "Your session has expired. Sign in again; your current entries are kept." : submissionError.status === 403 ? "You are not allowed to submit an artifact in this scope." : submissionError.status === 404 ? "Project or milestone not found." : submissionError.message || "No submission confirmation was received. Retry with the same request key to avoid creating a duplicate version."}</p>
        {submissionError.errors && <ul className="mt-2 list-disc pl-5">{Object.entries(submissionError.errors).flatMap(([field, messages]) => messages.map((message, index) => <li key={field + "-" + index}><strong>{field}:</strong> {message}</li>))}</ul>}
      </AlertDescription></Alert>}

      <Card className="gap-5 overflow-hidden py-0"><CardHeader className="border-b bg-muted/20 px-5 py-5"><CardTitle className="text-base">Submission details</CardTitle><CardDescription>Repository and deployment links are optional individually. At least one valid link is required for official submission; drafts can be saved before the form is complete.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5">
          <label className="grid gap-2 text-sm font-medium">Repository URL<Input disabled={submissionMutation.isPending} type="url" value={repositoryUrl} aria-invalid={Boolean(saveError?.errors?.repositoryUrl)} onChange={(event) => { markSubmissionEdited(); markDraftEdited(); setRepositoryUrl(event.target.value); }} placeholder="https://github.com/..." />{saveError?.errors?.repositoryUrl?.map((message) => <span key={message} className="text-xs font-normal text-destructive">{message}</span>)}</label>
          <label className="grid gap-2 text-sm font-medium">Deployment URL<Input disabled={submissionMutation.isPending} type="url" value={deploymentUrl} aria-invalid={Boolean(saveError?.errors?.deploymentUrl)} onChange={(event) => { markSubmissionEdited(); markDraftEdited(); setDeploymentUrl(event.target.value); }} placeholder="https://..." />{saveError?.errors?.deploymentUrl?.map((message) => <span key={message} className="text-xs font-normal text-destructive">{message}</span>)}</label>
          <label className="grid gap-2 text-sm font-medium">Release notes<Textarea maxLength={RELEASE_NOTES_MAX_CHARACTERS} disabled={submissionMutation.isPending} value={releaseNotes} aria-invalid={Boolean(releaseNotesError || saveError?.errors?.releaseNotes)} onChange={(event) => { markSubmissionEdited(); markDraftEdited(); if (!releaseNotesWithinLimit(event.target.value) && countReleaseNoteCharacters(event.target.value) > countReleaseNoteCharacters(releaseNotes)) { setReleaseNotesError(`Maximum ${RELEASE_NOTES_MAX_CHARACTERS} characters.`); return; } setReleaseNotesError(releaseNotesWithinLimit(event.target.value) ? null : `Maximum ${RELEASE_NOTES_MAX_CHARACTERS} characters.`); setReleaseNotes(event.target.value); }} placeholder="Summarize the changes in this delivery..." rows={7} className="h-44 min-h-44 max-h-44 resize-none overflow-y-auto overscroll-contain leading-relaxed" /><span className="text-xs font-normal text-muted-foreground">{countReleaseNoteCharacters(releaseNotes)}/{RELEASE_NOTES_MAX_CHARACTERS} characters</span>{releaseNotesError && <span className="text-xs font-normal text-destructive">{releaseNotesError}</span>}{saveError?.errors?.releaseNotes?.map((message) => <span key={message} className="text-xs font-normal text-destructive">{message}</span>)}</label>
          <div className="grid gap-2 text-sm font-medium">Attachments
            <label className={`flex items-center gap-3 rounded-lg border border-dashed p-4 ${workspaceQuery.data.uploadPolicy.enabled ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}>
              <FileUp className="size-5" /><span>{uploadMutation.isPending ? "Scanning and uploading..." : workspaceQuery.data.uploadPolicy.enabled ? "Choose a file to upload" : "File upload is disabled until the team policy and scanner are configured."}</span>
              <input type="file" className="sr-only" disabled={!workspaceQuery.data.uploadPolicy.enabled || uploadMutation.isPending || submissionMutation.isPending}
                accept={workspaceQuery.data.uploadPolicy.allowedMimeTypes.join(",")}
                onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) { markSubmissionEdited(); uploadMutation.mutate(file); } }} />
            </label>
            <span className="text-xs font-normal">Current policy: {workspaceQuery.data.uploadPolicy.enabled ? `${workspaceQuery.data.uploadPolicy.allowedMimeTypes.join(", ")} · maximum ${Math.ceil(workspaceQuery.data.uploadPolicy.maxBytes / 1024 / 1024)} MB` : "disabled"}. Only successfully scanned files appear below.</span>
            {attachments.length > 0 && <ul className="grid gap-2">{attachments.map((attachment) => <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{attachment.fileName}</span><span className="shrink-0 text-xs text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(0)} KB · Scanned</span>
            </li>)}</ul>}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Back</Button><div className="flex flex-wrap gap-2">
        <Button ref={previewTriggerRef} onClick={() => { setPreviewTime(Date.now()); setReviewing(true); }} disabled={!workspaceQuery.data.canSubmit || !releaseNotesWithinLimit(releaseNotes) || submissionMutation.isPending || saveMutation.isPending || uploadMutation.isPending}><Eye /> {reviewing ? "Close preview" : submission ? "Submit new version" : "Preview & submit"}</Button>
        <Button variant="outline" onClick={submitDraft} disabled={!canSaveDraft}><Save /> {saveMutation.isPending ? "Saving..." : "Save draft"}</Button>
      </div></div>
      </section>
      <ArtifactSubmissionReference checklist={milestone.checklist} rubric={milestone.rubric} />
      </div>
      <ArtifactSubmissionPreviewDialog open={reviewing} onOpenChange={setReviewing} onConfirm={submitOfficially} triggerRef={previewTriggerRef} fallbackFocusRef={headingRef}
        version={(submission?.version ?? 0) + 1} milestoneTitle={milestone.title} deadline={formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)} checklist={milestone.checklist}
        repositoryUrl={repositoryUrl} deploymentUrl={deploymentUrl} releaseNotes={releaseNotes} attachments={attachments} pastDeadline={previewTime > Date.parse(milestone.deadline)} pending={submissionMutation.isPending}
        error={releaseNotesError ?? (submissionError ? submissionError.message || "Submission failed. Your entries have been kept; retry when ready." : null)} />
    </main>
  </MainLayout>;
}
