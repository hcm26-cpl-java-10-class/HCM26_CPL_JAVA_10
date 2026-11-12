import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { ArrowUpRight, FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportDelivery } from "@/types/features/project-report";
import { deliveryLabels } from "./report-labels";
import { reportDate } from "./report-utils";

const buckets = [
  ["ALL", "Tất cả milestone"], ["SUBMITTED", "Chờ duyệt"], ["CHANGES_REQUESTED", "Cần chỉnh sửa"],
  ["ACCEPTED", "Đã chấp nhận"], ["REJECTED", "Bị từ chối"], ["DRAFT", "Bản nháp"], ["MISSING", "Chưa nộp"], ["RISK", "Có cảnh báo"],
];
export function ReportDeliveries({ rows, bucket, onBucket, timeZone }: {
  rows: ReportDelivery[]; bucket: string; onBucket: (value: string) => void; timeZone: string;
}) {
  const location = useLocation();
  const [page, setPage] = useState(0);
  const selected = buckets.some(([key]) => key === bucket) ? bucket : "ALL";
  const visible = rows.filter(row => selected === "ALL" || selected === "RISK" && row.attention !== "NONE"
    || selected === "MISSING" && !["ACCEPTED", "WAIVED"].includes(row.milestoneStatus) && (!row.artifactStatus || row.artifactStatus === "DRAFT")
    || selected !== "MISSING" && selected !== "RISK" && row.artifactStatus === selected);
  const pages = Math.max(1, Math.ceil(visible.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const viewRows = visible.slice(currentPage * 20, (currentPage + 1) * 20);
  function selectBucket(value: string) { setPage(0); onBucket(value); }
  function milestoneLink(row: ReportDelivery) { return row.teamId == null ? `/projects/${row.projectId}/milestones/${row.milestoneId}` : `/teams/${row.teamId}/milestones/${row.milestoneId}`; }
  function attention(row: ReportDelivery) {
    if (row.attention === "OVERDUE") return row.artifactStatus && row.artifactStatus !== "DRAFT" ? "Quá hạn · chưa nghiệm thu" : "Quá hạn · chưa nộp";
    if (row.attention === "DUE_SOON") return "Sắp hạn · chưa nộp";
    if (row.attention === "REVISION") return "Bài nộp cần xử lý";
    return null;
  }
  return <section data-report-deliveries aria-label="Milestone và bài nộp" className="overflow-hidden rounded-lg border bg-card shadow-xs">
    <header className="flex flex-wrap items-start justify-between gap-3 p-4"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="size-4 text-blue-500" />Milestone & Bài nộp</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Bản hiện tại của từng milestone/team trong Project và Workspace đang hoạt động. {visible.length} milestone khớp trạng thái.</p></div>
      <Select value={selected} onValueChange={selectBucket}><SelectTrigger aria-label="Lọc trạng thái bài nộp" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{buckets.map(([key, label]) => <SelectItem key={key} value={key}>{label}{key === "ALL" ? ` (${rows.length})` : ""}</SelectItem>)}</SelectContent></Select>
    </header>
    {!visible.length ? <div className="space-y-2 border-t p-8 text-center"><p className="text-sm font-medium">Chưa có milestone hoặc bài nộp phù hợp</p><p className="text-xs text-muted-foreground">Thử đổi trạng thái hoặc điều chỉnh bộ lọc chung.</p>{selected !== "ALL" && <Button variant="outline" size="sm" onClick={() => onBucket("ALL")}>Xem tất cả milestone</Button>}</div> : <div className="overflow-x-auto"><Table className="min-w-[1040px]"><TableHeader><TableRow>
      {["Milestone / Project", "Team", "Deadline", "Trạng thái", "Bản nộp hiện tại", "Người duyệt / Checklist", ""].map((label, index) => <TableHead key={index} className="text-xs">{label}</TableHead>)}
    </TableRow></TableHeader><TableBody>{viewRows.map(row => <TableRow key={`${row.projectId}:${row.milestoneId}`} className="align-top">
      <TableCell className="max-w-64 whitespace-normal py-4"><Link to={milestoneLink(row)} state={{ returnTo: location.pathname + location.search }} className="text-xs font-semibold leading-5 text-blue-600 hover:underline dark:text-blue-400">{row.title}</Link><p className="mt-1 text-[11px] text-muted-foreground">{row.projectCode} · {row.projectName}</p>{row.masterId !== row.projectId && <p className="mt-1 text-[10px] text-muted-foreground">Master: {row.masterName}</p>}{row.mandatory && <Badge variant="outline" className="mt-2 text-[10px]">Bắt buộc</Badge>}</TableCell>
      <TableCell className="py-4 text-xs">{row.teamName ?? "Dùng chung"}</TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4 text-[11px]"><p>{reportDate(row.deadline, timeZone)}</p>{attention(row) && <p className={`mt-2 font-medium ${row.attention === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"}`}>{attention(row)}</p>}</TableCell>
      <TableCell className="py-4 text-xs"><p>{deliveryLabels[row.milestoneStatus] ?? row.milestoneStatus}</p></TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4"><p className="text-xs font-medium">{row.artifactStatus ? deliveryLabels[row.artifactStatus] ?? row.artifactStatus : "Chưa có bài nộp"}{row.version != null && <span className="ml-1.5 text-muted-foreground">· v{row.version}</span>}</p>{row.submittedAt && <p className="mt-1 text-[10px] text-muted-foreground">Nộp {reportDate(row.submittedAt, timeZone)}</p>}</TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4 text-xs"><p>{row.reviewerName ?? "Chưa có người duyệt"}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.checklistCompleted} / {row.checklistTotal} mục checklist đạt</p></TableCell>
      <TableCell className="py-4"><Link to={row.submissionId ? `/milestone-submissions/${row.submissionId}/review` : milestoneLink(row)} state={{ returnTo: location.pathname + location.search }} className="inline-flex items-center gap-1 rounded text-xs font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">{row.submissionId ? "Xem bài" : "Xem mốc"}<ArrowUpRight className="size-3" /></Link></TableCell>
    </TableRow>)}</TableBody></Table></div>}
    {visible.length > 20 && <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-4"><p className="text-xs text-muted-foreground">Trang {currentPage + 1} / {pages} · {visible.length} milestone</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Trước</Button><Button variant="outline" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Sau</Button></div></footer>}
  </section>;
}
