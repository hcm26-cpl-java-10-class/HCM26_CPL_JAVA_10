import { useGitActivityParam } from "./git-activity-url-context";
import { useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, ChevronUp, GitPullRequest, Search } from "lucide-react";
import { workspaceGitApi, type GitCodeReviewAnalytics } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceEmptyState } from "./workspace.shared";
import { useGitProjectFilter } from "./git-project-scope";
import { GitProjectSelect } from "./GitProjectSelect";
import { GitListPagination } from "./GitListPagination";
import { GitLinkedTasks, GitSubmittedReviews, GitTaskBadges } from "./GitDetailLists";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date);
}

function stateVariant(state: string) {
  return state === "MERGED" ? "default" : state === "CLOSED" ? "secondary" : "outline";
}

export function GitPullRequestsWorkspacePanel({ workspaceId, taskId, view = "all", active = true }: {
  workspaceId: number;
  taskId?: number;
  initialProjectId?: number;
  view?: "all" | "analytics" | "pull-requests" | "reviews";
  active?: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const [search, setSearch] = useGitActivityParam<string>("gitPrSearch", "");
  const deferredSearch = useDeferredValue(search.trim());
  const [sort, setSort] = useGitActivityParam<"newest" | "oldest">("gitPrSort", "newest");
  const projectFilter = useGitProjectFilter(view === "reviews" ? "gitReviewProjectId" : "gitPrProjectId");
  const { projectId, setProjectId } = projectFilter;
  const [developerId, setDeveloperId] = useGitActivityParam<number | undefined>("gitPrDeveloperId", undefined, "number");
  const [reviewerId, setReviewerId] = useGitActivityParam<number | undefined>("gitPrReviewerId", undefined, "number");
  const [from, setFrom] = useGitActivityParam<string>("gitPrFrom", "");
  const [to, setTo] = useGitActivityParam<string>("gitPrTo", "");
  const [page, setPage] = useGitActivityParam<number>("gitPrPage", 0);
  const [selectedPullRequestId, setSelectedPullRequestId] = useGitActivityParam<number | null>("gitPrDetail", null, "number");
  const [showAnalyticsDetails, setShowAnalyticsDetails] = useGitActivityParam<boolean>("gitPrAnalyticsDetails", false);
  const showPullRequestAnalytics = view === "all" || view === "analytics" || view === "pull-requests";
  const showPullRequestHistory = view === "all" || view === "pull-requests";
  const showReviewAnalytics = view === "all" || view === "reviews";
  const activeSelectedPullRequestId = active ? selectedPullRequestId : null;
  const filters = useQuery({
    queryKey: ["git-activity", "filters", workspaceId, user.email, activeRole, projectId],
    queryFn: ({ signal }) => workspaceGitApi.activityFilters(workspaceId, projectId, signal),
    retry: false,
  });
  const history = useQuery({
    queryKey: ["git-activity", "pull-requests", workspaceId, user.email, activeRole,
      deferredSearch, sort, page, taskId, projectId, developerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.pullRequests(workspaceId, {
      search: deferredSearch || undefined, sort, page, size: 20, taskId,
      projectId, developerId, from: from || undefined, to: to || undefined,
    }, signal),
    enabled: active && showPullRequestHistory,
    retry: false,
  });
  const details = useQuery({
    queryKey: ["git-activity", "pull-request", workspaceId, user.email, activeRole, activeSelectedPullRequestId],
    queryFn: ({ signal }) => workspaceGitApi.pullRequest(workspaceId, activeSelectedPullRequestId!, signal),
    enabled: active && activeSelectedPullRequestId !== null,
    retry: false,
  });
  const analytics = useQuery({
    queryKey: ["git-activity", "pull-request-analytics", workspaceId, user.email, activeRole,
      projectId, taskId, developerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.pullRequestAnalytics(workspaceId, {
      projectId, taskId, developerId, from: from || undefined, to: to || undefined,
    }, signal),
    enabled: active && showPullRequestAnalytics,
    retry: false,
  });
  const reviewAnalytics = useQuery({
    queryKey: ["git-activity", "review-analytics", workspaceId, user.email, activeRole,
      projectId, reviewerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.codeReviewAnalytics(workspaceId, {
      projectId, developerId: reviewerId, from: from || undefined, to: to || undefined,
    }, signal),
    enabled: active && showReviewAnalytics,
    retry: false,
  });
  const reviewerOptionsQuery = useQuery({
    queryKey: ["git-activity", "reviewer-options", workspaceId, user.email, activeRole, projectId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.codeReviewAnalytics(workspaceId, {
      projectId, from: from || undefined, to: to || undefined,
    }, signal),
    enabled: active && showReviewAnalytics,
    retry: false,
  });
  const reviewerOptions = reviewerOptionsQuery.data?.reviewers.filter(reviewer => reviewer.developerId != null) ?? [];
  const rows = history.data?.content ?? [];
  const formatDuration = (hours: number | null | undefined) => {
    if (hours == null || !Number.isFinite(hours)) return "No valid merge samples";
    if (hours < 1) return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(hours * 60)} minutes`;
    if (hours < 24) return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(hours)} hours`;
    const days = hours / 24;
    return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(days)} days`;
  };

  const formatReviewDuration = (hours: number | null) =>
    hours == null || !Number.isFinite(hours) ? "No valid response sample" : formatDuration(hours);

  return <>
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><GitPullRequest className="size-4" />
            {view === "reviews" ? "Code Review Analytics" : view === "analytics" ? "Pull Request Analytics" : "Pull Requests"}</CardTitle>
            <CardDescription>{view === "reviews" ? "Submitted review outcomes and first response time in your permitted scope."
              : view === "analytics" ? "PR status and merge time for the selected project, developer and dates."
                : "Overview and history share project, developer and date filters. Search filters the list."}</CardDescription></div>
          {showReviewAnalytics && reviewAnalytics.data && view === "reviews"
            ? <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">{reviewAnalytics.data.totalReviews} valid reviews</Badge>
            : showPullRequestHistory && history.data && <Badge variant="outline">{history.data.totalElements} pull requests</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {showPullRequestHistory && <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input aria-label="Search pull requests" placeholder="Search title, number or author" value={search}
              onChange={event => { setSearch(event.target.value); setPage(0); }} className="pl-9" />
          </div>}
          {showPullRequestHistory && <Select value={sort} onValueChange={value => { if (value === "newest" || value === "oldest") { setSort(value); setPage(0); } }}>
            <SelectTrigger aria-label="Sort pull requests" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
          </Select>}
          <GitProjectSelect {...projectFilter} label={view === "reviews" ? "Filter code reviews by Project" : "Filter pull requests by Project"}
            className="w-48" onChange={value => {
              setProjectId(value); setDeveloperId(undefined); setReviewerId(undefined); setPage(0);
            }} />
          {(view === "all" || view === "analytics" || view === "pull-requests") && <Select value={developerId?.toString() ?? "all"} onValueChange={value => {
            setDeveloperId(value === "all" ? undefined : Number(value)); setPage(0);
          }}>
            <SelectTrigger aria-label="Filter pull requests by developer" className="w-48"><SelectValue placeholder="All developers" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All developers</SelectItem>
              {(filters.data?.developers ?? []).map(developer => <SelectItem key={developer.id} value={developer.id.toString()}>
                {developer.name}{developer.login ? ` (@${developer.login})` : ""}
              </SelectItem>)}
            </SelectContent>
          </Select>}
          <Input aria-label={view === "reviews" ? "Reviews from date" : "Pull requests from date"} type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(0); }} className="w-40" />
          <Input aria-label={view === "reviews" ? "Reviews to date" : "Pull requests to date"} type="date" value={to} onChange={event => { setTo(event.target.value); setPage(0); }} className="w-40" />
          {showReviewAnalytics && <Select value={reviewerId?.toString() ?? "all"} onValueChange={value => setReviewerId(value === "all" ? undefined : Number(value))}>
            <SelectTrigger aria-label="Filter code review analytics by reviewer" className="w-56"><SelectValue placeholder="All reviewers" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All reviewers</SelectItem>
              {reviewerOptions.map(reviewer => <SelectItem key={reviewer.contributorId} value={String(reviewer.developerId)}>
                {reviewer.name}{reviewer.login ? " (@" + reviewer.login + ")" : ""}
              </SelectItem>)}</SelectContent>
          </Select>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showPullRequestAnalytics && <section className="space-y-3 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/70 via-white to-white p-4" aria-label="Pull Request Analytics">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-violet-950">Pull Request overview</h3>
              <p className="text-xs text-muted-foreground">Project, developer and creation-date filters apply to these metrics and the PR list.</p>
            </div>
            <Button type="button" size="sm" variant="outline" aria-expanded={showAnalyticsDetails} aria-controls="git-pr-analytics-details"
              onClick={() => setShowAnalyticsDetails(value => !value)}>
              {showAnalyticsDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              {showAnalyticsDetails ? "Hide analytics details" : "Show analytics details"}
            </Button>
          </div>
          {analytics.isPending ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20" />)}
          </div> : analytics.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
            <span>{analytics.error instanceof Error ? analytics.error.message : "Could not load PR analytics."}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void analytics.refetch()}>Retry</Button>
          </div> : analytics.data?.total === 0 ? <WorkspaceEmptyState icon={GitPullRequest}
            title="No synced Pull Requests" description="Pull Request analytics will appear when PR history is available." compact />
            : analytics.data && <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Total PRs" value={analytics.data.total} />
                <Metric label="Open" value={analytics.data.open} />
                <Metric label="Merged" value={analytics.data.merged} />
                <Metric label="Closed without merge" value={analytics.data.closedWithoutMerge} />
              </div>
              <div id="git-pr-analytics-details" hidden={!showAnalyticsDetails} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Metric label="Average merge time" value={formatDuration(analytics.data.averageMergeHours)}
                  description="Merged PRs with valid creation and merge timestamps" />
                <Metric label="Median merge time" value={formatDuration(analytics.data.medianMergeHours)}
                  description="Middle merge duration; uses the same merged PRs as the average" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PRs by developer</h4>
                {analytics.data.developers.length === 0 ? <p className="text-sm text-muted-foreground">No developer activity in this filter.</p>
                  : <div className="flex flex-wrap gap-1">{analytics.data.developers.map(developer =>
                    <Button key={`${developer.developerId ?? "unmapped"}-${developer.contributorId ?? "unknown"}`}
                      type="button" size="sm" variant={developerId === developer.developerId && developer.developerId != null ? "secondary" : "ghost"}
                      className="h-auto max-w-full justify-start px-2 py-1 text-xs"
                      disabled={developer.developerId == null}
                      title={developer.developerId == null ? "Map this GitHub account to a Project Member to filter by developer." : undefined}
                      onClick={() => { if (developer.developerId != null) { setDeveloperId(developer.developerId); setPage(0); } }}>
                      <span className="max-w-48 truncate">{developer.name}{developer.login ? ` (@${developer.login})` : ""}</span>
                      <span className="ml-1 text-muted-foreground">{developer.total}</span>
                    </Button>)}
                  </div>}
              </div>
              </div>
            </>}
        </section>}
        {showReviewAnalytics && <section className="space-y-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-sky-50/70 p-4 shadow-sm"
          aria-label="Code Review Analytics">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="flex items-center gap-2 text-sm font-semibold"><GitPullRequest className="size-4 text-indigo-700" />Code Review Analytics</h3>
              <p className="mt-1 text-xs text-muted-foreground">Counts submitted, non-dismissed reviews from people other than the PR author. Project, reviewer and date filters select activity; first response measures from PR creation to the earliest valid review.</p></div>
            {reviewAnalytics.data && <Badge variant="outline" className="border-indigo-200 bg-white text-indigo-800">
              {reviewAnalytics.data.totalReviews} valid reviews</Badge>}
          </div>
          {reviewAnalytics.isPending ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20" />)}</div>
            : reviewAnalytics.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
              <span>{reviewAnalytics.error instanceof Error ? reviewAnalytics.error.message : "Could not load code review analytics."}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void reviewAnalytics.refetch()}>Retry</Button></div>
            : reviewAnalytics.data?.totalReviews === 0 ? <WorkspaceEmptyState icon={GitPullRequest}
              title="No submitted reviews in this filter" description="Pending, dismissed and self reviews are excluded from these statistics." compact />
              : reviewAnalytics.data && <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Total reviews" value={reviewAnalytics.data.totalReviews} />
                  <Metric label="Approved" value={reviewAnalytics.data.approved} />
                  <Metric label="Changes requested" value={reviewAnalytics.data.changesRequested} />
                  <Metric label="Commented" value={reviewAnalytics.data.commented} />
                  <Metric label="First response · average" value={formatReviewDuration(reviewAnalytics.data.averageFirstResponseHours)}
                    description={reviewAnalytics.data.reviewedPullRequests + " PRs with valid response timestamps"} />
                  <Metric label="First response · median" value={formatReviewDuration(reviewAnalytics.data.medianFirstResponseHours)}
                    description={reviewAnalytics.data.reviewedPullRequests + " PRs with valid response timestamps"} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviews by developer</h4>
                  <ReviewActivityList reviewers={reviewAnalytics.data.reviewers} onSelect={setSelectedPullRequestId} formatDuration={formatReviewDuration} />
                </div>
              </>}
        </section>}
        {showPullRequestHistory && <><h3 className="pt-2 text-sm font-semibold text-slate-900">Pull Request history</h3>
        {history.isPending ? <div className="space-y-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
          : history.isError ? <WorkspaceEmptyState icon={GitPullRequest} title="Could not load Pull Requests"
            description={history.error instanceof Error ? history.error.message : "Could not load Pull Requests."}
            action={<Button variant="outline" onClick={() => void history.refetch()}>Retry</Button>} />
          : rows.length === 0 ? <WorkspaceEmptyState icon={GitPullRequest} title="No Pull Requests yet"
            description="Synced Pull Requests will appear here when they are available." compact />
          : <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[56rem] table-fixed">
              <TableHeader><TableRow><TableHead>Pull Request</TableHead><TableHead className="w-36">Author</TableHead><TableHead className="w-28">Status</TableHead><TableHead className="w-40">Created</TableHead><TableHead className="w-36">Tasks</TableHead><TableHead className="w-28 text-right">Source</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map(pr => <TableRow key={pr.id}>
                <TableCell className="max-w-[30rem]">
                  <button type="button" className="block max-w-full text-left" onClick={() => setSelectedPullRequestId(pr.id)}>
                    <span className="block truncate font-medium hover:underline">#{pr.number} · {pr.title}</span>
                    {pr.draft && <span className="text-xs text-muted-foreground">Draft</span>}
                  </button>
                </TableCell>
                <TableCell><span className="block truncate" title={pr.authorName}>{pr.authorName}</span>{pr.authorLogin && <span className="block truncate text-xs text-muted-foreground" title={pr.authorLogin}>@{pr.authorLogin}</span>}</TableCell>
                <TableCell><Badge variant={stateVariant(pr.state)}>{pr.state}</Badge>{pr.draft && <Badge className="ml-1" variant="outline">Draft</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{formatDate(pr.createdAt)}</TableCell>
                <TableCell><GitTaskBadges tasks={pr.tasks} /></TableCell>
                <TableCell className="text-right">{pr.htmlUrl ? <Button asChild variant="ghost" size="sm">
                  <a href={pr.htmlUrl} target="_blank" rel="noreferrer" aria-label={`View pull request ${pr.number} on GitHub`}>GitHub <ArrowUpRight className="ml-1 size-3.5" /></a>
                </Button> : <span className="text-xs text-muted-foreground">Pending link</span>}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>}
        {history.data && history.data.totalPages > 1 && <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {page + 1} of {history.data.totalPages}</span>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || history.isFetching} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= history.data.totalPages || history.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>
        </div>}</>}
      </CardContent>
    </Card>

    <Dialog open={activeSelectedPullRequestId !== null} onOpenChange={open => { if (!open) setSelectedPullRequestId(null); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Pull Request details</DialogTitle><DialogDescription>Synced Pull Request metadata, Task links and submitted reviews.</DialogDescription></DialogHeader>
        {details.isPending ? <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-24 w-full" /></div>
          : details.isError ? <p role="alert" className="text-sm text-destructive">
            {details.error instanceof Error ? details.error.message : "Could not load Pull Request details."}</p>
          : taskId && details.data && !details.data.tasks.some(task => task.taskId === taskId)
            ? <p role="alert" className="text-sm text-destructive">This Pull Request is not linked to the selected task.</p>
          : details.data && <div className="space-y-4">
            <div><h3 className="font-medium">#{details.data.number} · {details.data.title}</h3>
              {details.data.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{details.data.body}</p>}</div>
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Author</dt><dd>{details.data.authorName}{details.data.authorLogin ? ` (@${details.data.authorLogin})` : ""}</dd>
              <dt className="text-muted-foreground">Status</dt><dd><Badge variant={stateVariant(details.data.state)}>{details.data.state}</Badge>{details.data.draft && <Badge className="ml-1" variant="outline">Draft</Badge>}</dd>
              <dt className="text-muted-foreground">Branches</dt><dd className="break-all">{details.data.sourceBranch} → {details.data.targetBranch}</dd>
              <dt className="text-muted-foreground">Created</dt><dd>{formatDate(details.data.createdAt)}</dd>
              <dt className="text-muted-foreground">Merged</dt><dd>{formatDate(details.data.mergedAt)}</dd>
              <dt className="text-muted-foreground">Closed</dt><dd>{formatDate(details.data.closedAt)}</dd>
              <dt className="text-muted-foreground">Repository</dt><dd>{details.data.repositoryName}</dd>
            </dl>
            <section className="space-y-2"><h3 className="text-sm font-medium">Linked tasks</h3>
              <GitLinkedTasks key={details.data.id} tasks={details.data.tasks} /></section>
            <section className="space-y-2"><h3 className="text-sm font-medium">Submitted reviews</h3>
              <GitSubmittedReviews key={details.data.id} reviews={details.data.reviews} /></section>
            {details.data.htmlUrl ? <Button asChild><a href={details.data.htmlUrl} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight className="ml-1 size-4" /></a></Button>
              : <p className="text-sm text-muted-foreground">View on GitHub will be available after the repository is connected.</p>}
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}

function ReviewActivityList({ reviewers, onSelect, formatDuration }: {
  reviewers: GitCodeReviewAnalytics["reviewers"];
  onSelect: (id: number) => void;
  formatDuration: (hours: number | null) => string;
}) {
  const [page, setPage] = useGitActivityParam<number>("gitReviewPage", 0);
  const current = Math.min(page, Math.max(0, Math.ceil(reviewers.length / 6) - 1));
  if (!reviewers.length) return <p className="text-sm text-muted-foreground">No reviewers match this Workspace scope.</p>;
  return <div className="space-y-3">
    <div className="grid gap-3 lg:grid-cols-2">{reviewers.slice(current * 6, current * 6 + 6).map(reviewer =>
      <ReviewActivityCard key={reviewer.contributorId} reviewer={reviewer} onSelect={onSelect} formatDuration={formatDuration} />)}</div>
    <GitListPagination page={current} total={reviewers.length} pageSize={6} onChange={setPage} label="reviewers" />
  </div>;
}

function ReviewActivityCard({ reviewer, onSelect, formatDuration }: {
  reviewer: GitCodeReviewAnalytics["reviewers"][number];
  onSelect: (id: number) => void;
  formatDuration: (hours: number | null) => string;
}) {
  const [page, setPage] = useGitActivityParam<number>(`gitReviewer${reviewer.contributorId}Page`, 0);
  const current = Math.min(page, Math.max(0, Math.ceil(reviewer.pullRequests.length / 5) - 1));
  return <section aria-label={`Reviews by ${reviewer.name}`} className="space-y-3 rounded-lg border border-indigo-100 bg-white/90 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-medium">{reviewer.name}{reviewer.login && <span className="ml-1 text-xs text-muted-foreground">@{reviewer.login}</span>}</p>
        {reviewer.developerId == null && <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-amber-800">Unmapped reviewer</Badge>}</div>
      <Badge variant="secondary">{reviewer.reviews} reviews</Badge>
    </div>
    <div className="flex flex-wrap gap-1 text-xs">
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved {reviewer.approved}</Badge>
      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Changes {reviewer.changesRequested}</Badge>
      <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Commented {reviewer.commented}</Badge>
    </div>
    <div className="space-y-1.5">{reviewer.pullRequests.slice(current * 5, current * 5 + 5).map(pr =>
      <div key={pr.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs">
        <div className="min-w-0 flex-1"><button type="button" className="block max-w-full truncate text-left font-medium text-primary hover:underline"
          onClick={() => onSelect(pr.id)}>#{pr.number} · {pr.title}</button>
          <p className="text-muted-foreground">{pr.state}{pr.firstReviewAt ? " · first review " + formatDate(pr.firstReviewAt) : " · no valid response timestamp"}</p></div>
        <span className="whitespace-nowrap font-medium text-indigo-800">{formatDuration(pr.responseHours)}</span>
        {pr.htmlUrl && <a className="text-indigo-700 hover:underline" href={pr.htmlUrl} target="_blank" rel="noreferrer">GitHub</a>}
      </div>)}</div>
    <GitListPagination page={current} total={reviewer.pullRequests.length} pageSize={5} onChange={setPage} label={`${reviewer.name} reviewed PRs`} />
  </section>;
}

function Metric({ label, value, description }: { label: string; value: number | string; description?: string }) {
  return <div className="min-w-0 rounded-md border bg-card px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p>
    {description && <p className="mt-1 text-[10px] text-muted-foreground">{description}</p>}
  </div>;
}
