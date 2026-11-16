import { Building2, ExternalLink, FolderGit2, User } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GitInstallation } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../git-integration.format";
import { GitHubStatusBadge } from "./GitHubStatusBadge";
import { STATUS_STYLES } from "./git-integration.styles";

/** GitHub settings page where the owner manages (or uninstalls) this installation. */
function manageUrl(connection: GitInstallation) {
  return connection.accountType === "Organization"
    ? `https://github.com/organizations/${encodeURIComponent(connection.accountLogin)}/settings/installations/${connection.installationId}`
    : `https://github.com/settings/installations/${connection.installationId}`;
}

function repositoryLabel(selection?: string | null) {
  if (selection === "all") return "All repositories";
  if (selection === "selected") return "Selected repositories";
  return "Repository access not reported";
}

export function GitInstallationCard({ installation: connection, actions }: {
  installation: GitInstallation;
  /** Extra controls (e.g. Reconnect) shown only to users who can manage. */
  actions?: ReactNode;
}) {
  const isOrg = connection.accountType === "Organization";
  const AccountIcon = isOrg ? Building2 : User;
  const initial = connection.accountLogin.slice(0, 1).toUpperCase();
  const style = STATUS_STYLES[connection.status] ?? STATUS_STYLES.NOT_CONNECTED;

  return <article className={cn(
    "rounded-xl border border-l-[3px] bg-card p-4 shadow-xs transition-shadow hover:shadow-md", style.accent)}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {initial}
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-all text-sm font-semibold">{connection.accountLogin}</p>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <AccountIcon className="size-3" aria-hidden="true" />{isOrg ? "Organization" : "Personal account"}
            </span>
            <GitHubStatusBadge status={connection.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FolderGit2 className="size-3.5" aria-hidden="true" />{repositoryLabel(connection.repositorySelection)}
            </span>
            {connection.githubUserLogin && <span>Authorized by <span className="font-medium text-foreground">@{connection.githubUserLogin}</span></span>}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {connection.connectedByName ? <>Connected by {connection.connectedByName} · </> : null}
            <time dateTime={connection.connectedAt} title={formatDateTime(connection.connectedAt)}>
              {formatRelative(connection.connectedAt)}
            </time>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={manageUrl(connection)} target="_blank" rel="noreferrer">
            Manage on GitHub<ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
        {actions}
      </div>
    </div>
  </article>;
}
