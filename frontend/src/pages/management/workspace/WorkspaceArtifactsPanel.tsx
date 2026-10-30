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
import type { ArtifactSubmission, MilestoneListItem } from "@/types";

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
}: {
  workspaceId: number;
  projectId?: number | null;
  teamId: number;
  access: WorkspaceSectionAccess;
}) {
  const navigate = useNavigate();
  const { activeRole } = usePermissions();
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

  const [historyMilestone, setHistoryMilestone] = useState<MilestoneListItem | null>(null);

  // Load team milestones
  const milestonesQuery = useQuery({
    queryKey: ["workspace-artifacts-milestones", teamId],
    queryFn: () => milestoneApi.getTeamList(teamId, { page: 0, size: 100 }),
    retry: false,
  });

  const milestones = milestonesQuery.data?.content ?? [];

  // Students only load their own history; reviewers/admins load the team queue.
  const submissionsQuery = useQuery({
    queryKey: ["team-artifact-submissions-workspace", teamId, isStudent, milestones.map((m) => m.id)],
    queryFn: async (): Promise<MilestoneSubmissionHistoryItem[]> => {
      if (!isStudent) return milestoneApi.getTeamArtifactSubmissions(teamId);
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
    enabled: teamId > 0 && !milestonesQuery.isPending && !milestonesQuery.isError,
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
    navigate(`/teams/${teamId}/milestones/${milestoneId}/submit?workspaceId=${workspaceId}`);
  };

  const handleOpenSubmissionsPage = (milestoneId: string) => {
    if (isStudent) {
      navigate(`/student/teams/${teamId}/milestones/${milestoneId}/submissions?workspaceId=${workspaceId}`);
    } else {
      navigate(`/teams/${teamId}/milestones/${milestoneId}/submissions?workspaceId=${workspaceId}`);
    }
  };

  if (milestonesQuery.isPending) {
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

  if (milestonesQuery.isError) {
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
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <FolderOpen className="size-5 text-primary" /> Quản lý sản phẩm bàn giao (Artifacts)
            </CardTitle>
            <CardDescription className="mt-1">
              Theo dõi tình trạng bàn giao mã nguồn, demo và lịch sử nộp bài theo từng Milestone của nhóm.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void milestonesQuery.refetch();
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
                          {m.status}
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
                          if (status === "CHANGES_REQUESTED" && isStudent) {
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
                          onClick={() => handleOpenSubmit(m.id)}
                          title="Soạn thảo và nộp sản phẩm cho milestone"
                        >
                          <Upload className="mr-1.5 size-4" />
                          Nộp sản phẩm
                        </Button>
                      )}
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History className="size-5 text-primary" />
              Lịch sử bài nộp: {historyMilestone?.title}
            </DialogTitle>
            <DialogDescription>
              Danh sách tất cả các phiên bản artifact đã được nhóm nộp lên hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {submissionsQuery.isPending ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <RotateCw className="size-4 animate-spin" /> Đang tải lịch sử phiên bản…
              </div>
            ) : submissionsQuery.isError ? (
              <div className="grid justify-items-center gap-3 py-8 text-center text-sm text-destructive">
                <p>Không tải được lịch sử artifact. Hãy thử lại để xem dữ liệu mới nhất.</p>
                <Button variant="outline" size="sm" onClick={() => void submissionsQuery.refetch()}>
                  <RotateCw className="mr-1.5 size-4" /> Thử lại
                </Button>
              </div>
            ) : activeMilestoneSubmissions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Chưa có phiên bản nào được nộp cho milestone này.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Phiên bản</TableHead>
                      <TableHead className="w-36">Trạng thái</TableHead>
                      <TableHead className="w-24">Thời điểm</TableHead>
                      <TableHead className="w-28">Đúng hạn</TableHead>
                      <TableHead>Repository / Deploy</TableHead>
                      <TableHead className="w-32">Ghi chú</TableHead>
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
                            <p className="mt-1 max-w-48 whitespace-pre-wrap text-xs text-muted-foreground">
                              {activeMilestoneSubmissions.find((item) => item.submission.id === submission.id)?.reviewFeedback}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(submission.submittedAt).toLocaleString("vi-VN")}
                        </TableCell>
                        <TableCell>
                          {submission.submittedLate ? (
                            <Badge variant="destructive" className="text-[11px]">
                              Late {submission.latePenaltyPercent != null ? `(-${submission.latePenaltyPercent}%)` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px]">
                              On time
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs space-y-1">
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
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={submission.releaseNotes ?? ""}>
                          {submission.releaseNotes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const targetMilestoneId = historyMilestone?.id;
                setHistoryMilestone(null);
                if (targetMilestoneId) handleOpenSubmissionsPage(targetMilestoneId);
              }}
            >
              <ExternalLink className="mr-1.5 size-4" /> Mở trang bài nộp đầy đủ
            </Button>
            <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setHistoryMilestone(null)}>
              Đóng
            </Button>
            {isStudent && historyMilestone && activeMilestoneSubmissions[0]?.submission.status === "CHANGES_REQUESTED" && (
              <Button onClick={() => handleOpenSubmit(historyMilestone.id)}>
                <Send className="mr-1.5 size-4" /> Nộp phiên bản mới
              </Button>
            )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
