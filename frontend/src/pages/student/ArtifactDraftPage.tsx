import { milestoneApi, milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MilestoneRubricCard } from "@/pages/management/project/milestone/components/MilestoneRubricCard";
import { formatTenantDateTime, getMilestoneApiError } from "@/pages/management/project/milestone/milestone.utils";
import { countReleaseNoteWords, RELEASE_NOTES_MAX_WORDS, releaseNotesWithinLimit } from "@/lib/release-notes";
import { artifactFormSource } from "@/lib/artifact-form-source";
import type { ArtifactAttachment, ArtifactDraftRequest, ArtifactSubmission, ArtifactSubmissionRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, FileUp, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

type PendingArtifactSubmission = { key: string; payload: ArtifactSubmissionRequest };

const artifactFieldName: Record<string, string> = {
  repositoryUrl: "Repository URL",
  deploymentUrl: "Deployment URL",
  releaseNotes: "Release notes",
  checklist: "Acceptance checklist",
  expectedVersion: "Phiên bản bản nháp",
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
  const [releaseNotesWordError, setReleaseNotesWordError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<ArtifactAttachment[]>([]);
  const [draftVersion, setDraftVersion] = useState<number | undefined>();
  const [reviewing, setReviewing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submission, setSubmission] = useState<ArtifactSubmission | null>(null);
  const idempotencyKey = useRef<string | undefined>(undefined);
  const pendingSubmission = useRef<PendingArtifactSubmission | null>(null);
  const initializedFormScope = useRef<string | null>(null);

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
    if (!workspaceQuery.data) return;
    if (initializedFormScope.current === pendingStorageKey) return;
    initializedFormScope.current = pendingStorageKey;
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
      pendingSubmission.current = pending;
      idempotencyKey.current = pending.key;
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
      return;
    }
    pendingSubmission.current = null;
    const source = artifactFormSource(draft, workspaceQuery.data.latestSubmission);
    setRepositoryUrl(source?.repositoryUrl ?? "");
    setDeploymentUrl(source?.deploymentUrl ?? "");
    setReleaseNotes(source?.releaseNotes ?? "");
    setDraftVersion(draft?.version);
    setAttachments(draft?.attachments ?? []);
    setChecklist(Object.fromEntries(milestone.checklist.map((item) => [item.id, source === draft ? draft?.checklist[item.id] ?? false : false])));
    setSubmission(workspaceQuery.data.latestSubmission);
  }, [workspaceQuery.data, pendingStorageKey]);

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
    mutationFn: ({ payload, key }: { payload: ArtifactSubmissionRequest; key: string }) =>
      milestoneApi.submitArtifact(projectId as string, milestoneId as string, payload, key),
    onSuccess: (result) => {
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
  if (workspaceQuery.isPending) return <MainLayout pathName={{ projects: "Dự án", milestones: "Milestone", submit: "Nộp artifact" }}><div className="mx-auto grid max-w-5xl gap-5"><Skeleton className="h-32" /><Skeleton className="h-72" /><Skeleton className="h-48" /></div></MainLayout>;

  if (workspaceQuery.isError || !milestone) {
    const error = getMilestoneApiError(workspaceQuery.error);
    const title = error.status === 401 ? "Phiên đăng nhập hết hạn" : error.status === 403 ? "Bạn không có quyền truy cập milestone này" : error.status === 404 ? "Không tìm thấy milestone" : "Không tải được thông tin milestone hoặc bản nháp";
    const description = error.status === 401 ? "Đăng nhập lại rồi thử mở màn hình này." : error.status === 403 ? "Hãy quay lại hoặc yêu cầu cấp quyền truy cập dự án." : error.status === 404 ? "Milestone không tồn tại trong dự án đã chọn." : "Dữ liệu chưa tải thành công nên chưa thể tạo form mới. Hãy thử tải lại.";
    return <MainLayout pathName={{ projects: "Dự án", milestones: "Milestone", submit: "Nộp artifact" }}>
      <Alert variant="destructive" className="mx-auto max-w-3xl"><AlertCircle /><AlertTitle>{title}</AlertTitle><AlertDescription>{description}
        <div className="mt-4 flex gap-2"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Quay lại</Button>{error.status !== 403 && error.status !== 404 && <Button onClick={() => void workspaceQuery.refetch()}>Thử lại</Button>}</div>
      </AlertDescription></Alert>
    </MainLayout>;
  }

  const submitDraft = () => {
    if (!releaseNotesWithinLimit(releaseNotes)) {
      setReleaseNotesWordError(`Release notes không được vượt quá ${RELEASE_NOTES_MAX_WORDS} từ.`);
      return;
    }
    setReleaseNotesWordError(null);
    setSaved(false);
    saveMutation.mutate({ repositoryUrl: repositoryUrl.trim() || undefined, deploymentUrl: deploymentUrl.trim() || undefined,
      releaseNotes: releaseNotes.trim() || undefined, checklist, expectedVersion: draftVersion });
  };

  const submitOfficially = () => {
    if (!releaseNotesWithinLimit(releaseNotes)) {
      setReleaseNotesWordError(`Release notes không được vượt quá ${RELEASE_NOTES_MAX_WORDS} từ.`);
      return;
    }
    setReleaseNotesWordError(null);
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

  return <MainLayout pathName={{ projects: "Dự án", [projectId ?? "project"]: milestone.project.name, milestones: "Milestone", [milestone.id]: milestone.title, submit: "Chuẩn bị artifact" }}>
    <main className="mx-auto grid w-full max-w-5xl gap-5">
      {reviewSubmissionQuery.data?.status === "CHANGES_REQUESTED" ? <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/20"><RotateCcw /><AlertTitle>Đang chuẩn bị bài nộp lại Version {reviewSubmissionQuery.data.currentVersionNumber + 1}</AlertTitle><AlertDescription><p>{reviewSubmissionQuery.data.reviews[0]?.overallFeedback || "Hãy cập nhật sản phẩm theo feedback của reviewer."}</p><Button className="mt-2" size="sm" variant="outline" onClick={() => navigate(`/student/milestone-submissions/${reviewSubmissionQuery.data?.id}`)}>Xem toàn bộ feedback</Button></AlertDescription></Alert> : null}
      {!workspaceQuery.data.canSubmit && !submission && <Alert><AlertCircle /><AlertTitle>Milestone chưa mở nhận bài</AlertTitle><AlertDescription>Bạn chỉ có thể chuẩn bị và nộp artifact khi milestone đang IN_PROGRESS hoặc được yêu cầu nộp lại và còn trong hạn.</AlertDescription></Alert>}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-background"><CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Trạng thái milestone: {milestone.lifecycleStatus}</span><span>·</span><span>Hạn: {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</span></div><Button asChild size="sm" variant="outline"><Link to="/student/milestone-submissions"><Eye className="size-4" /> Xem bài nộp của tôi</Link></Button></div>
        <CardTitle className="text-2xl">Chuẩn bị sản phẩm: {milestone.title}</CardTitle><CardDescription>{milestone.description}</CardDescription>
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-emerald-600" /> Dữ liệu được kiểm tra quyền truy cập ở backend</div>
      </CardHeader></Card>

      {saved && <Alert><CheckCircle2 /><AlertTitle>Đã lưu bản nháp</AlertTitle><AlertDescription>Trạng thái là DRAFT; chưa phải sản phẩm đã nộp chính thức.</AlertDescription></Alert>}
      {saveError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Bản nháp chưa được lưu</AlertTitle><AlertDescription>
        <p>{saveError.status === 422 ? "Một số thông tin chưa hợp lệ. Hãy sửa các mục bên dưới rồi lưu lại; dữ liệu đang nhập vẫn được giữ nguyên." : saveError.message || "Hãy thử lại. Nội dung bạn nhập vẫn được giữ trên màn hình."}</p>
        {saveError.errors && <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(saveError.errors).flatMap(([field, messages]) => messages.map((message, index) => <li key={`${field}-${index}`}><strong>{artifactFieldName[field] ?? field}:</strong> {message}</li>))}</ul>}
      </AlertDescription></Alert>}
      {uploadMutation.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Tệp chưa tải lên thành công</AlertTitle><AlertDescription>{getMilestoneApiError(uploadMutation.error).message || "Hãy thử lại hoặc chọn tệp khác. Các trường bạn đã nhập vẫn được giữ."}</AlertDescription></Alert>}
      {submission && <Alert><CheckCircle2 /><AlertTitle>Phiên bản đã nộp gần nhất: {submission.version} (SUBMITTED)</AlertTitle><AlertDescription>
        Trạng thái: SUBMITTED · {formatTenantDateTime(submission.submittedAt, milestone.tenantTimeZone)}.
        {submission.submittedLate ? " Sản phẩm được tiếp nhận theo late policy" + (submission.latePenaltyPercent == null ? "." : " (mức khấu trừ " + submission.latePenaltyPercent + "%).") : " Sản phẩm đã được nộp thành công."}
        {" "}Việc duyệt sản phẩm là bước riêng.
      </AlertDescription></Alert>}
      {submissionError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Chưa nộp được sản phẩm</AlertTitle><AlertDescription>
        <p>{submissionError.status === 422 ? "Kiểm tra và sửa các thông tin được nêu bên dưới rồi thử lại." : submissionError.status === 401 ? "Phiên đăng nhập hết hạn. Hãy đăng nhập lại; thông tin đang nhập vẫn được giữ." : submissionError.status === 403 ? "Bạn không có quyền nộp sản phẩm trong phạm vi này." : submissionError.status === 404 ? "Không tìm thấy project hoặc milestone." : submissionError.message || "Không nhận được xác nhận nộp. Hãy thử gửi lại; yêu cầu dùng cùng khóa để tránh tạo phiên bản trùng."}</p>
        {submissionError.errors && <ul className="mt-2 list-disc pl-5">{Object.entries(submissionError.errors).flatMap(([field, messages]) => messages.map((message, index) => <li key={field + "-" + index}><strong>{field}:</strong> {message}</li>))}</ul>}
      </AlertDescription></Alert>}

      <Card><CardHeader><CardTitle>Acceptance checklist</CardTitle><CardDescription>Các tiêu chí này do reviewer đánh giá sau khi bạn nộp sản phẩm.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">{milestone.checklist.length ? milestone.checklist.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            checked={checklist[item.id] ?? false}
            onCheckedChange={(checked) => {
              markSubmissionEdited();
              markDraftEdited();
              setChecklist((prev) => ({ ...prev, [item.id]: Boolean(checked) }));
            }}
            aria-label={`${item.content} — self assessment`}
          />
          <span className="flex-1 text-sm">{item.content}{item.mandatory && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Bắt buộc</span>}</span>
        </div>) : <p className="text-sm text-muted-foreground">Milestone chưa cấu hình checklist.</p>}{saveError?.errors?.checklist?.map((message) => <p key={message} className="text-sm text-destructive">{message}</p>)}</CardContent>
      </Card>

      <MilestoneRubricCard rubric={milestone.rubric} />

      <Card><CardHeader><CardTitle>Thông tin sản phẩm</CardTitle><CardDescription>Các trường không bắt buộc; có thể lưu nháp khi chưa điền đủ.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">Repository URL<Input disabled={submissionMutation.isPending} type="url" value={repositoryUrl} aria-invalid={Boolean(saveError?.errors?.repositoryUrl)} onChange={(event) => { markSubmissionEdited(); markDraftEdited(); setRepositoryUrl(event.target.value); }} placeholder="https://github.com/..." />{saveError?.errors?.repositoryUrl?.map((message) => <span key={message} className="text-xs font-normal text-destructive">{message}</span>)}</label>
          <label className="grid gap-2 text-sm font-medium">Deployment URL<Input disabled={submissionMutation.isPending} type="url" value={deploymentUrl} aria-invalid={Boolean(saveError?.errors?.deploymentUrl)} onChange={(event) => { markSubmissionEdited(); markDraftEdited(); setDeploymentUrl(event.target.value); }} placeholder="https://..." />{saveError?.errors?.deploymentUrl?.map((message) => <span key={message} className="text-xs font-normal text-destructive">{message}</span>)}</label>
          <label className="grid gap-2 text-sm font-medium">Release notes<Textarea disabled={submissionMutation.isPending} value={releaseNotes} aria-invalid={Boolean(releaseNotesWordError || saveError?.errors?.releaseNotes)} onChange={(event) => { markSubmissionEdited(); markDraftEdited(); if (!releaseNotesWithinLimit(event.target.value) && countReleaseNoteWords(event.target.value) > countReleaseNoteWords(releaseNotes)) { setReleaseNotesWordError(`Tối đa ${RELEASE_NOTES_MAX_WORDS} từ.`); return; } setReleaseNotesWordError(releaseNotesWithinLimit(event.target.value) ? null : `Tối đa ${RELEASE_NOTES_MAX_WORDS} từ.`); setReleaseNotes(event.target.value); }} placeholder="Mô tả ngắn nội dung bàn giao" rows={5} className="max-h-40 resize-none overflow-y-auto" /><span className="text-xs font-normal text-muted-foreground">{countReleaseNoteWords(releaseNotes)}/{RELEASE_NOTES_MAX_WORDS} từ</span>{releaseNotesWordError && <span className="text-xs font-normal text-destructive">{releaseNotesWordError}</span>}{saveError?.errors?.releaseNotes?.map((message) => <span key={message} className="text-xs font-normal text-destructive">{message}</span>)}</label>
          <div className="grid gap-2 text-sm font-medium">Tệp đính kèm
            <label className={`flex items-center gap-3 rounded-lg border border-dashed p-4 ${workspaceQuery.data.uploadPolicy.enabled ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}>
              <FileUp className="size-5" /><span>{uploadMutation.isPending ? "Đang kiểm tra và tải tệp…" : workspaceQuery.data.uploadPolicy.enabled ? "Chọn tệp để tải lên" : "Tải tệp đang khóa: policy hoặc scanner chưa được cấu hình."}</span>
              <input type="file" className="sr-only" disabled={!workspaceQuery.data.uploadPolicy.enabled || uploadMutation.isPending || submissionMutation.isPending}
                accept={workspaceQuery.data.uploadPolicy.allowedMimeTypes.join(",")}
                onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) { markSubmissionEdited(); uploadMutation.mutate(file); } }} />
            </label>
            <span className="text-xs font-normal">Policy hiện tại: {workspaceQuery.data.uploadPolicy.enabled ? `${workspaceQuery.data.uploadPolicy.allowedMimeTypes.join(", ")} · tối đa ${Math.ceil(workspaceQuery.data.uploadPolicy.maxBytes / 1024 / 1024)} MB` : "chưa bật"}. Chỉ tệp quét sạch mới xuất hiện bên dưới.</span>
            {attachments.length > 0 && <ul className="grid gap-2">{attachments.map((attachment) => <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{attachment.fileName}</span><span className="shrink-0 text-xs text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(0)} KB · Đã quét sạch</span>
            </li>)}</ul>}
          </div>
        </CardContent>
      </Card>

      {reviewing && <Card className="border-primary/30"><CardHeader><CardTitle>Xem lại sản phẩm sẽ nộp</CardTitle><CardDescription>Xác nhận để tạo một phiên bản SUBMITTED mới. Phiên bản đã nộp trước đây sẽ được giữ nguyên.</CardDescription></CardHeader><CardContent className="grid gap-2 text-sm">
        <p><strong>Repository:</strong> {repositoryUrl || "Chưa cung cấp"}</p><p><strong>Deployment:</strong> {deploymentUrl || "Chưa cung cấp"}</p><p><strong>Tệp:</strong> {attachments.length} tệp đã tải lên và quét sạch</p><div><strong>Checklist ({milestone.checklist.length} tiêu chí, reviewer đánh giá):</strong>{milestone.checklist.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{milestone.checklist.map((item) => <li key={item.id}>{item.content}{item.mandatory ? " (bắt buộc)" : " (không bắt buộc)"}</li>)}</ul> : <span className="ml-1 text-muted-foreground">Không có tiêu chí</span>}</div>
        <Button onClick={submitOfficially} disabled={!workspaceQuery.data.canSubmit || submissionMutation.isPending || uploadMutation.isPending}>
          {submissionMutation.isPending ? "Đang gửi…" : "Xác nhận nộp"}
        </Button>
      </CardContent></Card>}

      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Quay lại</Button><div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setReviewing((value) => !value)} disabled={!workspaceQuery.data.canSubmit || !releaseNotesWithinLimit(releaseNotes) || submissionMutation.isPending}><Eye /> {reviewing ? "Đóng xem trước" : "Review & submit"}</Button>
        <Button onClick={submitDraft} disabled={!workspaceQuery.data.canSubmit || !releaseNotesWithinLimit(releaseNotes) || saveMutation.isPending || submissionMutation.isPending}><Save /> {saveMutation.isPending ? "Đang lưu…" : "Lưu nháp"}</Button>
      </div></div>
    </main>
  </MainLayout>;
}
