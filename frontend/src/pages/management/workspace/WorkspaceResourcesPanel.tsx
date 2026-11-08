import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Info,
  Link2,
  Loader2,
  Paperclip,
  Pen,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeExternalUrl } from "@/lib/utils";
import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import { WorkspaceEmptyState, getWorkspaceError } from "./workspace.shared";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";

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

/**
 * Resources tab of a workspace (`/management/workspaces/:id?tab=resources`).
 * Trainees can browse the documents and external links their team received
 * with the project brief and download the documents through signed URLs.
 */
export function WorkspaceResourcesPanel({
  workspaceId,
  projectId,
  selectedProjectId,
  teamId,
  onAccessChanged,
}: {
  workspaceId: number;
  projectId?: number | null;
  selectedProjectId?: number | null;
  teamId: number;
  onAccessChanged: () => void;
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
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "FILE" | "LINK">("ALL");
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});
  const query = useQuery({
    queryKey: ["workspace-resources", workspaceId, user.email, activeRole, selectedProjectId],
    queryFn: ({ signal }) => workspaceApi.resources(workspaceId, signal, selectedProjectId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const denied = sectionForbidden(query.error);
  useEffect(() => {
    if (denied) onAccessChanged();
  }, [denied, onAccessChanged]);

  // Keep loaded resources (and any open editor) mounted during background
  // refetches, so returning to a browser tab does not flash the Overview.
  // Initial loading and access errors still replace the content immediately.
  if (denied || query.isError || query.isPending) {
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

  const normalizedSearch = search.trim().toLowerCase();
  const visibleItems = data.items.filter((item) => {
    if (kindFilter !== "ALL" && item.kind !== kindFilter) return false;
    if (!normalizedSearch) return true;
    return [item.title, item.description, item.url, ...item.files.map((file) => file.fileName)]
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  const groups = new Map<string, WorkspaceResource[]>();
  for (const item of visibleItems) {
    const key = `${item.origin}:${item.sourceTemplateId ?? item.projectId}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const sortedGroups = [...groups.values()].sort((first, second) =>
    Number(second[0].origin === "PARENT") - Number(first[0].origin === "PARENT"));
  const empty = data.items.length === 0;
  const fileCount = data.items.reduce((total, item) => total + item.files.length, 0);
  const linkCount = data.items.filter((item) => item.kind === "LINK").length;
  const documentCount = data.items.length - linkCount;
  const updatedTimestamps = data.items
    .map((item) => item.updatedAt)
    .filter((value): value is string => !!value)
    .sort();
  const lastUpdated = updatedTimestamps.length
    ? updatedTimestamps[updatedTimestamps.length - 1]
    : null;
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
      const { blob, fileName } = await workspaceApi.downloadResource(workspaceId, resource.id, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloading ${fileName}`);
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
        : await workspaceApi.createResource(workspaceId, payload, selectedProjectId);
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
    if (!resource.canManage) return null;
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

  const filterOptions = [
    { id: "ALL" as const, label: "All", count: data.items.length },
    { id: "FILE" as const, label: "Documents", count: documentCount },
    { id: "LINK" as const, label: "Links", count: linkCount },
  ];

  return (
    <div className="space-y-5">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-muted/30 px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-lg font-semibold leading-tight">Project resources</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Documents, repositories and reference links shared with your team for this project.
              </p>
              {!noProject && !empty && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="size-3.5" />{data.items.length} {data.items.length === 1 ? "resource" : "resources"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3.5" />{documentCount} {documentCount === 1 ? "document" : "documents"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="size-3.5" />{linkCount} {linkCount === 1 ? "link" : "links"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3.5" />{fileCount} {fileCount === 1 ? "file" : "files"}
                  </span>
                  {lastUpdated && <span>Updated {formatDate(lastUpdated)}</span>}
                </div>
              )}
            </div>
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
              {query.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              Changes apply to this team workspace only — the project template and other teams stay unchanged.
            </span>
            <Badge variant="outline">Allowed: {data.allowedExtensions.join(", ")}</Badge>
            <Badge variant="outline">Max {humanSize(data.maxFileBytes)}</Badge>
          </div>
        )}
      </Card>

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
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by title, link or file name"
                aria-label="Search resources"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1" role="group" aria-label="Filter resources by type">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={kindFilter === option.id}
                  onClick={() => setKindFilter(option.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    kindFilter === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <Card>
              <CardContent>
                <WorkspaceEmptyState
                  icon={Search}
                  title="No matching resources"
                  description="Try a different keyword or switch the filter back to all resource types."
                  action={
                    <Button variant="outline" onClick={() => { setSearch(""); setKindFilter("ALL"); }}>
                      Clear filters
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4" aria-busy={query.isFetching}>
              {sortedGroups.map(group => {
                const source = group[0];
                const label = source.origin === "PARENT" ? "Master resources"
                  : source.origin === "SUB_PROJECT" ? "Module resources" : "Project resources";
                return <Card key={`${source.origin}:${source.sourceTemplateId ?? source.projectId}`}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <FolderOpen className="size-4 text-primary" />
                        {label}
                        {source.sourceName && (
                          <span className="text-sm font-normal text-muted-foreground">· {source.sourceName}</span>
                        )}
                      </CardTitle>
                      <Badge variant="secondary" className="tabular-nums">
                        {group.length} {group.length === 1 ? "resource" : "resources"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid items-stretch gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {group.map(resource => {
                      const href = resource.kind === "LINK" ? normalizeExternalUrl(resource.url) : null;
                      const isLink = resource.kind === "LINK";
                      return <article
                        key={resource.id}
                        className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                            isLink
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {isLink ? <Link2 className="size-4" /> : <FileText className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer"
                                  className="min-w-0 break-words font-medium hover:underline">
                                  {resource.title}
                                </a>
                              ) : (
                                <p className="min-w-0 break-words font-medium">{resource.title}</p>
                              )}
                              <Badge variant="outline">{resource.kind}</Badge>
                            </div>
                            {resource.description && (
                              <p className="break-words text-xs leading-5 text-muted-foreground">{resource.description}</p>
                            )}
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer"
                                className="inline-flex min-w-0 items-center gap-1 break-all text-xs text-primary hover:underline">
                                <ExternalLink className="size-3 shrink-0" />{href}
                              </a>
                            )}
                          </div>
                        </div>

                        {resource.files.length > 0 ? (
                          <ul className="divide-y rounded-lg border bg-muted/20">
                            {resource.files.map(file => (
                              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                                <span className="flex min-w-0 items-center gap-2">
                                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate font-medium">{file.fileName}</span>
                                  <span className="shrink-0 text-muted-foreground">{humanSize(file.sizeBytes)}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" disabled={downloading === file.id}
                                    onClick={() => void download(resource, file)}>
                                    {downloading === file.id
                                      ? <Loader2 className="size-3.5 animate-spin" />
                                      : <Download className="size-3.5" />}
                                    Download
                                  </Button>
                                  {resource.canManage && (
                                    <Button variant="ghost" size="sm" className="text-destructive"
                                      onClick={() => void removeFile(resource, file)}>
                                      <X className="size-3.5" />
                                      Remove
                                    </Button>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : !isLink && (
                          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            No file attached yet.
                          </p>
                        )}

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                          <p className="text-[11px] text-muted-foreground">Updated {formatDate(resource.updatedAt)}</p>
                          {manageActions(resource, resource.kind === "LINK")}
                        </div>
                      </article>;
                    })}
                  </CardContent>
                </Card>;
              })}
            </div>
          )}
        </>
      )}

      <ResourceFormDialog
        open={dialogOpen}
        onOpenChange={(value) => { if (!saving) setDialogOpen(value); }}
        idPrefix="workspace-resource"
        modalTitle={editing ? "Edit workspace resource" : "Add workspace resource"}
        modalDescription="Resources are shared with the team in this workspace. Files are downloaded through short-lived links."
        submitLabel={editing ? "Save changes" : "Add resource"}
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
