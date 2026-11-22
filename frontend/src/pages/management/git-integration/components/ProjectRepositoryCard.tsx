import { AlertCircle, CornerLeftUp, ExternalLink, FolderGit2, GitBranch, Link2, Loader2, RefreshCw, TriangleAlert, Unplug } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GitRepositoryItem, LinkedRepository, ProjectRepositoryView } from "@/types/features/git-integration";
import type { GitHubTabTarget } from "../github-tab.params";
import { connectionBroken, formatDateTime, installationManageUrl } from "../git-integration.format";
import { syncErrorMessage } from "../git-integration.messages";
import {
  syncInProgress, useGitHubConnection, useGitInstallations, useLinkRepository, useProjectRepository, useRetrySync, useUnlinkRepository,
} from "../useGitIntegration";
import { GitHubConnectionBanner, GitHubConnectionChip } from "./GitHubConnectionStatus";
import { GitHubTile } from "./GitIntegrationHeader";
import { LinkRepositoryDialog } from "./LinkRepositoryDialog";
import { RepositoryActivitySummary } from "./RepositoryActivitySummary";
import { RepositoryBrowserSheet } from "./RepositoryBrowserSheet";
import {
  PreviousRepositories, RepositoryManageMenu, RepositoryStatusAlert, RepositoryStatusBadge, UnlinkRepositoryDialog,
} from "./RepositoryManagement";
import { RepositoryVisibilityBadge, RepositoryVisibilityIcon } from "./RepositoryVisibilityBadge";
import { SyncStatusPill } from "./SyncStatusPill";

function Header({ children }: { children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/40 px-4 py-3.5 dark:bg-muted/20 sm:px-5">
    <div className="flex min-w-0 items-center gap-2.5">
      <GitHubTile size="sm" />
      <div className="space-y-1">
        <h3 className="text-sm font-semibold leading-5">GitHub repository</h3>
        <p className="text-[11px] leading-4 text-muted-foreground">Source of the project's development activity</p>
      </div>
    </div>
    {children}
  </div>;
}

function SharedFromMaster({ view }: { view: ProjectRepositoryView }) {
  return <p className="flex items-start gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
    <CornerLeftUp className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
    <span>Shared from master project <span className="font-medium text-foreground">{view.masterProject.code} · {view.masterProject.name}</span></span>
  </p>;
}

function RepositoryLine({ repository, menu }: { repository: LinkedRepository; menu?: ReactNode }) {
  return <div className="flex items-start gap-3">
    <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <RepositoryVisibilityIcon visibility={repository.visibility} className="size-4" />
    </span>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="min-w-0 break-words text-sm">
          <span className="text-muted-foreground">{repository.owner}/</span><span className="font-medium">{repository.name}</span>
        </p>
        <RepositoryVisibilityBadge visibility={repository.visibility} />
        {repository.defaultBranch && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          <GitBranch className="size-3" aria-hidden="true" />{repository.defaultBranch}
        </span>}
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        {repository.installation && <>via {repository.installation.accountLogin} ({repository.installation.accountType === "Organization" ? "Organization" : "Personal account"}) · </>}
        Linked{repository.linkedBy?.name ? ` by ${repository.linkedBy.name}` : ""} · {formatDateTime(repository.linkedAt)}
      </p>
    </div>
    <Button variant="outline" size="sm" className="h-8 shrink-0" asChild>
      <a href={repository.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${repository.fullName} on GitHub (new tab)`}>
        <ExternalLink />Open
      </a>
    </Button>
    {menu}
  </div>;
}

/**
 * US-GI-04: the GitHub repository of a project. A master project links one
 * repository (picked from the GitHub App's repositories); its modules show the
 * master's repository read-only.
 * US-GI-05: the PM of the master (or a Git Integration manager) unlinks it from the "⋯" menu; a
 * repository GitHub disconnected or that failed shows why, with "Check again / Sync again" and
 * "Unlink"; repositories unlinked before are listed, their data still counting in the analytics.
 * WS-GH-01: on Overview the activity summary opens the GitHub tab (`onOpenActivity`);
 * the GitHub tab itself shows it as a one-line strip (`variant="strip"`, `showActivity={false}`).
 */
export function ProjectRepositoryCard({ projectId, onOpenActivity, showActivity = true, variant = "card", extra }: {
  projectId: number;
  /** US-GI-06: shown in the strip next to the sync state (the viewer's GitHub account). */
  extra?: ReactNode;
  onOpenActivity?: (target: GitHubTabTarget) => void;
  showActivity?: boolean;
  /** "strip": one line (linked repository only; loading, errors and linking keep the card). */
  variant?: "card" | "strip";
}) {
  const query = useProjectRepository(projectId);
  const view = query.data;
  const installationsQuery = useGitInstallations({ enabled: !!view?.canLink });
  const connected = (installationsQuery.data?.installations ?? []).filter(item => item.status === "CONNECTED");
  const link = useLinkRepository(projectId);
  const retry = useRetrySync(projectId);
  const unlink = useUnlinkRepository(projectId);
  const [unlinking, setUnlinking] = useState(false);
  // US-GI-02: the connection the repository is read through (account, status, PM's actions).
  const connection = useGitHubConnection(projectId, !!view?.repository).data;
  const broken = connectionBroken(connection);

  const [browsing, setBrowsing] = useState(false);
  const [chosenInstallationId, setChosenInstallationId] = useState<number>();
  const [selected, setSelected] = useState<GitRepositoryItem | null>(null);
  const installationId = connected.some(item => item.id === chosenInstallationId) ? chosenInstallationId : connected[0]?.id;
  const installation = connected.find(item => item.id === installationId);
  const manageUrl = installation ? installationManageUrl(installation) : "https://github.com/settings/installations";

  function choose(repository: GitRepositoryItem) {
    link.reset();
    setSelected(repository);
  }

  function confirmLink() {
    if (!selected || installationId === undefined) return;
    link.mutate({ installationId, externalId: selected.externalId }, {
      onSuccess: () => {
        setSelected(null);
        setBrowsing(false);
        toast.success("Repository linked", { description: "The initial synchronization has started." });
      },
    });
  }

  if (query.isPending) {
    return <section aria-label="GitHub repository" className="min-w-0"><Header />
      <div role="status" aria-label="Loading repository" className="flex items-start gap-3 p-4 sm:p-5">
        <Skeleton className="size-8 rounded-lg" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div>
      </div>
    </section>;
  }

  if (query.isError) {
    const status = gitIntegrationHttpStatus(query.error);
    return <section aria-label="GitHub repository" className="min-w-0"><Header />
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm sm:p-5">
        <p className="text-muted-foreground">
          {status === 403 ? "You don't have access to this project's repository."
            : status === 404 ? "This project is not available."
            : "The repository could not be loaded."}
        </p>
        {status !== 403 && status !== 404 && <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
        </Button>}
      </div>
    </section>;
  }

  if (!view) return null;
  const repository = view.repository;
  const active = repository?.status === "ACTIVE";
  const previous = view.previousRepositories ?? [];

  function confirmUnlink() {
    if (!repository) return;
    unlink.mutate(repository.id, { onSettled: () => setUnlinking(false) });
  }
  const sync = view.latestSync;
  const modules = view.masterProject.moduleCount;
  const syncing = syncInProgress(view);
  const stopped = active && (sync?.status === "FAILED" || sync?.status === "PARTIAL");
  const imported = sync?.progress?.inserted ?? 0;
  const importedPulls = sync?.progress?.pullRequests?.inserted ?? 0;
  const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

  // US-SY-01: one click, at any time; disabled while a sync is waiting or running.
  const syncNowButton = active && view.canSync && <Button variant="outline" size="sm" className="h-8 shrink-0"
    disabled={syncing || retry.isPending} onClick={() => retry.mutate()}
    title={syncing ? "A synchronization is in progress" : "Import new commits from GitHub now"}>
    <RefreshCw className={syncing || retry.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />Sync now
  </Button>;

  const linkButton = (label: string) => installationsQuery.isPending
    ? <Button size="sm" disabled><Loader2 className="animate-spin" />{label}</Button>
    : connected.length === 0
      ? <Button size="sm" variant="outline" asChild><Link to="/git-integration"><Unplug />Connect GitHub first</Link></Button>
      : <Button size="sm" onClick={() => setBrowsing(true)}><Link2 />{label}</Button>;

  // Shown under the repository in both layouts (card on Overview, strip in the GitHub tab).
  const alerts = repository ? <>
      {broken && connection && <GitHubConnectionBanner projectId={projectId} connection={connection} />}
      {/* US-GI-05 AC04: DISCONNECTED / ERROR (the connection banner above covers a broken installation). */}
      {!active && !broken && <RepositoryStatusAlert view={view} manageUrl={connection?.account?.manageUrl}
        syncing={retry.isPending} onResync={() => retry.mutate()} onUnlink={() => setUnlinking(true)} />}
      {stopped && sync && !broken && <div role="alert" className={sync.status === "PARTIAL"
        ? "flex flex-wrap items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
        : "flex flex-wrap items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"}>
        {sync.status === "PARTIAL" ? <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="size-4 shrink-0" aria-hidden="true" />}
        <p className="min-w-0 flex-1 text-xs">
          {sync.status === "PARTIAL" && <span className="font-medium">
            Imported {plural(imported, "commit")}{importedPulls > 0 && ` and ${plural(importedPulls, "pull request")}`}, then it stopped.{" "}
          </span>}
          {syncErrorMessage(sync.errorCode)}
          {sync.resumable && view.canSync && " Resuming continues where it stopped."}
        </p>
        {view.canSync && <Button size="sm" variant="outline" className="h-8" disabled={retry.isPending} onClick={() => retry.mutate()}>
          <RefreshCw className={retry.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />{sync.resumable ? "Resume sync" : "Retry sync"}
        </Button>}
      </div>}
  </> : null;

  let body: ReactNode;
  if (!repository) {
    body = <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
          <FolderGit2 className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{view.inherited ? "The master project hasn't linked a repository yet" : "No repository linked"}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            {view.inherited ? "Modules use the master project's repository. It appears here once the master project links one."
              : view.canLink ? `Link the team's GitHub repository so the system can collect commits and pull requests.${modules > 0 ? ` All ${modules} ${modules === 1 ? "module" : "modules"} will share it.` : ""}`
              : ["COMPLETED", "CANCELLED"].includes(view.masterProject.status) ? "This project has ended, so a repository can no longer be linked."
              : "Ask the project manager to link the project's repository."}
          </p>
          {view.canLink && !installationsQuery.isPending && connected.length === 0 && <p className="text-[11px] text-muted-foreground">
            Install the GitHub App on your GitHub account or organization first.
          </p>}
        </div>
      </div>
      {view.canLink && linkButton("Link GitHub repository")}
      <PreviousRepositories repositories={previous} className="basis-full" />
    </div>;
  } else {
    body = <div className="space-y-3">
      <RepositoryLine repository={repository} menu={<RepositoryManageMenu view={view} onUnlink={() => setUnlinking(true)} />} />
      {alerts}
      {/* US-SY-04: data synchronized from webhooks (also shown, read-only, while the repository is unavailable). */}
      {showActivity && <RepositoryActivitySummary projectId={view.project.id} repositoryName={repository.fullName} onOpen={onOpenActivity} />}
      {active && !view.inherited && modules > 0 && <p className="text-[11px] text-muted-foreground">
        Shared with {modules} {modules === 1 ? "module" : "modules"} of this project.
      </p>}
      <PreviousRepositories repositories={previous} />
    </div>;
  }

  const dialogs = <>
    {browsing && view.canLink && installationId !== undefined && <RepositoryBrowserSheet open onOpenChange={open => { if (!open) setBrowsing(false); }}
      installations={connected} installationId={installationId} onInstallationChange={setChosenInstallationId}
      projectId={view.masterProject.id} onSelect={choose} selectLabel="Select" />}
    <LinkRepositoryDialog repository={selected} masterName={view.masterProject.name} moduleCount={modules}
      pending={link.isPending} error={link.error} manageUrl={manageUrl}
      onConfirm={confirmLink} onClose={() => { setSelected(null); link.reset(); }} />
    {view.canUnlink && <UnlinkRepositoryDialog view={view} open={unlinking} pending={unlink.isPending}
      onConfirm={confirmUnlink} onCancel={() => setUnlinking(false)} />}
  </>;

  // WS-GH-02: one line in the GitHub tab, where the repository is context rather than content.
  if (variant === "strip" && repository) {
    const hasAlert = !active || stopped || broken;
    return <section aria-label="GitHub repository" className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5">
        <GitHubTile size="sm" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm">
            <span className="text-muted-foreground">{repository.owner}/</span><span className="font-semibold">{repository.name}</span>
          </p>
          <RepositoryVisibilityBadge visibility={repository.visibility} />
          {repository.defaultBranch && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            <GitBranch className="size-3" aria-hidden="true" />{repository.defaultBranch}
          </span>}
          {view.inherited && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title={`Shared from master project ${view.masterProject.code} · ${view.masterProject.name}`}>
            <CornerLeftUp className="size-3" aria-hidden="true" />Shared from {view.masterProject.code}
          </span>}
        </div>
        {connection && <GitHubConnectionChip projectId={projectId} connection={connection} />}
        {extra}
        {active ? <SyncStatusPill job={sync} lastSyncedAt={repository.lastSyncedAt} />
          : <RepositoryStatusBadge status={repository.status} />}
        {!stopped && !broken && syncNowButton}
        <Button variant="outline" size="sm" className="h-8 shrink-0" asChild>
          <a href={repository.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${repository.fullName} on GitHub (new tab)`}>
            <ExternalLink />Open
          </a>
        </Button>
        <RepositoryManageMenu view={view} onUnlink={() => setUnlinking(true)} />
      </div>
      {hasAlert && <div className="space-y-2 px-4 pb-3 sm:px-5">{alerts}</div>}
      {previous.length > 0 && <div className="px-4 pb-3 sm:px-5"><PreviousRepositories repositories={previous} /></div>}
      {dialogs}
    </section>;
  }

  return <section aria-label="GitHub repository" className="min-w-0">
    <Header>
      {connection && <GitHubConnectionChip projectId={projectId} connection={connection} />}
      {active && <SyncStatusPill job={sync} lastSyncedAt={repository.lastSyncedAt} />}
      {!stopped && !broken && syncNowButton}
      {repository && !active && <RepositoryStatusBadge status={repository.status} />}
    </Header>
    <div className="space-y-3 p-4 sm:p-5">
      {view.inherited && <SharedFromMaster view={view} />}
      {body}
    </div>

    {dialogs}
  </section>;
}
