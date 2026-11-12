import { useState } from "react";
import { Filter, X } from "lucide-react";
import { SearchInput } from "@/components/datatable/toolbar/SearchInput";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportFilters, ReportOption, ReportOptions, ReportRisk, ReportStatus } from "@/types/features/project-report";
import { reportStatuses, statusLabels } from "./report-utils";

interface ReportFilterToolbarProps {
  options: ReportOptions;
  value: ReportFilters;
  applied: ReportFilters;
  onChange: (next: ReportFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value?: number;
  options: ReportOption[];
  onChange: (value?: number) => void;
}) {
  return <div className="grid gap-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value === undefined ? "all" : String(value)} onValueChange={next => onChange(next === "all" ? undefined : Number(next))}>
      <SelectTrigger className="w-full min-w-0" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">Tất cả</SelectItem>
        {options.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

export function ReportFilterToolbar({ options, value, applied, onChange, onApply, onReset }: ReportFilterToolbarProps) {
  const [open, setOpen] = useState(false);
  const update = (changes: Partial<ReportFilters>) => onChange({ ...value, ...changes });
  const classes = options.classes.filter(c => (!value.programId || c.programId === value.programId) && (!value.cohortId || c.cohortId === value.cohortId));
  const projects = (options.projects ?? []).filter(p => classes.some(c => c.id === p.classId) && (!value.classId || p.classId === value.classId));
  const masters = projects.filter(p => p.id === p.masterId);
  const teams = options.teams.filter(t => classes.some(c => c.id === t.classId) && (!value.classId || t.classId === value.classId)
    && (!value.masterId || projects.some(p => p.masterId === value.masterId && p.teamId === t.id)));
  const activeCount = [applied.programId, applied.cohortId, applied.classId, applied.teamId,
    applied.mentorId, applied.templateId, applied.sourceVersionId, applied.projectId, applied.masterId,
    applied.masterStatus, applied.status, applied.createdFrom, applied.createdTo].filter(item => item !== undefined && item !== "").length
    + Number(!!applied.risk && applied.risk !== "ALL");

  const name = (label: string, id: number | undefined, values: ReportOption[]) => id === undefined ? "" : `${label}: ${values.find(item => item.id === id)?.name ?? `#${id}`}`;
  const riskLabels: Record<ReportRisk, string> = { ALL: "", OVERDUE: "Đang quá hạn", INACTIVE_MEMBERS: "Thành viên không hoạt động", NEEDS_ATTENTION: "Đang cần xử lý", LATE_SUBMISSION: "Lịch sử nộp trễ" };
  const appliedLabels = [name("Chương trình", applied.programId, options.programs), name("Cohort", applied.cohortId, options.cohorts),
    name("Lớp", applied.classId, options.classes), name("Team", applied.teamId, options.teams), name("Mentor", applied.mentorId, options.mentors),
    name("Đề bài", applied.templateId, options.templates), name("Phiên bản", applied.sourceVersionId, options.versions),
    name("Master", applied.masterId, options.projects ?? []), name("Project", applied.projectId, options.projects ?? []),
    applied.masterStatus ? "Master: " + statusLabels[applied.masterStatus] : "", applied.status ? "Sub-project: " + statusLabels[applied.status] : "", applied.risk ? riskLabels[applied.risk] : "",
    applied.createdFrom ? `Từ ${applied.createdFrom}` : "", applied.createdTo ? `Đến ${applied.createdTo}` : "",
    applied.q ? `Tìm: ${applied.q}` : ""].filter(Boolean);

  return <div className="space-y-2.5" aria-label="Bộ lọc báo cáo"><div className="flex min-w-0 flex-wrap items-center gap-2.5">
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipWrapper content="Filter data">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 bg-card text-xs shadow-xs">
            <Filter size={14} />Filters
            {activeCount > 0 && <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeCount}</Badge>}
          </Button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent align="start" aria-label="Filters" className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-96 max-w-[calc(100vw-2rem)] flex-col p-0">
        <div className="flex shrink-0 items-center justify-between border-b px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium"><Filter size={14} />Filters</span>
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" aria-label="Đóng bộ lọc" onClick={() => setOpen(false)}><X size={14} /></Button>
        </div>
        <form className="flex min-h-0 flex-col overflow-hidden" onSubmit={event => { event.preventDefault(); onApply(); setOpen(false); }}>
          <div className="grid min-h-0 gap-3 overflow-y-auto p-3">
            <FilterSelect label="Chương trình đào tạo" value={value.programId} options={options.programs} onChange={programId => update({ programId, cohortId: undefined, classId: undefined, teamId: undefined, masterId: undefined, projectId: undefined, workSprintId: undefined })} />
            <FilterSelect label="Khóa / Cohort" value={value.cohortId} options={options.cohorts.filter(c => !value.programId || options.classes.some(item => item.programId === value.programId && item.cohortId === c.id))} onChange={cohortId => update({ cohortId, classId: undefined, teamId: undefined, masterId: undefined, projectId: undefined, workSprintId: undefined })} />
            <FilterSelect label="Lớp" value={value.classId} options={classes} onChange={classId => update({ classId, teamId: undefined, masterId: undefined, projectId: undefined, workSprintId: undefined })} />
            <FilterSelect label="Master Project" value={value.masterId} options={masters} onChange={masterId => update({ masterId, teamId: undefined, projectId: undefined, workSprintId: undefined })} />
            <FilterSelect label="Team" value={value.teamId} options={teams} onChange={teamId => update({ teamId, projectId: undefined, workSprintId: undefined })} />
            <FilterSelect label="Project / phần việc cụ thể" value={value.projectId} options={projects.filter(p => (!value.masterId || p.masterId === value.masterId) && (!value.teamId || p.teamId === value.teamId))} onChange={projectId => update({ projectId, workSprintId: undefined })} />
            <FilterSelect label="Mentor" value={value.mentorId} options={options.mentors} onChange={mentorId => update({ mentorId })} />
            <FilterSelect label="Master Project template" value={value.templateId} options={options.templates} onChange={templateId => update({ templateId, sourceVersionId: undefined })} />
            <FilterSelect label="Phiên bản đề bài" value={value.sourceVersionId} options={options.versions.filter(v => !value.templateId || v.templateId === value.templateId)} onChange={sourceVersionId => update({ sourceVersionId })} />
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Trạng thái Master</Label>
              <Select value={value.masterStatus ?? "all"} onValueChange={status => update({ masterStatus: status === "all" ? undefined : status as ReportStatus })}>
                <SelectTrigger className="w-full" aria-label="Trạng thái Master"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tất cả</SelectItem>{reportStatuses(value.masterStatus ? [value.masterStatus] : []).map(status => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Trạng thái Sub-project</Label>
              <Select value={value.status ?? "all"} onValueChange={status => update({ status: status === "all" ? undefined : status as ReportStatus })}>
                <SelectTrigger className="w-full" aria-label="Trạng thái Sub-project"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tất cả</SelectItem>{reportStatuses(value.status ? [value.status] : []).map(status => <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Cảnh báo Project</Label>
              <Select value={value.risk ?? "ALL"} onValueChange={risk => update({ risk: risk as ReportRisk })}>
                <SelectTrigger className="w-full" aria-label="Cảnh báo Project"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">Tất cả</SelectItem><SelectItem value="OVERDUE">Đang quá hạn</SelectItem>
                  <SelectItem value="INACTIVE_MEMBERS">Thành viên không hoạt động</SelectItem><SelectItem value="NEEDS_ATTENTION">Đang cần xử lý</SelectItem><SelectItem value="LATE_SUBMISSION">Lịch sử nộp trễ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground" htmlFor="report-from">Ngày tạo Project từ</Label><Input id="report-from" type="date" value={value.createdFrom ?? ""} max={value.createdTo} onChange={event => update({ createdFrom: event.target.value || undefined })} /></div>
            <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground" htmlFor="report-to">Ngày tạo Project đến</Label><Input id="report-to" type="date" value={value.createdTo ?? ""} min={value.createdFrom} onChange={event => update({ createdTo: event.target.value || undefined })} /></div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t p-3">
            <Button type="button" variant="outline" size="sm" onClick={onReset}>Đặt lại</Button>
            <Button type="submit" size="sm">Áp dụng</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
    <div className="min-w-0 flex-1 sm:max-w-sm [&_input]:h-8 [&_input]:bg-card [&_input]:text-xs [&_input]:shadow-xs"><SearchInput compact search={value.q ?? ""} onSearchChange={q => update({ q: q.slice(0, 120) })} /></div>
    {(activeCount > 0 || !!applied.q) && <Button type="button" variant="ghost" size="sm" onClick={onReset}>Đặt lại</Button>}
    <span className="ml-auto hidden pr-1 text-[11px] text-muted-foreground md:inline">{activeCount ? `${activeCount} điều kiện đã áp dụng` : "Tất cả dữ liệu trong phạm vi của bạn"}</span>
    </div>
    {appliedLabels.length > 0 && <div className="flex flex-wrap gap-1.5 border-t pt-3" aria-label="Điều kiện đã áp dụng">{appliedLabels.map(label => <Badge key={label} variant="secondary" className="max-w-full rounded-md px-2 py-1 text-[11px] font-normal whitespace-normal">{label}</Badge>)}</div>}
  </div>;
}
