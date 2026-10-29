import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionStatusBadge } from "@/pages/management/project/milestone-submission/components/SubmissionStatusBadge";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, ExternalLink, FileCheck2, RotateCw, Undo2 } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function StudentTeamMilestoneSubmissionsPage() {
  const { teamId: teamIdParam, milestoneId } = useParams<{ teamId: string; milestoneId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const teamId = Number(teamIdParam);
  const validParams = Number.isSafeInteger(teamId) && teamId > 0 && Boolean(milestoneId);
  const workspaceId = params.get("workspaceId");
  const workspaceQuery = useQuery({
    queryKey: ["student-team-artifact-workspace", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamArtifactWorkspace(teamId, milestoneId!),
    enabled: validParams,
    retry: false,
  });
  const submissionsQuery = useQuery({
    queryKey: ["my-team-milestone-submissions", teamId, milestoneId],
    queryFn: () => milestoneApi.getMyTeamArtifactSubmissions(teamId, milestoneId!),
    enabled: validParams,
    retry: false,
  });
  const backToWorkspace = () => workspaceId
    ? navigate(`/management/workspaces/${encodeURIComponent(workspaceId)}?tab=milestones`)
    : navigate(-1);
  const loading = workspaceQuery.isPending || submissionsQuery.isPending;
  const failed = !validParams || workspaceQuery.isError || submissionsQuery.isError;
  const latestSubmission = submissionsQuery.data?.[0];

  return <MainLayout pathName={{ student: "Sinh viên", management: "Management", workspaces: "Workspace", milestones: "Milestone", submissions: "Bài nộp của tôi" }}>
    <main className="mx-auto grid w-full max-w-5xl gap-5">
      <Button variant="ghost" className="w-fit" onClick={backToWorkspace}><ArrowLeft className="size-4" /> Quay lại Workspace</Button>
      {loading ? <div className="grid gap-3"><Skeleton className="h-28" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
        : failed ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Không tải được lịch sử bài nộp</AlertTitle><AlertDescription className="flex flex-wrap items-center gap-2">
          <span>Hãy kiểm tra kết nối, quyền truy cập hoặc thử tải lại.</span>
          <Button variant="outline" size="sm" onClick={() => { void workspaceQuery.refetch(); void submissionsQuery.refetch(); }}><RotateCw className="size-4" /> Thử lại</Button>
        </AlertDescription></Alert>
        : <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>{workspaceQuery.data?.milestone.title ?? "Milestone"}</CardTitle>
                <CardDescription>Lịch sử các phiên bản artifact do bạn nộp trong milestone này.</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => navigate(`/teams/${teamId}/milestones/${milestoneId}/submit?workspaceId=${encodeURIComponent(workspaceId ?? "")}`)}
              >
                {submissionsQuery.data && submissionsQuery.data.length > 0 ? "Nộp lại phiên bản mới (Resubmit)" : "Nộp sản phẩm"}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><Badge variant="outline">{workspaceQuery.data?.milestone.status}</Badge><span className="flex items-center gap-2"><CalendarClock className="size-4" /> Hạn nộp: {workspaceQuery.data?.milestone.deadline ? new Date(workspaceQuery.data.milestone.deadline).toLocaleString("vi-VN") : "—"}</span></CardContent>
          </Card>
          {latestSubmission?.submission.status === "CHANGES_REQUESTED" ? <Alert className="border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
            <Undo2 /><AlertTitle>Admin/reviewer yêu cầu bạn nộp lại</AlertTitle>
            <AlertDescription className="grid justify-items-start gap-3">
              <p>{latestSubmission.reviewFeedback || "Vui lòng xem feedback trong phiên bản bên dưới và cập nhật artifact."}</p>
              <Button size="sm" onClick={() => navigate(`/teams/${teamId}/milestones/${milestoneId}/submit?workspaceId=${encodeURIComponent(workspaceId ?? "")}`)}>Cập nhật và nộp lại</Button>
            </AlertDescription>
          </Alert> : null}
          {submissionsQuery.data?.length === 0
            ? <Card><CardContent className="grid justify-items-center gap-2 p-10 text-center"><FileCheck2 className="size-8 text-muted-foreground" /><p className="font-medium">Bạn chưa có phiên bản nào được nộp</p><p className="text-sm text-muted-foreground">Bản nháp chưa được tính là bài nộp chính thức.</p></CardContent></Card>
            : <div className="grid gap-3">{submissionsQuery.data?.map(({ submission, reviewFeedback, reviewedAt }) => <Card key={submission.id}>
              <CardHeader className="p-4 pb-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Version {submission.version}</CardTitle><CardDescription>Nộp lúc {new Date(submission.submittedAt).toLocaleString("vi-VN")}{submission.submittedLate ? " · Nộp muộn" : " · Đúng hạn"}{reviewedAt ? ` · Được review lúc ${new Date(reviewedAt).toLocaleString("vi-VN")}` : ""}</CardDescription></div><SubmissionStatusBadge status={submission.status} /></div></CardHeader>
              <CardContent className="grid gap-2 p-4 pt-2 text-sm">
                <p><strong>Repository:</strong> {submission.repositoryUrl ? <a className="break-all text-primary underline" href={submission.repositoryUrl} target="_blank" rel="noreferrer">{submission.repositoryUrl} <ExternalLink className="inline size-3" /></a> : "—"}</p>
                <p><strong>Deployment:</strong> {submission.deploymentUrl ? <a className="break-all text-primary underline" href={submission.deploymentUrl} target="_blank" rel="noreferrer">{submission.deploymentUrl} <ExternalLink className="inline size-3" /></a> : "—"}</p>
                <div><strong>Release notes:</strong><p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-2 text-muted-foreground">{submission.releaseNotes || "—"}</p></div>
                <p><strong>Tệp đính kèm:</strong> {submission.attachments.length}</p>
                {submission.submittedLate && submission.latePenaltyPercent != null ? <p><strong>Penalty nộp muộn:</strong> {submission.latePenaltyPercent}%</p> : null}
                {submission.status === "CHANGES_REQUESTED" ? <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"><p className="font-semibold">Feedback yêu cầu nộp lại</p><p className="mt-1 whitespace-pre-wrap">{reviewFeedback || "Reviewer chưa ghi feedback tổng quan."}</p></div> : null}
              </CardContent>
            </Card>)}</div>}
        </>}
    </main>
  </MainLayout>;
}
