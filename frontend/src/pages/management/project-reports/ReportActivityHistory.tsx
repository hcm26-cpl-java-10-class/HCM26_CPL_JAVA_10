import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, History, RefreshCw } from "lucide-react";
import { projectReportApi } from "@/api/features/project-report.api";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportActivity, ReportFilters } from "@/types/features/project-report";
import { activityLabel, deliveryLabels, workLabels } from "./report-labels";
import { reportDate, reportErrorMessage } from "./report-utils";

function recentDates(asOf: string, timeZone: string) {
  const activityTo = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(asOf));
  const start = new Date(activityTo + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - 6);
  return { activityFrom: start.toISOString().slice(0, 10), activityTo };
}

function EventStatus({ event }: { event: ReportActivity }) {
  return <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
    {event.beforeStatus && <span className="rounded bg-muted px-1.5 py-0.5">{workLabels[event.beforeStatus] ?? deliveryLabels[event.beforeStatus] ?? event.beforeStatus}</span>}
    {event.beforeStatus && event.afterStatus && <ArrowRight className="size-3" aria-hidden="true" />}
    {event.afterStatus && <span className="rounded bg-muted px-1.5 py-0.5">{workLabels[event.afterStatus] ?? deliveryLabels[event.afterStatus] ?? event.afterStatus}</span>}
  </div>;
}

export function ReportActivityHistory({ owner, filters, timeZone, asOf }: {
  owner: string; filters: ReportFilters; timeZone: string; asOf: string;
}) {
  const location = useLocation();
  const [dates, setDates] = useState(() => recentDates(asOf, timeZone));
  const [draft, setDraft] = useState(dates);
  const [dateError, setDateError] = useState("");
  const [page, setPage] = useState(0);
  const [before, setBefore] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { resultsRef.current?.scrollTo({ top: 0 }); }, [page, dates, refreshKey]);
  const size = 20;
  const query = useQuery({
    queryKey: ["project-report-activity", owner, filters, "history", dates, page, before, refreshKey],
    queryFn: ({ signal }) => projectReportApi.activityHistory(filters, { ...dates, historyPage: page, historySize: size, before }, signal),
    retry: false, gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false,
  });
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const events = query.data?.content ?? [];
  function changePage(next: number) {
    setBefore(before ?? query.data?.asOf);
    setPage(next);
  }
  function applyDates(next: typeof dates) {
    if (!next.activityFrom || !next.activityTo || next.activityFrom > next.activityTo) {
      setDateError("Chọn khoảng ngày hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      return;
    }
    setDateError(""); setDates(next); setDraft(next); setBefore(undefined); setPage(0); setRefreshKey(key => key + 1);
  }
  function refresh() { setBefore(undefined); setPage(0); setRefreshKey(key => key + 1); }
  function detail(event: ReportActivity) {
    return event.href ? <Link to={event.href} state={{ returnTo: location.pathname + location.search }} className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">Xem chi tiết<ArrowRight className="size-3" /></Link> : <span className="text-muted-foreground">—</span>;
  }
  return <>
    <DialogHeader className="shrink-0 gap-1.5 border-b bg-violet-50/40 px-4 py-4 pr-12 dark:bg-violet-950/15">
      <DialogTitle className="flex items-center gap-2 text-base font-semibold"><History className="size-4 text-violet-500" />Lịch sử hoạt động</DialogTitle>
      <DialogDescription className="text-xs leading-5">Các Project/team khớp bộ lọc Dashboard. Lọc theo ngày phát sinh hoạt động, mới nhất trước.</DialogDescription>
    </DialogHeader>
    <form className="flex shrink-0 flex-wrap items-end gap-2.5 border-b px-4 py-3" onSubmit={event => { event.preventDefault(); applyDates(draft); }}>
      <label className="grid min-w-0 flex-1 gap-1 text-[11px] text-muted-foreground sm:max-w-44">Từ ngày hoạt động<input aria-label="Từ ngày hoạt động" type="date" required value={draft.activityFrom} onChange={event => setDraft(current => ({ ...current, activityFrom: event.target.value }))} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-xs text-foreground" /></label>
      <label className="grid min-w-0 flex-1 gap-1 text-[11px] text-muted-foreground sm:max-w-44">Đến ngày hoạt động<input aria-label="Đến ngày hoạt động" type="date" required value={draft.activityTo} onChange={event => setDraft(current => ({ ...current, activityTo: event.target.value }))} className="h-9 w-full min-w-0 rounded-md border bg-background px-2 text-xs text-foreground" /></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" className="text-xs"><CalendarDays className="size-3.5" />Lọc lịch sử</Button><Button type="button" size="sm" variant="outline" className="text-xs" onClick={() => applyDates(recentDates(asOf, timeZone))}>7 ngày gần đây</Button><Button type="button" size="sm" variant="ghost" className="text-xs" disabled={query.isFetching} onClick={refresh}><RefreshCw className={query.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />Làm mới lịch sử</Button></div>
      {dateError && <p role="alert" className="w-full text-xs text-destructive">{dateError}</p>}
    </form>
    <div ref={resultsRef} data-report-history-results className="min-h-0 flex-1 overflow-auto overscroll-contain" role="region" aria-label="Kết quả lịch sử hoạt động" aria-busy={query.isFetching} tabIndex={0}>
      {query.isPending ? <div role="status" aria-label="Đang tải lịch sử hoạt động" className="space-y-3 p-4">{[0, 1, 2, 3, 4].map(row => <Skeleton key={row} className="h-14 w-full" />)}</div> : query.isError ? <div className="space-y-3 px-4 py-10 text-center"><p role="alert" className="text-sm text-destructive">{reportErrorMessage(query.error)}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Thử lại lịch sử</Button></div> : !events.length ? <div className="px-4 py-12 text-center"><History className="mx-auto mb-3 size-7 text-muted-foreground" /><p className="text-sm font-medium">Chưa có hoạt động trong khoảng ngày này</p><p className="mt-1 text-xs text-muted-foreground">Thử chọn khoảng ngày khác hoặc điều chỉnh bộ lọc Dashboard.</p></div> : <>
        <table className="hidden w-full table-fixed text-left text-xs md:table"><thead className="sticky top-0 z-10 bg-muted"><tr><th className="w-[15%] px-4 py-2.5 font-medium">Thời gian</th><th className="w-[16%] px-3 py-2.5 font-medium">Người thực hiện</th><th className="w-[29%] px-3 py-2.5 font-medium">Hoạt động</th><th className="w-[27%] px-3 py-2.5 font-medium">Project / Team</th><th className="w-[13%] px-3 py-2.5 font-medium">Chi tiết</th></tr></thead>
          <tbody className="divide-y">{events.map(event => <tr key={event.id} className="align-top hover:bg-muted/30"><td className="px-4 py-3 text-[11px] leading-5 text-muted-foreground"><time>{reportDate(event.occurredAt, timeZone)}</time></td><td className="px-3 py-3 font-medium leading-5 [overflow-wrap:anywhere]">{event.actorName}</td><td className="space-y-1.5 px-3 py-3 [overflow-wrap:anywhere]"><p className="text-[11px] text-muted-foreground">{activityLabel(event.action)}</p><p className="font-medium leading-5">{event.subject}</p><EventStatus event={event} /></td><td className="space-y-1 px-3 py-3 leading-5 [overflow-wrap:anywhere]"><p className="font-medium">{event.projectCode} · {event.projectName}</p><p className="text-[11px] text-muted-foreground">{event.teamName ?? "Phần việc dùng chung"}</p>{event.masterName !== event.projectName && <p className="text-[10px] text-muted-foreground">Master: {event.masterName}</p>}</td><td className="px-3 py-3">{detail(event)}</td></tr>)}</tbody>
        </table>
        <ol className="divide-y px-4 md:hidden">{events.map(event => <li key={event.id} className="space-y-2 py-3 [overflow-wrap:anywhere]"><div className="flex flex-wrap justify-between gap-1 text-[11px]"><strong>{event.actorName}</strong><time className="text-muted-foreground">{reportDate(event.occurredAt, timeZone)}</time></div><p className="text-[11px] text-muted-foreground">{activityLabel(event.action)}</p><p className="text-xs font-medium">{event.subject}</p><p className="text-[11px] leading-5 text-muted-foreground">{event.projectCode} · {event.projectName} · {event.teamName ?? "Phần việc dùng chung"}</p>{event.masterName !== event.projectName && <p className="text-[10px] text-muted-foreground">Master: {event.masterName}</p>}<div className="flex flex-wrap items-center justify-between gap-2"><EventStatus event={event} />{detail(event)}</div></li>)}</ol>
      </>}
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-3">
      <div className="space-y-1"><p aria-live="polite" className="text-xs">{query.isPending ? "Đang tải hoạt động…" : query.isError ? `Trang ${page + 1} chưa tải được` : total ? `${page * size + 1}–${Math.min((page + 1) * size, total)} / ${total} hoạt động · Trang ${page + 1} / ${pages}` : "0 hoạt động"}</p><p className="text-[10px] text-muted-foreground">20 dòng mỗi trang · {timeZone}</p></div>
      <div className="flex flex-wrap gap-1.5"><Button variant="outline" size="sm" className="text-xs" disabled={page === 0 || query.isFetching} onClick={() => changePage(0)}>Đầu</Button><Button variant="outline" size="sm" className="text-xs" disabled={page === 0 || query.isFetching} onClick={() => changePage(page - 1)}><ArrowLeft className="size-3" />Trước</Button><Button variant="outline" size="sm" className="text-xs" disabled={!query.data || page >= pages - 1 || query.isFetching} onClick={() => changePage(page + 1)}>Sau<ArrowRight className="size-3" /></Button><Button variant="outline" size="sm" className="text-xs" disabled={!query.data || page >= pages - 1 || query.isFetching} onClick={() => changePage(pages - 1)}>Cuối</Button><DialogClose asChild><Button variant="ghost" size="sm" className="text-xs">Đóng</Button></DialogClose></div>
    </footer>
  </>;
}
