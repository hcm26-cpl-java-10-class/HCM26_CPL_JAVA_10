import type { WorkspaceDetail } from "@/types/features/workspace";
import { ArrowRight, BriefcaseBusiness, Building2, Copy, FileText, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWorkspaceDate, WorkspaceStatusBadge } from "./workspace.shared";
import { WorkspaceGitRepositoryPanel } from "./WorkspaceGitRepositoryPanel";
import type { WorkspaceProjectNode } from "@/types/features/project-assignment";

function information(value?: string | null) {
  return value?.trim() || "No information available";
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

export function WorkspaceOverviewPanel({ workspace, canViewMembers, onViewMembers, onViewAccess, selectedProject }: {
  workspace: WorkspaceDetail;
  canViewMembers: boolean;
  onViewMembers: () => void;
  onViewAccess: () => void;
  selectedProject?: WorkspaceProjectNode;
}) {
  const projectCode = selectedProject?.code ?? workspace.projectCode;
  const projectName = selectedProject?.name ?? workspace.projectName;
  const projectStatus = selectedProject?.status ?? workspace.projectStatus;
  const projectDescription = selectedProject?.description ?? workspace.topic_snapshot?.description ?? workspace.projectDescription;
  const mentor = workspace.mentorName?.trim();

  const cardClass = "min-w-0 gap-0 overflow-hidden border-slate-200/80 py-0 shadow-none dark:border-border";
  const fieldClass = "min-w-0 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-border dark:bg-muted/20";
  const labelClass = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

  return <div className="min-w-0 space-y-5">
    <section aria-label="Project and workspace information" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card className={cardClass}>
        <CardHeader className="grid-rows-1 gap-0 border-b bg-slate-50/40 px-4 py-3.5 [.border-b]:pb-3.5 dark:bg-muted/20 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><FileText className="size-4" /></span>
              <div className="min-w-0 space-y-1"><CardTitle className="text-sm leading-5">Thông tin dự án / Project brief</CardTitle><CardDescription className="text-[11px] leading-4">Mục tiêu dự án và thông tin lớp học</CardDescription></div>
            </div>
            {projectStatus && <WorkspaceStatusBadge status={projectStatus} colored />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          {workspace.projectId == null ? <p className="text-sm text-muted-foreground">No project linked to this workspace.</p> : <>
            <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
              <div className={fieldClass}>
                <dt className={labelClass}>Mã dự án (Code)</dt>
                <dd className="flex min-w-0 items-start justify-between gap-2"><span className="min-w-0 break-words font-mono font-semibold leading-6">{information(projectCode)}</span>{projectCode?.trim() && <Button type="button" variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground" aria-label="Sao chép mã dự án" onClick={async () => {
                  try { await navigator.clipboard.writeText(projectCode!.trim()); toast.success("Đã sao chép mã dự án."); }
                  catch { toast.error("Không thể sao chép. Hãy chọn mã dự án để sao chép thủ công."); }
                }}><Copy className="size-3.5" /></Button>}</dd>
              </div>
              <div className={fieldClass}>
                <dt className={labelClass}>Tên dự án</dt>
                <dd className="truncate font-semibold leading-6" title={information(projectName)}>{information(projectName)}</dd>
              </div>
              <div className={fieldClass}>
                <dt className={labelClass}>Lớp học (Class)</dt>
                <dd className="flex min-w-0 items-start gap-1.5 leading-6"><Building2 className="mt-1 size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{information(workspace.projectClassName)}</span></dd>
              </div>
              <div className={fieldClass}>
                <dt className={labelClass}>Niên khóa (Cohort)</dt>
                <dd className="flex min-w-0 items-start gap-1.5 leading-6"><GraduationCap className="mt-1 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{information(workspace.projectCohortName)}</span></dd>
              </div>
            </dl>
            <section aria-label="Description" className="space-y-2">
              <h3 className={labelClass}>Mô tả dự án (Description)</h3>
              <p className="whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm leading-6 text-muted-foreground dark:border-border dark:bg-muted/20">{information(projectDescription)}</p>
            </section>
          </>}
        </CardContent>
      </Card>
      <Card className={cardClass} aria-label="Team and workspace details">
        <CardHeader className="grid-rows-1 gap-0 border-b bg-slate-50/40 px-4 py-3.5 [.border-b]:pb-3.5 dark:bg-muted/20 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"><BriefcaseBusiness className="size-4" /></span>
              <div className="min-w-0 space-y-1"><CardTitle className="text-sm leading-5">Thông tin Workspace & Nhóm</CardTitle><CardDescription className="text-[11px] leading-4">Thành viên, mentor và thông tin khởi tạo</CardDescription></div>
            </div>
            <Badge variant="secondary" className="max-w-full whitespace-normal break-words rounded-md font-mono text-[10px]">{workspace.code || "Not available"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 p-4 sm:p-5">
          <div className={`${fieldClass} flex flex-wrap items-center justify-between gap-3 space-y-0`}>
            <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">{initials(workspace.teamName) || <Users className="size-4" />}</span>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5"><p className="min-w-0 break-words text-xs font-semibold">Nhóm: {workspace.teamName}</p><Badge variant="outline" className="shrink-0 border-amber-200/60 bg-amber-50 text-[10px] font-normal text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">{workspace.member_count} active {workspace.member_count === 1 ? "member" : "members"}</Badge></div>
                <p className="break-words text-[11px] text-muted-foreground">Mã nhóm: {workspace.teamCode || "Not available"}</p>
              </div>
            </div>
            {canViewMembers && <Button type="button" variant="ghost" size="xs" onClick={onViewMembers} className="px-0 text-xs text-blue-600 hover:bg-transparent hover:text-blue-700 dark:text-blue-400">Xem nhóm<ArrowRight className="size-3.5" /></Button>}
            {!canViewMembers && <p className="w-full text-xs text-muted-foreground">You do not have permission to view member details.</p>}
          </div>
          <div className={`${fieldClass} flex items-center gap-3 space-y-0`}>
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">{mentor ? initials(mentor) : <GraduationCap className="size-4" />}</span>
            <div className="min-w-0 space-y-1"><p className={labelClass}>Giảng viên hướng dẫn</p><p className="break-words text-xs font-semibold">{mentor || "No mentor assigned"}</p></div>
          </div>
          <dl className="grid min-w-0 gap-2 text-xs sm:grid-cols-2">
            <div className={fieldClass}>
              <dt className={labelClass}>Người tạo (Created by)</dt>
              <dd className="flex items-start gap-1.5 font-medium leading-5"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" /><span className="min-w-0 break-words">{workspace.createdByName || "Not available"}</span></dd>
            </div>
            <div className={fieldClass}>
              <dt className={labelClass}>Thời gian tạo (Created at)</dt>
              <dd className="break-words font-mono text-[11px] leading-5">{formatWorkspaceDate(workspace.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t bg-slate-50/50 px-4 py-2.5 text-[11px] text-muted-foreground dark:bg-muted/20 sm:px-5">
          <span className="flex flex-wrap items-center gap-2">Trạng thái workspace{workspace.status ? <WorkspaceStatusBadge status={workspace.status} colored /> : <span>Chưa có thông tin</span>}</span>
          <Button type="button" variant="ghost" size="xs" className="gap-1 px-0 text-[11px] text-blue-600 hover:bg-transparent hover:text-blue-700 dark:text-blue-400" onClick={onViewAccess}><ShieldCheck className="size-3.5" />Chi tiết quyền hạn</Button>
        </div>
      </Card>
    </section>
    <Card className={cardClass}>
      <WorkspaceGitRepositoryPanel key={workspace.id} workspaceId={workspace.id} />
    </Card>
  </div>;
}
