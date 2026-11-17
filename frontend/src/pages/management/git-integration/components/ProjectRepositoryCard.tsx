import { AlertCircle, CornerLeftUp, ExternalLink, FolderGit2, GitBranch, Link2, Loader2, RefreshCw, TriangleAlert, Unplug } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GitRepositoryItem, LinkedRepository, ProjectRepositoryView } from "@/types/features/git-integration";
import { formatDateTime, installationManageUrl } from "../git-integration.format";
import { syncErrorMessage } from "../git-integration.messages";
import { useGitInstallations, useLinkRepository, useProjectRepository, useRetrySync } from "../useGitIntegration";
import { GitHubTile } from "./GitIntegrationHeader";
import { LinkRepositoryDialog } from "./LinkRepositoryDialog";
import { RepositoryActivitySummary } from "./RepositoryActivitySummary";
import { RepositoryBrowserSheet } from "./RepositoryBrowserSheet";
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

function RepositoryLine({ repository }: { repository: LinkedRepository }) {
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
  </div>;
}

/**
 * US-GI-04: the GitHub repository of a project. A master project links one
 * repository (picked from the GitHub App's repositories); its modules show the
 * master's repository read-only.
 */
export function ProjectRepositoryCard({ projectId }: { projectId: number }) {
  const query = useProjectRepository(projectId);
  const view = query.data;
  const installationsQuery = useGitInstallations({ enabled: !!view?.canLink });
  const connected = (installationsQuery.data?.installations ?? []).filter(item => item.status === "CONNECTED");
  const link = useLinkRepository(projectId);
  const retry = useRetrySync(projectId);

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
  const sync = view.latestSync;
  const modules = view.masterProject.moduleCount;

  const linkButton = (label: string) => installationsQuery.isPending
    ? <Button size="sm" disabled><Loader2 className="animate-spin" />{label}</Button>
    : connected.length === 0
      ? <Button size="sm" variant="outline" asChild><Link to="/git-integration"><Unplug />Connect GitHub first</Link></Button>
      : <Button size="sm" onClick={() => setBrowsing(true)}><Link2 />{label}</Button>;

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
              : "Ask a person who manages Git Integration to link the project's repository."}
          </p>
          {view.canLink && !installationsQuery.isPending && connected.length === 0 && <p className="text-[11px] text-muted-foreground">
            Install the GitHub App on your GitHub account or organization first.
          </p>}
        </div>
      </div>
      {view.canLink && linkButton("Link GitHub repository")}
    </div>;
  } else {
    body = <div className="space-y-3">
      <RepositoryLine repository={repository} />
      {!active && <div role="alert" className="flex flex-wrap items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">Repository is no longer accessible</p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
            {syncErrorMessage(sync?.errorCode)} {view.canLink ? "Link another repository, or grant access again on GitHub and link it again." : ""}
          </p>
        </div>
        {view.canLink && linkButton("Link another repository")}
      </div>}
      {active && sync?.status === "FAILED" && <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs">{syncErrorMessage(sync.errorCode)}</p>
        {view.canSync && <Button size="sm" variant="outline" className="h-8" disabled={retry.isPending} onClick={() => retry.mutate()}>
          <RefreshCw className={retry.isPending ? "animate-spin" : undefined} />Retry sync
        </Button>}
      </div>}
      {/* US-SY-04: data synchronized from webhooks (also shown, read-only, while the repository is unavailable). */}
      <RepositoryActivitySummary projectId={view.project.id} repositoryName={repository.fullName} />
      {active && !view.inherited && modules > 0 && <p className="text-[11px] text-muted-foreground">
        Shared with {modules} {modules === 1 ? "module" : "modules"} of this project.
      </p>}
    </div>;
  }

  return <section aria-label="GitHub repository" className="min-w-0">
    <Header>
      {active && <SyncStatusPill job={sync} lastSyncedAt={repository.lastSyncedAt} />}
      {repository && !active && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <TriangleAlert className="size-3.5" aria-hidden="true" />Unavailable
      </span>}
    </Header>
    <div className="space-y-3 p-4 sm:p-5">
      {view.inherited && <SharedFromMaster view={view} />}
      {body}
    </div>

    {browsing && view.canLink && installationId !== undefined && <RepositoryBrowserSheet open onOpenChange={open => { if (!open) setBrowsing(false); }}
      installations={connected} installationId={installationId} onInstallationChange={setChosenInstallationId}
      projectId={view.masterProject.id} onSelect={choose} selectLabel="Select" />}
    <LinkRepositoryDialog repository={selected} masterName={view.masterProject.name} moduleCount={modules}
      pending={link.isPending} error={link.error} manageUrl={manageUrl}
      onConfirm={confirmLink} onClose={() => { setSelected(null); link.reset(); }} />
  </section>;
}
