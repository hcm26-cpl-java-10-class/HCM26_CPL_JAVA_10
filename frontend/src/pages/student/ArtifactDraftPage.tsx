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
import type { ArtifactAttachment, ArtifactDraftRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, FileUp, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

  const workspaceQuery = useQuery({
    queryKey: ["artifact-submission-workspace", projectId, milestoneId],
    queryFn: () => milestoneApi.getArtifactWorkspace(projectId as string, milestoneId as string),
    enabled: Boolean(projectId && milestoneId),
    retry: false,
  });

  useEffect(() => {
    if (!workspaceQuery.data) return;
    const { draft, milestone } = workspaceQuery.data;
    setRepositoryUrl(draft?.repositoryUrl ?? "");
    setDeploymentUrl(draft?.deploymentUrl ?? "");
    setReleaseNotes(draft?.releaseNotes ?? "");
    setDraftVersion(draft?.version);
    setAttachments(draft?.attachments ?? []);
    setChecklist(Object.fromEntries(milestone.checklist.map((item) => [item.id, draft?.checklist[item.id] ?? false])));
  }, [workspaceQuery.data]);

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

      <Card><CardHeader><CardTitle>Acceptance checklist</CardTitle><CardDescription>Đánh dấu tiêu chí đã hoàn thành. Cấu hình milestone không bị thay đổi.</CardDescription></CardHeader>
        <CardContent className="grid gap-3">{milestone.checklist.length ? milestone.checklist.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <Checkbox checked={checklist[item.id] ?? false} onCheckedChange={(checked) => { setSaved(false); setChecklist((old) => ({ ...old, [item.id]: checked === true })); }} />
          <span className="flex-1 text-sm">{item.content}{item.mandatory && <span className="ml-2 text-xs text-muted-foreground">Bắt buộc</span>}</span>
        </label>) : <p className="text-sm text-muted-foreground">Milestone chưa cấu hình checklist.</p>}</CardContent>
      </Card>

      <MilestoneRubricCard rubric={milestone.rubric} />

      <Card><CardHeader><CardTitle>Thông tin sản phẩm</CardTitle><CardDescription>Các trường không bắt buộc; có thể lưu nháp khi chưa điền đủ.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">Repository URL<Input type="url" value={repositoryUrl} onChange={(event) => { setSaved(false); setRepositoryUrl(event.target.value); }} placeholder="https://github.com/..." /></label>
          <label className="grid gap-2 text-sm font-medium">Deployment URL<Input type="url" value={deploymentUrl} onChange={(event) => { setSaved(false); setDeploymentUrl(event.target.value); }} placeholder="https://..." /></label>
          <label className="grid gap-2 text-sm font-medium">Release notes<Textarea value={releaseNotes} onChange={(event) => { setSaved(false); setReleaseNotes(event.target.value); }} placeholder="Mô tả ngắn nội dung bàn giao" rows={5} /></label>
          <div className="grid gap-2 text-sm font-medium">Tệp đính kèm
            <label className={`flex items-center gap-3 rounded-lg border border-dashed p-4 ${workspaceQuery.data.uploadPolicy.enabled ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}>
              <FileUp className="size-5" /><span>{uploadMutation.isPending ? "Đang kiểm tra và tải tệp…" : workspaceQuery.data.uploadPolicy.enabled ? "Chọn tệp để tải lên" : "Tải tệp đang khóa: policy hoặc scanner chưa được cấu hình."}</span>
              <input type="file" className="sr-only" disabled={!workspaceQuery.data.uploadPolicy.enabled || uploadMutation.isPending}
                accept={workspaceQuery.data.uploadPolicy.allowedMimeTypes.join(",")}
                onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) uploadMutation.mutate(file); }} />
            </label>
            <span className="text-xs font-normal">Policy hiện tại: {workspaceQuery.data.uploadPolicy.enabled ? `${workspaceQuery.data.uploadPolicy.allowedMimeTypes.join(", ")} · tối đa ${Math.ceil(workspaceQuery.data.uploadPolicy.maxBytes / 1024 / 1024)} MB` : "chưa bật"}. Chỉ tệp quét sạch mới xuất hiện bên dưới.</span>
            {attachments.length > 0 && <ul className="grid gap-2">{attachments.map((attachment) => <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{attachment.fileName}</span><span className="shrink-0 text-xs text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(0)} KB · Đã quét sạch</span>
            </li>)}</ul>}
          </div>
        </CardContent>
      </Card>

      {reviewing && <Card className="border-primary/30"><CardHeader><CardTitle>Xem lại bản chuẩn bị</CardTitle><CardDescription>Đây chỉ là bước xem trước; chưa tạo submission hoặc phiên bản nộp chính thức.</CardDescription></CardHeader><CardContent className="grid gap-2 text-sm">
        <p><strong>Repository:</strong> {repositoryUrl || "Chưa cung cấp"}</p><p><strong>Deployment:</strong> {deploymentUrl || "Chưa cung cấp"}</p><p><strong>Checklist:</strong> {Object.values(checklist).filter(Boolean).length}/{milestone.checklist.length} tiêu chí</p><p><strong>Trạng thái:</strong> DRAFT</p>
      </CardContent></Card>}

      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Quay lại</Button><div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setReviewing((value) => !value)}><Eye /> {reviewing ? "Đóng xem trước" : "Review & submit"}</Button>
        <Button onClick={submitDraft} disabled={saveMutation.isPending}><Save /> {saveMutation.isPending ? "Đang lưu…" : "Lưu nháp"}</Button>
      </div></div>
    </main>
  </MainLayout>;
}
