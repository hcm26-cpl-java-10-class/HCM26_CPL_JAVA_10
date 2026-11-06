import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, ChevronDown, FileCheck2, FolderKanban, GraduationCap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportMaster, ReportProject } from "@/types/features/project-report";
import { ProgressValue, reportDate, StatusBadge } from "./report-ui";

function Milestones({ project, timeZone }: { project: ReportProject; timeZone: string }) {
  return <Dialog><DialogTrigger asChild><button type="button" className="flex min-w-40 items-center gap-2 rounded-md py-1 text-left text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"><FileCheck2 className="size-3.5" />{project.acceptedMilestones}/{project.milestones.length} được chấp nhận<ArrowUpRight className="size-3.5" /></button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Milestone của team {project.teamName}</DialogTitle><DialogDescription>{project.code} · {project.name}</DialogDescription></DialogHeader>
    <div className="grid items-start gap-4 sm:grid-cols-2">{!project.milestones.length && <p className="text-xs text-muted-foreground">Chưa có milestone.</p>}
      {project.milestones.map(m => <div key={m.id} className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4 text-xs">
        <div className="flex items-start gap-2"><p className="flex-1 font-semibold leading-5">{m.title}</p>{m.mandatory && <Badge variant="outline" className="text-[10px]">Bắt buộc</Badge>}</div>
        <p className="text-[11px] text-muted-foreground">{m.status} · Trọng số: {m.weight === null ? "Chưa đặt" : `${m.weight}%`}</p>
        <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><CalendarClock className="mt-0.5 size-3 shrink-0" />{reportDate(m.deadline, timeZone)}</p>
        <ProgressValue value={m.progress} /><p className="text-[11px] text-muted-foreground">{m.doneTasks}/{m.totalTasks} công việc Done</p>
        {m.latestSubmittedAt && <p className="text-[11px] text-muted-foreground">Đã nộp: {reportDate(m.latestSubmittedAt, timeZone)}</p>}
        {m.status === "SUBMITTED" && !m.lateSubmission && <p className="text-[11px] text-violet-600 dark:text-violet-400">Đang chờ Mentor chấm.</p>}
        <div className="flex flex-wrap gap-1">{m.overdue && <Badge variant="destructive" className="text-[10px]">Đang quá hạn</Badge>}{m.lateSubmission && <Badge variant="outline" className="text-[10px]">Có lần nộp trễ</Badge>}{m.atRisk && <Badge variant="secondary" className="text-[10px]">Sắp hạn · Có rủi ro</Badge>}</div>
      </div>)}</div></DialogContent></Dialog>;
}
export function ReportMasters({ masters, timeZone }: { masters: ReportMaster[]; timeZone: string }) {
  return <div className="space-y-4">{masters.map(master => <details key={master.key} className="group/master overflow-hidden rounded-xl border bg-card">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-5 transition-colors hover:bg-muted/25 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><FolderKanban className="size-5" /></div>
      <div className="min-w-0 flex-1 basis-52"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold leading-6">{master.templateName}</h3><Badge variant="outline" className="rounded-md text-[10px] font-normal">{master.sourceVersion}</Badge></div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><GraduationCap className="size-3.5" />{master.className}<span className="mx-1 text-border">|</span><Users className="size-3.5" />{master.matchingTeams}/{master.scopedTeams} team khớp bộ lọc</p></div>
      <StatusBadge status={master.status} /><div className="w-28"><ProgressValue value={master.progress} /></div>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="group-open/master:hidden">Xem chi tiết</span><span className="hidden group-open/master:inline">Thu gọn</span><ChevronDown className="size-4 transition-transform group-open/master:rotate-180" /></span>
    </summary>
    <div className="space-y-4 border-t">
      <div className="space-y-1 bg-muted/25 px-5 py-3"><p className="text-[11px] leading-5 text-muted-foreground">Tiến độ Master tính trên toàn bộ team bạn được phép xem trong nhóm đề bài, loại team có dự án đã hủy.</p>
        {master.missingProgressTeams > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{master.missingProgressTeams} team thiếu cấu hình trọng số; chưa thể tính tiến độ Master.</p>}</div>
      <div className="overflow-x-auto px-2 pb-2"><Table className="min-w-[900px]"><TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent"><TableHead className="pl-4 text-xs">Dự án / Team</TableHead><TableHead className="text-xs">Mentor</TableHead><TableHead className="text-xs">Trạng thái</TableHead><TableHead className="text-xs">Tiến độ</TableHead><TableHead className="text-xs">Rủi ro milestone</TableHead><TableHead className="text-xs">Bàn giao</TableHead></TableRow></TableHeader>
        <TableBody>{master.projects.map(project => <TableRow key={project.id} className="align-top">
          <TableCell className="min-w-48 max-w-72 py-4 pl-4 whitespace-normal"><p className="text-xs font-mono text-muted-foreground">{project.code}</p><p className="mt-1 text-sm font-medium leading-5">{project.name}</p><p className="mt-1.5 text-xs text-muted-foreground">{project.teamName} · {project.className}</p>
            {project.workspaceId && <Link className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400" to={`/management/workspaces/${project.workspaceId}`}>Mở workspace<ArrowUpRight className="size-3" /></Link>}</TableCell>
          <TableCell className="py-4 text-xs">{project.mentorName || "Chưa gán"}</TableCell><TableCell className="py-4"><StatusBadge status={project.status} /></TableCell>
          <TableCell className="py-4"><ProgressValue value={project.progress} />{project.notes.map(note => <p key={note} className="mt-2 max-w-60 whitespace-normal text-[11px] leading-5 text-muted-foreground">{note}</p>)}</TableCell>
          <TableCell className="space-y-2 py-4 text-xs">{project.overdueMilestones > 0 && <p className="text-rose-600 dark:text-rose-400">{project.overdueMilestones} đang quá hạn</p>}
            {project.atRiskMilestones > 0 && <p className="text-amber-700 dark:text-amber-400">{project.atRiskMilestones} sắp hạn có rủi ro</p>}
            {project.lateMilestones > 0 && <p className="text-[11px] text-muted-foreground">{project.lateMilestones} có lần nộp trễ (lịch sử)</p>}
            {!project.overdueMilestones && !project.atRiskMilestones && !project.lateMilestones && <span className="text-muted-foreground">—</span>}</TableCell>
          <TableCell className="py-4 whitespace-normal"><Milestones project={project} timeZone={timeZone} /></TableCell>
        </TableRow>)}</TableBody></Table></div>
    </div></details>)}</div>;
}
