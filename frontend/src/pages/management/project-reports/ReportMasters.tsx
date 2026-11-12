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
  return <Dialog><DialogTrigger asChild><button type="button" data-report-milestone-trigger aria-label={`Xem milestone của ${project.code}: ${project.acceptedMilestones}/${project.milestones.length} được chấp nhận`} className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400"><FileCheck2 className="size-3.5 shrink-0" /><span className="min-w-0"><span className="block tabular-nums">{project.acceptedMilestones}/{project.milestones.length}</span><span className="block text-[10px] font-normal leading-4">được chấp nhận</span></span><ArrowUpRight className="size-3 shrink-0" /></button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Milestone · {project.code}</DialogTitle><DialogDescription>{project.name} · {project.teamName ?? "Dùng chung trong Master"}</DialogDescription></DialogHeader>
      <div className="grid items-start gap-4 sm:grid-cols-2">{!project.milestones.length && <p className="text-xs text-muted-foreground">Chưa có milestone.</p>}
        {project.milestones.map(m => <div key={m.id} className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4 text-xs">
          <div className="flex items-start gap-2"><p className="min-w-0 flex-1 font-semibold leading-5 [overflow-wrap:anywhere]">{m.title}</p>{m.mandatory && <Badge variant="outline" className="shrink-0 text-[10px]">Bắt buộc</Badge>}</div>
          <p className="font-medium">{milestoneLabels[m.status] ?? m.status}</p>
          <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><CalendarClock className="mt-0.5 size-3 shrink-0" />{reportDate(m.deadline, timeZone)}</p>
          <p className="text-[11px] text-muted-foreground">{m.backlog.total} backlog item gắn với milestone</p><BacklogSummary counts={m.backlog} />
          {m.latestSubmittedAt && <p className="text-[11px] text-muted-foreground">Đã nộp: {reportDate(m.latestSubmittedAt, timeZone)}</p>}
        </div>)}
      </div>
    </DialogContent></Dialog>;
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
function ProjectIdentity({ project }: { project: ReportProject }) {
  return <div className="min-w-0 [overflow-wrap:anywhere]" style={{ paddingLeft: Math.max(0, Math.min(project.depth - 1, 5)) * 12 }}>
    <p className="text-[11px] font-mono text-muted-foreground">{project.code}</p><p className="mt-1 text-sm font-medium leading-5">{project.name}</p>
    {project.depth > 1 && <p className="mt-1 text-[10px] text-muted-foreground">Project cha: #{project.parentProjectId}</p>}
    {project.workspaceId && <Link className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline" to={"/management/workspaces/" + project.workspaceId}>Mở Workspace<ArrowUpRight className="size-3 shrink-0" /></Link>}
    {!project.workspaceId && project.status === "PLANNING" && <p className="mt-2 text-[11px] text-muted-foreground">Chờ publish nhóm để mở Workspace</p>}
  </div>;
}
function ProjectPeople({ project }: { project: ReportProject }) {
  return <div className="min-w-0 text-xs [overflow-wrap:anywhere]"><p>{project.teamName ?? "Dùng chung"}</p><p className="mt-1 text-muted-foreground">{project.mentorName ?? "Chưa gán"}</p><p className="mt-1 text-muted-foreground">{project.className}</p></div>;
}
function ProjectBacklog({ project }: { project: ReportProject }) {
  return <div className="min-w-0 [&_dl]:min-w-0"><p className="mb-2 text-xs font-semibold tabular-nums">{project.backlog.total} item</p><BacklogSummary counts={project.backlog} /></div>;
}
function SubProjects({ projects, timeZone }: { projects: ReportProject[]; timeZone: string }) {
  const ordered = treeOrder(projects);
  return <>
    <div data-report-subproject-table className="hidden px-2 pb-2 @[960px]/master-details:block"><Table className="table-fixed"><TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent"><TableHead className="w-[26%] pl-3 text-xs whitespace-normal">Mã & tên Sub-project</TableHead><TableHead className="w-[18%] text-xs whitespace-normal">Nhóm / Mentor</TableHead><TableHead className="w-[18%] text-xs whitespace-normal">Trạng thái Project</TableHead><TableHead className="w-[22%] text-xs whitespace-normal">Backlog trực tiếp</TableHead><TableHead className="w-[16%] text-xs whitespace-normal">Milestone</TableHead></TableRow></TableHeader>
      <TableBody>{ordered.map(project => <TableRow key={project.id} className="align-top">
        <TableCell className="py-3 pl-3 whitespace-normal"><ProjectIdentity project={project} /></TableCell>
        <TableCell className="py-3 whitespace-normal"><ProjectPeople project={project} /></TableCell>
        <TableCell className="py-3 whitespace-normal"><StatusBadge status={project.status} /></TableCell>
        <TableCell className="py-3 whitespace-normal"><ProjectBacklog project={project} /></TableCell>
        <TableCell className="py-3 whitespace-normal"><Milestones project={project} timeZone={timeZone} /></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <div data-report-subproject-cards className="space-y-2.5 px-3 pb-3 @[960px]/master-details:hidden">{ordered.map(project => <article key={project.id} aria-label={`Sub-project ${project.code}`} className="min-w-0 rounded-lg border p-3">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1 basis-44"><ProjectIdentity project={project} /></div><StatusBadge status={project.status} /></div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 @[600px]/master-details:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="col-span-2 min-w-0 @[420px]/master-details:col-span-1"><p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Nhóm / Mentor</p><ProjectPeople project={project} /></div>
        <div className="col-span-2 min-w-0 @[420px]/master-details:col-span-1"><p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Backlog trực tiếp</p><ProjectBacklog project={project} /></div>
        <div className="col-span-2 min-w-0 @[600px]/master-details:col-span-1"><p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Milestone</p><Milestones project={project} timeZone={timeZone} /></div>
      </div>
    </article>)}</div>
  </>;
}
export function ReportMasters({ masters, timeZone }: { masters: ReportMaster[]; timeZone: string }) {
  return <div className="space-y-2.5">{masters.map(master => <details key={master.key} className="group/master min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-xs dark:border-border">
    <summary data-report-master-summary className="grid cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-2.5 gap-y-2 p-3 transition-colors hover:bg-muted/25 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[2rem_minmax(0,1fr)_auto] [&::-webkit-details-marker]:hidden">
      <div aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><FolderKanban className="size-4" /></div>
      <div className="min-w-0 [overflow-wrap:anywhere]"><p className="text-[10px] font-mono text-muted-foreground">{master.code} · Master Project</p><h3 className="mt-0.5 text-sm font-semibold leading-5 text-foreground">{master.name}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-4 text-muted-foreground"><span className="inline-flex min-w-0 items-center gap-1"><GraduationCap className="size-3 shrink-0" />{master.className}</span><span className="text-border">·</span><span className="inline-flex items-center gap-1"><Users className="size-3 shrink-0" />{master.scopedTeams} team</span><span>· {master.matchingSubProjects}/{master.subProjects} Sub-project</span></p></div>
      <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end">
        <StatusBadge status={master.status} />
        <span className="text-[11px] text-muted-foreground"><strong className="font-semibold tabular-nums text-foreground">{master.backlog.total}</strong> backlog toàn Master</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground"><span className="group-open/master:hidden">Xem chi tiết</span><span className="hidden group-open/master:inline">Thu gọn</span><ChevronDown className="size-3.5 transition-transform group-open/master:rotate-180" /></span>
      </div>
    </summary>
    <div data-report-master-details className="@container/master-details min-w-0 space-y-4 border-t [overflow-wrap:anywhere]">
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
          <Milestones project={master.project} timeZone={timeZone} />
        </>}
      </div>
      {!master.projects.length ? <p className="px-5 pb-5 text-xs text-muted-foreground">{master.subProjects ? "Không có Sub-project khớp bộ lọc hiện tại." : "Master này chưa có Sub-project."}</p> : <SubProjects projects={master.projects} timeZone={timeZone} />}
    </div></details>)}</div>;
}
