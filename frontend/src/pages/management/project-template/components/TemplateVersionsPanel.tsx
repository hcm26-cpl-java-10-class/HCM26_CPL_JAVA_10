import { projectTemplateVersionApi } from "@/api/features/project-template-version.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { CreateVersionDialog } from "@/pages/management/project-template-version/workspace/CreateVersionDialog";
import { DuplicateTemplateDialog } from "@/pages/management/project-template-version/workspace/DuplicateTemplateDialog";
import { formatDateTime, parentVersionLabel, statusMeta } from "@/pages/management/project-template-version/workspace/version.constants";
import type { ProjectTemplateDTO } from "@/types/features/project-template";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, CopyPlus, GitBranch, Layers, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { TemplateVersionConfiguration } from "./TemplateVersionConfiguration";

export function TemplateVersionsPanel({ template }: { template: ProjectTemplateDTO }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { user, activeRole, hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(params.get("action") === "delete");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const query = useQuery({
    queryKey: ["project-template-versions", "by-template", template.id, user.email, activeRole],
    queryFn: () => projectTemplateVersionApi.getByTemplate(template.id),
    retry: false, refetchOnMount: "always", refetchOnWindowFocus: false,
  });
  const versions = query.data ?? [];
  const requestedId = params.get("version");
  const selected = requestedId ? versions.find(version => String(version.id) === requestedId) : versions.find(version => version.isActive) ?? versions[0];
  const published = versions.find(version => version.status === "PUBLISHED" && version.isActive);
  const canCreate = hasPermission("PROJECT_TEMPLATE_VERSION_CREATE");
  const canDelete = hasPermission("PROJECT_TEMPLATE_VERSION_DELETE") && !template.readOnly && template.status !== "ARCHIVED"
    && selected?.status === "DRAFT" && !versions.some(version => version.parentTemplateId === selected.id);
  const select = (id?: number) => setParams(current => {
    const next = new URLSearchParams(current); next.set("tab", "versions");
    next.delete("edit"); next.delete("action");
    if (id != null) next.set("version", String(id)); else next.delete("version");
    return next;
  }, { replace: true });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["project-templates"] }),
      client.invalidateQueries({ queryKey: ["project-template-versions"] }),
      client.invalidateQueries({ queryKey: ["project_template_version"] }),
    ]);
  };
  const action = async (work: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await work(); }
    catch (error) { const result = getTemplateError(error); toast.error(Object.values(result.fields).flat()[0] ?? result.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const create = () => action(async () => {
    const created = selected?.id ? await projectTemplateVersionApi.createNewVersion(selected.id)
      : await projectTemplateVersionApi.createInitialVersion(template.id);
    setCreating(false); await refresh();
    if (created?.id != null) navigate(`/project-templates/${template.id}/detail?tab=versions&version=${created.id}&edit=overview`);
    else select();
    toast.success(`Version ${created?.version ?? "v1.0"} created as a draft.`);
  });
  const duplicate = (payload: { name: string }) => action(async () => {
    if (selected?.id == null) return;
    const created = await projectTemplateVersionApi.duplicateTemplate(selected.id, payload);
    setDuplicating(false); await refresh();
    navigate(`/project-templates/${created.templateId}/detail?tab=versions&version=${created.id}`);
    toast.success("Template duplicated as an independent draft.");
  });
  const remove = () => action(async () => {
    if (!selected || !canDelete) return;
    await projectTemplateVersionApi.delete(String(selected.id));
    setDeleting(false); select(); await refresh();
    toast.success("Draft version deleted successfully.");
  });
  return <section className="grid min-w-0 gap-5" aria-label="Template version history">
    <div className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="grid gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="size-4" />Version history <Badge variant="secondary">{versions.length}</Badge></h2>
          <p className="text-xs text-muted-foreground">{published ? `Active: ${published.version}. Publishing a new version archives the previous active version.` : "No active version yet."}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={query.isFetching || busy} onClick={() => void refresh()}><RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Refresh versions</Button>
          {selected && canCreate && <Button variant="outline" disabled={busy} onClick={() => setDuplicating(true)}><Copy />Duplicate template</Button>}
          {!template.readOnly && template.status !== "ARCHIVED" && canCreate && <Button disabled={busy || query.isLoading || query.isError || !!requestedId && !selected}
            onClick={() => setCreating(true)}><CopyPlus />{versions.length ? "Create new version" : "Create first version"}</Button>}
          {canDelete && <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setDeleting(true)}><Trash2 />Delete draft version</Button>}
        </div>
      </header>
      {query.isLoading ? <ProjectTemplateLoading /> : query.isError ? <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />
        : !versions.length ? <p className="p-8 text-center text-sm text-muted-foreground">No versions yet. Create the first version to capture this template.</p>
          : <ul className="divide-y">{versions.map(version => {
            const meta = statusMeta(version.status);
            const parent = parentVersionLabel(versions, version.parentTemplateId);
            return <li key={version.id}><button type="button" disabled={busy} onClick={() => select(version.id)} aria-pressed={version.id === selected?.id}
              aria-label={`View version ${version.version}`} className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 ${version.id === selected?.id ? "bg-muted/60" : ""}`}>
              <span className="font-semibold">{version.version}</span>
              {parent && <span className="flex items-center gap-1 text-xs text-muted-foreground"><GitBranch className="size-3" />from {parent}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(version.updatedAt ?? version.createdAt)}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>{meta.label}</span>
            </button></li>;
          })}</ul>}
    </div>
    {requestedId && !selected && query.isSuccess && <Alert variant="destructive"><AlertDescription>
      This version does not belong to this template or is no longer available.
      <Button size="sm" variant="outline" onClick={() => select()}>Show latest version</Button>
    </AlertDescription></Alert>}
    {selected?.id != null && !query.isError && hasPermission("PROJECT_TEMPLATE_VERSION_READ") && <TemplateVersionConfiguration key={`${selected.id}-${params.get("edit")}`}
      versionId={selected.id} editOverview={params.get("edit") === "overview"} onChanged={() => { void refresh(); }} />}
    <CreateVersionDialog open={creating} onOpenChange={value => { if (!busy) setCreating(value); }} source={selected ?? null}
      versions={versions} loading={busy} onConfirm={create} />
    <DuplicateTemplateDialog open={duplicating} onOpenChange={value => { if (!busy) setDuplicating(value); }} source={selected ?? null}
      loading={busy} onConfirm={duplicate} />
    <Dialog open={deleting && !!canDelete} onOpenChange={value => { if (!busy) setDeleting(value); }}>
      <DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Delete draft version {selected?.version}?</DialogTitle>
        <DialogDescription>This draft will be removed. Published versions and existing workspaces are kept.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(false)}>Cancel</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Delete draft version</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
