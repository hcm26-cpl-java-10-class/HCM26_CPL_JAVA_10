import { useDeferredValue, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest } from "lucide-react";
import { workspaceGitApi } from "@/api/features/workspace-git.api";
import { MainLayout } from "@/components/layout/MainLayout";
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

const PAGE_SIZE = 20;
type TaskActivityView = "commits" | "pull-requests";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
};

function errorMessage(error: unknown) {
  const response = error as { response?: { data?: { message?: string } }; message?: string };
  return response?.response?.data?.message ?? response?.message ?? "Could not load this task's Git activity.";
}

function pageValue(params: URLSearchParams, key: string) {
  const value = Number(params.get(key));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function Pagination({ page, pages, total, loading, onChange }: {
  page: number; pages: number; total: number; loading: boolean; onChange: (page: number) => void;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
    <span>{total} matching items · Page {pages === 0 ? 0 : page + 1} of {pages}</span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => onChange(page - 1)}>Previous</Button>
      <Button variant="outline" size="sm" disabled={page + 1 >= pages || loading} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  </div>;
}

export default function TaskGitActivityPage() {
  const { workspaceId, taskId } = useParams<{ workspaceId: string; taskId: string }>();
  const { user, activeRole } = usePermissions();
  return <TaskGitActivity key={`${workspaceId}:${taskId}:${user.email}:${activeRole}`}
    workspaceId={Number(workspaceId)} taskId={Number(taskId)} />;
}

function TaskGitActivity({ workspaceId, taskId }: { workspaceId: number; taskId: number }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const validIds = Number.isSafeInteger(workspaceId) && workspaceId > 0 && Number.isSafeInteger(taskId) && taskId > 0;
  const canRead = hasPermission("SPRINT_BACKLOG_READ")
    && (hasPermission("WORKSPACE_READ") || hasPermission("VIEW_PROJECT_WORKSPACE"));
  const identity = [workspaceId, taskId, user.email, activeRole];

  const view: TaskActivityView = params.get("gitView") === "pull-requests" ? "pull-requests" : "commits";
  const commitSearch = params.get("commitSearch") ?? "";
  const pullRequestSearch = params.get("prSearch") ?? "";
  const deferredCommitSearch = useDeferredValue(commitSearch.trim());
  const deferredPullRequestSearch = useDeferredValue(pullRequestSearch.trim());
  const sort = params.get("gitSort") === "oldest" ? "oldest" : "newest";
  const from = params.get("gitFrom") ?? "";
  const to = params.get("gitTo") ?? "";
  const commitPage = pageValue(params, "commitPage");
  const pullRequestPage = pageValue(params, "prPage");
  const detailValue = params.get("gitDetail") ?? "";
  const detailMatch = /^(commit|pr):(\d+)$/.exec(detailValue);
  const selected = detailMatch ? { kind: detailMatch[1] as "commit" | "pr", id: Number(detailMatch[2]) } : null;

  const updateParams = (values: Record<string, string | null>, replace = true) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      Object.entries(values).forEach(([key, value]) => value == null || value === ""
        ? next.delete(key) : next.set(key, value));
      return next;
    }, { replace });
  };
  const setPage = (key: "commitPage" | "prPage", value: number) => updateParams({ [key]: String(Math.max(0, value)) });

  const task = useQuery({
    queryKey: ["git-activity", "task-context", ...identity],
    queryFn: ({ signal }) => workspaceGitApi.taskContext(workspaceId, taskId, signal),
    enabled: validIds && canRead, retry: false,
  });
  const enabled = canRead && task.isSuccess;
  const status = useQuery({
    queryKey: ["git-activity", "status", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.activityStatus(workspaceId, signal), enabled, retry: false,
  });
  const commits = useQuery({
    queryKey: ["git-activity", "task-commits-page", ...identity, deferredCommitSearch, sort, from, to, commitPage],
    queryFn: ({ signal }) => workspaceGitApi.commits(workspaceId, {
      taskId, search: deferredCommitSearch || undefined, page: commitPage, size: PAGE_SIZE, sort,
      from: from || undefined, to: to || undefined,
    }, signal), enabled, retry: false,
  });
  const pullRequests = useQuery({
    queryKey: ["git-activity", "task-prs-page", ...identity, deferredPullRequestSearch, sort, from, to, pullRequestPage],
    queryFn: ({ signal }) => workspaceGitApi.pullRequests(workspaceId, {
      taskId, search: deferredPullRequestSearch || undefined, page: pullRequestPage, size: PAGE_SIZE, sort,
      from: from || undefined, to: to || undefined,
    }, signal), enabled, retry: false,
  });
  const commitDetails = useQuery({
    queryKey: ["git-activity", "task-commit-details", ...identity, selected?.kind === "commit" ? selected.id : null],
    queryFn: ({ signal }) => workspaceGitApi.commit(workspaceId, selected!.id, signal),
    enabled: enabled && selected?.kind === "commit", retry: false,
  });
  const prDetails = useQuery({
    queryKey: ["git-activity", "task-pr-details", ...identity, selected?.kind === "pr" ? selected.id : null],
    queryFn: ({ signal }) => workspaceGitApi.pullRequest(workspaceId, selected!.id, signal),
    enabled: enabled && selected?.kind === "pr", retry: false,
  });

  const returnTo = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const backTo = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo : `/management/workspaces/${workspaceId}?tab=backlog${task.data ? `&project=${task.data.projectId}` : ""}`;
  const [backPath, backQuery] = backTo.split("?", 2);
  const taskReturnParams = new URLSearchParams(backQuery);
  taskReturnParams.set("itemId", String(taskId));
  const taskReturnTo = `${backPath}?${taskReturnParams}`;
  const workspacePath = `/management/workspaces/${workspaceId}`;
  const taskPath = `${workspacePath}/tasks/${taskId}`;
  const changeView = (nextView: TaskActivityView) => updateParams({ gitView: nextView, gitDetail: null }, false);
  const openDetails = (kind: "commit" | "pr", id: number) => updateParams({ gitDetail: `${kind}:${id}` }, false);
  const closeDetails = () => updateParams({ gitDetail: null });

  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background"
    ignorePaths={["management", "tasks"]}
    pathLinks={{ "/management/workspaces": "/management/workspaces/candidates", [workspacePath]: backTo, [taskPath]: taskReturnTo }}
    pathName={{ workspaces: "Workspace", [workspacePath]: task.data?.projectName ?? "Workspace", [taskPath]: `TASK-${taskId}`, "git-activities": "Git Activities" }}>
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-slate-600 hover:text-primary">
        <Link to={taskReturnTo}><ArrowLeft className="size-4" />Back to task</Link>
      </Button>
      {!validIds || !canRead ? <WorkspaceEmptyState icon={GitBranch} title="Task unavailable"
        description="This task is unavailable or you do not have permission to view its Git activity." />
        : task.isPending ? <Skeleton className="h-36 w-full" />
          : task.isError ? <LoadError error={task.error} retry={() => void task.refetch()} />
            : task.data && <>
              <header className="rounded-xl border bg-gradient-to-r from-slate-50 via-white to-blue-50/70 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid size-9 place-items-center rounded-lg bg-blue-100 text-blue-700"><GitBranch className="size-5" /></span>
                      <Badge className="border-blue-200 bg-blue-50 font-mono text-blue-800 hover:bg-blue-50">TASK-{task.data.taskId}</Badge>
                      {task.data.status && <TaskStatusBadge status={task.data.status} />}
                      {status.data?.mockData && <Badge variant="secondary">Mock data</Badge>}
                    </div>
                    <div><h1 className="break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{task.data.title}</h1>
                      <p className="mt-1 text-sm text-muted-foreground">{task.data.projectName ?? "Workspace"} · Showing Git activity linked only to this task.</p>
                    </div>
                  </div>
                  <div className="flex min-w-48 flex-col items-start gap-2 sm:items-end">
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
                      {view === "commits" ? <GitCommitHorizontal className="mr-1 size-3.5" /> : <GitPullRequest className="mr-1 size-3.5" />}
                      {view === "commits" ? "Task commits" : "Task pull requests"}
                    </Badge>
                    {status.data?.repositoryName && <span className="max-w-full truncate text-xs text-muted-foreground">{status.data.repositoryName}</span>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
                  <p className="text-xs font-medium text-slate-600">Task scope <span className="mx-1 text-slate-400">/</span>
                    <span className="text-slate-900">{task.data.title}</span></p>
                  {status.data?.repositoryUrl && <Button asChild size="sm" variant="outline" className="h-8 bg-white">
                    <a href={status.data.repositoryUrl} target="_blank" rel="noreferrer">Repository<ExternalLink className="size-3.5" /></a>
                  </Button>}
                </div>
              </header>

              <div className="overflow-x-auto rounded-xl border bg-white p-1 shadow-sm" role="tablist" aria-label="Task Git activity sections">
                <div className="flex min-w-max gap-1">
                  <TaskViewTab value="commits" active={view === "commits"} count={commits.data?.totalElements} onSelect={changeView}>
                    <GitCommitHorizontal className="size-4" />Commits
                  </TaskViewTab>
                  <TaskViewTab value="pull-requests" active={view === "pull-requests"} count={pullRequests.data?.totalElements} onSelect={changeView}>
                    <GitPullRequest className="size-4" />Pull Requests
                  </TaskViewTab>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3 shadow-sm">
                <div className="mr-auto flex items-center gap-2 text-sm font-medium text-slate-700">
                  {view === "commits" ? <GitCommitHorizontal className="size-4 text-blue-600" /> : <GitPullRequest className="size-4 text-violet-600" />}
                  {view === "commits" ? "Commit history" : "Pull Request history"}
                </div>
                <Select value={sort} onValueChange={value => {
                  if (value === "newest" || value === "oldest") updateParams({ gitSort: value, commitPage: null, prPage: null });
                }}>
                  <SelectTrigger className="w-40" aria-label="Sort task Git activities"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">From
                  <Input type="date" className="w-40" aria-label="Task Git activities from date" value={from}
                    onChange={event => updateParams({ gitFrom: event.target.value, commitPage: null, prPage: null })} />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">To
                  <Input type="date" className="w-40" aria-label="Task Git activities to date" value={to}
                    onChange={event => updateParams({ gitTo: event.target.value, commitPage: null, prPage: null })} />
                </label>
                <span className="w-full text-xs text-muted-foreground sm:w-auto">Dates use Vietnam time. PRs are filtered by creation date.</span>
              </div>

              {view === "commits" ? <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-blue-50/80 via-white to-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><CardTitle className="flex items-center gap-2 text-base text-slate-900"><GitCommitHorizontal className="size-4 text-blue-700" />Commits for TASK-{task.data.taskId}</CardTitle>
                      <CardDescription className="mt-1">Only commits linked to {task.data.title} are included.</CardDescription></div>
                    {commits.data && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">{commits.data.totalElements} commits</Badge>}
                  </div>
                  <div className="relative mt-3 max-w-xl">
                    <Input aria-label="Search task commits" placeholder="Search message, SHA or author" value={commitSearch}
                      onChange={event => { updateParams({ commitSearch: event.target.value, commitPage: null }); }} className="bg-white" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 sm:p-5">
                  {commits.isPending ? <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                    : commits.isError ? <LoadError error={commits.error} retry={() => void commits.refetch()} />
                      : commits.data?.content.length ? <div className="overflow-x-auto rounded-lg border">
                        <Table><TableHeader className="bg-slate-50"><TableRow>
                          <TableHead className="min-w-64">Message / SHA</TableHead><TableHead className="min-w-36">Author</TableHead>
                          <TableHead className="min-w-40">Committed</TableHead><TableHead className="min-w-32">Branch</TableHead>
                          <TableHead className="min-w-32 text-right">Actions</TableHead>
                        </TableRow></TableHeader>
                          <TableBody>{commits.data.content.map(commit => <TableRow key={commit.id} className="align-middle">
                            <TableCell className="max-w-[32rem]">
                              <button type="button" title={commit.message || "(no message)"} onClick={() => openDetails("commit", commit.id)}
                                className="block max-w-full truncate text-left font-medium text-slate-900 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                {commit.message.split("\n")[0] || "(no message)"}
                              </button>
                              <code className="mt-1 block font-mono text-xs text-slate-500">{commit.shortSha}</code>
                            </TableCell>
                            <TableCell><span className="font-medium">{commit.authorName}</span>{commit.authorLogin && <span className="block text-xs text-muted-foreground">@{commit.authorLogin}</span>}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-slate-600">{formatDate(commit.committedAt)}</TableCell>
                            <TableCell><Badge variant="outline" className="max-w-36 truncate border-slate-200 bg-slate-50 text-slate-700">{commit.branch ?? "Unknown"}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button type="button" variant="ghost" size="sm" onClick={() => openDetails("commit", commit.id)}>Details</Button>
                                <SourceLink url={commit.htmlUrl} label={`View commit ${commit.shortSha} on GitHub`} />
                              </div>
                            </TableCell>
                          </TableRow>)}</TableBody>
                        </Table>
                      </div> : <WorkspaceEmptyState icon={GitCommitHorizontal} title="No matching commits" description="No commits linked to this task match the current filters." compact />}
                  {commits.data && <Pagination page={commitPage} pages={commits.data.totalPages} total={commits.data.totalElements}
                    loading={commits.isFetching} onChange={nextPage => setPage("commitPage", nextPage)} />}
                </CardContent>
              </Card> : <Card className="overflow-hidden shadow-sm">
                <CardHeader className="border-b bg-gradient-to-r from-violet-50/80 via-white to-slate-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><CardTitle className="flex items-center gap-2 text-base text-slate-900"><GitPullRequest className="size-4 text-violet-700" />Pull Requests for TASK-{task.data.taskId}</CardTitle>
                      <CardDescription className="mt-1">Open a Pull Request to see its description, branches and submitted reviews.</CardDescription></div>
                    {pullRequests.data && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">{pullRequests.data.totalElements} pull requests</Badge>}
                  </div>
                  <div className="mt-3 max-w-xl"><Input aria-label="Search task pull requests" placeholder="Search title, number or author" value={pullRequestSearch}
                    onChange={event => { updateParams({ prSearch: event.target.value, prPage: null }); }} className="bg-white" /></div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 sm:p-5">
                  {pullRequests.isPending ? <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
                    : pullRequests.isError ? <LoadError error={pullRequests.error} retry={() => void pullRequests.refetch()} />
                      : pullRequests.data?.content.length ? <div className="overflow-x-auto rounded-lg border">
                        <Table><TableHeader className="bg-slate-50"><TableRow>
                          <TableHead className="min-w-64">Pull Request</TableHead><TableHead className="min-w-36">Author</TableHead>
                          <TableHead className="min-w-28">Status</TableHead><TableHead className="min-w-40">Created</TableHead>
                          <TableHead className="min-w-32 text-right">Actions</TableHead>
                        </TableRow></TableHeader>
                          <TableBody>{pullRequests.data.content.map(pr => <TableRow key={pr.id}>
                            <TableCell className="max-w-[32rem]">
                              <button type="button" title={pr.title} onClick={() => openDetails("pr", pr.id)}
                                className="block max-w-full truncate text-left font-medium text-slate-900 hover:text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                                #{pr.number} · {pr.title}
                              </button>
                              {pr.draft && <span className="text-xs text-muted-foreground">Draft</span>}
                            </TableCell>
                            <TableCell><span className="font-medium">{pr.authorName}</span>{pr.authorLogin && <span className="block text-xs text-muted-foreground">@{pr.authorLogin}</span>}</TableCell>
                            <TableCell><PullRequestStateBadge state={pr.state} /></TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-slate-600">{formatDate(pr.createdAt)}</TableCell>
                            <TableCell className="text-right"><div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="sm" onClick={() => openDetails("pr", pr.id)}>Details</Button>
                              <SourceLink url={pr.htmlUrl} label={`View pull request ${pr.number} on GitHub`} />
                            </div></TableCell>
                          </TableRow>)}</TableBody>
                        </Table>
                      </div> : <WorkspaceEmptyState icon={GitPullRequest} title="No matching Pull Requests" description="No Pull Requests linked to this task match the current filters." compact />}
                  {pullRequests.data && <Pagination page={pullRequestPage} pages={pullRequests.data.totalPages} total={pullRequests.data.totalElements}
                    loading={pullRequests.isFetching} onChange={nextPage => setPage("prPage", nextPage)} />}
                </CardContent>
              </Card>}
            </>}
    </div>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) closeDetails(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{selected?.kind === "pr" ? "Pull Request details" : "Commit details"}</DialogTitle>
          <DialogDescription>Details for activity linked to TASK-{taskId}.</DialogDescription></DialogHeader>
        {selected?.kind === "commit" ? commitDetails.isPending ? <DetailSkeleton />
          : commitDetails.isError ? <LoadError error={commitDetails.error} retry={() => void commitDetails.refetch()} />
            : commitDetails.data && <div className="space-y-4">
              <p className="whitespace-pre-wrap break-words font-medium">{commitDetails.data.message || "(no message)"}</p>
              <code className="block break-all rounded-md bg-slate-100 p-3 text-xs">{commitDetails.data.sha}</code>
              <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Author</dt><dd>{commitDetails.data.authorName}</dd>
                <dt className="text-muted-foreground">Committed</dt><dd>{formatDate(commitDetails.data.committedAt)}</dd>
                <dt className="text-muted-foreground">Branch</dt><dd>{commitDetails.data.branch ?? "—"}</dd>
                <dt className="text-muted-foreground">Repository</dt><dd>{commitDetails.data.repositoryName}</dd>
              </dl><SourceLink url={commitDetails.data.htmlUrl} label="View commit on GitHub" primary />
            </div>
          : selected?.kind === "pr" ? prDetails.isPending ? <DetailSkeleton />
            : prDetails.isError ? <LoadError error={prDetails.error} retry={() => void prDetails.refetch()} />
              : prDetails.data && <div className="space-y-4">
                <div><p className="font-medium">#{prDetails.data.number} · {prDetails.data.title}</p><PullRequestStateBadge state={prDetails.data.state} /></div>
                <p className="whitespace-pre-wrap break-words text-sm">{prDetails.data.body || "No description."}</p>
                <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Author</dt><dd>{prDetails.data.authorName}</dd>
                  <dt className="text-muted-foreground">Branches</dt><dd className="break-all">{prDetails.data.sourceBranch} → {prDetails.data.targetBranch}</dd>
                  <dt className="text-muted-foreground">Created</dt><dd>{formatDate(prDetails.data.createdAt)}</dd>
                  <dt className="text-muted-foreground">Merged</dt><dd>{formatDate(prDetails.data.mergedAt)}</dd>
                </dl>
                <section className="space-y-2"><h3 className="text-sm font-semibold">Reviews</h3>
                  {prDetails.data.reviews.length ? prDetails.data.reviews.map(review => <div key={review.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <span>{review.reviewerName}</span><ReviewStateBadge state={review.state} />
                    <span className="text-xs text-muted-foreground">{formatDate(review.submittedAt)}</span>
                  </div>) : <p className="text-sm text-muted-foreground">No submitted reviews are available.</p>}
                </section><SourceLink url={prDetails.data.htmlUrl} label="View pull request on GitHub" primary />
              </div> : null}
      </DialogContent>
    </Dialog>
  </MainLayout>;
}

function TaskViewTab({ value, active, count, onSelect, children }: {
  value: TaskActivityView; active: boolean; count?: number; onSelect: (value: TaskActivityView) => void; children: ReactNode;
}) {
  return <button type="button" role="tab" aria-selected={active} onClick={() => onSelect(value)}
    className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active
      ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
    {children}{count != null && <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${active ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{count}</span>}
  </button>;
}

function TaskStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const palette = normalized === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : normalized === "IN_PROGRESS" ? "border-blue-200 bg-blue-50 text-blue-800"
      : normalized === "REVIEW" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
  return <Badge variant="outline" className={palette}>{status.replaceAll("_", " ")}</Badge>;
}

function PullRequestStateBadge({ state }: { state: string }) {
  const palette = state === "MERGED" ? "border-violet-200 bg-violet-50 text-violet-800"
    : state === "CLOSED" ? "border-slate-200 bg-slate-100 text-slate-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <Badge variant="outline" className={palette}>{state === "MERGED" ? "Merged" : state === "CLOSED" ? "Closed" : "Open"}</Badge>;
}

function ReviewStateBadge({ state }: { state: string }) {
  const palette = state === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : state === "CHANGES_REQUESTED" ? "border-rose-200 bg-rose-50 text-rose-800"
      : "border-sky-200 bg-sky-50 text-sky-800";
  return <Badge variant="outline" className={palette}>{state.replaceAll("_", " ")}</Badge>;
}

function SourceLink({ url, label, primary = false }: { url: string | null; label: string; primary?: boolean }) {
  if (!url) return <span className="text-xs text-muted-foreground">Link after connection</span>;
  return <Button asChild variant={primary ? "default" : "ghost"} size="sm">
    <a href={url} target="_blank" rel="noreferrer" aria-label={label}>{primary ? "View on GitHub" : "GitHub"}<ArrowUpRight className="ml-1 size-3.5" /></a>
  </Button>;
}

function DetailSkeleton() {
  return <div className="space-y-2"><Skeleton className="h-5 w-56" /><Skeleton className="h-24 w-full" /></div>;
}

function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
    <span>{errorMessage(error)}</span><Button variant="outline" size="sm" onClick={retry}>Retry</Button>
  </div>;
}
