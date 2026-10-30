import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  History,
  RotateCw,
  Send,
  Upload,
} from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";
import type { ArtifactSubmission, MilestoneDetailResponse, MilestoneListItem } from "@/types";

type ArtifactMilestone = Pick<MilestoneListItem, "id" | "title" | "description" | "deadline" | "lifecycleStatus" | "mandatory">;

interface MilestoneSubmissionHistoryItem {
  submission: ArtifactSubmission;
  reviewSubmissionId?: string | null;
  submitterId?: string;
  submitterName?: string | null;
  submitterEmail?: string | null;
  reviewFeedback?: string | null;
  reviewedAt?: string | null;
}

export function WorkspaceArtifactsPanel({
  workspaceId,
  teamId,
  access: _access,
  milestone,
  onRefreshMilestone,
}: {
  workspaceId?: number;
  projectId?: number | null;
  teamId: number;
  access?: WorkspaceSectionAccess;
  milestone?: MilestoneDetailResponse;
  onRefreshMilestone?: () => void;
}) {
  const navigate = useNavigate();
  const { activeRole, hasPermission } = usePermissions();
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

  const [historyMilestone, setHistoryMilestone] = useState<ArtifactMilestone | null>(null);

  // Load team milestones
  const milestonesQuery = useQuery({
    queryKey: ["workspace-artifacts-milestones", teamId],
    queryFn: () => milestoneApi.getTeamList(teamId, { page: 0, size: 100 }),
    enabled: !milestone && teamId > 0,
    retry: false,
  });

  // The detail page supplies its current milestone, so it does not depend on
  // the workspace list's pagination or load submissions for other milestones.
  const milestones: ArtifactMilestone[] = milestone ? [milestone] : milestonesQuery.data?.content ?? [];
  const refreshMilestones = () => {
    if (milestone) onRefreshMilestone?.();
    else void milestonesQuery.refetch();
  };

  // Students only load their own history; reviewers/admins load the team queue.
  const submissionsQuery = useQuery({
    queryKey: ["team-artifact-submissions-workspace", teamId, isStudent, milestones.map((m) => m.id)],
    queryFn: async (): Promise<MilestoneSubmissionHistoryItem[]> => {
      if (!isStudent) return milestoneApi.getTeamArtifactSubmissions(teamId, milestone?.id);
      const ownHistory = await Promise.all(
        milestones.map((milestone) => milestoneApi.getMyTeamArtifactSubmissions(teamId, milestone.id)),
      );
      return ownHistory.flatMap((items) => items.map(({ submission, reviewFeedback, reviewedAt }) => ({
        submission,
        reviewFeedback,
        reviewedAt,
      })));
    },
    retry: false,
    enabled: teamId > 0 && (Boolean(milestone) || (!milestonesQuery.isPending && !milestonesQuery.isError)),
  });

  // Map submissions per milestoneId
  const submissionsByMilestone = new Map<string, MilestoneSubmissionHistoryItem[]>();
  submissionsQuery.data?.forEach((item) => {
    const list = submissionsByMilestone.get(item.submission.milestoneId) ?? [];
    list.push(item);
    submissionsByMilestone.set(item.submission.milestoneId, list);
  });

  // Submissions for dialog when milestone selected
  const activeMilestoneSubmissions = historyMilestone
    ? (submissionsByMilestone.get(historyMilestone.id) ?? []).sort(
        (a, b) => b.submission.version - a.submission.version
      )
    : [];

  const handleOpenSubmit = (milestoneId: string) => {
    navigate(`/teams/${teamId}/milestones/${milestoneId}/submit${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
  };

  const handleOpenSubmissionsPage = (milestoneId: string) => {
    if (isStudent) {
      navigate(`/student/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
    } else {
      navigate(`/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
    }
  };

  if (!milestone && milestonesQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="size-5 text-primary" /> Quản lý sản phẩm bàn giao (Artifacts)
          </CardTitle>
          <CardDescription>Đang tải danh sách milestone của workspace...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <RotateCw className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!milestone && milestonesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive text-lg">Không thể tải danh sách sản phẩm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Có lỗi khi lấy thông tin milestone của nhóm. Vui lòng kiểm tra quyền truy cập.
          </p>
          <Button variant="outline" size="sm" onClick={() => void milestonesQuery.refetch()}>
            <RotateCw className="mr-2 size-4" /> Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Overview Header */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <FolderOpen className="size-5 shrink-0 text-primary" /> {milestone ? "Nộp và theo dõi sản phẩm (Artifact)" : "Quản lý sản phẩm bàn giao (Artifacts)"}
            </CardTitle>
            <CardDescription className="mt-1">
              {milestone ? "Nộp sản phẩm, xem feedback và lịch sử phiên bản của milestone này ngay tại đây." : "Theo dõi tình trạng bàn giao mã nguồn, demo và lịch sử nộp bài theo từng Milestone của nhóm."}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshMilestones();
              void submissionsQuery.refetch();
            }}
          >
            <RotateCw className="mr-1.5 size-3.5" /> Làm mới
          </Button>
        </CardHeader>
        {submissionsQuery.isError && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <span className="text-destructive">Không tải được lịch sử artifact. Dữ liệu chưa được xác nhận.</span>
              <Button variant="outline" size="sm" onClick={() => void submissionsQuery.refetch()}>
                <RotateCw className="mr-1.5 size-4" /> Thử lại
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Milestone Artifact Cards */}
      {milestones.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="size-10 text-muted-foreground/60 mb-2" />
            <h3 className="font-semibold text-base">Chưa có milestone nào trong workspace</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Khi giáo viên hoặc quản trị viên tạo milestone cho nhóm, bạn có thể nộp và theo dõi sản phẩm tại đây.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {milestones.map((m) => {
            const milestoneSubmissions = submissionsByMilestone.get(m.id) ?? [];
            const latestSub = milestoneSubmissions.length > 0
              ? [...milestoneSubmissions].sort((a, b) => b.submission.version - a.submission.version)[0]
              : null;
            const hasSubmission = Boolean(latestSub);
            const deadlineDate = new Date(m.deadline);
            const isPastDeadline = Date.now() > deadlineDate.getTime();

            return (
              <Card key={m.id} className="transition-all hover:border-primary/40 hover:shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    {/* Left Info */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-base text-foreground truncate">{m.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {m.lifecycleStatus.replaceAll("_", " ")}
                        </Badge>
                        {m.mandatory && (
                          <Badge variant="secondary" className="text-[11px]">
                            Bắt buộc
                          </Badge>
                        )}
                        {hasSubmission ? (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">
                            Đã nộp v{latestSub!.submission.version}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">
                            Chưa nộp
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {m.description || "Không có mô tả chi tiết."}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="size-3.5" />
                          Hạn chót: <strong>{deadlineDate.toLocaleString("vi-VN")}</strong>
                        </span>
                        {isPastDeadline && (
                          <span className="text-destructive font-medium">Đã quá hạn</span>
                        )}
                        {hasSubmission && (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                            <FileCheck2 className="size-3.5" />
                            Đã có {milestoneSubmissions.length} phiên bản đã nộp
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* View submission history */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryMilestone(m)}
                        title="Xem lịch sử tất cả các phiên bản đã nộp"
                      >
                        <History className="mr-1.5 size-4" />
                        Lịch sử nộp ({hasSubmission ? milestoneSubmissions.length : 0})
                      </Button>

                      {/* Action buttons (Fix Bug #26 & Bug #31: REJECTED blocks resubmit) */}
                      {hasSubmission ? (
                        (() => {
                          const status = latestSub!.submission.status;
                          if (status === "REJECTED") {
                            return (
                              <Badge variant="destructive" className="px-3 py-1 text-xs" title="Reviewer đánh giá REJECTED (0 điểm). Rớt milestone và không được nộp lại.">
                                Đã rớt (0 điểm) · Bị từ chối
                              </Badge>
                            );
                          }
                          if (status === "ACCEPTED") {
                            return (
                              <Badge className="bg-emerald-600 text-white px-3 py-1 text-xs">
                                Đã đạt (ACCEPTED)
                              </Badge>
                            );
                          }
                          if (status === "CHANGES_REQUESTED" && isStudent && hasPermission("ARTIFACT_SUBMIT")) {
                            return (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenSubmit(m.id)}
                                className="font-medium border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                title="Reviewer yêu cầu nộp lại. Bấm để nộp phiên bản mới tiếp theo"
                              >
                                <Send className="mr-1.5 size-4" />
                                Nộp lại (Resubmit v{latestSub!.submission.version + 1})
                              </Button>
                            );
                          }
                          if (status === "CHANGES_REQUESTED") {
                            return <Badge variant="outline" className="border-amber-300 text-amber-700 px-2.5 py-1 text-xs">Cần chỉnh sửa</Badge>;
                          }
                          return (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 px-2.5 py-1 text-xs">
                              Đang chờ chấm bài
                            </Badge>
                          );
                        })()
                      ) : (
                        <Button
                          size="sm"
                          disabled={!hasPermission("ARTIFACT_SUBMIT") || submissionsQuery.isPending || submissionsQuery.isError || (m.lifecycleStatus !== "IN_PROGRESS" && m.lifecycleStatus !== "CHANGES_REQUESTED")}
                          onClick={() => handleOpenSubmit(m.id)}
                          title={m.lifecycleStatus === "PLANNED" ? "Milestone chưa mở. Admin cần Open milestone trước khi nộp." : "Soạn thảo và nộp sản phẩm cho milestone"}
                        >
                          <Upload className="mr-1.5 size-4" />
                          Nộp sản phẩm
                        </Button>
                      )}
                      {m.lifecycleStatus === "PLANNED" && <span className="text-xs text-muted-foreground">Milestone chưa mở nhận bài.</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* History Dialog (Fix Bug #28) */}
      <Dialog open={Boolean(historyMilestone)} onOpenChange={(open) => !open && setHistoryMilestone(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:max-w-5xl">
          <div className="border-b bg-gradient-to-r from-primary/10 via-background to-sky-500/10 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex min-w-0 items-start gap-2 pr-6 text-lg leading-snug">
              <History className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">Submission history: {historyMilestone?.title}</span>
            </DialogTitle>
            <DialogDescription>
              Review status, submission time, delivery links, and release notes for every submitted version.
            </DialogDescription>
          </DialogHeader>
          {activeMilestoneSubmissions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{activeMilestoneSubmissions.length} {activeMilestoneSubmissions.length === 1 ? "version" : "versions"}</Badge>
              <Badge variant="outline">Latest: v{activeMilestoneSubmissions[0].submission.version}</Badge>
            </div>
          )}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-4 py-4 sm:px-6">
            {submissionsQuery.isPending ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <RotateCw className="size-4 animate-spin" /> Loading submission history…
              </div>
            ) : submissionsQuery.isError ? (
              <div className="grid justify-items-center gap-3 py-8 text-center text-sm text-destructive">
                <p>Could not load submission history. Try again to refresh the latest data.</p>
                <Button variant="outline" size="sm" onClick={() => void submissionsQuery.refetch()}>
                  <RotateCw className="mr-1.5 size-4" /> Try again
                </Button>
              </div>
            ) : activeMilestoneSubmissions.length === 0 ? (
              <div className="grid justify-items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                <FileCheck2 className="size-7" />
                <p className="font-medium text-foreground">No submissions yet</p>
                <p>No submitted versions are available for this milestone.</p>
              </div>
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border">
                <Table className="w-full min-w-[850px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Version</TableHead>
                      <TableHead className="w-36">Review status</TableHead>
                      <TableHead className="w-44">Submitted</TableHead>
                      <TableHead className="w-28">Timing</TableHead>
                      <TableHead>Delivery links</TableHead>
                      <TableHead className="w-48">Release notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMilestoneSubmissions.map(({ submission }) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-semibold">v{submission.version}</TableCell>
                        <TableCell>
                          <Badge variant={submission.status === "REJECTED" ? "destructive" : submission.status === "ACCEPTED" ? "default" : submission.status === "CHANGES_REQUESTED" ? "secondary" : "outline"}>
                            {submission.status.replaceAll("_", " ")}
                          </Badge>
                          {activeRole && normalizeRole(activeRole) === STUDENT_ROLE && activeMilestoneSubmissions.find((item) => item.submission.id === submission.id)?.reviewFeedback ? (
                            <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground [overflow-wrap:anywhere]">
                              {activeMilestoneSubmissions.find((item) => item.submission.id === submission.id)?.reviewFeedback}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {submission.submittedLate ? (
                            <Badge variant="destructive" className="text-[11px]">
                              Late{submission.latePenaltyPercent != null ? ` (-${submission.latePenaltyPercent}%)` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px]">
                              On time
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-y-1 text-xs">
                          {submission.repositoryUrl && (
                            <div>
                              <a
                                href={submission.repositoryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline inline-flex items-center gap-1 break-all"
                              >
                                Repo <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}
                          {submission.deploymentUrl && (
                            <div>
                              <a
                                href={submission.deploymentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline inline-flex items-center gap-1 break-all"
                              >
                                Deploy <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground"><div className="max-h-32 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]" tabIndex={0} aria-label={`Release notes for version ${submission.version}`}>
                          {submission.releaseNotes || "—"}
                        </div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="m-0 flex min-w-0 shrink-0 flex-col items-stretch gap-3 rounded-none border-t bg-muted/20 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const targetMilestoneId = historyMilestone?.id;
                setHistoryMilestone(null);
                if (targetMilestoneId) handleOpenSubmissionsPage(targetMilestoneId);
              }}
            >
              <ExternalLink className="mr-1.5 size-4" /> Open full submission page
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setHistoryMilestone(null)}>
                Close
              </Button>
              {isStudent && hasPermission("ARTIFACT_SUBMIT") && historyMilestone && activeMilestoneSubmissions[0]?.submission.status === "CHANGES_REQUESTED" && (
                <Button onClick={() => handleOpenSubmit(historyMilestone.id)}>
                  <Send className="mr-1.5 size-4" /> Submit a new version
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
