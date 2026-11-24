import { Loader2, MoreHorizontal, Unplug } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { gitIntegrationErrorCode, gitIntegrationHttpStatus } from "@/api/features/git-integration.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { GitInstallation } from "@/types/features/git-integration";
import { errorMessage } from "../git-integration.messages";
import { useDisconnectInstallation } from "../useGitIntegration";

/** GitHub logins are case-insensitive; the server compares the same way. */
function sameLogin(typed: string, login: string) {
  return typed.trim().toLowerCase() === login.trim().toLowerCase();
}

/**
 * US-GI-07: disconnect a GitHub account or organization from the platform. Offered to a Git
 * Integration manager or the person who installed it (`canDisconnect`). The dialog names the account
 * and the master projects that stop synchronizing (BR2), and the account name must be typed (BR3).
 * The platform uninstalls the App on GitHub; cancelling or a wrong name changes nothing (AC03).
 */
export function DisconnectGitHubAction({ installation }: { installation: GitInstallation }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const disconnect = useDisconnectInstallation();
  const inputId = useId();
  const hintId = useId();
  const projects = installation.projects ?? [];
  const accountKind = installation.accountType === "Organization" ? "organization" : "personal account";
  const matches = sameLogin(typed, installation.accountLogin);
  const code = disconnect.error ? gitIntegrationErrorCode(disconnect.error) : undefined;
  const failure = disconnect.error ? errorMessage(code, gitIntegrationHttpStatus(disconnect.error)) : null;

  function close(next: boolean) {
    if (disconnect.isPending) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      disconnect.reset();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!matches || disconnect.isPending) return;
    disconnect.mutate({ id: installation.id, confirmLogin: typed }, { onSuccess: () => close(false) });
  }

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

    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="break-words pr-6">Disconnect GitHub from {installation.accountLogin}?</DialogTitle>
            <DialogDescription>
              The GitHub App will be uninstalled from the {accountKind} <b className="text-foreground">{installation.accountLogin}</b>,
              and the platform stops reading all of its repositories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            {projects.length === 0
              ? <p className="text-muted-foreground">No project reads a repository through it right now.</p>
              : <>
                <p className="font-medium">
                  {projects.length === 1 ? "This project stops" : `These ${projects.length} projects stop`} synchronizing:
                </p>
                <ul className="max-h-40 divide-y overflow-y-auto rounded-md border bg-muted/30">
                  {projects.map(project => <li key={project.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-1.5">
                    <span className="min-w-0 break-words font-medium">
                      {project.code ? `${project.code} · ` : ""}{project.name ?? `Project #${project.id}`}
                    </span>
                    <span className="min-w-0 break-all text-xs text-muted-foreground">{project.repositoryFullName}</span>
                  </li>)}
                </ul>
              </>}
            <p className="text-muted-foreground">
              Data already synchronized stays in their analytics, labelled “disconnected”. To synchronize again, connect GitHub
              again and link the repositories again.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={inputId} className="text-sm">
              Type <b className="select-all break-all font-mono">{installation.accountLogin}</b> to confirm
            </label>
            <Input id={inputId} value={typed} autoComplete="off" spellCheck={false} autoFocus
              aria-describedby={failure ? hintId : undefined} aria-invalid={code === "GIT_DISCONNECT_CONFIRMATION_MISMATCH" || undefined}
              onChange={event => { setTyped(event.target.value); if (disconnect.error) disconnect.reset(); }} />
            {failure && <p id={hintId} role="alert" className="text-xs text-red-600 dark:text-red-400">
              {failure.title}. {failure.description}
            </p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={disconnect.isPending} onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={!matches || disconnect.isPending}>
              {disconnect.isPending ? <><Loader2 className="animate-spin motion-reduce:animate-none" />Disconnecting…</> : <><Unplug />Disconnect GitHub</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
