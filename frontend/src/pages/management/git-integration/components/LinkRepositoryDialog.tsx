import { AlertCircle, ExternalLink, GitBranch, Loader2, Link2 } from "lucide-react";
import { gitIntegrationErrorBody, gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GitRepositoryItem } from "@/types/features/git-integration";
import { errorMessage } from "../git-integration.messages";
import { RepositoryVisibilityBadge, RepositoryVisibilityIcon } from "./RepositoryVisibilityBadge";

function projectLabel(project?: { code?: string | null; name?: string | null } | null) {
  if (!project?.code) return undefined;
  return project.name ? `${project.code} · ${project.name}` : project.code;
}

/** Inline explanation of a refused link, naming what blocked it when the server says. */
function LinkError({ error, manageUrl }: { error: unknown; manageUrl: string }) {
  const body = gitIntegrationErrorBody(error);
  const message = errorMessage(body?.code, gitIntegrationHttpStatus(error));
  let detail = message.description;
  if (body?.code === "GIT_PROJECT_ALREADY_LINKED" && body.details?.repository) {
    detail = `It is already linked to ${body.details.repository.fullName}. A master project can have only one active repository.`;
  } else if (body?.code === "GIT_REPOSITORY_IN_USE") {
    const label = projectLabel(body.details?.linkedProject);
    detail = label ? `It is linked to ${label}. Choose another repository.` : "It is linked to another project. Choose another repository.";
  } else if (body?.code === "GIT_PROJECT_NOT_MASTER") {
    const label = projectLabel(body.details?.masterProject);
    detail = label ? `Link the repository from the master project ${label}.` : message.description;
  }
  return <div role="alert" className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium">{message.title}</p>
      <p className="text-xs leading-5 text-red-800/90 dark:text-red-200/80">{detail}</p>
      {body?.code === "GIT_REPOSITORY_NOT_ACCESSIBLE" && <a href={manageUrl} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2">
        Manage access on GitHub<ExternalLink className="size-3" aria-hidden="true" />
      </a>}
    </div>
  </div>;
}

/** US-GI-04: confirm linking the chosen repository to the master project. */
export function LinkRepositoryDialog({ repository, masterName, moduleCount, pending, error, manageUrl, onConfirm, onClose }: {
  repository: GitRepositoryItem | null;
  masterName: string;
  moduleCount: number;
  pending: boolean;
  error: unknown;
  manageUrl: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return <Dialog open={repository !== null} onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent showCloseButton={!pending} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Link repository to {masterName}?</DialogTitle>
        <DialogDescription>The system will collect this project's development activity from the repository.</DialogDescription>
      </DialogHeader>
      {repository && <div className="flex items-start gap-3 rounded-lg border bg-slate-50/70 p-3 dark:bg-muted/20">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <RepositoryVisibilityIcon visibility={repository.visibility} className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="break-words text-sm"><span className="text-muted-foreground">{repository.owner}/</span><span className="font-medium">{repository.name}</span></p>
          <div className="flex flex-wrap items-center gap-1.5">
            <RepositoryVisibilityBadge visibility={repository.visibility} />
            {repository.defaultBranch && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              <GitBranch className="size-3" aria-hidden="true" />{repository.defaultBranch}
            </span>}
          </div>
        </div>
      </div>}
      <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
        {moduleCount > 0 && <li>All {moduleCount} {moduleCount === 1 ? "module" : "modules"} of this project will share this repository.</li>}
        <li>A repository can be linked to only one master project.</li>
        <li>An initial synchronization starts right after linking.</li>
      </ul>
      {error !== null && error !== undefined && <LinkError error={error} manageUrl={manageUrl} />}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{error ? "Choose another" : "Cancel"}</Button>
        <Button type="button" disabled={pending} onClick={onConfirm}>
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />}Link repository
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
