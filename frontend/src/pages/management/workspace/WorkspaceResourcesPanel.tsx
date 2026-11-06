import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
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
import { cn, normalizeExternalUrl } from "@/lib/utils";
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
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Short label for a link, so a long URL does not dominate the card. */
function linkHost(href: string) {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
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
    // Picking a file in the OS dialog moves focus away from the window; the
    // focus refetch would otherwise re-render (and reset) the resource dialog.
    refetchOnWindowFocus: false,
  });

  const denied = sectionForbidden(query.error);
  useEffect(() => {
    if (denied) onAccessChanged();
  }, [denied, onAccessChanged]);

  // Only the first load may replace the panel with a loading state. A background
  // refetch must keep the panel (and therefore the open resource dialog with its
  // typed values and selected file) mounted.
  if (denied || !query.data) {
    return (
      <WorkspaceSectionState
        loading={!denied && !query.isError}
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
    return [item.title, item.description, item.category, item.url, ...item.files.map((file) => file.fileName)]
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

  const manageActions = (resource: WorkspaceResource) => {
    if (!resource.canManage) return null;
    const uploading = uploadingId === resource.id;
    const hasFile = resource.files.length > 0;
    const attachLabel = hasFile ? "Replace file" : "Attach file";
    return (
      <div className="flex shrink-0 items-center">
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
        <Button variant="ghost" size="icon-sm" disabled={uploading} title={attachLabel}
          aria-label={`${attachLabel}: ${resource.title}`}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => fileInputs.current[resource.id]?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
        </Button>
        <Button variant="ghost" size="icon-sm" title="Edit" aria-label={`Edit ${resource.title}`}
          className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(resource)}>
          <Pen />
        </Button>
        <Button variant="ghost" size="icon-sm" title="Delete" aria-label={`Delete ${resource.title}`}
          className="text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete(resource)}>
          <Trash2 />
        </Button>
      </div>
    );
  };

  const filterOptions = [
    { id: "ALL" as const, label: "All", count: data.items.length },
    { id: "FILE" as const, label: "Documents", count: documentCount },
    { id: "LINK" as const, label: "Links", count: linkCount },
  ];

  const stats = [
    `${data.items.length} ${data.items.length === 1 ? "resource" : "resources"}`,
    `${documentCount} ${documentCount === 1 ? "document" : "documents"}`,
    `${linkCount} ${linkCount === 1 ? "link" : "links"}`,
    `${fileCount} ${fileCount === 1 ? "file" : "files"}`,
    ...(lastUpdated ? [`Updated ${formatDate(lastUpdated)}`] : []),
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-xl border bg-card px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold leading-6">
                Project resources
                {!noProject && !empty && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums leading-4 text-muted-foreground">
                    {data.items.length}
                  </span>
                )}
              </h2>
              <p className="text-xs leading-5 text-muted-foreground">
                Documents, repositories and reference links shared with your team for this project.
              </p>
              {!noProject && !empty && (
                <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-5 text-muted-foreground">
                  {stats.map((item, index) => (
                    <span key={item} className="inline-flex items-center gap-1.5">
                      {index > 0 && <span aria-hidden className="opacity-50">·</span>}
                      {item}
                    </span>
                  ))}
                </p>
              )}
              {canManage && (
                <p className="truncate text-[11px] leading-5 text-muted-foreground/80"
                  title={`Changes apply to this team workspace only — the project template and other teams stay unchanged. Allowed: ${data.allowedExtensions.join(", ")} · max ${humanSize(data.maxFileBytes)} per file`}>
                  Workspace-only · {data.allowedExtensions.join(", ")} · max {humanSize(data.maxFileBytes)}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground"
              title="Refresh" aria-label="Refresh resources" disabled={query.isFetching}
              onClick={() => void query.refetch()}>
              <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
            </Button>
            {canManage && (
              <Button size="sm" onClick={openCreate}>
                <Plus />
                Add resource
              </Button>
            )}
          </div>
        </div>
      </section>

      {noProject ? (
        <div className="rounded-xl border bg-card">
          <WorkspaceEmptyState
            icon={BookOpen}
            title="No project linked yet"
            description="This workspace has no project, so no learning resources are available."
          />
        </div>
      ) : empty ? (
        <div className="rounded-xl border bg-card">
          <WorkspaceEmptyState
            icon={FolderOpen}
            title="No resources yet"
            description={canManage
              ? "Add a link or upload a document so your team has everything it needs for this project."
              : "Your mentor has not shared any documents or links for this project. Check back after the project brief is assigned."}
            action={canManage ? <Button onClick={openCreate}><Plus />Add resource</Button> : undefined}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 rounded-lg pl-9 text-sm"
                placeholder="Search title, link or file name"
                aria-label="Search resources"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Filter resources by type">
              {filterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={kindFilter === option.id}
                  onClick={() => setKindFilter(option.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    kindFilter === option.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                  <span className="text-[10px] font-semibold tabular-nums opacity-60">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <div className="rounded-xl border bg-card">
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
            </div>
          ) : (
            <div className="space-y-4" aria-busy={query.isFetching}>
              {sortedGroups.map(group => {
                const source = group[0];
                const label = source.origin === "PARENT" ? "Master resources"
                  : source.origin === "SUB_PROJECT" ? "Module resources" : "Project resources";
                return <section key={`${source.origin}:${source.sourceTemplateId ?? source.projectId}`} className="space-y-2">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                      <h3 className="truncate text-sm font-semibold leading-5">{label}</h3>
                      {source.sourceName && (
                        <span className="truncate text-xs text-muted-foreground">· {source.sourceName}</span>
                      )}
                    </div>
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {group.length} {group.length === 1 ? "resource" : "resources"}
                    </span>
                  </header>
                  <div className="grid items-stretch gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                    {group.map(resource => {
                      const href = resource.kind === "LINK" ? normalizeExternalUrl(resource.url) : null;
                      const isLink = resource.kind === "LINK";
                      return <article
                        key={resource.id}
                        className="flex min-w-0 flex-col rounded-xl border bg-card transition-colors hover:border-primary/40 hover:shadow-sm"
                      >
                        <div className="flex min-w-0 items-start gap-2.5 p-3">
                          <span className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            isLink
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          )}>
                            {isLink ? <Link2 className="size-4" /> : <FileText className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer"
                                  title={resource.title}
                                  className="truncate text-sm font-medium leading-5 hover:underline">
                                  {resource.title}
                                </a>
                              ) : (
                                <p title={resource.title} className="truncate text-sm font-medium leading-5">{resource.title}</p>
                              )}
                              <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-4 text-muted-foreground">
                                {categoryLabel(resource)}
                              </span>
                            </div>
                            {resource.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{resource.description}</p>
                            )}
                            {href && (
                              <a href={href} target="_blank" rel="noopener noreferrer" title={href}
                                className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] leading-4 text-primary hover:underline">
                                <ExternalLink className="size-3 shrink-0" />
                                <span className="truncate">{linkHost(href)}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {resource.files.length > 0 ? (
                          <ul className="mx-3 mb-2.5 divide-y overflow-hidden rounded-lg border bg-muted/20 text-xs">
                            {resource.files.map(file => (
                              <li key={file.id} className="flex items-center gap-2 px-2.5 py-1.5">
                                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate font-medium" title={file.fileName}>{file.fileName}</span>
                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{humanSize(file.sizeBytes)}</span>
                                <span className="flex shrink-0 items-center">
                                  <Button variant="ghost" size="icon-sm" title="Download"
                                    aria-label={`Download ${file.fileName}`} disabled={downloading === file.id}
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() => void download(resource, file)}>
                                    {downloading === file.id
                                      ? <Loader2 className="animate-spin" />
                                      : <Download />}
                                  </Button>
                                  {resource.canManage && (
                                    <Button variant="ghost" size="icon-sm" title="Remove file"
                                      aria-label={`Remove ${file.fileName}`}
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() => void removeFile(resource, file)}>
                                      <X />
                                    </Button>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : !isLink ? (
                          <p className="mx-3 mb-2.5 rounded-lg border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground">
                            No file attached yet.
                          </p>
                        ) : null}

                        <div className="mt-auto flex items-center justify-between gap-2 border-t px-3 py-1">
                          <p className="truncate text-[10px] text-muted-foreground">Updated {formatDate(resource.updatedAt)}</p>
                          {manageActions(resource)}
                        </div>
                      </article>;
                    })}
                  </div>
                </section>;
              })}
            </div>
          )}
        </>
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
