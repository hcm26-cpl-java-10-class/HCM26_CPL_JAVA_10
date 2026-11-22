import { AlertCircle, ArrowLeft, FolderGit2, LockKeyhole, PlugZap, RefreshCw, ShieldAlert, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { FaGithub } from "react-icons/fa6";
import { Link, useSearchParams } from "react-router-dom";
import { gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { GitInstallation, GitInstallationListResponse } from "@/types/features/git-integration";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { ConnectGitHubButton } from "./components/ConnectGitHubButton";
import { ConnectStepsInfo } from "./components/ConnectStepsInfo";
import { DisconnectGitHubAction } from "./components/DisconnectGitHubAction";
import { GitHubStatusBadge } from "./components/GitHubStatusBadge";
import { GitInstallationCard } from "./components/GitInstallationCard";
import { GitIntegrationHeader } from "./components/GitIntegrationHeader";
import { GitIntegrationStateCard } from "./components/GitIntegrationPageState";
import { RepositoryBrowserSheet } from "./components/RepositoryBrowserSheet";
import { WebhookDeliveryLog } from "./components/WebhookDeliveryLog";
import { clearPendingConnect, readPendingConnect } from "./git-integration.storage";
import { useGitInstallations, useRecheckInstallation } from "./useGitIntegration";

function Shell({ children }: { children: ReactNode }) {
  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background" pathName={{ "git-integration": "Git Integration" }}>
    {children}
  </MainLayout>;
}

function LoadingState() {
  return <div className="space-y-4" role="status" aria-label="Loading GitHub connections">
    <Skeleton className="h-28 w-full rounded-2xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
  </div>;
}

function ReadOnlyNote() {
  return <p className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
    <LockKeyhole className="size-3.5" aria-hidden="true" />Only people who manage Git Integration can connect GitHub.
  </p>;
}

/** Shown when the user came back from GitHub without finishing (no callback is sent then). */
function UnfinishedConnectBanner({ canManage, onDismiss }: { canManage: boolean; onDismiss: () => void }) {
  return <div role="status"
    className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">Connection not completed</p>
      <p className="text-xs text-amber-800/90 dark:text-amber-200/80">
        It looks like the GitHub installation was cancelled. No connection was created.
      </p>
    </div>
    {canManage && <ConnectGitHubButton label="Start again" variant="outline" size="sm" />}
    <Button variant="ghost" size="icon" className="size-7" aria-label="Dismiss" onClick={onDismiss}><X className="size-4" /></Button>
  </div>;
}

function Hero({ data }: { data: GitInstallationListResponse }) {
  const count = data.installations.length;
  if (count === 0) {
    return <Card className="overflow-hidden rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-slate-900 text-white ring-8 ring-slate-100 dark:bg-white dark:text-slate-900 dark:ring-slate-800">
          <FaGithub className="size-7" />
        </span>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-base font-semibold">No GitHub account connected yet</h2>
            <GitHubStatusBadge status="NOT_CONNECTED" />
          </div>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
            Install the authorized GitHub App on your GitHub account or organization so the platform can access your team's repositories — without your password.
          </p>
        </div>
        {data.canManage ? <ConnectGitHubButton className="min-w-44" /> : <ReadOnlyNote />}
      </CardContent>
    </Card>;
  }
  return <Card className="rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-card dark:to-background">
    <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <GitHubStatusBadge status={data.status} />
          <span className="text-xs text-muted-foreground">{count} {count === 1 ? "account" : "accounts"} connected</span>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {data.status === "SUSPENDED"
            ? "GitHub reports the installation as suspended. Ask the account owner to unsuspend it on GitHub, then reconnect."
            : data.status === "ERROR"
              ? "GitHub refused a connection below. Check it again; if it still fails, reconnect it."
              : "Install the app once per GitHub account or organization. Projects choose repositories from these connections."}
        </p>
      </div>
      {data.canManage ? <ConnectGitHubButton label="Connect another account" variant="outline" /> : <ReadOnlyNote />}
    </CardContent>
  </Card>;
}

/**
 * GI-01: GitHub App installations of the organization. Installing the app is
 * an organization-level setting done once per GitHub account/org; projects
 * pick repositories from these installations later (GI-02).
 */
export default function GitIntegrationIndexPage() {
  const { activeRole, effectivePermissions } = usePermissions();
  const homePath = getHomePathByRole(activeRole, effectivePermissions);
  const query = useGitInstallations();

  const [pending, setPending] = useState(() => readPendingConnect());
  const showUnfinished = useMemo(() => {
    if (!pending || !query.data) return false;
    // A connection saved after the attempt started means the flow did finish.
    return !query.data.installations.some(item => new Date(item.connectedAt).getTime() >= pending.startedAt - 1000);
  }, [pending, query.data]);

  function dismissPending() {
    clearPendingConnect();
    setPending(undefined);
  }

  // US-GI-03: the repository browser opens from ?repos=<installation id> so the panel can be linked and survives F5.
  const [params, setParams] = useSearchParams();
  const connected = useMemo(() => (query.data?.installations ?? []).filter(item => item.status === "CONNECTED"), [query.data]);
  const reposParam = Number(params.get("repos"));
  const browsingId = connected.some(item => item.id === reposParam) ? reposParam : undefined;

  function openRepositories(id: number) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set("repos", String(id)); return next; });
  }
  function closeRepositories() {
    setParams(previous => { const next = new URLSearchParams(previous); next.delete("repos"); return next; }, { replace: true });
  }

  const header = <GitIntegrationHeader eyebrow="Project Management · Integrations" title="Git Integration"
    description="GitHub accounts and organizations your team has authorized. No passwords or personal access tokens."
    actions={<Button variant="outline" size="sm" asChild><Link to={homePath}><ArrowLeft />Back to dashboard</Link></Button>} />;

  if (query.isError) {
    const forbidden = gitIntegrationHttpStatus(query.error) === 403;
    return <Shell>
      <div className="space-y-4">
        {header}
        <div className="flex justify-center py-8">
          {forbidden
            ? <GitIntegrationStateCard icon={ShieldAlert} title="403 · Permission denied"
              description="You don't have access to Git Integration. Ask your program manager to review your role." />
            : <GitIntegrationStateCard icon={AlertCircle} tone="error" title="GitHub connections could not be loaded"
              description="Please try again in a moment.">
              <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
                <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Try again
              </Button>
            </GitIntegrationStateCard>}
        </div>
      </div>
    </Shell>;
  }

  const data = query.data;
  return <Shell>
    <div className="mx-auto max-w-5xl space-y-4">
      {header}
      {!data ? <LoadingState /> : <>
        {showUnfinished && <UnfinishedConnectBanner canManage={data.canManage} onDismiss={dismissPending} />}

        <Hero data={data} />

        {data.installations.length > 0 && <section aria-labelledby="git-installations" className="space-y-2">
          <h2 id="git-installations" className="text-sm font-semibold">Connected accounts</h2>
          <div className="space-y-3">
            {data.installations.map(installation => <GitInstallationCard key={installation.id} installation={installation}
              actions={<InstallationActions installation={installation} canManage={data.canManage}
                onBrowse={() => openRepositories(installation.id)} />} />)}
          </div>
        </section>}

        {/* US-SY-04: how GitHub activity is being synchronized; managers can replay failed events. */}
        {data.canManage && data.installations.length > 0 && <WebhookDeliveryLog />}

        {data.canManage && (data.installations.length === 0
          ? <ConnectStepsInfo />
          : <details className="group rounded-xl border bg-card px-4 py-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground marker:hidden">
              <PlugZap className="size-3.5" aria-hidden="true" />How connecting works
            </summary>
            <ConnectStepsInfo className="mt-3" />
          </details>)}

        {browsingId !== undefined && <RepositoryBrowserSheet open onOpenChange={open => { if (!open) closeRepositories(); }}
          installations={connected} installationId={browsingId} onInstallationChange={openRepositories} />}
      </>}
    </div>
  </Shell>;
}

/**
 * Actions that make sense for each installation state: browsing for a working
 * connection; US-GI-02: "Check again" (asks GitHub) first for a broken one, then reconnecting.
 * US-GI-07: "Disconnect GitHub…" for a manager or the person who installed it (`canDisconnect`).
 */
function InstallationActions({ installation, canManage, onBrowse }: {
  installation: GitInstallation;
  canManage: boolean;
  onBrowse: () => void;
}) {
  const recheck = useRecheckInstallation();
  const disconnect = installation.canDisconnect && <DisconnectGitHubAction installation={installation} />;
  if (installation.status === "CONNECTED") {
    return <>
      <Button size="sm" onClick={onBrowse}><FolderGit2 />View repositories</Button>
      {disconnect}
    </>;
  }
  if (!canManage) return disconnect || null;
  return <>
    {installation.status !== "DISCONNECTED" && <Button size="sm" variant={installation.status === "ERROR" ? "default" : "outline"}
      disabled={recheck.isPending} onClick={() => recheck.mutate(installation.id)}>
      <RefreshCw className={recheck.isPending ? "animate-spin motion-reduce:animate-none" : undefined} />Check again
    </Button>}
    <ConnectGitHubButton label="Reconnect" variant="secondary" size="sm" />
    {disconnect}
  </>;
}
