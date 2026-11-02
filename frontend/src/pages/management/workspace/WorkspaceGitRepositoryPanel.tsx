import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Copy, ExternalLink, GitBranch, GitFork, Link2, Loader2, Pencil, RefreshCw, Unlink } from "lucide-react";
import { workspaceGitApi, type WorkspaceGitConfig, type WorkspaceGitInput } from "@/api/features/workspace-git.api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

function safeWebLink(raw: string | null): string | undefined {
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash) return url.href;
  } catch { /* Legacy/invalid data must never become an executable link. */ }
}
function errorDetails(error: unknown): { message: string; fields: Record<string, string>; conflict: boolean } {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data;
    const fields: Record<string, string> = {};
    if (body?.errors && typeof body.errors === "object") {
      for (const [key, value] of Object.entries(body.errors)) if (typeof value === "string") fields[key] = value;
    }
    return {
      message: status === 403 ? "You do not have permission to access this repository or perform this action."
        : status === 409 ? "Another user changed the repository. Reload the latest configuration before saving."
        : status === 422 ? "Please check the highlighted fields."
        : "Could not load or save the repository. Check your connection and retry.",
      fields, conflict: status === 409,
    };
  }
  return { message: "Could not complete the repository request. Please retry.", fields: {}, conflict: false };
}
const EDIT_REASON = "Chỉ Team Leader, thành viên có quyền Edit Workspace hoặc Mentor phụ trách mới có quyền thay đổi thông tin Git Repository.";

export function WorkspaceGitRepositoryPanel({ workspaceId }: { workspaceId: number }) {
  const client = useQueryClient();
  const account = useSelector((state: RootState) => state.auth.email);
  const key = ["workspace-git-config", workspaceId, account];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => workspaceGitApi.get(workspaceId, signal), retry: false });
  const [editing, setEditing] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<number | null>(null);
  const [form, setForm] = useState<WorkspaceGitInput>({ version: 0, repositoryUrl: "", defaultBranch: "main", repositoryWebUrl: "" });
  const success = (config: WorkspaceGitConfig, message: string) => {
    client.setQueryData(key, config);
    setEditing(false); setConfirmUnlink(null);
    toast.success(message);
  };
  const save = useMutation({ mutationFn: (input: WorkspaceGitInput) => workspaceGitApi.save(workspaceId, input),
    onSuccess: config => success(config, "Repository link saved successfully."),
    onError: error => { if (axios.isAxiosError(error) && error.response?.status === 403) void query.refetch(); },
  });
  const unlink = useMutation({ mutationFn: (version: number) => workspaceGitApi.unlink(workspaceId, version),
    onSuccess: config => success(config, "Repository unlinked. Previous submissions are unchanged."),
    onError: error => { if (axios.isAxiosError(error) && error.response?.status === 403) void query.refetch(); },
  });
  const loadForm = (config: WorkspaceGitConfig) => {
    setForm({ version: config.version, repositoryUrl: config.repositoryUrl ?? "", defaultBranch: config.defaultBranch ?? "main", repositoryWebUrl: config.repositoryWebUrl ?? "" });
    save.reset(); setEditing(true);
  };
  const reloadForm = async () => {
    const result = await query.refetch();
    if (result.data && !result.error) loadForm(result.data);
  };
  const pending = save.isPending || unlink.isPending;
  const saveError = save.error ? errorDetails(save.error) : null;
  const unlinkError = unlink.error ? errorDetails(unlink.error) : null;
  const config = query.data;
  const webLink = safeWebLink(config?.repositoryWebUrl ?? null);
  const provider = config?.provider === "AZURE_DEVOPS" ? "Azure DevOps" : config?.provider === "SELF_HOSTED" ? "Self-hosted Git" : config?.provider?.replace("GITHUB", "GitHub").replace("GITLAB", "GitLab").replace("BITBUCKET", "Bitbucket");
  const fieldError = (field: string) => saveError?.fields[field] ? <p id={`git-${workspaceId}-${field}-error`} role="alert" className="text-xs text-destructive">{saveError.fields[field]}</p> : null;
  return <section aria-label="Git Repository" className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-semibold"><GitFork className="size-4 text-primary" /> Git Repository</h3>
      {config?.configured && !query.isError && <Badge variant="outline">{provider} · Configured</Badge>}
    </div>
    {query.isPending ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading repository…</p>
      : query.isError ? <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"><p>{errorDetails(query.error).message}</p><Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button></div>
      : config?.configured ? <>
        {webLink ? <a href={webLink} target="_blank" rel="noopener noreferrer" className="block break-all text-sm font-medium text-primary underline underline-offset-4">{config.repositoryWebUrl}<ExternalLink aria-label="Opens in a new tab" className="ml-1 inline size-3.5" /></a>
          : <p role="alert" className="text-sm text-destructive">The repository page is unavailable. Ask the team leader or mentor to update the link.</p>}
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><GitBranch className="size-4 shrink-0" /> Default branch: <span className="break-all font-medium text-foreground">{config.defaultBranch}</span></p>
        <div className="flex flex-wrap gap-2">
          {webLink && <Button size="sm" variant="outline" asChild><a href={webLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" /> Open repository</a></Button>}
          <Button size="sm" type="button" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(config.repositoryUrl ?? ""); toast.success("Clone URL copied."); }
            catch { toast.error("Could not copy. Select and copy the clone URL below."); }
          }}><Copy className="size-3.5" /> Copy clone URL</Button>
          {config.canEdit && <Button size="sm" variant="outline" type="button" onClick={() => loadForm(config)}><Pencil className="size-3.5" /> Edit</Button>}
          {config.canUnlink && <Button size="sm" variant="ghost" type="button" onClick={() => { unlink.reset(); setConfirmUnlink(config.version); }}><Unlink className="size-3.5" /> Unlink</Button>}
        </div>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Clone URL</summary><p className="mt-2 select-text break-all font-mono">{config.repositoryUrl}</p></details>
        {config.updatedAt && <p className="text-xs text-muted-foreground">Updated by {config.updatedBy || "Former member"} · {new Date(config.updatedAt).toLocaleString()}</p>}
        {!config.canEdit && <p className="text-xs text-muted-foreground" title={EDIT_REASON}>{EDIT_REASON}</p>}
      </> : config ? <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">Chưa có Git Repository nào được liên kết. Vui lòng liên kết Git Repo để tiến hành làm bài và nộp sản phẩm.</p>
        {config.canEdit ? <Button type="button" size="sm" variant="outline" onClick={() => loadForm(config)}><Link2 className="size-4" /> Thêm Git Repository</Button>
          : <p className="text-xs text-muted-foreground" title={EDIT_REASON}>Liên hệ Team Leader hoặc Mentor để liên kết repository của nhóm.</p>}
      </div> : null}

    <Dialog open={editing} onOpenChange={open => { if (!pending) setEditing(open); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-xl" showCloseButton={!pending}>
        <DialogHeader><DialogTitle>{config?.configured ? "Edit Git repository" : "Link Git repository"}</DialogTitle><DialogDescription>Configure your team's repository. Do not include a token, password or private key. Saving a link does not verify access to the repository.</DialogDescription></DialogHeader>
        <form noValidate className="flex min-h-0 flex-col gap-4" onSubmit={event => { event.preventDefault(); if (!pending && !query.isError && config?.canEdit) save.mutate(form); }}>
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2"><Label htmlFor={`git-url-${workspaceId}`}>Repository clone URL</Label><Input id={`git-url-${workspaceId}`} value={form.repositoryUrl} maxLength={2048} required disabled={pending} autoComplete="off" spellCheck={false} placeholder="https://github.com/organization/repository.git" aria-invalid={Boolean(saveError?.fields.repositoryUrl)} aria-describedby={`git-${workspaceId}-repositoryUrl-error`} onChange={e => setForm({ ...form, repositoryUrl: e.target.value })} />{fieldError("repositoryUrl")}<p className="text-xs text-muted-foreground">HTTPS or SSH, for example git@github.com:organization/repository.git.</p></div>
            <div className="space-y-2"><Label htmlFor={`git-branch-${workspaceId}`}>Default branch</Label><Input id={`git-branch-${workspaceId}`} value={form.defaultBranch} maxLength={255} required disabled={pending} placeholder="main" autoComplete="off" spellCheck={false} aria-invalid={Boolean(saveError?.fields.defaultBranch)} onChange={e => setForm({ ...form, defaultBranch: e.target.value })} />{fieldError("defaultBranch")}<p className="text-xs text-muted-foreground">Enter the branch name. Branches are not fetched from Git.</p></div>
            <div className="space-y-2"><Label htmlFor={`git-web-${workspaceId}`}>Repository page for self-hosted SSH</Label><Input id={`git-web-${workspaceId}`} value={form.repositoryWebUrl ?? ""} maxLength={2048} disabled={pending} placeholder="https://git.company.com/team/repository" autoComplete="off" spellCheck={false} aria-invalid={Boolean(saveError?.fields.repositoryWebUrl)} onChange={e => setForm({ ...form, repositoryWebUrl: e.target.value })} />{fieldError("repositoryWebUrl")}<p className="text-xs text-muted-foreground">Required for self-hosted SSH only. GitHub, GitLab, Bitbucket and Azure DevOps pages are mapped automatically.</p></div>
            {saveError && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"><p>{saveError.message}</p>{saveError.conflict && <Button type="button" size="sm" variant="outline" disabled={query.isFetching} onClick={() => void reloadForm()}><RefreshCw className="size-3.5" /> Reload latest</Button>}</div>}
          </div>
          <DialogFooter className="shrink-0 border-t pt-4"><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={pending || query.isError || !config?.canEdit}>{save.isPending && <Loader2 className="size-4 animate-spin" />} Save link</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={confirmUnlink !== null} onOpenChange={open => { if (!pending && !open) setConfirmUnlink(null); }}>
      <DialogContent showCloseButton={!pending}><DialogHeader><DialogTitle>Unlink Git repository?</DialogTitle><DialogDescription>This removes the current workspace link. Previously submitted artifacts and their repository URLs will remain unchanged.</DialogDescription></DialogHeader>
        {unlinkError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{unlinkError.message}</p>{unlinkError.conflict && <Button type="button" variant="outline" disabled={query.isFetching} onClick={async () => {
          const latest = await query.refetch();
          if (!latest.error && latest.data) { setConfirmUnlink(latest.data.canUnlink ? latest.data.version : null); unlink.reset(); }
        }}>Reload latest</Button>}</div>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmUnlink(null)}>Cancel</Button><Button type="button" variant="destructive" disabled={pending || query.isError || !config?.canUnlink} onClick={() => { if (confirmUnlink !== null) unlink.mutate(confirmUnlink); }}>{unlink.isPending && <Loader2 className="size-4 animate-spin" />} Unlink repository</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
