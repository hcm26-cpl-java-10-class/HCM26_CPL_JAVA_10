import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, BarChart3, Clock3, FolderSearch, Layers3, RefreshCw } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { projectReportApi } from "@/api/features/project-report.api";
import type { ReportFilters } from "@/types/features/project-report";
import { ReportOverview } from "./ReportOverview";
import { ReportMasters } from "./ReportMasters";
import { ReportExports } from "./ReportExports";
import { ReportFilterToolbar } from "./ReportFilters";
import { reportDate, reportErrorMessage } from "./report-utils";
import { ReportWork } from "./ReportWork";
import { ReportDeliveries } from "./ReportDeliveries";
import { ReportActivity } from "./ReportActivity";
import { readReportFilters, reportDefaults as defaults, writeReportFilters } from "./report-navigation";
import "./report-dashboard.css";

function LoadingReport() {
  return <div className="space-y-3.5" role="status" aria-label="Đang tổng hợp báo cáo">
    <div className="grid grid-cols-2 gap-3 @[600px]/reports:grid-cols-3 @[960px]/reports:grid-cols-6">{[0, 1, 2, 3, 4, 5].map(key =>
      <Card key={key}><CardContent className="space-y-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-10 w-16" /><Skeleton className="h-3 w-40" /></CardContent></Card>)}</div>
    <div className="grid gap-3.5 @[960px]/reports:grid-cols-2 @[1020px]/reports:grid-cols-3">
      {[0, 1, 2].map(key => <Skeleton key={key} className="h-56 rounded-lg" />)}
      <Skeleton className="h-56 rounded-lg @[1020px]/reports:col-span-3 @[1020px]/reports:h-40" />
    </div>
  </div>;
}
function ReportContent({ owner }: { owner: string }) {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [params, setParams] = useSearchParams();
  const applied = useMemo(() => readReportFilters(params), [params]);
  const [draft, setDraft] = useState<ReportFilters>(applied);
  const view = ["overview", "work", "deliveries"].includes(params.get("view") ?? "") ? params.get("view")! : "overview";
  useEffect(() => setDraft(applied), [applied]);
  function setApplied(next: ReportFilters, replace = false) { setParams(current => writeReportFilters(current, next), { replace }); }
  function setView(value: string) { setParams(current => { const next = new URLSearchParams(current); next.set("view", value); return next; }); }
  function setDelivery(value: string) { setParams(current => { const next = new URLSearchParams(current); next.set("delivery", value); return next; }); }
  const projectsSection = useRef<HTMLElement>(null);
  useEffect(() => {
    const q = draft.q ?? "";
    if (q === (applied.q ?? "")) return;
    const timer = window.setTimeout(() => setApplied({ ...applied, q: q || undefined, workSprintId: undefined, page: 0 }, true), 300);
    return () => window.clearTimeout(timer);
  }, [draft.q, applied.q]);
  const options = useQuery({ queryKey: ["project-report-options", owner], queryFn: ({ signal }) => projectReportApi.options(signal), retry: false, gcTime: 0 });
  const query = useQuery({ queryKey: ["project-report-dashboard", owner, applied], queryFn: ({ signal }) => projectReportApi.dashboard(applied, signal), enabled: options.isSuccess, retry: false, gcTime: 0,
    refetchInterval: state => state.state.status === "error" ? false : 30_000, refetchIntervalInBackground: false });
  const fetching = refreshing || query.isFetching || options.isFetching;
  function reset() { setDraft({ ...defaults }); setApplied({ ...defaults }); }
  function quickFilter(changes: Partial<ReportFilters>) {
    const next = { ...applied, workSprintId: undefined, ...changes, page: 0 };
    setDraft(next); setApplied(next);
  }
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await options.refetch();
      await Promise.all([query.refetch(), client.invalidateQueries({ queryKey: ["project-report-activity", owner] })]);
    } finally { setRefreshing(false); }
  }
  function viewProjects() {
    if (view !== "overview") setView("overview");
    projectsSection.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    projectsSection.current?.focus({ preventScroll: true });
  }
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.size)) : 1;
  return <div role="region" aria-label="Project Dashboard" className="project-report-dashboard @container/reports w-full min-w-0 space-y-3.5 bg-slate-50/70 p-4 dark:bg-background lg:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 shadow-xs dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"><BarChart3 className="size-5" /></div>
        <div className="min-w-0"><p data-report-eyebrow className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Management</p>
          <h1 className="text-lg font-semibold leading-tight tracking-tight">Project Dashboard</h1>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Theo dõi phân công Master và Sub-project, trạng thái dự án, backlog và các cảnh báo.</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="bg-card text-xs shadow-xs" disabled={fetching} onClick={() => void refresh()}><RefreshCw className={fetching ? "size-3.5 animate-spin" : "size-3.5"} />Làm mới dữ liệu</Button>
    </header>
    {options.isPending ? <LoadingReport /> : options.isError ?
      <Card><CardContent className="flex flex-wrap items-center gap-3"><AlertCircle className="size-5 text-destructive" /><p role="alert" className="flex-1 text-sm">{reportErrorMessage(options.error)}</p><Button variant="outline" onClick={() => void options.refetch()}>Thử lại</Button></CardContent></Card> : <>
      <Tabs value={view} onValueChange={setView} className="gap-3.5">
      <div className="flex min-w-0 flex-col gap-3 @[1020px]/reports:flex-row @[1020px]/reports:items-start">
      <div className="min-w-0 flex-1"><ReportFilterToolbar options={options.data} value={draft} applied={applied} onChange={setDraft} onApply={() => setApplied({ ...draft, workSprintId: undefined, page: 0 })} onReset={reset} /></div>
      <TabsList aria-label="Các phần báo cáo" className="group-data-[orientation=horizontal]/tabs:h-auto max-w-full shrink-0 flex-wrap justify-start gap-1 bg-slate-100/80 p-1 dark:bg-muted">
        <TabsTrigger value="overview" className="text-xs">Tổng quan</TabsTrigger><TabsTrigger value="work" className="text-xs">Sprint & Task</TabsTrigger><TabsTrigger value="deliveries" className="text-xs">Milestone & Bài nộp</TabsTrigger>
      </TabsList>
      </div>
      {query.isPending ? <LoadingReport /> : query.isError ?
        <Card><CardContent className="flex flex-wrap items-center gap-3"><AlertCircle className="size-5 text-destructive" /><p role="alert" className="flex-1 text-sm">{reportErrorMessage(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Thử lại</Button></CardContent></Card> : <>
        <TabsContent value="overview" className="space-y-3.5">
        <ReportOverview data={query.data} onFilter={quickFilter} onViewProjects={viewProjects} />
        <div data-report-projects-activity className="grid min-w-0 items-start gap-3.5">
        <section ref={projectsSection} id="project-report-masters" tabIndex={-1} aria-label="Danh sách dự án" className="scroll-mt-4 space-y-3 pt-1 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5"><div aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card"><Layers3 className="size-4 text-muted-foreground" /></div>
              <div><h2 className="text-sm font-semibold tracking-tight">Master Project và các Project con</h2><p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">Mở Master để xem phân công, trạng thái và backlog từng Sub-project.</p></div></div>
            <span className="rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"><strong className="font-semibold text-foreground">{query.data.total}</strong> Master Project trong kết quả</span>
          </div>
          {!query.data.content.length ? <Card className="shadow-none"><CardContent className="flex flex-col items-center py-10 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted"><FolderSearch className="size-6 text-muted-foreground" /></div>
            <h3 className="font-semibold">Chưa có dự án phù hợp</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Thử điều chỉnh bộ lọc hoặc kiểm tra các team đã được tạo Project trong phạm vi bạn phụ trách.</p>
            <Button className="mt-4" variant="outline" onClick={reset}>Đặt lại bộ lọc</Button>
          </CardContent></Card> : <ReportMasters masters={query.data.content} timeZone={query.data.timeZone} />}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-xs text-muted-foreground">Trang <strong className="font-medium text-foreground">{query.data.page + 1}</strong> / {pages} · {query.data.total} Master Project</p><div className="flex gap-2">
            <Button variant="outline" size="sm" className="bg-card" disabled={query.isFetching || !applied.page} onClick={() => setApplied({ ...applied, page: (applied.page ?? 0) - 1 })}><ArrowLeft className="size-3.5" />Trước</Button>
            <Button variant="outline" size="sm" className="bg-card" disabled={query.isFetching || ((applied.page ?? 0) + 1) * query.data.size >= query.data.total} onClick={() => setApplied({ ...applied, page: (applied.page ?? 0) + 1 })}>Sau<ArrowRight className="size-3.5" /></Button></div></div>
        </section>
        <ReportActivity key={owner + JSON.stringify({ ...applied, page: undefined, size: undefined, workSprintId: undefined })} owner={owner} filters={applied} initial={query.data.activities} timeZone={query.data.timeZone} />
        </div>
        </TabsContent>
        <TabsContent value="work"><ReportWork work={query.data.work} timeZone={query.data.timeZone} onSelect={workSprintId => quickFilter({ workSprintId })} /></TabsContent>
        <TabsContent value="deliveries"><ReportDeliveries rows={query.data.deliveries} bucket={params.get("delivery") ?? "ALL"} onBucket={setDelivery} timeZone={query.data.timeZone} /></TabsContent>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] leading-5 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />Dữ liệu lúc {reportDate(query.data.asOf, query.data.timeZone)}</span><span>{query.data.timeZone}</span><span>Trong phạm vi bạn được cấp quyền.</span></div>
      </>}
      </Tabs>
      {options.data.canExport && <ReportExports owner={owner} filters={applied} timeZone={options.data.timeZone} disabled={query.isPending || query.isError || query.isFetching} />}
    </>}
  </div>;
}
export default function ProjectReportsPage() {
  const { user, activeRole } = usePermissions();
  const owner = `${user.email}:${activeRole}`;
  // The core layout owns scrolling. Normal block flow keeps a tall report from
  // shrinking inside its flex column; page padding is applied only by ReportContent.
  return <MainLayout compactHeader mainClassName="block p-0"><ReportContent key={owner} owner={owner} /></MainLayout>;
}
