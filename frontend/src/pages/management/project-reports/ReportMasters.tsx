import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, ChevronDown, FileCheck2, FolderKanban, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportMaster, ReportProject } from "@/types/features/project-report";
import { BacklogSummary, StatusBadge } from "./report-ui";
import { reportDate } from "./report-utils";

const milestoneLabels: Record<string, string> = {
  PLANNED: "Lên kế hoạch", IN_PROGRESS: "Đang thực hiện", SUBMITTED: "Đã nộp · Chờ chấm",
  CHANGES_REQUESTED: "Cần chỉnh sửa", ACCEPTED: "Được chấp nhận", REJECTED: "Bị từ chối",
};
function Milestones({ project, timeZone }: { project: ReportProject; timeZone: string }) {
  return <Dialog><DialogTrigger asChild><button type="button" className="flex min-w-40 items-center gap-2 rounded-md py-1 text-left text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"><FileCheck2 className="size-3.5" />{project.acceptedMilestones}/{project.milestones.length} được chấp nhận<ArrowUpRight className="size-3.5" /></button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Milestone · {project.code}</DialogTitle><DialogDescription>{project.name} · {project.teamName ?? "Dùng chung trong Master"}</DialogDescription></DialogHeader>
      <div className="grid items-start gap-4 sm:grid-cols-2">{!project.milestones.length && <p className="text-xs text-muted-foreground">Chưa có milestone.</p>}
        {project.milestones.map(m => <div key={m.id} className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4 text-xs">
          <div className="flex items-start gap-2"><p className="flex-1 font-semibold leading-5">{m.title}</p>{m.mandatory && <Badge variant="outline" className="text-[10px]">Bắt buộc</Badge>}</div>
          <p className="font-medium">{milestoneLabels[m.status] ?? m.status}</p>
          <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><CalendarClock className="mt-0.5 size-3 shrink-0" />{reportDate(m.deadline, timeZone)}</p>
          <p className="text-[11px] text-muted-foreground">{m.backlog.total} backlog item gắn với milestone</p><BacklogSummary counts={m.backlog} />
          {m.latestSubmittedAt && <p className="text-[11px] text-muted-foreground">Đã nộp: {reportDate(m.latestSubmittedAt, timeZone)}</p>}
          <div className="flex flex-wrap gap-1">{m.overdue && <Badge variant="destructive" className="text-[10px]">Đang quá hạn</Badge>}{m.lateSubmission && <Badge variant="outline" className="text-[10px]">Có lần nộp trễ</Badge>}</div>
        </div>)}
      </div>
    </DialogContent></Dialog>;
}
function Risks({ project, timeZone }: { project: ReportProject; timeZone: string }) {
  return <div className="space-y-2 text-xs">
    {project.overdueMilestones > 0 && <Badge variant="destructive" className="text-[10px]">{project.overdueMilestones} milestone quá hạn</Badge>}
    {project.inactiveMembers.length > 0 && <Dialog><DialogTrigger asChild><button className="block text-left text-amber-700 underline underline-offset-4 dark:text-amber-400">{project.inactiveMembers.length} thành viên không hoạt động</button></DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>Thành viên cần theo dõi</DialogTitle><DialogDescription>{project.code} · {project.teamName}</DialogDescription></DialogHeader>
        <ul className="space-y-3">{project.inactiveMembers.map(member => <li key={member.userId} className="space-y-1 rounded-lg border p-3 text-xs">
          <p className="font-semibold">{member.name}{member.userCode ? " · " + member.userCode : ""}</p>
          <p className="text-muted-foreground">Tham gia: {reportDate(member.joinedAt, timeZone)}</p><p className="text-muted-foreground">Có việc chờ từ: {reportDate(member.pendingSince, timeZone)}</p>
          <p className="text-muted-foreground">Lần bắt đầu task gần nhất: {reportDate(member.lastActivityAt, timeZone)}</p>
        </li>)}</ul>
      </DialogContent></Dialog>}
    {project.lateMilestones > 0 && <p className="text-[11px] text-muted-foreground">{project.lateMilestones} có lần nộp trễ (lịch sử)</p>}
    {!project.overdueMilestones && !project.inactiveMembers.length && !project.lateMilestones && <span className="text-muted-foreground">—</span>}
  </div>;
}
// Keep descendants together even when filters hide their immediate parent.
function treeOrder(projects: ReportProject[]) {
  const ids = new Set(projects.map(p => p.id)), result: ReportProject[] = [], visited = new Set<number>();
  function visit(project: ReportProject) {
    if (visited.has(project.id)) return;
    visited.add(project.id); result.push(project);
    projects.filter(p => p.parentProjectId === project.id).forEach(visit);
  }
  projects.filter(p => p.parentProjectId === null || !ids.has(p.parentProjectId)).forEach(visit);
  projects.forEach(visit);
  return result;
}
export function ReportMasters({ masters, timeZone }: { masters: ReportMaster[]; timeZone: string }) {
  return <div className="space-y-3">{masters.map(master => <details key={master.key} className="group/master overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-xs dark:border-border">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/25 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><FolderKanban className="size-[18px]" /></div>
      <div className="min-w-0 flex-1 basis-52"><p className="text-[10px] font-mono text-muted-foreground">{master.code} · Master Project</p><h3 className="mt-0.5 text-sm font-semibold leading-5 text-foreground">{master.name}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><GraduationCap className="size-3" />{master.className}<span className="mx-1 text-border">|</span><Users className="size-3" />{master.scopedTeams} team · {master.matchingSubProjects}/{master.subProjects} Sub-project khớp bộ lọc</p></div>
      <StatusBadge status={master.status} /><div className="text-right"><strong className="text-base tabular-nums text-foreground">{master.backlog.total}</strong><p className="text-[10px] text-muted-foreground">backlog toàn Master</p></div>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><span className="group-open/master:hidden">Xem chi tiết</span><span className="hidden group-open/master:inline">Thu gọn</span><ChevronDown className="size-3.5 transition-transform group-open/master:rotate-180" /></span>
    </summary>
    <div className="space-y-4 border-t">
      <div className="space-y-3 bg-muted/25 px-5 py-4"><p className="text-xs text-muted-foreground">Đề bài Master: {master.templateName} · {master.sourceVersion}</p>
        <p className="text-[11px] leading-5 text-muted-foreground">Tổng backlog gồm Master và tất cả Project con bạn được phép xem, kể cả module bị ẩn bởi bộ lọc chi tiết.</p>
        <BacklogSummary counts={master.backlog} />
      </div>
      <div className="mx-5 space-y-3 rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-xs font-semibold text-foreground">Phần việc trực tiếp của Master</h4>
        <p className="mt-1 text-xs text-muted-foreground">{master.project.teamName ?? "Dùng chung"} · Mentor: {master.project.mentorName ?? "Chưa gán"}</p></div>
        {master.project.workspaceId && <Link className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline" to={"/management/workspaces/" + master.project.workspaceId}>Mở Workspace<ArrowUpRight className="size-3" /></Link>}
        {!master.project.workspaceId && !master.project.contextOnly && master.project.status === "PLANNING" && <span className="text-xs text-muted-foreground">Chờ publish nhóm để mở Workspace</span>}
      </div>
        {master.project.contextOnly ? <p className="text-xs text-muted-foreground">Bạn được xem Master để định vị Project con; phần việc trực tiếp nằm ngoài phạm vi được cấp.</p> : <>
          <p className="text-xs text-muted-foreground">{master.project.backlog.total} backlog item trực tiếp</p><BacklogSummary counts={master.project.backlog} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2"><Milestones project={master.project} timeZone={timeZone} /><Risks project={master.project} timeZone={timeZone} /></div>
        </>}
      </div>
      {!master.projects.length ? <p className="px-5 pb-5 text-xs text-muted-foreground">{master.subProjects ? "Không có Sub-project khớp bộ lọc hiện tại." : "Master này chưa có Sub-project."}</p> :
        <div className="overflow-x-auto px-2 pb-2"><Table className="min-w-[1100px]"><TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent"><TableHead className="pl-4 text-xs">Mã & tên Sub-project</TableHead><TableHead className="text-xs">Nhóm / Mentor</TableHead><TableHead className="text-xs">Trạng thái Project</TableHead><TableHead className="text-xs">Backlog trực tiếp</TableHead><TableHead className="text-xs">Cần theo dõi</TableHead><TableHead className="text-xs">Milestone</TableHead></TableRow></TableHeader>
          <TableBody>{treeOrder(master.projects).map(project => <TableRow key={project.id} className="align-top">
            <TableCell className="min-w-48 max-w-72 py-4 pl-4 whitespace-normal"><div style={{ paddingLeft: Math.min(project.depth - 1, 5) * 12 }}><p className="text-xs font-mono text-muted-foreground">{project.code}</p><p className="mt-1 text-sm font-medium leading-5">{project.name}</p>
              {project.depth > 1 && <p className="mt-1 text-[10px] text-muted-foreground">Project cha: #{project.parentProjectId}</p>}
              {project.workspaceId && <Link className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline" to={"/management/workspaces/" + project.workspaceId}>Mở Workspace<ArrowUpRight className="size-3" /></Link>}</div>
              {!project.workspaceId && project.status === "PLANNING" && <p className="mt-2 text-[11px] text-muted-foreground">Chờ publish nhóm để mở Workspace</p>}
            </TableCell>
            <TableCell className="py-4 text-xs whitespace-normal"><p>{project.teamName ?? "Dùng chung"}</p><p className="mt-1.5 text-muted-foreground">{project.mentorName ?? "Chưa gán"}</p><p className="mt-1 text-muted-foreground">{project.className}</p></TableCell>
            <TableCell className="py-4"><StatusBadge status={project.status} /></TableCell>
            <TableCell className="max-w-56 py-4"><p className="mb-2 text-xs font-semibold tabular-nums">{project.backlog.total} item</p><BacklogSummary counts={project.backlog} /></TableCell>
            <TableCell className="py-4 whitespace-normal"><Risks project={project} timeZone={timeZone} /></TableCell>
            <TableCell className="py-4 whitespace-normal"><Milestones project={project} timeZone={timeZone} /></TableCell>
          </TableRow>)}</TableBody></Table></div>}
    </div></details>)}</div>;
}
