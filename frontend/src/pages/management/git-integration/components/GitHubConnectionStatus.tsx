import { AlertCircle, Building2, ExternalLink, MoreHorizontal, PauseCircle, RefreshCw, Unplug, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GitHubConnectionView } from "@/types/features/git-integration";
import { connectionBroken, formatDateTime, formatRelative } from "../git-integration.format";
import { useRecheckConnection } from "../useGitIntegration";
import { ConnectGitHubButton } from "./ConnectGitHubButton";

const REASONS: Record<string, string> = {
  SUSPENDED_ON_GITHUB: "The account owner suspended the GitHub App.",
  UNINSTALLED: "The GitHub App was removed from the account.",
  TOKEN_REJECTED: "GitHub refused the App's access token.",
  INSTALLATION_NOT_FOUND: "GitHub could not find the App installation.",
};

/** One meaning per colour: amber = suspended, red = error, slate = removed. Text and icon always carry it. */
const TONES = {
  SUSPENDED: { box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100", icon: PauseCircle },
  ERROR: { box: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100", icon: AlertCircle },
  DISCONNECTED: { box: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100", icon: Unplug },
} as const;

/**
 * US-GI-02 AC01: which account the project reads GitHub through, with the PM's actions in a menu.
 * Removing the GitHub App is not offered here: it affects every project of the account, so it is on
 * the Git Integration page. To stop using a repository, the PM unlinks it (GI-05).
 */
export function GitHubConnectionChip({ projectId, connection }: { projectId: number; connection: GitHubConnectionView }) {
  const recheck = useRecheckConnection(projectId);
  const account = connection.account;
  if (!account || connection.status !== "CONNECTED") return null;
  const AccountIcon = account.type === "Organization" ? Building2 : User;
  const verified = connection.lastVerifiedAt ? `verified ${formatRelative(connection.lastVerifiedAt)}` : undefined;
  const manage = connection.actions.canRecheck;

  return <span className="inline-flex min-w-0 items-center gap-0.5">
    <span title={`GitHub App connected to ${account.login}${verified ? ` · ${verified}` : ""}`}
      className="inline-flex min-w-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
      <AccountIcon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">via {account.login}</span>
    </span>
    {manage && <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="GitHub connection actions"><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {connection.actions.canRecheck && <DropdownMenuItem disabled={recheck.isPending} onSelect={() => recheck.mutate()}>
          <RefreshCw className={cn(recheck.isPending && "animate-spin motion-reduce:animate-none")} />Check connection again
        </DropdownMenuItem>}
        <DropdownMenuItem asChild>
          <a href={account.manageUrl} target="_blank" rel="noreferrer"><ExternalLink />Manage on GitHub</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>}
  </span>;
}

/** US-GI-02 AC03/AC04: the connection broke; one primary action per state. Non-PMs see the same words without buttons. */
export function GitHubConnectionBanner({ projectId, connection }: { projectId: number; connection: GitHubConnectionView }) {
  const recheck = useRecheckConnection(projectId);
  if (!connectionBroken(connection)) return null;
  const status = connection.status as keyof typeof TONES;
  const tone = TONES[status] ?? TONES.ERROR;
  const Icon = tone.icon;
  const login = connection.account?.login ?? "the GitHub account";
  const since = connection.since ? <span title={formatDateTime(connection.since)}> (since {formatRelative(connection.since)})</span> : null;
  const { canRecheck, canReconnect, canConnect } = connection.actions;

  const title = status === "SUSPENDED" ? <>The GitHub App is suspended on <b>{login}</b>{since}</>
    : status === "DISCONNECTED" ? <>The GitHub App was removed from <b>{login}</b>{since}</>
      : <>GitHub refused the connection to <b>{login}</b>{since}</>;
  const detail = status === "DISCONNECTED"
    ? "Synchronized data is kept. Reconnect GitHub to synchronize again."
    : "Commits and pull requests are not synchronized until the connection works again.";

  const checkAgain = canRecheck && <Button size="sm" variant={status === "ERROR" ? "default" : "outline"} className="h-8"
    disabled={recheck.isPending} onClick={() => recheck.mutate()}>
    <RefreshCw className={cn(recheck.isPending && "animate-spin motion-reduce:animate-none")} />Check again
  </Button>;

  let primary = null;
  if (canReconnect && status === "SUSPENDED" && connection.account) {
    primary = <Button size="sm" className="h-8" asChild>
      <a href={connection.account.manageUrl} target="_blank" rel="noreferrer"><ExternalLink />Reconnect on GitHub</a>
    </Button>;
  } else if (canReconnect && canConnect && status !== "SUSPENDED") {
    primary = <ConnectGitHubButton label="Reconnect" size="sm" variant={status === "ERROR" ? "outline" : "default"} />;
  }

  return <div role="alert" className={cn("flex flex-wrap items-start gap-2.5 rounded-lg border px-3 py-2.5", tone.box)}>
    <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs opacity-90">
        {REASONS[connection.reason ?? ""] ? `${REASONS[connection.reason ?? ""]} ` : ""}{detail}
        {!canRecheck && " Ask your project manager to reconnect GitHub."}
      </p>
    </div>
    {(primary || checkAgain) && <div className="flex flex-wrap items-center gap-1.5">{status === "ERROR" ? <>{checkAgain}{primary}</> : <>{primary}{checkAgain}</>}</div>}
  </div>;
}
