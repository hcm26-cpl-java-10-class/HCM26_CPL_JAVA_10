import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  RotateCw,
  Save,
} from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactSubmissionPreviewDialog } from "./components/ArtifactSubmissionPreviewDialog";
import { ArtifactSubmissionReference } from "./components/ArtifactSubmissionReference";
import styles from "./components/ArtifactSubmissionLayout.module.css";
import { ArtifactReviewStatusBadge } from "./components/ArtifactReviewStatusBadge";
import { countReleaseNoteCharacters, RELEASE_NOTES_MAX_CHARACTERS, releaseNotesWithinLimit } from "@/lib/release-notes";
import { artifactFormSource } from "@/lib/artifact-form-source";

function submissionErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (!response) return "Could not connect to the server. The submission was not confirmed; check your connection and try again.";

  const data = response.data as { message?: unknown; errors?: unknown } | undefined;
  if (data?.errors && typeof data.errors === "object") {
    const details = Object.values(data.errors as Record<string, unknown>)
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === "string");
    if (details.length) return details.join(" ");
  }
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  switch (response.status) {
    case 401: return "Your session has expired. Sign in again.";
    case 403: return "You are not allowed to submit artifacts for this milestone.";
    case 404: return "The team or milestone could not be found.";
    case 409: return "The milestone or draft changed. Refresh the page and try again.";
    default: return `Submission failed (HTTP ${response.status}). Check the details and try again.`;
  }
}

function isValidHttpUrl(string: string): boolean {
  if (!string.trim()) return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function TeamArtifactSubmissionPage() {
  const { teamId: rawTeamId, milestoneId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  const teamId = Number(rawTeamId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [saveSuccessTime, setSaveSuccessTime] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [clientValidationError, setClientValidationError] = useState<string | null>(null);
  const [renderedAt, setRenderedAt] = useState(0);

  const submitKey = useRef<string | null>(null);
  const submissionInFlight = useRef(false);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const initializedFormScope = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setRenderedAt(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, [teamId, milestoneId]);

  const query = useQuery({
    queryKey: ["team-artifact-workspace", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamArtifactWorkspace(teamId, milestoneId),
    enabled: teamId > 0 && !!milestoneId,
    retry: false,
  });

  useEffect(() => {
    if (!query.data) return;
    const scope = `${teamId}:${milestoneId}`;
    if (initializedFormScope.current === scope) return;
    initializedFormScope.current = scope;
    const d = query.data.draft;
    const source = artifactFormSource(d, query.data.latestSubmission);
    setRepositoryUrl(source?.repositoryUrl ?? "");
    setDeploymentUrl(source?.deploymentUrl ?? "");
    setReleaseNotes(source?.releaseNotes ?? "");
    setChecklist(
      Object.fromEntries(
        query.data.milestone.checklist.map((x) => [x.id, source === d ? d?.checklist[x.id] ?? false : false])
      )
    );
  }, [query.data, teamId, milestoneId]);

  const save = useMutation({
    mutationFn: () =>
      milestoneApi.saveTeamArtifactDraft(teamId, milestoneId, {
        repositoryUrl: repositoryUrl.trim(),
        deploymentUrl: deploymentUrl.trim(),
        releaseNotes: releaseNotes.trim(),
        checklist,
        expectedVersion: query.data?.draft?.version,
      }),
    onSuccess: () => {
      const timeStr = new Date().toLocaleTimeString();
      setSaveSuccessTime(timeStr);
      toast.success("Draft saved successfully.");
      void qc.invalidateQueries({ queryKey: ["team-artifact-workspace", teamId, milestoneId] });
      navigate(`/student/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`);
    },
    onError: () => {
      toast.error("Could not save the draft. Try again.");
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      milestoneApi.submitTeamArtifact(
        teamId,
        milestoneId,
        {
          repositoryUrl: repositoryUrl.trim(),
          deploymentUrl: deploymentUrl.trim(),
          releaseNotes: releaseNotes.trim(),
          checklist,
          attachmentIds: [],
        },
        submitKey.current ?? (submitKey.current = crypto.randomUUID())
      ),
    onSuccess: (data) => {
      submitKey.current = null;
      setPreviewOpen(false);
      // Retain the accepted response even if refreshing the workspace fails.
      qc.setQueryData<Awaited<ReturnType<typeof milestoneApi.getTeamArtifactWorkspace>>>(
        ["team-artifact-workspace", teamId, milestoneId],
        (current) => current ? {
          ...current,
          milestone: { ...current.milestone, lifecycleStatus: "SUBMITTED" },
          latestSubmission: data,
          canSubmit: false,
        } : current,
      );
      void qc.invalidateQueries({ queryKey: ["team-artifact-submissions-workspace", teamId] });
      void qc.invalidateQueries({ queryKey: ["my-team-milestone-submissions", teamId, milestoneId] });
      void qc.invalidateQueries({ queryKey: ["student-team-artifact-workspace", teamId, milestoneId] });
      void qc.invalidateQueries({ queryKey: ["my-milestone-submissions"] });
      toast.success(`Version ${data.version} submitted successfully.`);
      return qc.invalidateQueries({ queryKey: ["team-artifact-workspace", teamId, milestoneId] });
    },
    onError: (err) => {
      toast.error(submissionErrorMessage(err));
    },
    onSettled: () => {
      submissionInFlight.current = false;
    },
  });

  const edited = () => {
    submitKey.current = null;
    setSaveSuccessTime(null);
    setClientValidationError(null);
    if (submit.isError) submit.reset();
  };

  const handleValidateAndOpenPreview = () => {
    setClientValidationError(null);
    if (!releaseNotesWithinLimit(releaseNotes)) {
      setClientValidationError(`Release notes cannot exceed ${RELEASE_NOTES_MAX_CHARACTERS} characters.`);
      return;
    }
    const repo = repositoryUrl.trim();
    const deploy = deploymentUrl.trim();

    if (!repo && !deploy) {
      setClientValidationError("Provide a Repository URL or a Deployment URL before submitting.");
      return;
    }
    if (repo && !isValidHttpUrl(repo)) {
      setClientValidationError("Repository URL is invalid. Enter a URL starting with http:// or https://.");
      return;
    }
    if (deploy && !isValidHttpUrl(deploy)) {
      setClientValidationError("Deployment URL is invalid. Enter a URL starting with http:// or https://.");
      return;
    }

    setPreviewOpen(true);
  };

  const handleConfirmSubmit = () => {
    if (submissionInFlight.current || submit.isPending) return;
    submissionInFlight.current = true;
    submit.mutate();
  };

  const handleBack = () => {
    if (workspaceId) {
      navigate(`/management/workspaces/${encodeURIComponent(workspaceId)}?tab=artifacts`);
    } else {
      navigate(-1);
    }
  };

  if (query.isPending) {
    return (
      <MainLayout pathName={{ milestones: "Milestones", submit: "Submit artifact" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="mr-2 size-5 animate-spin" /> Loading milestone details...
        </div>
      </MainLayout>
    );
  }

  if (!query.data) {
    return (
      <MainLayout pathName={{ milestones: "Milestones", submit: "Submit artifact" }}>
        <main className="mx-auto max-w-4xl p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="size-5" /> Could not load milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The milestone could not be found, or you do not have access to this team.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => void query.refetch()}>
                  <RotateCw className="mr-2 size-4" /> Try again
                </Button>
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 size-4" /> Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </MainLayout>
    );
  }

  const m = query.data.milestone;
  const draft = query.data.draft;
  const latestSubmission = query.data.latestSubmission;
  const canSubmit = query.data.canSubmit;
  const canSaveDraft = ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(m.lifecycleStatus);
  const deadlineDate = new Date(m.deadline);
  const isPastDeadline = renderedAt > 0 && renderedAt > deadlineDate.getTime();
  const reviewStatus = m.lifecycleStatus === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : latestSubmission?.status ?? m.lifecycleStatus;

  return (
    <MainLayout
      contentClassName="bg-slate-50/80 dark:bg-background"
      pathName={{
        milestones: "Milestones",
        [m.id]: m.title,
        submit: "Submit artifact",
      }}
    >
      <main className={styles.shell}>
        <header className="mb-5 space-y-4">
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground" onClick={handleBack}>
            <ArrowLeft className="size-4" /> {workspaceId ? "Back to workspace" : "Go back"}
          </Button>
          <div className="flex flex-col items-start gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <h1 ref={previewHeadingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">Submit artifact</h1>
              <h2 className="break-words text-base font-medium [overflow-wrap:anywhere]">{m.title}</h2>
              <p className="max-w-2xl break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{m.description || "Prepare your team's deliverable for review."}</p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <ArtifactReviewStatusBadge status={reviewStatus} />
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-3.5 shrink-0" />Deadline: {deadlineDate.toLocaleString()}</p>
              {isPastDeadline && <span className="text-xs text-muted-foreground">Deadline passed - Late policy applies</span>}
            </div>
          </div>
        </header>
        <div className={styles.layout}>
        <div className="min-w-0 space-y-4">
          {draft && artifactFormSource(draft, latestSubmission) === draft && (
            <div role="status" className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <Save className="mt-0.5 size-4 shrink-0 text-blue-600" />
              <div className="min-w-0 text-sm"><p className="font-medium">Saved draft loaded <span className="font-normal text-blue-700 dark:text-blue-300">- Draft v{draft.version}</span></p><p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">Saved {new Date(draft.updatedAt).toLocaleString()}. Continue editing below.</p></div>
            </div>
          )}
          {latestSubmission && (
            <div role="status" className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-medium"><FileCheck2 className="size-4 text-blue-600" />Previously submitted <span className="text-blue-600">v{latestSubmission.version}</span></p><Badge variant="outline" className={latestSubmission.submittedLate ? "border-amber-200 text-amber-800 dark:text-amber-200" : "border-emerald-200 text-emerald-700 dark:text-emerald-300"}>{latestSubmission.submittedLate ? "Submitted late" : "Submitted on time"}</Badge></div>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(latestSubmission.submittedAt).toLocaleString()} - Submission receipt is separate from the review outcome.</p>
              {canSubmit && <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">Update your artifact below to prepare version {latestSubmission.version + 1}.</p>}
              {artifactFormSource(draft, latestSubmission) === latestSubmission && <p className="mt-2 text-xs text-muted-foreground">The form starts with this version's links and release notes.</p>}
            </div>
          )}
          {submit.isSuccess && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><CheckCircle2 className="size-4" /><AlertTitle>Version {submit.data.version} submitted</AlertTitle><AlertDescription>The version has been received. See the review status above for the evaluation outcome.</AlertDescription></Alert>}
          {saveSuccessTime && <p role="status" className="text-sm text-blue-700">Draft saved at {saveSuccessTime}.</p>}

        {/* Artifact Form Card (Fix Bug #23) */}
        <Card className="min-w-0 gap-5 overflow-hidden py-0">
          <CardHeader className="gap-2 border-b bg-muted/20 px-5 py-5">
            <CardTitle className="text-base">Submission details <span className="text-blue-600">(Version {latestSubmission ? latestSubmission.version + 1 : 1})</span></CardTitle>
            <CardDescription>
              Add repository and deployment links, then describe this release.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 px-5 pb-5">
            {/* Repository URL */}
            <div className="space-y-1.5">
              <label htmlFor="artifact-repository" className="flex flex-wrap items-center justify-between gap-1 text-sm font-medium">
                <span>Repository URL</span>
                <span className="text-xs text-muted-foreground font-normal">Git repository (GitHub, GitLab, etc.)</span>
              </label>
              <Input
                id="artifact-repository"
                disabled={save.isPending || submit.isPending}
                aria-invalid={Boolean(clientValidationError && repositoryUrl.trim() && !isValidHttpUrl(repositoryUrl))}
                placeholder="https://github.com/organization/repository"
                value={repositoryUrl}
                onChange={(e) => {
                  edited();
                  setRepositoryUrl(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                HTTP(S) links only. Your reviewer verifies repository access and content.
              </p>
            </div>

            {/* Deployment URL */}
            <div className="space-y-1.5">
              <label htmlFor="artifact-deployment" className="flex flex-wrap items-center justify-between gap-1 text-sm font-medium">
                <span>Deployment URL</span>
                <span className="text-xs text-muted-foreground font-normal">Live demo or staging environment</span>
              </label>
              <Input
                id="artifact-deployment"
                disabled={save.isPending || submit.isPending}
                aria-invalid={Boolean(clientValidationError && deploymentUrl.trim() && !isValidHttpUrl(deploymentUrl))}
                placeholder="https://my-app.vercel.app"
                value={deploymentUrl}
                onChange={(e) => {
                  edited();
                  setDeploymentUrl(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Use an HTTP(S) demo or staging URL. Access is not verified automatically.
              </p>
            </div>

            {/* Validation Rule Notice */}
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Required: at least one link.</strong> Add a repository or deployment URL before submitting. Both fields may be left empty when saving a draft.
            </div>

            {/* Release notes */}
            <div className="space-y-1.5">
              <label htmlFor="artifact-release-notes" className="text-sm font-medium">Release notes</label>
              <Textarea
                maxLength={RELEASE_NOTES_MAX_CHARACTERS}
                id="artifact-release-notes"
                disabled={save.isPending || submit.isPending}
                placeholder="Summarize the changes included in this version..."
                value={releaseNotes}
                rows={7}
                className="h-44 min-h-44 max-h-44 resize-none overflow-y-auto overscroll-contain text-sm leading-relaxed"
                onChange={(e) => {
                  edited();
                  if (!releaseNotesWithinLimit(e.target.value) && countReleaseNoteCharacters(e.target.value) > countReleaseNoteCharacters(releaseNotes)) {
                    setClientValidationError(`Release notes are limited to ${RELEASE_NOTES_MAX_CHARACTERS} characters (${countReleaseNoteCharacters(releaseNotes)}/${RELEASE_NOTES_MAX_CHARACTERS} used).`);
                    return;
                  }
                  setReleaseNotes(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">{countReleaseNoteCharacters(releaseNotes)}/{RELEASE_NOTES_MAX_CHARACTERS} characters</p>
            </div>

            {/* Rejected Alert (Fix Bug #31) */}
            {latestSubmission?.status === "REJECTED" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
              <AlertTitle>Submission rejected (REJECTED — 0 points)</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  The reviewer rejected this milestone submission (0 points). The team cannot resubmit or edit its draft.
                </AlertDescription>
              </Alert>
            )}

            {/* Amber Alert ONLY when submission is truly blocked (Fix Bug #29) */}
            {!canSubmit && !latestSubmission && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <AlertCircle className="size-4" />
              <AlertTitle>Submissions are not open</AlertTitle>
              <AlertDescription className="text-xs mt-1">{query.data.submissionBlockReason ?? "Submission is available while the milestone is in progress or when a reviewer requests changes within the allowed submission window."}</AlertDescription>
              </Alert>
            )}

            {/* Client validation error */}
            {clientValidationError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Check the submission details</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {clientValidationError}
                </AlertDescription>
              </Alert>
            )}

            {/* Server submission error */}
            {submit.isError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Submission failed</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {submissionErrorMessage(submit.error)}
                </AlertDescription>
              </Alert>
            )}

            {save.isError && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>Draft could not be saved</AlertTitle><AlertDescription>{submissionErrorMessage(save.error)}</AlertDescription></Alert>}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                disabled={save.isPending || submit.isPending || !canSaveDraft || !releaseNotesWithinLimit(releaseNotes) || latestSubmission?.status === "REJECTED"}
                onClick={() => save.mutate()}
              >
                {save.isPending ? (
                  <>
                    <RotateCw className="mr-2 size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" /> Save draft
                  </>
                )}
              </Button>

              <Button
                ref={previewTriggerRef}
                disabled={submit.isPending || save.isPending || !canSubmit || !releaseNotesWithinLimit(releaseNotes) || latestSubmission?.status === "REJECTED"}
                onClick={handleValidateAndOpenPreview}
              >
                <Eye className="mr-2 size-4" /> {latestSubmission ? "Submit new version (v" + (latestSubmission.version + 1) + ")" : "Preview & submit"}
              </Button>

              <Button variant="ghost" onClick={handleBack}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
        <ArtifactSubmissionReference checklist={m.checklist} rubric={m.rubric} />
        </div>

        <ArtifactSubmissionPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onConfirm={handleConfirmSubmit}
          triggerRef={previewTriggerRef}
          fallbackFocusRef={previewHeadingRef}
          version={latestSubmission ? latestSubmission.version + 1 : 1}
          milestoneTitle={m.title}
          deadline={deadlineDate.toLocaleString()}
          checklist={m.checklist}
          repositoryUrl={repositoryUrl}
          deploymentUrl={deploymentUrl}
          releaseNotes={releaseNotes}
          pastDeadline={isPastDeadline}
          pending={submit.isPending}
          error={submit.isError ? submissionErrorMessage(submit.error) : null}
        />
      </main>
    </MainLayout>
  );
}
