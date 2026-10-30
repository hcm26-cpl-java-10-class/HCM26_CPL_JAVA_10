import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  Info,
  RotateCw,
  Send,
  Save,
} from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MilestoneRubricCard } from "@/pages/management/project/milestone/components/MilestoneRubricCard";
import { countReleaseNoteWords, RELEASE_NOTES_MAX_WORDS, releaseNotesWithinLimit } from "@/lib/release-notes";
import { artifactFormSource } from "@/lib/artifact-form-source";

function submissionErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (!response) return "Không thể kết nối đến máy chủ. Yêu cầu nộp chưa được ghi nhận; vui lòng kiểm tra kết nối và thử lại.";

  const data = response.data as { message?: unknown; errors?: unknown } | undefined;
  if (data?.errors && typeof data.errors === "object") {
    const details = Object.values(data.errors as Record<string, unknown>)
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter((value): value is string => typeof value === "string");
    if (details.length) return details.join(" ");
  }
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  switch (response.status) {
    case 401: return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    case 403: return "Bạn không có quyền nộp sản phẩm cho milestone này.";
    case 404: return "Không tìm thấy nhóm hoặc milestone.";
    case 409: return "Trạng thái milestone hoặc bản nháp đã thay đổi. Vui lòng làm mới trang.";
    default: return `Nộp bài thất bại (HTTP ${response.status}). Vui lòng kiểm tra lại thông tin và thử lại.`;
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

  const submitKey = useRef<string | null>(null);
  const initializedFormScope = useRef<string | null>(null);

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
      const timeStr = new Date().toLocaleTimeString("vi-VN");
      setSaveSuccessTime(timeStr);
      toast.success("Bản nháp đã được lưu thành công!");
      void qc.invalidateQueries({ queryKey: ["team-artifact-workspace", teamId, milestoneId] });
      navigate(`/student/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`);
    },
    onError: () => {
      toast.error("Không thể lưu bản nháp. Vui lòng thử lại.");
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
        (current) => current ? { ...current, latestSubmission: data, canSubmit: false } : current,
      );
      void qc.invalidateQueries({ queryKey: ["team-artifact-submissions-workspace", teamId] });
      void qc.invalidateQueries({ queryKey: ["my-team-milestone-submissions", teamId, milestoneId] });
      void qc.invalidateQueries({ queryKey: ["student-team-artifact-workspace", teamId, milestoneId] });
      void qc.invalidateQueries({ queryKey: ["my-milestone-submissions"] });
      toast.success(`Nộp sản phẩm phiên bản ${data.version} thành công!`);
      return qc.invalidateQueries({ queryKey: ["team-artifact-workspace", teamId, milestoneId] });
    },
    onError: (err) => {
      toast.error(submissionErrorMessage(err));
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
      setClientValidationError(`Release notes không được vượt quá ${RELEASE_NOTES_MAX_WORDS} từ.`);
      return;
    }
    const repo = repositoryUrl.trim();
    const deploy = deploymentUrl.trim();

    if (!repo && !deploy) {
      setClientValidationError("Vui lòng cung cấp ít nhất Repository URL hoặc Deployment URL.");
      return;
    }
    if (repo && !isValidHttpUrl(repo)) {
      setClientValidationError("Repository URL không hợp lệ. Vui lòng nhập URL bắt đầu bằng http:// hoặc https://");
      return;
    }
    if (deploy && !isValidHttpUrl(deploy)) {
      setClientValidationError("Deployment URL không hợp lệ. Vui lòng nhập URL bắt đầu bằng http:// hoặc https://");
      return;
    }

    setPreviewOpen(true);
  };

  const handleConfirmSubmit = () => {
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
      <MainLayout pathName={{ milestones: "Milestone", submit: "Nộp sản phẩm" }}>
        <div className="mx-auto flex max-w-4xl items-center justify-center py-20 text-muted-foreground">
          <RotateCw className="mr-2 size-5 animate-spin" /> Đang tải thông tin milestone...
        </div>
      </MainLayout>
    );
  }

  if (!query.data) {
    return (
      <MainLayout pathName={{ milestones: "Milestone", submit: "Nộp sản phẩm" }}>
        <main className="mx-auto max-w-4xl p-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertCircle className="size-5" /> Không thể tải milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Không tìm thấy dữ liệu milestone hoặc bạn không có quyền truy cập vào nhóm này.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => void query.refetch()}>
                  <RotateCw className="mr-2 size-4" /> Thử lại
                </Button>
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 size-4" /> Quay lại
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
  const deadlineDate = new Date(m.deadline);
  const isPastDeadline = Date.now() > deadlineDate.getTime();

  return (
    <MainLayout
      pathName={{
        milestones: "Milestones",
        [m.id]: m.title,
        submit: "Nộp sản phẩm",
      }}
    >
      <main className="mx-auto grid max-w-4xl gap-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="outline" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 size-4" />
            {workspaceId ? "Quay lại Workspace" : "Quay lại"}
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{m.lifecycleStatus}</Badge>
          </div>
        </div>

        {/* Existing Draft Alert (Fix Bug #25) */}
        {draft && artifactFormSource(draft, latestSubmission) === draft && (
          <Alert className="border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
            <Info className="size-4" />
            <AlertTitle className="font-semibold">Đang mở bản nháp đã lưu</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Hệ thống đã tự động nạp bản nháp phiên bản <strong>v{draft.version}</strong> (cập nhật lúc {new Date(draft.updatedAt).toLocaleString("vi-VN")}). Bạn có thể tiếp tục chỉnh sửa, lưu nháp mới hoặc nộp chính thức bên dưới.
            </AlertDescription>
          </Alert>
        )}

        {latestSubmission && artifactFormSource(draft, latestSubmission) === latestSubmission && (
          <Alert className="border-blue-300 bg-blue-50 text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
            <Info className="size-4" />
            <AlertTitle>Đã kế thừa nội dung phiên bản {latestSubmission.version}</AlertTitle>
            <AlertDescription>Repository URL, Deployment URL và Release notes đã được điền từ bản nộp trước để bạn chỉnh sửa. Bản đã nộp vẫn được giữ nguyên.</AlertDescription>
          </Alert>
        )}

        {/* Save Draft Success Feedback (Fix Bug #22) */}
        {saveSuccessTime && (
          <Alert className="border-green-400 bg-green-50 text-green-900 dark:bg-green-950/20 dark:text-green-200">
            <CheckCircle2 className="size-4 text-green-600" />
            <AlertTitle className="font-semibold">Lưu bản nháp thành công</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              Bản nháp đã được cập nhật thành công trên hệ thống vào lúc <strong>{saveSuccessTime}</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Latest Submission Banner / Clear Green Success State (Fix Bug #29) */}
        {latestSubmission && (
          <Alert className="border-emerald-400 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
            <FileCheck2 className="size-5 text-emerald-600" />
            <AlertTitle className="font-semibold text-base">
              Đã nộp thành công Phiên bản {latestSubmission.version}
            </AlertTitle>
            <AlertDescription className="mt-1 text-xs space-y-1">
              <p>
                Thời gian nộp: <strong>{new Date(latestSubmission.submittedAt).toLocaleString("vi-VN")}</strong> · Trạng thái:{" "}
                <Badge variant={latestSubmission.submittedLate ? "destructive" : "secondary"} className="text-[11px] px-1.5 py-0">
                  {latestSubmission.submittedLate ? "Nộp muộn" : "Đúng hạn"}
                </Badge>
              </p>
              {canSubmit && <p className="text-emerald-800 dark:text-emerald-200">
                Bạn có thể nộp phiên bản mới (v{latestSubmission.version + 1}) theo yêu cầu chỉnh sửa của reviewer.
              </p>}
            </AlertDescription>
          </Alert>
        )}

        {/* Milestone Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-xl">{m.title}</CardTitle>
                <CardDescription className="mt-1">
                  {m.description || "Milestone bàn giao sản phẩm của nhóm."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <span>Hạn chót: <strong>{deadlineDate.toLocaleString("vi-VN")}</strong></span>
                {isPastDeadline && (
                  <Badge variant="destructive" className="ml-1 text-xs">Đã qua hạn</Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Acceptance Checklist Card (Fix Bug #20) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Tiêu chí nghiệm thu (Checklist)</CardTitle>
                <CardDescription className="text-sm">
                  Reviewer sẽ đánh giá các tiêu chí này sau khi nộp bài.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {m.checklist.length} tiêu chí
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {m.checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Milestone này không yêu cầu checklist nghiệm thu riêng.</p>
            ) : (
              m.checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30"
                >
                  <Checkbox
                    id={`check-${item.id}`}
                    disabled
                    checked={false}
                    className="mt-0.5"
                    aria-label={`${item.content} — reviewer assessment`}
                  />
                  <label
                    htmlFor={`check-${item.id}`}
                    className="flex-1 text-sm leading-relaxed"
                  >
                    {item.content}
                    {item.mandatory && (
                      <span className="ml-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        Bắt buộc
                      </span>
                    )}
                  </label>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Milestone Rubric Card (Fix Bug #21) */}
        {m.rubric && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tiêu chuẩn chấm điểm (Rubric)
            </h3>
            <MilestoneRubricCard rubric={m.rubric} />
          </div>
        )}

        {/* Artifact Form Card (Fix Bug #23) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thông tin sản phẩm nộp</CardTitle>
            <CardDescription>
              Cung cấp đường dẫn mã nguồn, môi trường triển khai và ghi chú phiên bản.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {/* Repository URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Repository URL</span>
                <span className="text-xs text-muted-foreground font-normal">Git repository (GitHub, GitLab, ...)</span>
              </label>
              <Input
                placeholder="https://github.com/organization/repository"
                value={repositoryUrl}
                onChange={(e) => {
                  edited();
                  setRepositoryUrl(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Hệ thống chỉ kiểm tra định dạng URL HTTP(S); reviewer cần xác nhận repository tồn tại và có đúng nội dung.
              </p>
            </div>

            {/* Deployment URL */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center justify-between">
                <span>Deployment URL</span>
                <span className="text-xs text-muted-foreground font-normal">Môi trường chạy thử / Demo trực tiếp</span>
              </label>
              <Input
                placeholder="https://my-app.vercel.app"
                value={deploymentUrl}
                onChange={(e) => {
                  edited();
                  setDeploymentUrl(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Nhập URL HTTP(S) của bản demo hoặc staging. Hệ thống kiểm tra định dạng, không tự truy cập URL này.
              </p>
            </div>

            {/* Validation Rule Notice */}
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>Yêu cầu hợp lệ:</strong> Cần cung cấp ít nhất một đường dẫn (Repository URL hoặc Deployment URL) trước khi nộp chính thức. Bạn vẫn có thể lưu nháp nếu chưa hoàn thiện.
            </div>

            {/* Release notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ghi chú phát hành (Release Notes)</label>
              <Textarea
                placeholder="Mô tả tóm tắt các tính năng đã hoàn thiện trong đợt bàn giao này..."
                value={releaseNotes}
                rows={4}
                className="max-h-40 resize-none overflow-y-auto"
                onChange={(e) => {
                  edited();
                  if (!releaseNotesWithinLimit(e.target.value) && countReleaseNoteWords(e.target.value) > countReleaseNoteWords(releaseNotes)) {
                    setClientValidationError(`Release notes tối đa ${RELEASE_NOTES_MAX_WORDS} từ (${countReleaseNoteWords(releaseNotes)}/${RELEASE_NOTES_MAX_WORDS} đang dùng).`);
                    return;
                  }
                  setReleaseNotes(e.target.value);
                }}
              />
              <p className="text-xs text-muted-foreground">{countReleaseNoteWords(releaseNotes)}/{RELEASE_NOTES_MAX_WORDS} từ</p>
            </div>

            {/* Rejected Alert (Fix Bug #31) */}
            {latestSubmission?.status === "REJECTED" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Bài nộp đã bị từ chối (REJECTED - 0 điểm)</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  Bài nộp cho milestone này đã bị reviewer đánh giá REJECTED (0 điểm). Nhóm không được phép nộp lại hoặc chỉnh sửa bản nháp.
                </AlertDescription>
              </Alert>
            )}

            {/* Amber Alert ONLY when submission is truly blocked (Fix Bug #29) */}
            {!canSubmit && !latestSubmission && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <AlertCircle className="size-4" />
                <AlertTitle>Chưa mở nộp bài chính thức</AlertTitle>
                <AlertDescription className="text-xs mt-1">{query.data.submissionBlockReason ?? "Chức năng nộp bài chỉ khả dụng khi milestone đang thực hiện hoặc reviewer yêu cầu nộp lại, trong thời hạn cho phép."}</AlertDescription>
              </Alert>
            )}

            {/* Client validation error */}
            {clientValidationError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Thông tin chưa hợp lệ</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {clientValidationError}
                </AlertDescription>
              </Alert>
            )}

            {/* Server submission error */}
            {submit.isError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Nộp bài không thành công</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  {submissionErrorMessage(submit.error)}
                </AlertDescription>
              </Alert>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="outline"
                disabled={save.isPending || submit.isPending || !canSubmit || !releaseNotesWithinLimit(releaseNotes) || latestSubmission?.status === "REJECTED"}
                onClick={() => save.mutate()}
              >
                {save.isPending ? (
                  <>
                    <RotateCw className="mr-2 size-4 animate-spin" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" /> Lưu bản nháp
                  </>
                )}
              </Button>

              <Button
                disabled={submit.isPending || save.isPending || !canSubmit || !releaseNotesWithinLimit(releaseNotes) || latestSubmission?.status === "REJECTED"}
                onClick={handleValidateAndOpenPreview}
              >
                <Eye className="mr-2 size-4" /> Xem trước & Nộp bài
              </Button>

              <Button variant="ghost" onClick={handleBack}>
                Hủy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview & Confirm Submission Dialog (Fix Bug #24) */}
        <Dialog open={previewOpen} onOpenChange={(open) => { if (!submit.isPending) setPreviewOpen(open); }}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:max-w-2xl" showCloseButton={!submit.isPending}>
            <DialogHeader className="shrink-0 border-b bg-muted/30 px-5 py-5 pr-12 sm:px-6 sm:pr-12">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl border bg-background p-2.5 text-primary shadow-sm"><FileCheck2 className="size-5" /></div>
                <div className="min-w-0 space-y-2">
                  <DialogTitle className="text-lg font-semibold leading-snug">Xác nhận nộp sản phẩm</DialogTitle>
                  <Badge variant="secondary" className="w-fit">Phiên bản v{latestSubmission ? latestSubmission.version + 1 : 1}</Badge>
                </div>
              </div>
              <DialogDescription className="mt-2 leading-relaxed">Kiểm tra nội dung bên dưới trước khi gửi cho reviewer.</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 text-sm sm:px-6">
              <section className="min-w-0 rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Milestone</p>
                <h3 className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">{m.title}</h3>
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3.5" /> Hạn nộp: {deadlineDate.toLocaleString("vi-VN")}</p>
              </section>

              <section className="min-w-0 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Tiêu chí nghiệm thu</h3>
                  <Badge variant="outline">{m.checklist.length} tiêu chí</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Reviewer sẽ đánh giá các tiêu chí này sau khi nộp.</p>
                {m.checklist.length > 0 ? <ul className="mt-3 space-y-2">{m.checklist.map((item) => <li key={item.id} className="flex min-w-0 items-start gap-2.5 rounded-lg bg-muted/40 p-2.5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" /><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{item.content}{item.mandatory && <span className="ml-2 inline-block text-xs font-medium text-amber-700 dark:text-amber-300">Bắt buộc</span>}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Không có tiêu chí.</p>}
              </section>

              <section className="min-w-0 rounded-xl border p-4">
                <h3 className="font-semibold">Liên kết sản phẩm</h3>
                <div className="mt-3 grid min-w-0 gap-3">
                  {[
                    { label: "Repository URL", url: repositoryUrl.trim() },
                    { label: "Deployment URL", url: deploymentUrl.trim() },
                  ].map(({ label, url }) => (
                    <div key={label} className="min-w-0 rounded-lg bg-muted/40 p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
                      {url ? <a href={url} target="_blank" rel="noreferrer" className="flex min-w-0 items-start gap-2 text-primary hover:underline"><span className="min-w-0 flex-1 break-all">{url}</span><ExternalLink className="mt-0.5 size-3.5 shrink-0" /></a> : <p className="text-muted-foreground">Chưa cung cấp</p>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="min-w-0 rounded-xl border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Release notes</h3><span className="text-xs text-muted-foreground">{countReleaseNoteWords(releaseNotes)}/{RELEASE_NOTES_MAX_WORDS} từ</span></div>
                <div tabIndex={0} aria-label="Nội dung Release notes" className="max-h-40 min-w-0 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                  {releaseNotes.trim() || "Không có ghi chú phát hành"}
                </div>
              </section>

              {isPastDeadline && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  <strong>Chú ý:</strong> Đã qua thời hạn deadline của milestone. Bài nộp sẽ được tính là Nộp muộn (Late) theo quy định.
                </div>
              )}
            </div>

            <DialogFooter className="m-0 shrink-0 gap-2 rounded-none border-t px-5 py-4 sm:px-6">
              <Button className="w-full sm:w-auto" variant="outline" disabled={submit.isPending} onClick={() => setPreviewOpen(false)}>
                Chỉnh sửa lại
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={submit.isPending}
                onClick={handleConfirmSubmit}
              >
                {submit.isPending ? (
                  <>
                    <RotateCw className="mr-2 size-4 animate-spin" /> Đang nộp...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 size-4" /> Xác nhận nộp bài
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </MainLayout>
  );
}
