import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, GitPullRequest, Search } from "lucide-react";
import { workspaceGitApi } from "@/api/features/workspace-git.api";
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

export function GitPullRequestsWorkspacePanel({ workspaceId, taskId, view = "all" }: {
  workspaceId: number;
  taskId?: number;
  view?: "all" | "analytics" | "pull-requests" | "reviews";
}) {
  const { user, activeRole } = usePermissions();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [projectId, setProjectId] = useState<number | undefined>();
  const [developerId, setDeveloperId] = useState<number | undefined>();
  const [reviewerId, setReviewerId] = useState<number | undefined>();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedPullRequestId, setSelectedPullRequestId] = useState<number | null>(null);
  const showPullRequestAnalytics = view === "all" || view === "analytics";
  const showPullRequestHistory = view === "all" || view === "pull-requests";
  const showReviewAnalytics = view === "all" || view === "reviews";
  const activeSelectedPullRequestId = showPullRequestHistory ? selectedPullRequestId : null;
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
    retry: false,
  });
  const details = useQuery({
    queryKey: ["git-activity", "pull-request", workspaceId, user.email, activeRole, activeSelectedPullRequestId],
    queryFn: ({ signal }) => workspaceGitApi.pullRequest(workspaceId, activeSelectedPullRequestId!, signal),
    enabled: activeSelectedPullRequestId !== null,
    retry: false,
  });
  const analytics = useQuery({
    queryKey: ["git-activity", "pull-request-analytics", workspaceId, user.email, activeRole,
      projectId, taskId, developerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.pullRequestAnalytics(workspaceId, {
      projectId, taskId, developerId, from: from || undefined, to: to || undefined,
    }, signal),
    retry: false,
  });
  const reviewAnalytics = useQuery({
    queryKey: ["git-activity", "review-analytics", workspaceId, user.email, activeRole,
      projectId, reviewerId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.codeReviewAnalytics(workspaceId, {
      projectId, developerId: reviewerId, from: from || undefined, to: to || undefined,
    }, signal),
    retry: false,
  });
  const reviewerOptionsQuery = useQuery({
    queryKey: ["git-activity", "reviewer-options", workspaceId, user.email, activeRole, projectId, from, to],
    queryFn: ({ signal }) => workspaceGitApi.codeReviewAnalytics(workspaceId, {
      projectId, from: from || undefined, to: to || undefined,
    }, signal),
    retry: false,
  });
  const reviewerOptions = reviewerOptionsQuery.data?.reviewers.filter(reviewer => reviewer.developerId != null) ?? [];
  const rows = history.data?.content ?? [];
  const formatDuration = (hours: number | null | undefined) => {
    if (hours == null || !Number.isFinite(hours)) return "No valid merge samples";
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
                : "PRs and submitted reviews in the repository scope you can access."}</CardDescription></div>
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
          <Select value={projectId?.toString() ?? "all"} onValueChange={value => {
            setProjectId(value === "all" ? undefined : Number(value)); setDeveloperId(undefined); setReviewerId(undefined); setPage(0);
          }}>
            <SelectTrigger aria-label="Filter pull requests by Project" className="w-48"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Projects</SelectItem>
              {(filters.data?.projects ?? []).map(project => <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
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
        {showPullRequestAnalytics && <section className="space-y-3 rounded-md border bg-muted/10 p-3" aria-label="Pull Request Analytics">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Pull Request analytics</h3>
              <p className="text-xs text-muted-foreground">Project, developer and creation-date filters apply to these metrics and the PR list.</p>
            </div>
            {analytics.data && <Badge variant="outline">{analytics.data.total} PRs</Badge>}
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
              <div className="grid gap-2">
                <Metric label="Average merge time" value={formatDuration(analytics.data.averageMergeHours)}
                  description="Merged PRs with valid creation and merge timestamps" />
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
                  {reviewAnalytics.data.reviewers.length === 0 ? <p className="text-sm text-muted-foreground">No reviewers match this Workspace scope.</p>
                    : <div className="grid gap-3 lg:grid-cols-2">{reviewAnalytics.data.reviewers.map(reviewer =>
                      <div key={reviewer.contributorId} className="rounded-lg border border-indigo-100 bg-white/90 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div><p className="font-medium">{reviewer.name}{reviewer.login ? <span className="ml-1 text-xs text-muted-foreground">@{reviewer.login}</span> : null}</p>
                            {reviewer.developerId == null && <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 text-amber-800">Unmapped reviewer</Badge>}</div>
                          <Badge variant="secondary">{reviewer.reviews} reviews</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 text-xs">
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved {reviewer.approved}</Badge>
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Changes {reviewer.changesRequested}</Badge>
                          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Commented {reviewer.commented}</Badge>
                        </div>
                        <div className="mt-3 space-y-1.5">{reviewer.pullRequests.map(pr =>
                          <div key={pr.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs">
                            <div className="min-w-0 flex-1"><p className="truncate font-medium">#{pr.number} · {pr.title}</p>
                              <p className="text-muted-foreground">{pr.state}{pr.firstReviewAt ? " · first review by this member " + formatDate(pr.firstReviewAt) : " · no valid response timestamp"}</p></div>
                            <span className="whitespace-nowrap font-medium text-indigo-800">{formatReviewDuration(pr.responseHours)}</span>
                            {pr.htmlUrl && <a className="text-indigo-700 hover:underline" href={pr.htmlUrl} target="_blank" rel="noreferrer">Open</a>}
                          </div>)}</div>
                      </div>)}</div>}
                </div>
              </>}
        </section>}
        {showPullRequestHistory && <>{history.isPending ? <div className="space-y-2">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
          : history.isError ? <WorkspaceEmptyState icon={GitPullRequest} title="Could not load Pull Requests"
            description={history.error instanceof Error ? history.error.message : "Could not load Pull Requests."}
            action={<Button variant="outline" onClick={() => void history.refetch()}>Retry</Button>} />
          : rows.length === 0 ? <WorkspaceEmptyState icon={GitPullRequest} title="No Pull Requests yet"
            description="Synced Pull Requests will appear here when they are available." compact />
          : <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Pull Request</TableHead><TableHead>Author</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Tasks</TableHead><TableHead className="text-right">Source</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map(pr => <TableRow key={pr.id}>
                <TableCell className="max-w-[30rem]">
                  <button type="button" className="block max-w-full text-left" onClick={() => setSelectedPullRequestId(pr.id)}>
                    <span className="block truncate font-medium hover:underline">#{pr.number} · {pr.title}</span>
                    {pr.draft && <span className="text-xs text-muted-foreground">Draft</span>}
                  </button>
                </TableCell>
                <TableCell><span>{pr.authorName}</span>{pr.authorLogin && <span className="block text-xs text-muted-foreground">@{pr.authorLogin}</span>}</TableCell>
                <TableCell><Badge variant={stateVariant(pr.state)}>{pr.state}</Badge>{pr.draft && <Badge className="ml-1" variant="outline">Draft</Badge>}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(pr.createdAt)}</TableCell>
                <TableCell>{pr.tasks.length ? pr.tasks.map(task => <Badge key={task.taskId} variant="outline" className="mr-1 max-w-44 truncate">{task.title}</Badge>) : "—"}</TableCell>
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
              {details.data.tasks.length ? details.data.tasks.map(task => <div key={task.taskId} className="rounded-md border px-3 py-2 text-sm">{task.title} <span className="text-muted-foreground">· #{task.taskId} · {task.source}</span></div>)
                : <p className="text-sm text-muted-foreground">No Task is linked to this Pull Request.</p>}</section>
            <section className="space-y-2"><h3 className="text-sm font-medium">Submitted reviews</h3>
              {details.data.reviews.length ? <div className="space-y-2">{details.data.reviews.map(review => <div key={review.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div>{review.reviewerName}{review.reviewerLogin ? <span className="text-muted-foreground"> (@{review.reviewerLogin})</span> : null}
                  {review.selfReview && <Badge className="ml-2" variant="outline">Self review</Badge>}</div>
                <div className="flex items-center gap-2"><Badge variant={review.state === "APPROVED" ? "default" : review.state === "CHANGES_REQUESTED" ? "destructive" : "secondary"}>{review.state.replaceAll("_", " ")}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(review.submittedAt)}</span></div>
              </div>)}</div> : <p className="text-sm text-muted-foreground">No submitted reviews are available.</p>}</section>
            {details.data.htmlUrl ? <Button asChild><a href={details.data.htmlUrl} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight className="ml-1 size-4" /></a></Button>
              : <p className="text-sm text-muted-foreground">View on GitHub will be available after the repository is connected.</p>}
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}

function Metric({ label, value, description }: { label: string; value: number | string; description?: string }) {
  return <div className="min-w-0 rounded-md border bg-card px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</p>
    {description && <p className="mt-1 text-[10px] text-muted-foreground">{description}</p>}
  </div>;
}
