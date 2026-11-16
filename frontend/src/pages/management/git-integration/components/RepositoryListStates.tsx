import { CloudOff, ExternalLink, FolderGit2, PauseCircle, RefreshCw, SearchX, Timer, Unplug } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function StateBlock({ icon: Icon, tone, title, children, actions }: {
  icon: typeof FolderGit2;
  tone: "info" | "error" | "warning" | "neutral";
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const tile = {
    info: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    error: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300",
    warning: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  }[tone];
  return <div role={tone === "error" || tone === "warning" ? "alert" : "status"}
    className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <span className={cn("flex size-12 items-center justify-center rounded-full", tile)}>
      <Icon className="size-6" aria-hidden="true" />
    </span>
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mx-auto max-w-sm text-xs leading-5 text-muted-foreground">{children}</div>
    </div>
    {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
  </div>;
}

export function RepositoryListSkeleton() {
  return <ul role="status" aria-label="Loading repositories" className="divide-y">
    {Array.from({ length: 6 }, (_, index) => <li key={index} className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="size-8 rounded-lg" />
      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
    </li>)}
  </ul>;
}

/** AC02: the app has not been granted any repository. */
export function NoRepositoriesState({ manageUrl, onRefresh, refreshing }: { manageUrl: string; onRefresh: () => void; refreshing: boolean }) {
  return <StateBlock icon={FolderGit2} tone="info" title="No repositories available"
    actions={<>
      <Button size="sm" asChild><a href={manageUrl} target="_blank" rel="noreferrer">Grant access on GitHub<ExternalLink /></a></Button>
      <Button size="sm" variant="outline" disabled={refreshing} onClick={onRefresh}>
        <RefreshCw className={refreshing ? "animate-spin" : undefined} />Refresh
      </Button>
    </>}>
    The GitHub App hasn't been granted access to any repository yet. Choose repositories in the installation settings on
    GitHub, then refresh this list.
  </StateBlock>;
}

/** AC03: the search matched nothing (different from AC02: no access hint). */
export function NoMatchState({ query, onClear }: { query: string; onClear: () => void }) {
  return <StateBlock icon={SearchX} tone="neutral" title={`No repositories match “${query}”`}
    actions={<Button size="sm" variant="outline" onClick={onClear}>Clear search</Button>}>
    Try another name or owner.
  </StateBlock>;
}

/** AC04: GitHub could not be reached — never show stale data instead. */
export function GitHubErrorState({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return <StateBlock icon={CloudOff} tone="error" title="Couldn't reach GitHub"
    actions={<Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
      <RefreshCw className={retrying ? "animate-spin" : undefined} />Try again
    </Button>}>
    The repository list could not be loaded from GitHub, so nothing is shown until it can be verified.
  </StateBlock>;
}

export function RateLimitState({ retryAfterSeconds, onRetry }: { retryAfterSeconds: number; onRetry: () => void }) {
  const [left, setLeft] = useState(retryAfterSeconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  return <StateBlock icon={Timer} tone="warning" title="GitHub rate limit reached"
    actions={<Button size="sm" variant="outline" disabled={left > 0} onClick={onRetry}>
      {left > 0 ? `Try again in ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s` : "Try again"}
    </Button>}>
    GitHub is limiting requests for this connection. The list will be available again shortly.
  </StateBlock>;
}

export function InstallationNotActiveState({ status, manageUrl }: { status?: string; manageUrl: string }) {
  const suspended = status === "SUSPENDED";
  return <StateBlock icon={suspended ? PauseCircle : Unplug} tone="warning"
    title={suspended ? "This GitHub connection is suspended" : "This GitHub connection was removed"}
    actions={<Button size="sm" variant="outline" asChild><a href={manageUrl} target="_blank" rel="noreferrer">Open on GitHub<ExternalLink /></a></Button>}>
    {suspended
      ? "The account owner suspended the GitHub App. Ask them to unsuspend it on GitHub, then try again."
      : "The GitHub App was uninstalled from this account. Connect it again from Git Integration to browse repositories."}
  </StateBlock>;
}
