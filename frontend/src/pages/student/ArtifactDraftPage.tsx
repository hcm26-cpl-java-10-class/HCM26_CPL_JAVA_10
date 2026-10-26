import { milestoneApi } from "@/api";
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
import type { ArtifactAttachment, ArtifactDraftRequest, ArtifactSubmission, ArtifactSubmissionRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, FileUp, Save, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type PendingArtifactSubmission = { key: string; payload: ArtifactSubmissionRequest };

export default function ArtifactDraftPage() {
  const { projectId, milestoneId } = useParams<{ projectId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [deploymentUrl, setDeploymentUrl] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<ArtifactAttachment[]>([]);
  const [draftVersion, setDraftVersion] = useState<number | undefined>();
  const [reviewing, setReviewing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submission, setSubmission] = useState<ArtifactSubmission | null>(null);
  const idempotencyKey = useRef<string | undefined>(undefined);
  const pendingSubmission = useRef<PendingArtifactSubmission | null>(null);

  const pendingStorageKey = projectId && milestoneId
    ? "artifact-submit-pending:" + projectId + ":" + milestoneId
    : null;

  const workspaceQuery = useQuery({
    queryKey: ["artifact-submission-workspace", projectId, milestoneId],
    queryFn: () => milestoneApi.getArtifactWorkspace(projectId as string, milestoneId as string),
    enabled: Boolean(projectId && milestoneId),
    retry: false,
  });

  useEffect(() => {
    if (!workspaceQuery.data) return;
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
    setRepositoryUrl(draft?.repositoryUrl ?? "");
    setDeploymentUrl(draft?.deploymentUrl ?? "");
    setReleaseNotes(draft?.releaseNotes ?? "");
    setDraftVersion(draft?.version);
    setAttachments(draft?.attachments ?? []);
    setChecklist(Object.fromEntries(milestone.checklist.map((item) => [item.id, draft?.checklist[item.id] ?? false])));
    setSubmission(workspaceQuery.data.latestSubmission);
  }, [workspaceQuery.data, pendingStorageKey]);

  const saveMutation = useMutation({
    mutationFn: (payload: ArtifactDraftRequest) => milestoneApi.saveArtifactDraft(projectId as string, milestoneId as string, payload),
    onSuccess: async (draft) => {
      setDraftVersion(draft.version);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["artifact-submission-workspace", projectId, milestoneId] });
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
    setSaved(false);
    saveMutation.mutate({ repositoryUrl: repositoryUrl.trim() || undefined, deploymentUrl: deploymentUrl.trim() || undefined,
      releaseNotes: releaseNotes.trim() || undefined, checklist, expectedVersion: draftVersion });
  };

  const submitOfficially = () => {
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

  const submissionError = submissionMutation.isError ? getMilestoneApiError(submissionMutation.error) : null;

  return <MainLayout pathName={{ projects: "Dự án", [projectId ?? "project"]: milestone.project.name, milestones: "Milestone", [milestone.id]: milestone.title, submit: "Chuẩn bị artifact" }}>
    <main className="mx-auto grid w-full max-w-5xl gap-5">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-background"><CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Trạng thái milestone: {milestone.status}</span><span>·</span><span>Hạn: {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</span></div>
        <CardTitle className="text-2xl">Chuẩn bị sản phẩm: {milestone.title}</CardTitle><CardDescription>{milestone.description}</CardDescription>
        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-emerald-600" /> Dữ liệu được kiểm tra quyền truy cập ở backend</div>
      </CardHeader></Card>

      {saved && <Alert><CheckCircle2 /><AlertTitle>Đã lưu bản nháp</AlertTitle><AlertDescription>Trạng thái là DRAFT; chưa phải sản phẩm đã nộp chính thức.</AlertDescription></Alert>}
      {saveMutation.isError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Bản nháp chưa được lưu</AlertTitle><AlertDescription>{getMilestoneApiError(saveMutation.error).message || "Hãy thử lại. Nội dung bạn nhập vẫn được giữ trên màn hình."}</AlertDescription></Alert>}
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

      <Card><CardHeader><CardTitle>Acceptance checklist</CardTitle><CardDescription>Đánh dấu tiêu chí đã hoàn thành. Cấu hình milestone không bị thay đổi.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">{milestone.checklist.length ? milestone.checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <Checkbox disabled={submissionMutation.isPending} checked={checklist[item.id] ?? false} onCheckedChange={(checked) => { markSubmissionEdited(); setSaved(false); setChecklist((old) => ({ ...old, [item.id]: checked === true })); }} />
          <span className="flex-1 text-sm">{item.content}{item.mandatory && <span className="ml-2 text-xs text-muted-foreground">Bắt buộc</span>}</span>
        </label>) : <p className="text-sm text-muted-foreground">Milestone chưa cấu hình checklist.</p>}</CardContent>
      </Card>

      <MilestoneRubricCard rubric={milestone.rubric} />

      <Card><CardHeader><CardTitle>Thông tin sản phẩm</CardTitle><CardDescription>Các trường không bắt buộc; có thể lưu nháp khi chưa điền đủ.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">Repository URL<Input disabled={submissionMutation.isPending} type="url" value={repositoryUrl} onChange={(event) => { markSubmissionEdited(); setSaved(false); setRepositoryUrl(event.target.value); }} placeholder="https://github.com/..." /></label>
          <label className="grid gap-2 text-sm font-medium">Deployment URL<Input disabled={submissionMutation.isPending} type="url" value={deploymentUrl} onChange={(event) => { markSubmissionEdited(); setSaved(false); setDeploymentUrl(event.target.value); }} placeholder="https://..." /></label>
          <label className="grid gap-2 text-sm font-medium">Release notes<Textarea disabled={submissionMutation.isPending} value={releaseNotes} maxLength={10000} onChange={(event) => { markSubmissionEdited(); setSaved(false); setReleaseNotes(event.target.value); }} placeholder="Mô tả ngắn nội dung bàn giao" rows={5} className="max-h-48 resize-none overflow-y-auto" /></label>
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
        <p><strong>Repository:</strong> {repositoryUrl || "Chưa cung cấp"}</p><p><strong>Deployment:</strong> {deploymentUrl || "Chưa cung cấp"}</p><p><strong>Tệp:</strong> {attachments.length} tệp đã tải lên và quét sạch</p><p><strong>Checklist:</strong> {Object.values(checklist).filter(Boolean).length}/{milestone.checklist.length} tiêu chí</p>
        <Button onClick={submitOfficially} disabled={submissionMutation.isPending || uploadMutation.isPending}>
          {submissionMutation.isPending ? "Đang gửi…" : "Xác nhận nộp"}
        </Button>
      </CardContent></Card>}

      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Quay lại</Button><div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setReviewing((value) => !value)} disabled={submissionMutation.isPending}><Eye /> {reviewing ? "Đóng xem trước" : "Review & submit"}</Button>
        <Button onClick={submitDraft} disabled={saveMutation.isPending || submissionMutation.isPending}><Save /> {saveMutation.isPending ? "Đang lưu…" : "Lưu nháp"}</Button>
      </div></div>
    </main>
  </MainLayout>;
}
