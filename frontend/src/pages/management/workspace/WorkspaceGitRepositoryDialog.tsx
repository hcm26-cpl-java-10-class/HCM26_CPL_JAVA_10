import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { WorkspaceGitInput } from "@/api/features/workspace-git.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function requiresRepositoryPage(raw: string) {
  const value = raw.trim();
  const host = value.startsWith("git@")
    ? value.slice(4).split(":", 1)[0]?.toLowerCase()
    : (() => {
      try { return new URL(value).hostname.toLowerCase(); }
      catch { return ""; }
    })();
  if (!host) return false;
  return !["github.com", "gitlab.com", "bitbucket.org", "dev.azure.com", "ssh.dev.azure.com"]
    .includes(host) && !host.endsWith(".visualstudio.com");
}

export function WorkspaceGitRepositoryDialog({ workspaceId, configured, value, onChange, onClose, onSave,
  busy, disabled, error, onReload, reloading }: {
  workspaceId: number;
  configured: boolean;
  value: WorkspaceGitInput;
  onChange: (value: WorkspaceGitInput) => void;
  onClose: () => void;
  onSave: (value: WorkspaceGitInput) => void;
  busy: boolean;
  disabled: boolean;
  error: { message: string; fields: Record<string, string>; conflict: boolean } | null;
  onReload: () => void;
  reloading: boolean;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fieldError = (name: string) => errors[name] || error?.fields[name];
  const inputId = (name: string) => `git-${workspaceId}-${name}`;
  const renderError = (name: string) => fieldError(name)
    ? <p id={`${inputId(name)}-error`} role="alert" className="text-xs text-destructive">{fieldError(name)}</p>
    : null;

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-xl" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>{configured ? "Edit Git repository" : "Link Git repository"}</DialogTitle>
        <DialogDescription>
          Configure your team&apos;s repository. Do not include a token, password or private key. Saving a link does not verify access to the repository.
        </DialogDescription>
      </DialogHeader>
      <form noValidate className="flex min-h-0 flex-col gap-4" aria-busy={busy} onSubmit={event => {
        event.preventDefault();
        if (busy || disabled) return;
        const next: Record<string, string> = {};
        if (!value.repositoryUrl.trim()) next.repositoryUrl = "Repository clone URL is required.";
        if (!value.defaultBranch.trim()) next.defaultBranch = "Default branch is required.";
        if (requiresRepositoryPage(value.repositoryUrl) && /^(?:git@|ssh:\/\/)/i.test(value.repositoryUrl.trim())
          && !value.repositoryWebUrl?.trim()) {
          next.repositoryUrl = "Self-hosted SSH URLs need a separate repository page. Use an HTTPS clone URL instead.";
        }
        setErrors(next);
        if (Object.keys(next).length === 0) onSave(value);
      }}>
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor={inputId("repositoryUrl")}>Repository clone URL</Label>
            <Input id={inputId("repositoryUrl")} value={value.repositoryUrl} maxLength={2048} required disabled={busy}
              autoComplete="off" spellCheck={false} placeholder="https://github.com/organization/repository.git"
              aria-invalid={Boolean(fieldError("repositoryUrl"))}
              aria-describedby={fieldError("repositoryUrl") ? `${inputId("repositoryUrl")}-error` : undefined}
              onChange={event => {
                setErrors(current => ({ ...current, repositoryUrl: "" }));
                onChange({ ...value, repositoryUrl: event.target.value, repositoryWebUrl: "" });
              }} />
            {renderError("repositoryUrl")}
            <p className="text-xs text-muted-foreground">HTTPS or SSH, for example git@github.com:organization/repository.git.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={inputId("defaultBranch")}>Default branch</Label>
            <Input id={inputId("defaultBranch")} value={value.defaultBranch} maxLength={255} required disabled={busy}
              placeholder="main" autoComplete="off" spellCheck={false}
              aria-invalid={Boolean(fieldError("defaultBranch"))}
              aria-describedby={fieldError("defaultBranch") ? `${inputId("defaultBranch")}-error` : undefined}
              onChange={event => {
                setErrors(current => ({ ...current, defaultBranch: "" }));
                onChange({ ...value, defaultBranch: event.target.value });
              }} />
            {renderError("defaultBranch")}
            <p className="text-xs text-muted-foreground">Enter the branch name. Branches are not fetched from Git.</p>
          </div>
          {error && (error.conflict || !["repositoryUrl", "defaultBranch"].some(name => error.fields[name])) && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
            <p>{error.message}</p>
            {error.conflict && <Button type="button" size="sm" variant="outline" disabled={busy || reloading} onClick={onReload}>
              {reloading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Reload latest
            </Button>}
          </div>}
        </div>
        <DialogFooter className="shrink-0 border-t pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || disabled}>
            {busy && <Loader2 className="size-4 animate-spin" />}{busy ? "Saving…" : "Save link"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
