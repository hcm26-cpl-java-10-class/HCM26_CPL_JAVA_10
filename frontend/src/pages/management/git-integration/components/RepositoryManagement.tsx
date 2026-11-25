import { AlertCircle, ExternalLink, History, MoreHorizontal, RefreshCw, TriangleAlert, Unlink, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { GitRepositoryConnectionStatus, GitRepositoryLabel, PreviousRepository, ProjectRepositoryView } from "@/types/features/git-integration";
import { formatDateTime, formatRelative } from "../git-integration.format";
import { repositoryReasonMessage } from "../git-integration.messages";

/** US-GI-05: colors of the four connection statuses (ACTIVE is usually shown by the sync pill instead). */
const STATUS_TONES: Record<GitRepositoryConnectionStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  INACTIVE: {
    label: "Unlinked",
    className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  DISCONNECTED: {
    label: "Disconnected",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  ERROR: {
    label: "Error",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  },
};

export function RepositoryStatusBadge({ status, className }: { status: GitRepositoryConnectionStatus; className?: string }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.ERROR;
  const Icon = status === "ERROR" ? AlertCircle : status === "DISCONNECTED" ? Unplug : null;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tone.className, className)}>
    {Icon && <Icon className="size-3.5" aria-hidden="true" />}{tone.label}
  </span>;
}

/**
 * US-GI-05: which repository a commit / pull request came from, when the project linked more than one.
 * US-GI-07 (AC05): data of a repository that stopped synchronizing is labelled "unlinked" or "disconnected".
 */
export function RepositoryLabelChip({ repository }: { repository?: GitRepositoryLabel | null }) {
  if (!repository) return null;
  const name = repository.fullName.includes("/") ? repository.fullName.slice(repository.fullName.indexOf("/") + 1) : repository.fullName;
  const state = repository.status === "INACTIVE" ? "unlinked" : repository.status === "DISCONNECTED" ? "disconnected" : null;
  return <span title={state ? `${repository.fullName} (${state})` : repository.fullName}
    className={cn("inline-flex max-w-44 items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
      state === "unlinked" ? "border-dashed border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400"
        : state === "disconnected" ? "border-dashed border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300")}>
    <span className="truncate">{name}</span>{state && <span className="shrink-0">· {state}</span>}
  </span>;
}

/**
 * US-GI-05 AC04: the project's repository is DISCONNECTED or in ERROR. Says why and offers what the
 * viewer may do: grant access on GitHub, sync again (GitHub is checked first), unlink. Someone who
 * may not change the configuration only reads it.
 */
export function RepositoryStatusAlert({ view, manageUrl, syncing, onResync, onUnlink, linkAction }: {
  view: ProjectRepositoryView;
  manageUrl?: string;
  syncing: boolean;
  onResync: () => void;
  onUnlink: () => void;
  /** US-GI-07: GitHub was disconnected from the repository's account: link it again (or connect GitHub first). */
  linkAction?: ReactNode;
}) {
  const repository = view.repository;
  if (!repository || (repository.status !== "DISCONNECTED" && repository.status !== "ERROR")) return null;
  const disconnected = repository.status === "DISCONNECTED";
  const message = repositoryReasonMessage(repository.statusReason, repository.status);
  const deleted = repository.statusReason === "REPOSITORY_DELETED";
  const since = repository.statusChangedAt
    ? <span className="font-normal" title={formatDateTime(repository.statusChangedAt)}> · since {formatRelative(repository.statusChangedAt)}</span>
    : null;
  const relink = repository.installationGone && view.canLink ? linkAction : null;
  const manage = view.canResync || view.canUnlink || !!relink;

  return <div role="alert" className={cn("flex flex-wrap items-start gap-2.5 rounded-lg border px-3 py-2.5",
    disconnected
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
      : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100")}>
    {disconnected ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
    <div className="min-w-0 flex-1 basis-60 space-y-0.5">
      <p className="text-sm font-medium">{message.title}{since}</p>
      <p className="text-xs opacity-90">
        {message.description} Synchronized data is kept.
        {!manage && (repository.installationGone ? " Ask the project manager to link the repository again once GitHub is connected."
          : " Ask the project manager to restore or unlink the repository.")}
      </p>
    </div>
    {manage && <div className="flex flex-wrap items-center gap-1.5">
      {relink}
      {disconnected && !deleted && view.canResync && manageUrl && <Button size="sm" className="h-8" asChild>
        <a href={manageUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />Grant access on GitHub</a>
      </Button>}
      {view.canResync && !deleted && <Button size="sm" variant={disconnected ? "outline" : "default"} className="h-8" disabled={syncing} onClick={onResync}>
        <RefreshCw className={cn(syncing && "animate-spin motion-reduce:animate-none")} />{disconnected ? "Check again" : "Sync again"}
      </Button>}
      {view.canUnlink && <Button size="sm" variant={deleted ? "default" : "outline"} className="h-8" onClick={onUnlink}>
        <Unlink />Unlink
      </Button>}
    </div>}
  </div>;
}

/** US-GI-05: "⋯" menu of the repository for whoever may manage it (PM of the master, Git Integration manager). */
export function RepositoryManageMenu({ view, onUnlink }: { view: ProjectRepositoryView; onUnlink: () => void }) {
  if (!view.canUnlink || !view.repository) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Manage repository"><MoreHorizontal /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuItem className="text-red-600 focus:text-red-700 dark:text-red-400" onSelect={onUnlink}>
        <Unlink />Unlink repository
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** US-GI-05 AC02: confirmation before the repository is unlinked; says what stops and what is kept. */
export function UnlinkRepositoryDialog({ view, open, pending, onConfirm, onCancel }: {
  view: ProjectRepositoryView;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const repository = view.repository;
  if (!repository) return null;
  const modules = view.masterProject.moduleCount;
  const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
  return <ConfirmDialog open={open} destructive loading={pending} title={`Unlink ${repository.fullName}?`}
    confirmLabel="Unlink repository" loadingLabel="Unlinking…" onConfirm={onConfirm} onCancel={onCancel}
    description={<div className="space-y-2">
      <p>New commits and pull requests will stop syncing.</p>
      <p>
        Data already synced ({plural(repository.commitCount ?? 0, "commit")}, {plural(repository.pullRequestCount ?? 0, "pull request")})
        stays in this project's analytics, labelled with the repository name.
      </p>
      {modules > 0 && <p>All {plural(modules, "module")} will stop showing this repository.</p>}
      <p>To use another repository, link it once this one is unlinked.</p>
    </div>} />;
}

/** US-GI-05: repositories unlinked from the master project; their data still counts in the analytics. */
export function PreviousRepositories({ repositories, className }: { repositories: PreviousRepository[]; className?: string }) {
  if (repositories.length === 0) return null;
  return <details className={cn("group rounded-lg border bg-muted/20 text-sm", className)}>
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
      <History className="size-3.5" aria-hidden="true" />
      Previously linked ({repositories.length})
      <span className="ml-auto font-normal">Their data still counts in this project</span>
    </summary>
    <ul className="divide-y border-t">
      {repositories.map(repository => <li key={repository.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <a href={repository.htmlUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words font-medium hover:underline">
          {repository.fullName}
        </a>
        <RepositoryStatusBadge status="INACTIVE" />
        <span className="text-[11px] text-muted-foreground">
          {formatDateTime(repository.linkedAt)} → {repository.unlinkedAt ? formatDateTime(repository.unlinkedAt) : "—"}
          {repository.unlinkedBy?.name ? ` · unlinked by ${repository.unlinkedBy.name}` : ""}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {repository.commitCount.toLocaleString("en-US")} commits · {repository.pullRequestCount.toLocaleString("en-US")} PRs
        </span>
      </li>)}
    </ul>
  </details>;
}
