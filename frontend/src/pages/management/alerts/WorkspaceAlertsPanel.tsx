import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowUpRight, Bell, BellOff, Check, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search, Settings2, TriangleAlert, X } from "lucide-react";
import { projectAlertApi } from "@/api/features/project-alert.api";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { AlertKind, WorkspaceAlertItem, WorkspaceAlertPage, WorkspaceSentAlert } from "@/types/features/project-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getAlertError } from "./alert-errors";

type KindFilter = AlertKind | "ALL";
type TimeFilter = "ALL" | "TODAY" | "7" | "30";
const PAGE_SIZE = 5;
const DAY = 86_400_000;
const kinds: { value: KindFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "BACKLOG", label: "Công việc quá hạn" },
  { value: "MILESTONE", label: "Rủi ro milestone" },
];
const statusLabels: Record<string, string> = {
  TODO: "Cần làm / To do", IN_PROGRESS: "Đang thực hiện / In progress", REVIEW: "Đang kiểm tra / Review",
  DONE: "Đã hoàn thành / Done", SUBMITTED: "Đã nộp / Submitted", ACCEPTED: "Đã chấp nhận / Accepted",
  DRAFT: "Bản nháp / Draft", PLANNED: "Đã lên kế hoạch / Planned", OPEN: "Đã mở / Open",
  NOT_STARTED: "Chưa bắt đầu / Not started", CANCELLED: "Đã hủy / Cancelled",
};
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
function date(value?: string | null) {
  const time = value ? new Date(value) : null;
  return time && Number.isFinite(time.getTime()) ? dateFormatter.format(time) : "Chưa có thông tin";
}
function searchable(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replaceAll("đ", "d");
}
function statusLabel(value: string | null) {
  return value ? statusLabels[value] ?? value.replaceAll("_", " ").toLowerCase() : "Chưa ghi nhận";
}
function overdueAtSend(deadline: string | null, sentAt: string) {
  if (!deadline) return null;
  const elapsed = new Date(sentAt).getTime() - new Date(deadline).getTime();
  if (!Number.isFinite(elapsed) || elapsed <= 0) return null;
  const duration = elapsed >= DAY ? `${Math.ceil(elapsed / DAY)} ngày` : `${Math.max(1, Math.ceil(elapsed / 3_600_000))} giờ`;
  return `Quá hạn ${duration} lúc gửi`;
}

async function loadHistory(workspaceId: number, teamId: number, signal: AbortSignal): Promise<WorkspaceAlertPage> {
  const first = await projectAlertApi.sentInWorkspace(workspaceId, { page: 0, size: 100 }, signal);
  function requireContext(page: WorkspaceAlertPage) {
    if (page.workspaceId !== workspaceId || page.teamId !== teamId) throw new Error("Alerts do not match this workspace.");
    return page.content;
  }
  const content = [...requireContext(first)];
  // Search, time filters and category counts include later API pages.
  const pages = Math.ceil(first.total / first.size);
  for (let page = 1; page < pages; page += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, pages - page) }, (_, offset) =>
      projectAlertApi.sentInWorkspace(workspaceId, { page: page + offset, size: first.size }, signal)));
    batch.forEach(result => content.push(...requireContext(result)));
  }
  const unique = [...new Map(content.map(alert => [alert.id, alert])).values()];
  return { ...first, content: unique, total: unique.length };
}

function AlertSnapshot({ item, alert, workspaceId, teamId }: {
  item: WorkspaceAlertItem; alert: WorkspaceSentAlert; workspaceId: number; teamId: number;
}) {
  const task = alert.kind === "BACKLOG";
  const overdue = overdueAtSend(item.deadline, alert.sentAt);
  const progress = item.percentage != null && Number.isFinite(item.percentage) ? Math.min(100, Math.max(0, item.percentage)) : null;
  const initials = item.assigneeName?.trim().split(/\s+/).slice(-2).map(word => word[0]).join("").toUpperCase();
  const destination = task ? `/management/workspaces/${workspaceId}?tab=backlog`
    : item.id ? `/teams/${teamId}/milestones/${encodeURIComponent(item.id)}?workspaceId=${workspaceId}`
      : `/management/workspaces/${workspaceId}?tab=milestones`;
  return <section aria-label={item.title ?? (task ? "Công việc được cảnh báo" : "Milestone được cảnh báo")}
    className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-border dark:bg-muted/25">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
          task ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300")}>
          {task ? "TASK" : <ClipboardList className="size-4" />}
        </span>
        <div className="min-w-0 space-y-1.5">
          <h4 className="break-words text-xs font-semibold leading-5 text-foreground">{item.title ?? (task ? "Công việc" : "Milestone")}</h4>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] leading-5 text-muted-foreground">{task ? "Công việc được nhắc trong cảnh báo" : "Cột mốc được nhắc trong cảnh báo"}</p>
            {overdue && <Badge className="max-w-full whitespace-normal rounded bg-rose-100 px-1.5 text-[10px] text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{overdue}</Badge>}
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" asChild className={cn("h-8 self-start rounded-lg text-xs shadow-none",
        task ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300")}>
        <Link to={destination}>{task ? "Mở backlog" : "Mở milestone"}<ArrowUpRight className="size-3.5" /></Link>
      </Button>
    </div>
    <dl className="mt-3.5 grid min-w-0 gap-3 border-t border-slate-200/70 pt-3.5 text-xs dark:border-border sm:grid-cols-2 xl:grid-cols-3">
      <div className="min-w-0 space-y-1.5"><dt className="text-[11px] text-muted-foreground">Trạng thái lúc gửi</dt>
        <dd><Badge className={cn("max-w-full whitespace-normal rounded px-2 text-[11px]",
          task ? "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300")}>{statusLabel(item.status)}</Badge></dd>
      </div>
      <div className="min-w-0 space-y-1.5"><dt className="text-[11px] text-muted-foreground">Hạn chót lúc gửi</dt>
        <dd className={cn("break-words font-medium leading-5", overdue && "text-rose-700 dark:text-rose-400")}>{date(item.deadline)}</dd>
      </div>
      {(task || item.assigneeName) && <div className="min-w-0 space-y-1.5"><dt className="text-[11px] text-muted-foreground">Người phụ trách</dt>
        <dd className="flex items-start gap-1.5 leading-5">{initials && <span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white">{initials}</span>}<span className="min-w-0 break-words font-medium">{item.assigneeName || "Chưa được phân công"}</span></dd>
      </div>}
      {progress !== null && <div className="min-w-0 space-y-1.5"><dt className="text-[11px] text-muted-foreground">Tiến độ lúc gửi</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <div role="progressbar" aria-label="Tiến độ lúc gửi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
            className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-muted">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">{progress}%{item.done != null && item.total != null ? ` (${item.done}/${item.total} đã xong)` : ""}</span>
        </dd>
      </div>}
    </dl>
  </section>;
}

function SentAlertCard({ alert, workspaceId, teamId }: { alert: WorkspaceSentAlert; workspaceId: number; teamId: number }) {
  const task = alert.kind === "BACKLOG";
  const Icon = task ? AlertCircle : TriangleAlert;
  return <article aria-label={`${task ? "Công việc quá hạn" : "Rủi ro milestone"} · ${alert.senderName}`}
    className={cn("flex min-w-0 flex-col gap-4 rounded-xl border border-l-4 bg-card p-4 transition-shadow hover:shadow-sm sm:flex-row sm:p-5",
      task ? "border-rose-200 border-l-rose-600 dark:border-rose-500/30 dark:border-l-rose-500" : "border-amber-200 border-l-amber-500 dark:border-amber-500/30 dark:border-l-amber-500")}>
    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl",
      task ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400")}><Icon className="size-5" /></span>
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          <Badge className={cn("gap-1.5 border-0 px-2.5 font-semibold", task ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300")}>
            <span className={cn("size-1.5 rounded-full", task ? "bg-rose-500" : "bg-amber-500")} />{task ? "Công việc quá hạn" : "Rủi ro milestone"}
          </Badge>
          <span className="min-w-0 break-words leading-5 text-muted-foreground">Người gửi: <strong className="font-semibold text-foreground">{alert.senderName}</strong></span>
          <span className="hidden size-1 rounded-full bg-slate-300 sm:block" aria-hidden="true" />
          <time dateTime={alert.sentAt} className="text-[11px] leading-5 text-muted-foreground">{date(alert.sentAt)}</time>
        </div>
        <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600 dark:border-border dark:bg-muted/40 dark:text-muted-foreground"><Check className="size-3 text-emerald-600" />Đã gửi</Badge>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{alert.warningNote}</p>
      {!!alert.items.length && <div className="space-y-3">{alert.items.map((item, index) =>
        <AlertSnapshot key={item.id ?? index} item={item} alert={alert} workspaceId={workspaceId} teamId={teamId} />)}</div>}
    </div>
  </article>;
}

export function WorkspaceAlertsPanel({ workspaceId, teamId }: { workspaceId: number; teamId: number }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [search, setSearch] = useState("");
  const [time, setTime] = useState<TimeFilter>("ALL");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["workspace-alerts", workspaceId, teamId, user.email, activeRole],
    queryFn: ({ signal }) => loadHistory(workspaceId, teamId, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always", refetchInterval: 15_000,
  });
  const failure = query.isError ? getAlertError(query.error) : undefined;
  const data = !failure && query.data?.workspaceId === workspaceId && query.data.teamId === teamId ? query.data : undefined;
  const term = searchable(search.trim());
  const now = new Date();
  const cutoff = time === "ALL" ? 0 : time === "TODAY" ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() : now.getTime() - Number(time) * DAY;
  const matching = (data?.content ?? []).filter(alert => {
    if (time !== "ALL" && !(new Date(alert.sentAt).getTime() >= cutoff)) return false;
    return !term || searchable([alert.warningNote, alert.senderName, ...alert.items.flatMap(item =>
      [item.title, item.assigneeName, statusLabel(item.status)])].filter(Boolean).join(" ")).includes(term);
  });
  const counts = { ALL: matching.length, BACKLOG: matching.filter(alert => alert.kind === "BACKLOG").length,
    MILESTONE: matching.filter(alert => alert.kind === "MILESTONE").length };
  const filtered = kind === "ALL" ? matching : matching.filter(alert => alert.kind === kind);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const firstPage = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);
  const hasFilters = kind !== "ALL" || !!search.trim() || time !== "ALL";
  function changeKind(value: string) { setKind(value as KindFilter); setPage(0); }
  function reset() { setKind("ALL"); setSearch(""); setTime("ALL"); setPage(0); }

  return <section aria-label="Cảnh báo của nhóm" className="min-w-0 rounded-xl border border-slate-200/80 bg-card p-4 font-sans shadow-sm dark:border-border sm:p-6">
    <header className="space-y-5 border-b border-slate-100 pb-5 dark:border-border">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/15"><Bell className="size-6" /></span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold tracking-tight">Cảnh báo của nhóm</h2><Badge variant="outline" className="border-slate-200 bg-slate-100 text-[10px] font-medium text-slate-600 dark:border-border dark:bg-muted dark:text-muted-foreground">Lịch sử đã gửi</Badge></div>
            <p className="max-w-2xl text-xs leading-5 text-muted-foreground">Lịch sử cảnh báo công việc và milestone đã gửi cho nhóm. Số liệu phản ánh tình trạng tại thời điểm gửi cảnh báo.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs shadow-none" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />Làm mới</Button>
          {hasPermission("PROJECT_ALERT_READ") && <Button variant="secondary" size="sm" className="h-9 rounded-lg text-xs" asChild><Link to={`/management/alerts?teamId=${teamId}${kind === "ALL" ? "" : `&view=${kind}`}`}><Settings2 className="size-3.5" />Quản lý cảnh báo</Link></Button>}
        </div>
      </div>
      <div role="group" aria-label="Lọc nhanh loại cảnh báo" className="flex flex-wrap items-center gap-2">
        {kinds.map(option => <button key={option.value} type="button" aria-pressed={kind === option.value} onClick={() => changeKind(option.value)}
          className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background",
            option.value === "ALL" && (kind === "ALL" ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-border dark:bg-muted/30 dark:text-muted-foreground"),
            option.value === "BACKLOG" && "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
            option.value === "MILESTONE" && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
            kind === option.value && option.value !== "ALL" && "ring-2 ring-current/15")}>
          {option.value !== "ALL" && <span aria-hidden="true" className={cn("size-1.5 rounded-full", option.value === "BACKLOG" ? "bg-rose-500" : "bg-amber-500")} />}
          {option.label}<span className={cn("flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", option.value === "ALL" && kind === "ALL" ? "bg-white/20 dark:bg-slate-900/10" : "bg-current/10")}>{data ? counts[option.value] : "—"}</span>
        </button>)}
      </div>
    </header>

    <div role="search" aria-label="Tìm kiếm và lọc cảnh báo" className="my-5 grid min-w-0 gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-border dark:bg-muted/20 lg:grid-cols-3">
      <div className="min-w-0 space-y-2"><Label htmlFor="workspace-alert-kind" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Loại cảnh báo (Alert type)</Label>
        <Select value={kind} onValueChange={changeKind}><SelectTrigger id="workspace-alert-kind" className="h-9 w-full min-w-0 bg-background text-xs shadow-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Tất cả loại cảnh báo</SelectItem><SelectItem value="BACKLOG">Công việc quá hạn</SelectItem><SelectItem value="MILESTONE">Rủi ro milestone</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-2"><Label htmlFor="workspace-alert-search" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tìm kiếm nội dung</Label>
        <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input id="workspace-alert-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Tên task, milestone, người gửi…" className="h-9 bg-background pl-9 pr-9 text-xs md:text-xs" />
          {!!search && <Button type="button" variant="ghost" size="icon-xs" aria-label="Xóa tìm kiếm" className="absolute right-1.5 top-1.5 text-muted-foreground" onClick={() => { setSearch(""); setPage(0); }}><X className="size-3.5" /></Button>}
        </div>
      </div>
      <div className="min-w-0 space-y-2"><Label htmlFor="workspace-alert-time" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Thời gian gửi</Label>
        <Select value={time} onValueChange={value => { setTime(value as TimeFilter); setPage(0); }}><SelectTrigger id="workspace-alert-time" className="h-9 w-full min-w-0 bg-background text-xs shadow-xs"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">Toàn bộ thời gian (All time)</SelectItem><SelectItem value="TODAY">Hôm nay</SelectItem><SelectItem value="7">7 ngày gần đây</SelectItem><SelectItem value="30">30 ngày gần đây</SelectItem></SelectContent>
        </Select>
      </div>
    </div>

    {query.isPending ? <div role="status" aria-label="Đang tải lịch sử cảnh báo" className="space-y-4">{[0, 1].map(value => <div key={value} className="space-y-4 rounded-xl border p-5"><Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-full" /><Skeleton className="h-28 w-full" /></div>)}</div>
      : failure || !data ? <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center"><TriangleAlert className="size-8 text-destructive" /><h3 className="text-sm font-semibold">Không thể tải cảnh báo</h3><p className="max-w-lg px-4 text-xs leading-5 text-muted-foreground">{failure?.message ?? "Không thể tải cảnh báo cho workspace này."}</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Thử lại</Button></div>
        : visible.length ? <div aria-label="Danh sách cảnh báo đã gửi" className="space-y-4">{visible.map(alert => <SentAlertCard key={alert.id} alert={alert} workspaceId={workspaceId} teamId={teamId} />)}</div>
          : <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-12 text-center"><span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-muted">{hasFilters ? <Search className="size-6" /> : <BellOff className="size-6" />}</span><h3 className="text-sm font-semibold">{hasFilters ? "Không tìm thấy cảnh báo phù hợp" : "Chưa có cảnh báo nào được gửi"}</h3><p className="max-w-md text-xs leading-5 text-muted-foreground">{hasFilters ? "Thử thay đổi loại cảnh báo, từ khóa hoặc khoảng thời gian gửi." : "Các cảnh báo sẽ xuất hiện tại đây sau khi người quản lý gửi cho nhóm."}</p>{hasFilters && <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={reset}>Xóa bộ lọc</Button>}</div>}

    {data && <footer className="mt-6 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-muted-foreground dark:border-border sm:flex-row sm:items-center">
      <p role="status">Hiển thị <strong className="font-semibold text-foreground">{filtered.length ? start + 1 : 0} – {Math.min(start + PAGE_SIZE, filtered.length)}</strong> trên tổng số <strong className="font-semibold text-foreground">{filtered.length}</strong> cảnh báo{hasFilters ? " phù hợp" : " đã gửi"}</p>
      <nav aria-label="Phân trang cảnh báo" className="flex flex-wrap items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 text-xs shadow-none" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-3.5" />Trước</Button>
        {pageNumbers.map(value => <Button key={value} variant="outline" size="icon-sm" aria-label={`Trang ${value + 1}`} aria-current={currentPage === value ? "page" : undefined}
          className={cn("text-xs shadow-none", currentPage === value && "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:text-white dark:border-blue-500")} onClick={() => setPage(value)}>{value + 1}</Button>)}
        <Button variant="outline" size="sm" className="h-8 text-xs shadow-none" disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>Sau<ChevronRight className="size-3.5" /></Button>
      </nav>
    </footer>}
  </section>;
}
