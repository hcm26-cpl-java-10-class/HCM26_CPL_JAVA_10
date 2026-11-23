import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { workspaceGitApi, type GitCommitItem, type GitPullRequestItem } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

const PAGE_SIZE = 5;

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load Git activities.";
}

function PageControls({
  page,
  totalPages,
  disabled,
  label,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  label: string;
  onPageChange: (page: number) => void;
}) {
  if (totalPages < 2) return null;
  return <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
    <span>Page {page + 1} of {totalPages}</span>
    <div className="flex gap-1">
      <Button type="button" size="sm" variant="outline" aria-label={`Previous ${label} page`}
        disabled={page === 0 || disabled} onClick={() => onPageChange(Math.max(0, page - 1))}>Previous</Button>
      <Button type="button" size="sm" variant="outline" aria-label={`Next ${label} page`}
        disabled={page + 1 >= totalPages || disabled} onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}>Next</Button>
    </div>
  </div>;
}

function CommitRow({ commit }: { commit: GitCommitItem }) {
  return <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
    <div className="min-w-0 flex-1">
      <p className="line-clamp-2 break-words text-sm font-medium">{commit.message.split("\n")[0] || "(no message)"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{commit.authorName} · {formatDate(commit.committedAt)}</p>
    </div>
    {commit.htmlUrl
      ? <Button asChild type="button" size="sm" variant="ghost">
        <a href={commit.htmlUrl} target="_blank" rel="noreferrer" aria-label={`View commit ${commit.shortSha} on GitHub`}>
          GitHub <ArrowUpRight className="ml-1 size-3.5" />
        </a>
      </Button>
      : <span className="text-xs text-muted-foreground">Link after connection</span>}
  </li>;
}

function PullRequestRow({ pullRequest }: { pullRequest: GitPullRequestItem }) {
  return <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
    <div className="min-w-0 flex-1">
      <p className="line-clamp-2 break-words text-sm font-medium">{pullRequest.title}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{pullRequest.authorName}</span>
        <span>·</span>
        <time dateTime={pullRequest.createdAt}>{formatDate(pullRequest.createdAt)}</time>
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{pullRequest.state}</Badge>
      </p>
    </div>
    {pullRequest.htmlUrl
      ? <Button asChild type="button" size="sm" variant="ghost">
        <a href={pullRequest.htmlUrl} target="_blank" rel="noreferrer" aria-label={`View pull request ${pullRequest.number} on GitHub`}>
          GitHub <ArrowUpRight className="ml-1 size-3.5" />
        </a>
      </Button>
      : <span className="text-xs text-muted-foreground">Link after connection</span>}
  </li>;
}

export function BacklogItemGitActivities({
  workspaceId,
  taskId,
  enabled,
}: {
  workspaceId: number;
  taskId: number;
  enabled: boolean;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const location = useLocation();
  const canReadTasks = hasPermission("SPRINT_BACKLOG_READ");
  const [commitPage, setCommitPage] = useState(0);
  const [pullRequestPage, setPullRequestPage] = useState(0);
  const [pageTaskId, setPageTaskId] = useState(taskId);

  useEffect(() => {
    if (pageTaskId !== taskId) {
      setPageTaskId(taskId);
      setCommitPage(0);
      setPullRequestPage(0);
    }
  }, [pageTaskId, taskId]);

  const status = useQuery({
    queryKey: ["git-activity", "status", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.activityStatus(workspaceId, signal),
    enabled: enabled && canReadTasks,
    retry: false,
  });
  const commits = useQuery({
    queryKey: ["git-activity", "task-detail", "commits", workspaceId, user.email, activeRole, taskId, commitPage],
    queryFn: ({ signal }) => workspaceGitApi.commits(workspaceId,
      { taskId, page: commitPage, size: PAGE_SIZE, sort: "newest" }, signal),
    enabled: enabled && canReadTasks,
    retry: false,
  });
  const pullRequests = useQuery({
    queryKey: ["git-activity", "task-detail", "pull-requests", workspaceId, user.email, activeRole, taskId, pullRequestPage],
    queryFn: ({ signal }) => workspaceGitApi.pullRequests(workspaceId,
      { taskId, page: pullRequestPage, size: PAGE_SIZE, sort: "newest" }, signal),
    enabled: enabled && canReadTasks,
    retry: false,
  });

  const commitRows = commits.data?.content ?? [];
  const pullRequestRows = pullRequests.data?.content ?? [];
  const noActivity = !commits.isPending && !pullRequests.isPending
    && !commits.isError && !pullRequests.isError
    && commits.data?.totalElements === 0 && pullRequests.data?.totalElements === 0;

  if (!canReadTasks) return null;

  return <section aria-label="Git Activities" className="rounded-lg border bg-card">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="size-4 text-muted-foreground" />Git Activities</h3>
      <div className="flex items-center gap-2">
        {status.data?.mockData && <Badge variant="secondary">Mock fixture</Badge>}
        <Button asChild type="button" size="sm" variant="outline">
          <Link to={`/management/workspaces/${workspaceId}/tasks/${taskId}/git-activities`}
            state={{ returnTo: location.pathname + location.search }}>View all</Link>
        </Button>
      </div>
    </header>
    <div className="space-y-4 p-4">
      {noActivity ? <p className="rounded-md border border-dashed px-3 py-5 text-center text-sm text-muted-foreground">
        No Git activities are linked to this task yet.
      </p> : <>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commits</h4>
            {commits.data && <span className="text-xs text-muted-foreground">{commits.data.totalElements}</span>}
          </div>
          {commits.isPending ? <p className="text-sm text-muted-foreground">Loading commits…</p>
            : commits.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{errorMessage(commits.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void commits.refetch()}>Retry</Button>
            </div>
            : commitRows.length ? <ul className="space-y-2">{commitRows.map(commit => <CommitRow key={commit.id} commit={commit} />)}</ul>
              : <p className="text-sm text-muted-foreground">No commits linked to this task.</p>}
          {commits.data && <PageControls page={commitPage} totalPages={commits.data.totalPages}
            disabled={commits.isFetching} label="commit" onPageChange={setCommitPage} />}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pull Requests</h4>
            {pullRequests.data && <span className="text-xs text-muted-foreground">{pullRequests.data.totalElements}</span>}
          </div>
          {pullRequests.isPending ? <p className="text-sm text-muted-foreground">Loading Pull Requests…</p>
            : pullRequests.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{errorMessage(pullRequests.error)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void pullRequests.refetch()}>Retry</Button>
            </div>
            : pullRequestRows.length ? <ul className="space-y-2">{pullRequestRows.map(pullRequest => <PullRequestRow key={pullRequest.id} pullRequest={pullRequest} />)}</ul>
              : <p className="text-sm text-muted-foreground">No Pull Requests linked to this task.</p>}
          {pullRequests.data && <PageControls page={pullRequestPage} totalPages={pullRequests.data.totalPages}
            disabled={pullRequests.isFetching} label="Pull Request" onPageChange={setPullRequestPage} />}
        </div>
      </>}
    </div>
  </section>;
}
