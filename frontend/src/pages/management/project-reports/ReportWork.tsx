import { useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportDashboard } from "@/types/features/project-report";
import { reportDate } from "./report-utils";
import { ReportStateBadge } from "./report-ui";

const SPRINT_PAGE_SIZE = 10;

export function ReportWork({ work, timeZone, onSelect }: { work: ReportDashboard["work"]; timeZone: string; onSelect: (id?: number) => void }) {
  const [page, setPage] = useState(() => {
    const selectedIndex = work.sprints.findIndex(sprint => sprint.id === work.selectedSprintId);
    return selectedIndex < 0 ? 0 : Math.floor(selectedIndex / SPRINT_PAGE_SIZE);
  });
  const pages = Math.max(1, Math.ceil(work.sprints.length / SPRINT_PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const viewSprints = work.sprints.slice(currentPage * SPRINT_PAGE_SIZE, (currentPage + 1) * SPRINT_PAGE_SIZE);
  const entries = [
    { label: "Todo", value: work.backlog.todo, color: "bg-slate-400" },
    { label: "In progress", value: work.backlog.inProgress, color: "bg-blue-500" },
    { label: "Review", value: work.backlog.review, color: "bg-amber-500" },
    { label: "Done", value: work.backlog.done, color: "bg-emerald-500" },
  ];
  const maximum = Math.max(1, ...entries.map(entry => entry.value));
  const selected = work.sprints.find(sprint => sprint.id === work.selectedSprintId);
  const statusLabels: Record<string, string> = { PLANNED: "Not started", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled" };
  return <section data-report-work className="space-y-3.5" aria-label="Work breakdown by sprint">
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="size-4 text-blue-500" />Work status breakdown</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Work items in the current scope, excluding subtasks. Total <strong className="font-medium text-foreground">{work.backlog.total.toLocaleString("en-GB")}</strong> work items.</p></div>
        <Select value={work.selectedSprintId?.toString() ?? "all"} onValueChange={value => onSelect(value === "all" ? undefined : Number(value))}>
          <SelectTrigger aria-label="Sprint for work breakdown" className="w-full min-w-0 sm:max-w-sm"><SelectValue placeholder="All work items" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All work items</SelectItem>{work.sprints.map(sprint => <SelectItem key={sprint.id} value={String(sprint.id)}>{sprint.name} · {sprint.teamName ?? sprint.projectName}</SelectItem>)}</SelectContent>
        </Select>
      </header>
      <p className="mt-2 text-[11px] text-muted-foreground">The sprint selection applies to work items and the Excel sprint sheet. Project metrics and activity use the main filters.</p>
      <div className="mt-5 grid gap-4" role="img" aria-label={entries.map(entry => `${entry.label}: ${entry.value} work items`).join(". ")}>
        {entries.map(entry => <div key={entry.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-xs sm:grid-cols-[110px_minmax(0,1fr)_auto]">
          <span className="font-medium">{entry.label}</span><div className="h-7 overflow-hidden rounded bg-muted/50"><div className={`h-full rounded ${entry.color}`} style={{ width: `${entry.value / maximum * 100}%` }} /></div>
          <strong className="min-w-11 text-right text-lg font-semibold tabular-nums">{entry.value.toLocaleString("en-GB")}</strong>
        </div>)}
      </div>
      {work.backlog.total === 0 && <p className="mt-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">No work items {selected ? "in this sprint" : "match the filters"}.</p>}
    </div>
    <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarRange className="size-4 text-muted-foreground" />Sprints in scope</h2><span className="text-xs text-muted-foreground">{work.sprints.length} Sprint</span></header>
      {!work.sprints.length ? <p className="p-6 text-sm text-muted-foreground">No sprints match the filters.</p> : <div className="overflow-x-auto"><Table className="min-w-[900px]"><TableHeader><TableRow>
        {["Sprint / Project", "Class", "Team", "Status", "Time", "Todo", "In progress", "Review", "Done", ""].map((label, i) => <TableHead key={i} className="text-xs">{label}</TableHead>)}
      </TableRow></TableHeader><TableBody>{viewSprints.map(sprint => <TableRow key={sprint.id} className={selected?.id === sprint.id ? "bg-muted/50" : ""}>
        <TableCell className="max-w-64 whitespace-normal"><p className="text-xs font-medium">{sprint.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{sprint.projectName}</p></TableCell>
        <TableCell className="max-w-48 whitespace-normal text-xs [overflow-wrap:anywhere]">{sprint.className}</TableCell>
        <TableCell className="text-xs">{sprint.teamName ?? "Shared"}</TableCell><TableCell className="text-xs"><ReportStateBadge status={sprint.status}>{statusLabels[sprint.status] ?? sprint.status}</ReportStateBadge></TableCell>
        <TableCell className="text-[11px] text-muted-foreground"><p>{reportDate(sprint.startAt, timeZone)}</p><p>{reportDate(sprint.endAt, timeZone)}</p></TableCell>
        {[sprint.backlog.todo, sprint.backlog.inProgress, sprint.backlog.review, sprint.backlog.done].map((count, i) => <TableCell key={i} className="text-xs font-medium tabular-nums">{count.toLocaleString("en-GB")}</TableCell>)}
        <TableCell><Button variant="ghost" size="sm" className="text-xs" onClick={() => onSelect(selected?.id === sprint.id ? undefined : sprint.id)}>{selected?.id === sprint.id ? "Clear selection" : "View breakdown"}</Button></TableCell>
      </TableRow>)}</TableBody></Table></div>}
      {work.sprints.length > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
        <p aria-live="polite" className="text-xs text-muted-foreground">{currentPage * SPRINT_PAGE_SIZE + 1}–{Math.min((currentPage + 1) * SPRINT_PAGE_SIZE, work.sprints.length)} / {work.sprints.length} Sprint · {SPRINT_PAGE_SIZE} Sprint/trang</p>
        <nav aria-label="Sprint pages" className="flex items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">Page {currentPage + 1} / {pages}</span>
          <Button variant="outline" size="sm" className="text-xs" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft className="size-3.5" />Previous</Button>
          <Button variant="outline" size="sm" className="text-xs" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Next<ArrowRight className="size-3.5" /></Button>
        </nav>
      </footer>}
    </div>
  </section>;
}
