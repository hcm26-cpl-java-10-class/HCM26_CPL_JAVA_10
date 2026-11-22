import { MoreHorizontal, Unplug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { GitInstallation } from "@/types/features/git-integration";
import { installationManageUrl } from "../git-integration.format";

/**
 * US-GI-02 AC04, moved from the project card: removing the GitHub App from a whole account or
 * organization is a Git Integration setting, so it is offered on the installation, to whoever
 * manages Git Integration. The confirmation lists the projects that would stop synchronizing.
 * Until GI-07 the removal itself is finished on GitHub ("Uninstall"); the "deleted" webhook does the rest.
 */
export function DisconnectGitHubAction({ installation }: { installation: GitInstallation }) {
  const [open, setOpen] = useState(false);
  const projects = installation.projects ?? [];
  const accountKind = installation.accountType === "Organization" ? "organization" : "personal account";

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${installation.accountLogin}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem className="text-red-600 focus:text-red-700 dark:text-red-400" onSelect={() => setOpen(true)}>
          <Unplug />Disconnect GitHub…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog open={open} destructive title={`Disconnect GitHub from ${installation.accountLogin}?`}
      description={<span className="block space-y-2 text-sm">
        <span className="block">
          This removes the GitHub App from the {accountKind} <b>{installation.accountLogin}</b>.
        </span>
        {projects.length === 0
          ? <span className="block">No project reads a repository through it right now.</span>
          : <>
            <span className="block">
              {projects.length === 1 ? "This project stops" : `These ${projects.length} projects stop`} synchronizing:
            </span>
            <span className="block max-h-40 overflow-y-auto rounded-md border bg-muted/30 px-2.5 py-1.5">
              {projects.map(project => <span key={project.id} className="flex flex-wrap items-baseline gap-x-2 py-0.5">
                <span className="font-medium">{project.code ? `${project.code} · ` : ""}{project.name ?? `Project #${project.id}`}</span>
                <span className="text-xs text-muted-foreground">{project.repositoryFullName}</span>
              </span>)}
            </span>
          </>}
        <span className="block">Commits, pull requests and reviews already synchronized are kept.</span>
        <span className="block text-muted-foreground">You will finish on GitHub ("Uninstall"); this page updates by itself afterwards.</span>
      </span>}
      confirmLabel="Continue on GitHub" cancelLabel="Cancel"
      onCancel={() => setOpen(false)}
      onConfirm={() => { setOpen(false); window.open(installationManageUrl(installation), "_blank", "noopener,noreferrer"); }} />
  </>;
}
