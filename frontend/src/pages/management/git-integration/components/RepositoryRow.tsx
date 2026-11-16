import { Ban, CheckCircle2, ExternalLink, GitBranch, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitRepositoryItem } from "@/types/features/git-integration";
import { RepositoryArchivedBadge, RepositoryVisibilityBadge, RepositoryVisibilityIcon } from "./RepositoryVisibilityBadge";

/** Why a repository cannot be picked, in words (never colour alone). */
function UnavailableNote({ repository }: { repository: GitRepositoryItem }) {
  const project = repository.linkedProject;
  const projectLabel = project?.code ? `${project.code}${project.name ? ` · ${project.name}` : ""}` : "another organization's project";
  switch (repository.unavailableReason) {
    case "LINKED_TO_OTHER_PROJECT":
      return <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
        <Link2 className="size-3" aria-hidden="true" />Linked to {projectLabel}
      </p>;
    case "LINKED_TO_THIS_PROJECT":
      return <p className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3" aria-hidden="true" />Linked to this project
      </p>;
    case "ARCHIVED":
      return <p className="text-[11px] text-muted-foreground">Archived repositories are read-only and can't be linked.</p>;
    case "DISABLED":
      return <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Ban className="size-3" aria-hidden="true" />Disabled on GitHub
      </p>;
    default:
      return null;
  }
}

export function RepositoryRow({ repository }: { repository: GitRepositoryItem }) {
  const dimmed = !repository.selectable && repository.unavailableReason !== "LINKED_TO_THIS_PROJECT";
  return <li className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60",
    dimmed && "opacity-60")}>
    <span aria-hidden="true"
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <RepositoryVisibilityIcon visibility={repository.visibility} className="size-4" />
    </span>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="min-w-0 break-words text-sm">
          <span className="text-muted-foreground">{repository.owner}/</span>
          <span className="font-medium text-foreground">{repository.name}</span>
        </p>
        <RepositoryVisibilityBadge visibility={repository.visibility} />
        {repository.archived && <RepositoryArchivedBadge />}
        {repository.defaultBranch && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          <GitBranch className="size-3" aria-hidden="true" />{repository.defaultBranch}
        </span>}
      </div>
      <UnavailableNote repository={repository} />
    </div>
    <a href={repository.htmlUrl} target="_blank" rel="noreferrer"
      className="mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Open ${repository.fullName} on GitHub (new tab)`}>
      <ExternalLink className="size-4" aria-hidden="true" />
    </a>
  </li>;
}
