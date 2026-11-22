import { ExternalLink, FileDiff, GitBranch, GitCommitHorizontal, Loader2, RefreshCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GitTaskRef } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../../git-integration.format";
import { usePullRequestDetail } from "../../useGitIntegration";
import { PullRequestStateBadge, ReviewStateBadge } from "../SyncDataBadges";
import { TaskRefChips } from "../TaskRefChips";
import { ContributorAvatar } from "./ContributorAvatar";

const BODY_PREVIEW_LINES = 8;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2 border-t px-4 py-3.5 sm:px-5">
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
    {children}
  </section>;
}

function Description({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = body.split("\n").length > BODY_PREVIEW_LINES || body.length > 800;
  return <div className="space-y-1.5">
    {/* Plain text on purpose: GitHub markdown is not rendered, so nothing from the PR can run in the page. */}
    <p className={`whitespace-pre-line break-words text-xs leading-5 text-foreground/90 ${!expanded && long ? "line-clamp-8" : ""}`}>{body}</p>
    {long && <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setExpanded(value => !value)}>
      {expanded ? "Show less" : "Show more"}
    </Button>}
  </div>;
}

/**
 * WS-GH-01: a pull request with its linked tasks, reviews and description. Shown in
 * the right column of the Pull requests view (large screens) or in a sheet.
 */
export function PullRequestDetail({ projectId, number, repositoryId, onOpenTask, onClose }: {
  projectId: number;
  number: number;
  /** US-GI-05: the repository of the pull request (numbers repeat across repositories). */
  repositoryId?: number;
  onOpenTask: (ref: GitTaskRef) => void;
  onClose?: () => void;
}) {
  const query = usePullRequestDetail(projectId, number, repositoryId);

  if (query.isPending) {
    return <div role="status" aria-label={`Loading pull request #${number}`} className="space-y-3 p-4 sm:p-5">
      <Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-1/2" />
      <Skeleton className="mt-6 h-16 w-full" />
    </div>;
  }

  if (query.isError || !query.data) {
    const missing = gitIntegrationHttpStatus(query.error) === 404;
    return <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-muted-foreground">
      {missing ? `Pull request #${number} is not synchronized yet.` : "The pull request could not be loaded."}
      <div className="flex gap-2">
        {!missing && <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
        </Button>}
        {onClose && <Button variant="ghost" size="sm" onClick={onClose}><X />Close</Button>}
      </div>
    </div>;
  }

  const { pullRequest: pr, body, mergedByLogin, commitsCount, reviews } = query.data;
  // "No task ID" would repeat the sentence below, so only real Task IDs are shown as chips.
  const refs = (pr.taskRefs ?? []).filter(ref => ref.status !== "MISSING");
  const linked = refs.some(ref => ref.status === "LINKED");
  const verb = pr.state === "OPEN" ? "wants to merge" : pr.state === "MERGED" ? "merged" : "proposed";

  return <article aria-label={`Pull request #${pr.number}`} className="min-w-0">
    <header className="space-y-2 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <PullRequestStateBadge state={pr.state} draft={pr.draft} />
        <div className="flex shrink-0 items-center gap-1">
          {query.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" />}
          {pr.htmlUrl && <Button variant="outline" size="sm" className="h-7" asChild>
            <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open pull request #${pr.number} on GitHub (new tab)`}><ExternalLink />GitHub</a>
          </Button>}
        </div>
      </div>
      <h3 className="break-words text-base font-semibold leading-6"><span className="font-normal text-muted-foreground">#{pr.number}</span> {pr.title}</h3>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        <ContributorAvatar login={pr.authorLogin} />
        <span className="font-medium text-foreground">{pr.authorLogin ?? "Unknown author"}</span>
        {pr.headRef && pr.baseRef && <>
          <span>{verb}</span>
          <span className="inline-flex max-w-48 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]"><GitBranch className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{pr.headRef}</span></span>
          <span aria-hidden="true">→</span><span className="sr-only">into</span>
          <span className="inline-flex max-w-48 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]"><span className="truncate">{pr.baseRef}</span></span>
        </>}
      </p>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        {pr.additions != null && pr.deletions != null && <div className="flex items-center gap-1"><dt className="sr-only">Changes</dt>
          <dd><span className="font-medium text-emerald-700 dark:text-emerald-400">+{pr.additions}</span> <span className="font-medium text-red-700 dark:text-red-400">−{pr.deletions}</span></dd></div>}
        {pr.changedFiles != null && <div className="flex items-center gap-1"><FileDiff className="size-3" aria-hidden="true" /><dt className="sr-only">Files</dt><dd>{pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}</dd></div>}
        {commitsCount != null && <div className="flex items-center gap-1"><GitCommitHorizontal className="size-3" aria-hidden="true" /><dt className="sr-only">Commits</dt><dd>{commitsCount} {commitsCount === 1 ? "commit" : "commits"}</dd></div>}
        <div><dt className="inline">Opened </dt><dd className="inline"><time dateTime={pr.createdAt} title={formatDateTime(pr.createdAt)}>{formatRelative(pr.createdAt)}</time></dd></div>
        {pr.mergedAt && <div><dt className="inline">Merged{mergedByLogin ? ` by ${mergedByLogin}` : ""} </dt><dd className="inline"><time dateTime={pr.mergedAt} title={formatDateTime(pr.mergedAt)}>{formatRelative(pr.mergedAt)}</time></dd></div>}
        {!pr.mergedAt && pr.closedAt && <div><dt className="inline">Closed </dt><dd className="inline"><time dateTime={pr.closedAt} title={formatDateTime(pr.closedAt)}>{formatRelative(pr.closedAt)}</time></dd></div>}
      </dl>
    </header>

    <Section title="Linked tasks">
      {refs.length > 0 ? <TaskRefChips refs={refs} onOpen={onOpenTask} /> : null}
      {!linked && <p className="text-xs text-muted-foreground">
        No task linked. Mention a Task ID (for example <span className="font-mono">FA-12</span>) in the title or description, or link it from the task.
      </p>}
    </Section>

    <Section title={`Reviews${reviews.length > 0 ? ` · ${reviews.length}` : ""}`}>
      {reviews.length === 0 ? <p className="text-xs text-muted-foreground">{pr.state === "OPEN" && !pr.draft ? "Waiting for the first review." : "No reviews."}</p>
        : <ol aria-label={`Reviews of pull request #${pr.number}`} className="space-y-2.5">
          {reviews.map(review => <li key={review.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <ContributorAvatar login={review.reviewerLogin} />
              <span className="font-medium">{review.reviewerLogin ?? "Unknown reviewer"}</span>
              <ReviewStateBadge state={review.state} />
              {review.submittedAt && <time className="text-muted-foreground" dateTime={review.submittedAt} title={formatDateTime(review.submittedAt)}>
                {formatRelative(review.submittedAt)}
              </time>}
            </div>
            {review.body && <p className="ml-7 whitespace-pre-line break-words rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">{review.body}</p>}
          </li>)}
        </ol>}
    </Section>

    <Section title="Description">
      {body?.trim() ? <Description key={pr.number} body={body} /> : <p className="text-xs text-muted-foreground">No description.</p>}
    </Section>
  </article>;
}
