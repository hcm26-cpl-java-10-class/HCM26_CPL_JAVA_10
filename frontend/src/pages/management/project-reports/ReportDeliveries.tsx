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
import { ReportStateBadge, reportStateStyle } from "./report-ui";

const buckets = [
  ["ALL", "All milestones"], ["SUBMITTED", "Pending review"], ["CHANGES_REQUESTED", "Changes requested"],
  ["ACCEPTED", "Accepted"], ["REJECTED", "Rejected"], ["DRAFT", "Draft"], ["MISSING", "Not submitted"], ["RISK", "At risk"],
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
    if (row.attention === "OVERDUE") return row.artifactStatus && row.artifactStatus !== "DRAFT" ? "Overdue · pending acceptance" : "Overdue · awaiting submission";
    if (row.attention === "DUE_SOON") return "Due soon · awaiting submission";
    if (row.attention === "CHANGES_REQUESTED" || row.attention === "REVISION" && row.milestoneStatus === "CHANGES_REQUESTED") return "Submission needs changes";
    if (row.attention === "REJECTED" || row.attention === "REVISION" && row.milestoneStatus === "REJECTED") return "Submission rejected";
    return null;
  }
  return <section data-report-deliveries aria-label="Milestones and submissions" className="overflow-hidden rounded-lg border bg-card shadow-xs">
    <header className="flex flex-wrap items-start justify-between gap-3 p-4"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="size-4 text-blue-500" />Milestones & Submissions</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Latest submissions by milestone and team in active projects and workspaces. {visible.length} milestones match this status.</p></div>
      <Select value={selected} onValueChange={selectBucket}><SelectTrigger aria-label="Filter submission status" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{buckets.map(([key, label]) => <SelectItem key={key} value={key}>{label}{key === "ALL" ? ` (${rows.length})` : ""}</SelectItem>)}</SelectContent></Select>
    </header>
    {!visible.length ? <div className="space-y-2 border-t p-8 text-center"><p className="text-sm font-medium">No matching milestones or submissions</p><p className="text-xs text-muted-foreground">Try a different status or change the report filters.</p>{selected !== "ALL" && <Button variant="outline" size="sm" onClick={() => onBucket("ALL")}>View all milestones</Button>}</div> : <div className="overflow-x-auto"><Table className="min-w-[1200px]"><TableHeader><TableRow>
      {["Milestone / Project", "Class", "Team", "Deadline", "Status", "Current submission", "Reviewer / Checklist", ""].map((label, index) => <TableHead key={index} className="text-xs">{label}</TableHead>)}
    </TableRow></TableHeader><TableBody>{viewRows.map(row => <TableRow key={`${row.projectId}:${row.milestoneId}`} className="align-top">
      <TableCell className="max-w-64 whitespace-normal py-4"><Link to={milestoneLink(row)} state={{ returnTo: location.pathname + location.search }} className="text-xs font-semibold leading-5 text-blue-600 hover:underline dark:text-blue-400">{row.title}</Link><p className="mt-1 text-[11px] text-muted-foreground">{row.projectCode} · {row.projectName}</p>{row.masterId !== row.projectId && <p className="mt-1 text-[10px] text-muted-foreground">Master: {row.masterName}</p>}{row.mandatory && <Badge variant="outline" className="mt-2 text-[10px]">Required</Badge>}</TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4 text-xs [overflow-wrap:anywhere]">{row.className}</TableCell>
      <TableCell className="py-4 text-xs">{row.teamName ?? "Shared"}</TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4 text-[11px]"><p>{reportDate(row.deadline, timeZone)}</p>{attention(row) && <p className={"mt-2 font-medium " + reportStateStyle(row.attention === "REVISION" ? row.milestoneStatus : row.attention).text}>{attention(row)}</p>}</TableCell>
      <TableCell className="py-4 text-xs"><ReportStateBadge status={row.milestoneStatus}>{deliveryLabels[row.milestoneStatus] ?? row.milestoneStatus}</ReportStateBadge></TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4"><p className="text-xs font-medium">{row.artifactStatus ? <ReportStateBadge status={row.artifactStatus}>{deliveryLabels[row.artifactStatus] ?? row.artifactStatus}</ReportStateBadge> : "No submission"}{row.version != null && <span className="ml-1.5 text-muted-foreground">· v{row.version}</span>}</p>{row.submittedAt && <p className="mt-1 text-[10px] text-muted-foreground">Submitted {reportDate(row.submittedAt, timeZone)}</p>}</TableCell>
      <TableCell className="max-w-48 whitespace-normal py-4 text-xs"><p>{row.reviewerName ?? "No reviewer"}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.checklistCompleted} / {row.checklistTotal} checklist items passed</p></TableCell>
      <TableCell className="py-4"><Link to={row.submissionId ? `/milestone-submissions/${row.submissionId}/review` : milestoneLink(row)} state={{ returnTo: location.pathname + location.search }} className="inline-flex items-center gap-1 rounded text-xs font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-ring dark:text-blue-400">{row.submissionId ? "View submission" : "View milestone"}<ArrowUpRight className="size-3" /></Link></TableCell>
    </TableRow>)}</TableBody></Table></div>}
    {visible.length > 20 && <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-4"><p className="text-xs text-muted-foreground">Page {currentPage + 1} / {pages} · {visible.length} milestone</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></footer>}
  </section>;
}
