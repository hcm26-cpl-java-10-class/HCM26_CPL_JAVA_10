import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Code2, Copy, ExternalLink, GitBranch, Link2, Loader2, Pencil, Unlink } from "lucide-react";
import { workspaceGitApi, type WorkspaceGitConfig, type WorkspaceGitInput } from "@/api/features/workspace-git.api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkspaceGitRepositoryDialog } from "./WorkspaceGitRepositoryDialog";
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
    if (fields.repositoryWebUrl) {
      fields.repositoryUrl = "For this self-hosted SSH server, use its HTTPS clone URL so the repository page can be opened.";
      delete fields.repositoryWebUrl;
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
const EDIT_REASON = "Only an Admin with access to this workspace, the Team Leader, a member with Edit Workspace permission, or the assigned Mentor can change the Git repository.";

export function WorkspaceGitRepositoryPanel({ workspaceId }: { workspaceId: number }) {
  const client = useQueryClient();
  const account = useSelector((state: RootState) => state.auth.email);
  const key = ["workspace-git-config", workspaceId, account];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => workspaceGitApi.get(workspaceId, signal), retry: false });
  const [editing, setEditing] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<number | null>(null);
  const [form, setForm] = useState<WorkspaceGitInput>({ version: 0, repositoryUrl: "", defaultBranch: "main" });
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
  const unlinkError = unlink.error ? errorDetails(unlink.error) : null;
  const config = query.data;
  const webLink = safeWebLink(config?.repositoryWebUrl ?? null);
  const provider = config?.provider === "AZURE_DEVOPS" ? "Azure DevOps" : config?.provider === "SELF_HOSTED" ? "Self-hosted Git" : config?.provider?.replace("GITHUB", "GitHub").replace("GITLAB", "GitLab").replace("BITBUCKET", "Bitbucket");
  return <section aria-label="Git Repository" className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/40 px-4 py-3.5 dark:bg-muted/20 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"><Code2 className="size-4" /></span><div className="space-y-1"><h3 className="text-sm font-semibold leading-5">Git Repository</h3><p className="text-[11px] leading-4 text-muted-foreground">Kho lưu trữ mã nguồn nhóm thực hành</p></div></div>
      {config?.configured && !query.isError && <Badge variant="outline">{provider} · Configured</Badge>}
      {config && !config.configured && !query.isError && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">Not linked</Badge>}
    </div>
    <div className="space-y-3 p-4 sm:p-5">
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
      </> : config ? <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-52 space-y-1">
          <p className="text-sm font-medium">Chưa có Git Repository nào được liên kết</p>
          <p className="text-xs leading-5 text-muted-foreground">{config.canEdit ? "Liên kết repository của GitHub / GitLab để nhóm truy cập mã nguồn và nộp sản phẩm." : "Liên hệ Admin, Team Leader hoặc Mentor để liên kết repository của nhóm."}</p>
        </div>
        {config.canEdit && <Button type="button" size="sm" variant="outline" onClick={() => loadForm(config)}><Link2 className="size-4" /> Thêm Git Repository</Button>}
      </div> : null}
    </div>

    {editing && config && <WorkspaceGitRepositoryDialog workspaceId={workspaceId} configured={config.configured}
      value={form} onChange={setForm} onClose={() => setEditing(false)} onSave={input => save.mutate(input)}
      busy={pending} disabled={query.isError || !config.canEdit} error={save.error ? errorDetails(save.error) : null}
      onReload={() => void reloadForm()} reloading={query.isFetching} />}
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
