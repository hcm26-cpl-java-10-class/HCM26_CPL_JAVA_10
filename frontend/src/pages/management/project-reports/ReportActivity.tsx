import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowRight, FileCheck2, Flag, History, ListTodo } from "lucide-react";
import { projectReportApi } from "@/api/features/project-report.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ReportActivityPage, ReportFilters } from "@/types/features/project-report";
import { activityLabel, deliveryLabels, workLabels } from "./report-labels";
import { reportDate, reportErrorMessage } from "./report-utils";
import { ReportActivityHistory } from "./ReportActivityHistory";
import { reportStateStyle } from "./report-ui";

export function ReportActivity({ initial, filters, owner, timeZone }: {
  initial: ReportActivityPage; filters: ReportFilters; owner: string; timeZone: string;
}) {
  const location = useLocation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const scope = { ...filters, page: undefined, size: undefined, workSprintId: undefined };
  const query = useQuery({
    queryKey: ["project-report-activity", owner, scope, "preview"],
    initialData: initial,
    queryFn: ({ signal }) => projectReportApi.activities(scope, 0, undefined, signal),
    retry: false, gcTime: 0, staleTime: 30_000, refetchInterval: 30_000, refetchIntervalInBackground: false,
  });
  const events = query.data.content.slice(0, 10);
  return <section data-report-activity aria-label="Recent activity" className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
    <header className="shrink-0 border-b bg-violet-50/40 px-3 py-3 dark:bg-violet-950/15"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-xs font-semibold"><Activity className="size-4 text-violet-500" />Recent activity</h2>
      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300" aria-label={`${events.length} events shown`}>{events.length}</span></div>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Activity for matching projects and teams, newest first.</p>
    </header>
    <div data-report-activity-scroll role="region" aria-label="Activity list" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
    {!events.length && !query.isError && <p className="px-4 py-8 text-center text-xs text-muted-foreground">No activity has been recorded in this scope.</p>}
    <ol className="divide-y">{events.map(event => {
      const Icon = event.entityType === "SUBMISSION" ? FileCheck2 : event.entityType === "MILESTONE" ? Flag : ListTodo;
      return <li key={event.id} className="flex min-w-0 gap-2 py-2.5">
        <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="size-3 text-muted-foreground" /></span>
        <div className="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]"><div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5"><p className="text-[11px] font-semibold leading-4">{event.actorName}</p><time className="text-[9px] leading-4 text-muted-foreground">{reportDate(event.occurredAt, timeZone)}</time></div>
          <p className="text-[10px] leading-4 text-muted-foreground">{activityLabel(event.action)}</p>
          <p className="text-xs font-medium leading-4">{event.subject}</p>
          <p className="text-[10px] leading-4 text-muted-foreground">{event.projectCode} · {event.projectName} · {event.teamName ?? "Shared work"}</p>
          {event.masterName !== event.projectName && <p className="text-[10px] leading-4 text-muted-foreground">Master: {event.masterName}</p>}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
              {event.beforeStatus && <span data-report-status={event.beforeStatus} className={"rounded px-1.5 py-0.5 " + reportStateStyle(event.beforeStatus).surface}>{workLabels[event.beforeStatus] ?? deliveryLabels[event.beforeStatus] ?? event.beforeStatus}</span>}
              {event.beforeStatus && event.afterStatus && <ArrowRight aria-hidden="true" className="size-3" />}
              {event.afterStatus && <span data-report-status={event.afterStatus} className={"rounded px-1.5 py-0.5 " + reportStateStyle(event.afterStatus).surface}>{workLabels[event.afterStatus] ?? deliveryLabels[event.afterStatus] ?? event.afterStatus}</span>}
            </div>
            {event.href && <Link to={event.href} state={{ returnTo: location.pathname + location.search }} className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">View details<ArrowRight className="size-3" /></Link>}
          </div>
        </div>
      </li>;
    })}</ol>
    </div>
    {query.isError && <div className="shrink-0 space-y-2 border-t p-3"><p role="alert" className="text-xs text-destructive">{reportErrorMessage(query.error)}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry loading activity</Button></div>}
    <footer className="flex shrink-0 flex-col items-start gap-2 border-t px-3 py-2.5"><span className="text-[9px] text-muted-foreground">Up to 10 recent events · {reportDate(query.data.asOf, timeZone)}</span>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 w-full text-[11px]"><History className="size-3.5" />View history</Button></DialogTrigger>
        <DialogContent data-report-history-dialog className="flex max-h-[88dvh] w-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          {historyOpen && <ReportActivityHistory owner={owner} filters={scope} timeZone={timeZone} asOf={query.data.asOf} />}
        </DialogContent>
      </Dialog>
    </footer>
  </section>;
}
