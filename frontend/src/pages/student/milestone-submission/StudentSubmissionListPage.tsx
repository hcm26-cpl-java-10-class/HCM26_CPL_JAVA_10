import { milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArtifactReviewStatusBadge } from "@/pages/student/components/ArtifactReviewStatusBadge";
import type { SubmissionListItem, SubmissionStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, Eye, FileCheck2, FilePenLine, History, MessageSquare, RotateCcw, Search, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 12;
const statuses: Array<{ label: string; value?: SubmissionStatus; color?: string }> = [
  { label: "All submissions" },
  { label: "Changes requested", value: "CHANGES_REQUESTED", color: "bg-amber-500" },
  { label: "Drafts", value: "DRAFT", color: "bg-slate-400" },
  { label: "Awaiting review", value: "SUBMITTED", color: "bg-blue-500" },
  { label: "Accepted", value: "ACCEPTED", color: "bg-emerald-500" },
  { label: "Rejected", value: "REJECTED", color: "bg-red-500" },
];

function hasVersion(item: SubmissionListItem) {
  return Number.isSafeInteger(item.currentVersionNumber) && item.currentVersionNumber > 0;
}

function MilestoneIdentity({ item }: { item: SubmissionListItem }) {
  const revision = item.status === "CHANGES_REQUESTED";
  return <div className="flex min-w-0 items-start gap-3">
    <span className={`mt-0.5 rounded-lg p-2 ${revision ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200" : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"}`}><FileCheck2 className="size-4 shrink-0" /></span>
    <div className="min-w-0 space-y-1.5">
      <p title={item.milestoneTitle || undefined} className="line-clamp-2 break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]">{item.milestoneTitle || "Untitled milestone"}</p>
      <p className="flex min-w-0 items-start gap-1.5 text-sm text-muted-foreground"><Users className="mt-0.5 size-3.5 shrink-0" /><span title={item.teamName || undefined} className="line-clamp-2 break-words [overflow-wrap:anywhere]">{item.teamName || "Team not available"}</span></p>
      {revision && <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200"><MessageSquare className="mt-0.5 size-3.5 shrink-0" /><span>Reviewer requested changes.{hasVersion(item) ? ` Next version: v${item.currentVersionNumber + 1}.` : ""}</span></p>}
    </div>
  </div>;
}

function VersionSummary({ item }: { item: SubmissionListItem }) {
  return <div className="space-y-1 text-sm"><p className="font-medium">{hasVersion(item) ? `${item.status === "DRAFT" ? "Draft v" : "Version "}${item.currentVersionNumber}` : item.status === "DRAFT" ? "Draft" : "No version yet"}</p><p className="text-xs leading-relaxed text-muted-foreground">{Number.isSafeInteger(item.submissionAttempts) && item.submissionAttempts >= 0 ? `${item.submissionAttempts} ${item.submissionAttempts === 1 ? "submission attempt" : "submission attempts"}` : "Submission attempts unavailable"}</p>{item.status === "DRAFT" && <p className="text-xs text-muted-foreground">Not officially submitted</p>}</div>;
}

function SubmissionDeadline({ item }: { item: SubmissionListItem }) {
  const valid = Boolean(item.deadline && Number.isFinite(Date.parse(item.deadline)));
  return <div className="space-y-1.5 text-sm"><p className="flex items-start gap-2 text-muted-foreground"><CalendarClock className="mt-0.5 size-3.5 shrink-0" />{valid ? <time dateTime={item.deadline} className="leading-relaxed">{new Date(item.deadline).toLocaleString()}</time> : <span>No deadline set</span>}</p>{item.status !== "DRAFT" && item.late && <p className="text-xs text-amber-800 dark:text-amber-200">Submitted late{item.penaltyPercent > 0 ? ` (${item.penaltyPercent}% penalty)` : ""}</p>}</div>;
}

function OpenSubmissionButton({ item, onOpen }: { item: SubmissionListItem; onOpen: (item: SubmissionListItem) => void }) {
  const revision = item.status === "CHANGES_REQUESTED";
  const draft = item.status === "DRAFT";
  const history = !revision && !draft && item.currentVersionNumber > 1;
  const label = revision ? "View feedback" : draft ? "Continue draft" : history ? "View history" : "View submission";
  const Icon = revision ? MessageSquare : draft ? FilePenLine : history ? History : Eye;
  return <Button type="button" size="sm" variant="outline" aria-label={`${label}: ${item.milestoneTitle || "Untitled milestone"}`} className={`w-full justify-center gap-1.5 text-xs sm:w-auto ${revision ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"}`} onClick={() => onOpen(item)}><Icon className="size-3.5" />{label}</Button>;
}

export function StudentSubmissionListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<SubmissionStatus>();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["my-milestone-submissions", page, status, search],
    queryFn: () => milestoneSubmissionApi.getMyPage({ page, size: PAGE_SIZE, status, search: search.trim() || undefined, sort: "submittedAt:desc" }),
    retry: false,
  });
  const data = query.data;
  const items = data?.content ?? [];
  const filtered = Boolean(status || search.trim());
  const openSubmission = (item: SubmissionListItem) => navigate(`/student/milestone-submissions/${item.id}`);
  const clearFilters = () => { setStatus(undefined); setSearch(""); setPage(0); };
  const rangeStart = data && items.length ? data.page * data.size + 1 : 0;
  const rangeEnd = data && items.length ? Math.min(data.page * data.size + items.length, data.totalElements) : 0;

  return <MainLayout contentClassName="bg-slate-50/80 dark:bg-background" pathName={{ student: "Student", "milestone-submissions": "My Submissions" }}>
    <main className="mx-auto w-full max-w-7xl space-y-4 pb-8">
      <header className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-start gap-3"><span className="rounded-lg bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><FileCheck2 className="size-5" /></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Milestone workflow</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">My Submissions</h1><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Track milestone submissions, version history and reviewer feedback.</p></div></div>
        <div className="shrink-0 rounded-lg bg-blue-50 px-4 py-2 text-right dark:bg-blue-950/40" role="status" aria-live="polite"><p className="text-xs font-medium text-muted-foreground">Matching records</p><p className="text-lg font-semibold tabular-nums text-blue-900 dark:text-blue-100">{data && !query.isError ? data.totalElements.toLocaleString() : "—"}</p></div>
      </header>

      <Tabs value={status ?? "ALL"} onValueChange={(value) => { setStatus(value === "ALL" ? undefined : value as SubmissionStatus); setPage(0); }} className="min-w-0 gap-4">
        <div className="min-w-0 rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-1"><TabsList aria-label="Filter submissions by status" className="h-auto min-h-9 justify-start gap-1 bg-transparent p-0">{statuses.map((item) => <TabsTrigger key={item.value ?? "ALL"} value={item.value ?? "ALL"} className="h-9 gap-1.5 rounded-lg px-3 text-xs data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900">{item.color && <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${item.color}`} />}{item.label}</TabsTrigger>)}</TabsList></div>
            <label className="relative block w-full shrink-0 xl:w-64"><span className="sr-only">Search milestone or team</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="h-9 bg-muted/20 pl-9 text-sm" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search milestone or team…" /></label>
          </div>
        </div>

        <TabsContent value={status ?? "ALL"} aria-busy={query.isPending || query.isFetching} className="min-w-0 space-y-0 rounded-xl border bg-card shadow-sm">
          {query.isPending ? <div className="space-y-3 p-4" role="status" aria-label="Loading submissions"><Skeleton className="h-10 rounded-lg" />{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}</div>
            : query.isError || !data ? <div className="p-4"><Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load submissions</AlertTitle><AlertDescription className="grid justify-items-start gap-3"><p>Check your connection and access, then try again.</p><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}><RotateCcw className="size-4" />Try again</Button></AlertDescription></Alert></div>
            : items.length === 0 ? <div className="grid justify-items-center gap-3 px-5 py-12 text-center"><span className="rounded-full bg-muted p-3"><FileCheck2 className="size-7 text-muted-foreground" /></span><div><h2 className="font-semibold">{filtered ? "No matching submissions" : "No submissions yet"}</h2><p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{filtered ? "Try a different status or search term." : "Your milestone drafts and submissions will appear here."} Drafts are not official submissions.</p></div>{filtered && <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}</div>
            : <>
              <div className="hidden min-w-0 overflow-x-auto overscroll-x-contain rounded-t-xl md:block" role="region" aria-label="Submission list; scroll horizontally when needed" tabIndex={0}>
                <Table className="min-w-[900px] table-fixed text-sm"><TableHeader className="bg-muted/30"><TableRow className="hover:bg-transparent"><TableHead className="w-[34%] px-5 py-3 text-xs uppercase tracking-wide">Milestone / team</TableHead><TableHead className="w-[17%] px-4 text-xs uppercase tracking-wide">Version & attempts</TableHead><TableHead className="w-[19%] px-4 text-xs uppercase tracking-wide">Deadline</TableHead><TableHead className="w-[15%] px-4 text-xs uppercase tracking-wide">Review status</TableHead><TableHead className="w-[15%] px-4 text-right text-xs uppercase tracking-wide">Actions</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id} className={`align-top ${item.status === "CHANGES_REQUESTED" ? "bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/10" : ""}`}><TableCell className="min-w-0 whitespace-normal px-5 py-4"><MilestoneIdentity item={item} /></TableCell><TableCell className="whitespace-normal px-4 py-4"><VersionSummary item={item} /></TableCell><TableCell className="whitespace-normal px-4 py-4"><SubmissionDeadline item={item} /></TableCell><TableCell className="whitespace-normal px-4 py-4"><ArtifactReviewStatusBadge status={item.status || "UNKNOWN"} /></TableCell><TableCell className="px-4 py-4 text-right"><OpenSubmissionButton item={item} onOpen={openSubmission} /></TableCell></TableRow>)}</TableBody></Table>
              </div>
              <div className="divide-y md:hidden" aria-label="Submission cards">{items.map((item) => <article key={item.id} className={`min-w-0 space-y-4 p-4 ${item.status === "CHANGES_REQUESTED" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}><MilestoneIdentity item={item} /><div className="flex flex-wrap items-start justify-between gap-3"><VersionSummary item={item} /><ArtifactReviewStatusBadge status={item.status || "UNKNOWN"} /></div><SubmissionDeadline item={item} /><OpenSubmissionButton item={item} onOpen={openSubmission} /></article>)}</div>
            </>}

          {data && !query.isError && !query.isPending && <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t bg-muted/15 px-4 py-3 text-xs text-muted-foreground"><p>Showing <strong className="font-medium text-foreground">{rangeStart}–{rangeEnd}</strong> of <strong className="font-medium text-foreground">{data.totalElements.toLocaleString()}</strong> submissions<span className="ml-3 hidden sm:inline">{PAGE_SIZE} per page</span></p>{data.totalPages > 1 && <nav aria-label="Submission pagination" className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={!data.hasPrevious} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span></Button><span className="tabular-nums">Page {data.page + 1} of {data.totalPages}</span><Button type="button" size="sm" variant="outline" disabled={!data.hasNext} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" /></Button></nav>}</footer>}
        </TabsContent>
      </Tabs>
    </main>
  </MainLayout>;
}
