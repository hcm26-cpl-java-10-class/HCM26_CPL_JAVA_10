import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import type {
  WorkspaceResource,
  WorkspaceResourceFile,
  WorkspaceResourcePayload,
} from "@/types/features/workspace-resource";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Paperclip,
  Pen,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeExternalUrl } from "@/lib/utils";
import { WorkspaceEmptyState, getWorkspaceError } from "./workspace.shared";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";
import { WorkspaceResourceDialog } from "./WorkspaceResourceDialog";

function humanSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-GB");
}

function categoryLabel(resource: WorkspaceResource) {
  const raw = resource.category?.trim();
  if (raw) return raw;
  if (resource.url?.toLowerCase().includes("github")) return "Git";
  if (resource.url?.toLowerCase().includes("docs.google")) return "Docs";
  return resource.kind === "FILE" ? "Document" : "Link";
}

/**
 * Resources tab of a workspace (`/management/workspaces/:id?tab=resources`).
 * Trainees can browse the documents and external links their team received
 * with the project brief and download the documents through signed URLs.
 */
export function WorkspaceResourcesPanel({
  workspaceId,
  projectId,
  teamId,
  onAccessChanged,
  embedded = false,
}: {
  workspaceId: number;
  projectId?: number | null;
  teamId: number;
  onAccessChanged: () => void;
  /** Render as a sub-section (used inside the Project brief card on Overview). */
  embedded?: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const [downloading, setDownloading] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WorkspaceResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const query = useQuery({
    queryKey: ["workspace-resources", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.resources(workspaceId, signal),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const denied = sectionForbidden(query.error);
  useEffect(() => {
    // Embedded instances must not force a navigation reload: a role without
    // resource access would otherwise remount in a loop. The state card keeps
    // a manual "Reload access" action instead.
    if (denied && !embedded) onAccessChanged();
  }, [denied, embedded, onAccessChanged]);

  if (denied || query.isError || query.isPending || query.isFetching) {
    return (
      <WorkspaceSectionState
        loading={!query.isError && query.isFetching}
        denied={denied}
        error={query.error}
        retry={() => (denied ? onAccessChanged() : void query.refetch())}
      />
    );
  }

  const data = query.data;
  if (!data || data.workspaceId !== workspaceId || data.teamId !== teamId
    || (data.projectId ?? null) !== (projectId ?? null)) {
    return (
      <WorkspaceSectionState
        error={new Error("Resources context does not match this workspace.")}
        retry={() => void query.refetch()}
      />
    );
  }

  const documents = data.items.filter((item) => item.kind === "FILE" || item.files.length > 0);
  const links = data.items.filter((item) => item.kind === "LINK" && item.url);
  const empty = data.items.length === 0;
  const noProject = data.projectId == null;
  const canManage = data.canManage;
  const acceptedExtensions = data.allowedExtensions.map((extension) => `.${extension}`).join(",");

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["workspace-resources", workspaceId] });
  };

  const openCreate = () => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEdit = (resource: WorkspaceResource) => {
    setEditing(resource);
    setDialogError(null);
    setDialogOpen(true);
  };

  const download = async (resource: WorkspaceResource, file: WorkspaceResourceFile) => {
    if (downloading != null) return;
    setDownloading(file.id);
    try {
      const ticket = await workspaceApi.resourceDownloadTicket(workspaceId, resource.id, file.id);
      const anchor = document.createElement("a");
      anchor.href = ticket.url;
      anchor.download = ticket.fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(`Downloading ${ticket.fileName}`);
    } catch (error) {
      toast.error(getWorkspaceError(error));
    } finally {
      setDownloading(null);
    }
  };

  const validateFile = (file: File) => {
    const dot = file.name.lastIndexOf(".");
    const extension = dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
    if (!data.allowedExtensions.includes(extension)) {
      toast.error(`.${extension || "?"} files are not allowed. Allowed: ${data.allowedExtensions.join(", ")}`);
      return false;
    }
    if (file.size > data.maxFileBytes) {
      toast.error(`File exceeds the ${humanSize(data.maxFileBytes)} limit`);
      return false;
    }
    return true;
  };

  const replaceFiles = async (resourceId: number, previous: WorkspaceResourceFile[], file: File) => {
    await workspaceApi.uploadResourceFile(workspaceId, resourceId, file);
    for (const old of previous) {
      await workspaceApi.deleteResourceFile(workspaceId, resourceId, old.id);
    }
  };

  const submitResource = async (payload: WorkspaceResourcePayload, file: File | null) => {
    if (saving) return;
    setSaving(true);
    setDialogError(null);
    try {
      const saved = editing
        ? await workspaceApi.updateResource(workspaceId, editing.id, payload)
        : await workspaceApi.createResource(workspaceId, payload);
      if (file) await replaceFiles(saved.id, editing?.files ?? [], file);
      await refresh();
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Resource updated." : "Resource added.");
    } catch (error) {
      const message = getWorkspaceError(error);
      setDialogError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const attachFile = async (resource: WorkspaceResource, file: File) => {
    if (!validateFile(file)) return;
    setUploadingId(resource.id);
    try {
      await replaceFiles(resource.id, resource.files, file);
      await refresh();
      toast.success(`File "${file.name}" uploaded.`);
    } catch (error) {
      toast.error(getWorkspaceError(error));
    } finally {
      setUploadingId(null);
    }
  };

  const removeFile = async (resource: WorkspaceResource, file: WorkspaceResourceFile) => {
    try {
      await workspaceApi.deleteResourceFile(workspaceId, resource.id, file.id);
      await refresh();
      toast.success(`"${file.fileName}" removed.`);
    } catch (error) {
      toast.error(getWorkspaceError(error));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await workspaceApi.deleteResource(workspaceId, pendingDelete.id);
      await refresh();
      toast.success(`"${pendingDelete.title}" removed.`);
      setPendingDelete(null);
    } catch (error) {
      toast.error(getWorkspaceError(error));
    } finally {
      setDeleting(false);
    }
  };

  const manageActions = (resource: WorkspaceResource, compact = false) => {
    if (!canManage) return null;
    return (
      <div className="flex flex-wrap gap-1">
        <input
          ref={(element) => { fileInputs.current[resource.id] = element; }}
          type="file"
          hidden
          accept={acceptedExtensions}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void attachFile(resource, file);
          }}
        />
        <Button variant="outline" size="sm" disabled={uploadingId === resource.id}
          onClick={() => fileInputs.current[resource.id]?.click()}>
          {uploadingId === resource.id ? <Loader2 className="animate-spin" /> : <Paperclip />}
          {compact ? (resource.files.length ? "Replace" : "Attach") : (resource.files.length ? "Replace file" : "Attach file")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => openEdit(resource)}><Pen />Edit</Button>
        <Button variant="outline" size="sm" className="text-destructive"
          onClick={() => setPendingDelete(resource)}><Trash2 />Delete</Button>
      </div>
    );
  };

  const manageHint = canManage ? (
    <p className="text-xs text-muted-foreground">
      You can add, edit or remove resources for this team only. The project template and other teams are not changed.
      {" "}Allowed uploads: {data.allowedExtensions.join(", ")} · maximum {humanSize(data.maxFileBytes)} per file.
    </p>
  ) : null;

  return (
    <div className={embedded ? "space-y-4" : "space-y-5"}>
      {embedded ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold"><BookOpen className="size-4 text-primary" />Resources</h3>
            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <Button size="sm" onClick={openCreate}><Plus />Add resource</Button>
              )}
              <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>
                <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />Refresh
              </Button>
            </div>
          </div>
          {manageHint}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Project resources</CardTitle>
                <CardDescription>
                  Documents, repositories and reference links shared with your team for this project.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <Button onClick={openCreate}>
                    <Plus />
                    Add resource
                  </Button>
                )}
                <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
                  <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          {canManage && <CardContent className="pt-0">{manageHint}</CardContent>}
        </Card>
      )}

      {noProject ? (
        <Card>
          <CardContent>
            <WorkspaceEmptyState
              icon={BookOpen}
              title="No project linked yet"
              description="This workspace has no project, so no learning resources are available."
            />
          </CardContent>
        </Card>
      ) : empty ? (
        <Card>
          <CardContent>
            <WorkspaceEmptyState
              icon={FolderOpen}
              title="No resources yet"
              description={canManage
                ? "Add a link or upload a document so your team has everything it needs for this project."
                : "Your mentor has not shared any documents or links for this project. Check back after the project brief is assigned."}
              action={canManage ? <Button onClick={openCreate}><Plus />Add resource</Button> : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className={embedded
          ? "grid gap-4"
          : "grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"}>
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>{documents.length} resource(s) with downloadable files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No documents have been attached yet.
                </p>
              ) : (
                documents.map((resource) => (
                  <div key={resource.id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-medium">{resource.title}</p>
                        {resource.description && (
                          <p className="break-words text-sm text-muted-foreground">{resource.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{categoryLabel(resource)}</Badge>
                        {manageActions(resource)}
                      </div>
                    </div>
                    {resource.files.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No file attached yet.</p>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {resource.files.map((file) => (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{file.fileName}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {humanSize(file.sizeBytes)}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={downloading === file.id}
                                onClick={() => void download(resource, file)}
                              >
                                {downloading === file.id ? <Loader2 className="animate-spin" /> : <Download />}
                                Download
                              </Button>
                              {canManage && (
                                <Button variant="ghost" size="sm" className="text-destructive"
                                  onClick={() => void removeFile(resource, file)}>
                                  <X />Remove
                                </Button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">Updated {formatDate(resource.updatedAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
              <CardDescription>Git repositories and shared documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {links.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No external links have been shared yet.
                </p>
              ) : (
                links.map((resource) => {
                  const href = normalizeExternalUrl(resource.url);
                  return (
                    <div key={resource.id} className="space-y-2 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <a
                          href={href ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                        >
                          {categoryLabel(resource).toLowerCase() === "git" ? <Link2 className="size-4 shrink-0" /> : <ExternalLink className="size-4 shrink-0" />}
                          <span className="break-all">{resource.title}</span>
                        </a>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{categoryLabel(resource)}</Badge>
                          {manageActions(resource, true)}
                        </div>
                      </div>
                      {resource.description && (
                        <p className="break-words text-sm text-muted-foreground">{resource.description}</p>
                      )}
                      <p className="break-all text-xs text-primary">{href ?? resource.url}</p>
                      <p className="text-xs text-muted-foreground">Updated {formatDate(resource.updatedAt)}</p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <WorkspaceResourceDialog
        open={dialogOpen}
        onOpenChange={(value) => { if (!saving) setDialogOpen(value); }}
        resource={editing}
        collection={data}
        saving={saving}
        error={dialogError}
        onSubmit={submitResource}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        destructive
        loading={deleting}
        title="Remove this resource?"
        description={pendingDelete
          ? `"${pendingDelete.title}" will be removed from this team workspace. The project template and other teams are not affected.`
          : ""}
        confirmLabel="Remove resource"
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
