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
  Clock3,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Info,
  LayoutGrid,
  Link2,
  Loader2,
  Paperclip,
  Pen,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
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

const STAT_TONES = {
  blue: {
    overlay: "from-blue-500/10 via-transparent to-transparent dark:from-blue-500/15",
    icon: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300",
  },
  emerald: {
    overlay: "from-emerald-500/10 via-transparent to-transparent dark:from-emerald-500/15",
    icon: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  sky: {
    overlay: "from-sky-500/10 via-transparent to-transparent dark:from-sky-500/15",
    icon: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
  },
  amber: {
    overlay: "from-amber-500/10 via-transparent to-transparent dark:from-amber-500/15",
    icon: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
  },
} as const;

function ResourceStat({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: keyof typeof STAT_TONES;
  hint?: string;
}) {
  const palette = STAT_TONES[tone];
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${palette.overlay}`}
      />
      <div className="relative flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${palette.icon}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xl font-semibold leading-none tracking-tight tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
      </div>
      {hint && <p className="relative mt-3 truncate text-[11px] text-muted-foreground" title={hint}>{hint}</p>}
    </div>
  );
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
  const expectedProjectId = selectedProjectId ?? projectId ?? null;
  if (!data || data.workspaceId !== workspaceId || data.teamId !== teamId
    || (data.projectId ?? null) !== expectedProjectId) {
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
  // One card per project: resources copied from a project template and resources
  // added directly in the workspace are listed together, without telling them apart.
  const groups = new Map<number, WorkspaceResource[]>();
  for (const item of visibleItems) {
    const group = groups.get(item.projectId) ?? [];
    group.push(item);
    groups.set(item.projectId, group);
  }
  // The workspace's own project comes first; module (sub-project) groups follow by id.
  const sortedGroups = [...groups.entries()].sort(([firstId], [secondId]) =>
    Number(secondId !== data.projectId) - Number(firstId !== data.projectId) || firstId - secondId);
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
      <div className="flex flex-wrap items-center gap-1">
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
        <Button variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-[11px]"
          disabled={uploadingId === resource.id}
          onClick={() => fileInputs.current[resource.id]?.click()}>
          {uploadingId === resource.id ? <Loader2 className="animate-spin" /> : <Paperclip />}
          {compact ? (resource.files.length ? "Replace" : "Attach") : (resource.files.length ? "Replace file" : "Attach file")}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-[11px]"
          onClick={() => openEdit(resource)}><Pen />Edit</Button>
        <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setPendingDelete(resource)}><Trash2 />Delete</Button>
      </div>
    );
  };

  const filterOptions = [
    { id: "ALL" as const, label: "All", count: data.items.length, icon: LayoutGrid },
    { id: "FILE" as const, label: "Documents", count: documentCount, icon: FileText },
    { id: "LINK" as const, label: "Links", count: linkCount, icon: Link2 },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-28 size-72 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15" />
          <div className="absolute -bottom-32 -left-24 size-72 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/10" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent dark:from-primary/[0.06]" />
        </div>
        <div className="relative flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/25">
              <BookOpen className="size-6" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold leading-tight tracking-tight">Project resources</h2>
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-blue-200 bg-blue-50 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                >
                  <Sparkles className="size-3" />
                  Resource hub
                </Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Documents, repositories and reference links shared with your team for this project.
              </p>
              {!noProject && !empty && lastUpdated && (
                <p className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">
                  <Clock3 className="size-3 shrink-0" />
                  <span className="truncate">Last updated {formatDate(lastUpdated)}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <Button onClick={openCreate} className="gap-2 rounded-full px-4 shadow-sm">
                <Plus />
                Add resource
              </Button>
            )}
            <Button variant="outline" className="gap-2 rounded-full bg-background/70 backdrop-blur" disabled={query.isFetching} onClick={() => void query.refetch()}>
              <RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
              {query.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
        {canManage && (
          <div className="relative flex flex-wrap items-center gap-2 border-t border-border/60 bg-muted/20 px-5 py-3 text-xs text-muted-foreground sm:px-6">
            <Info className="size-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
            <span className="min-w-0 flex-1">
              Changes apply to this team workspace only — the project template and other teams stay unchanged.
            </span>
            <Badge variant="outline" className="rounded-full bg-background/60">Allowed: {data.allowedExtensions.join(", ")}</Badge>
            <Badge variant="outline" className="rounded-full bg-background/60">Max {humanSize(data.maxFileBytes)}</Badge>
          </div>
        )}
      </section>

      {!noProject && !empty && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ResourceStat icon={FolderOpen} label="Resources" value={data.items.length} tone="blue" hint="All items shared with this project" />
          <ResourceStat icon={FileText} label="Documents" value={documentCount} tone="emerald" hint="Resource entries that hold files" />
          <ResourceStat icon={Link2} label="Links" value={linkCount} tone="sky" hint="External repositories and references" />
          <ResourceStat icon={Paperclip} label="Files" value={fileCount} tone="amber" hint="Downloadable attachments" />
        </div>
      )}

      {noProject ? (
        <Card className="border-dashed bg-muted/20 shadow-none">
          <CardContent>
            <WorkspaceEmptyState
              icon={BookOpen}
              title="No project linked yet"
              description="This workspace has no project, so no learning resources are available."
            />
          </CardContent>
        </Card>
      ) : empty ? (
        <Card className="border-dashed bg-muted/20 shadow-none">
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
          <div className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-xl border-border/70 bg-background pl-10 pr-10"
                placeholder="Search by title, link or file name"
                aria-label="Search resources"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                {visibleItems.length} of {data.items.length} shown
              </span>
              <div className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1" role="group" aria-label="Filter resources by type">
                {filterOptions.map((option) => {
                  const OptionIcon = option.icon;
                  const active = kindFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setKindFilter(option.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      }`}
                    >
                      <OptionIcon className={`size-3.5 ${active ? "text-blue-500 dark:text-blue-400" : ""}`} />
                      {option.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                          active
                            ? "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {visibleItems.length === 0 ? (
            <Card className="border-dashed bg-muted/20 shadow-none">
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
              {sortedGroups.map(([groupId, group]) => {
                const label = groupId === data.projectId ? "Project resources" : "Module resources";
                const name = group[0].sourceName;
                return <Card key={groupId} className="gap-0 overflow-hidden border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md">
                  <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/50 via-muted/20 to-transparent px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
                          <FolderOpen className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <CardTitle className="text-base">{label}</CardTitle>
                          {name && <p className="mt-0.5 truncate text-xs text-muted-foreground">{name}</p>}
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full bg-background/70 tabular-nums">
                        {group.length} {group.length === 1 ? "resource" : "resources"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid items-stretch gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
                    {group.map(resource => {
                      const href = resource.kind === "LINK" ? normalizeExternalUrl(resource.url) : null;
                      const isLink = resource.kind === "LINK";
                      return <article
                        key={resource.id}
                        className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 dark:hover:border-blue-400/30"
                      >
                        <div aria-hidden className={`h-1 w-full bg-gradient-to-r ${isLink ? "from-sky-400 to-cyan-500" : "from-emerald-400 to-teal-500"}`} />
                        <div className="flex flex-1 flex-col gap-3 p-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
                              isLink
                                ? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300"
                                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
                            }`}>
                              {isLink ? <Link2 className="size-5" /> : <FileText className="size-5" />}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                                {href ? (
                                  <a href={href} target="_blank" rel="noopener noreferrer"
                                    className="min-w-0 break-words font-semibold leading-snug transition-colors hover:text-blue-600 dark:hover:text-blue-400">
                                    {resource.title}
                                  </a>
                                ) : (
                                  <p className="min-w-0 break-words font-semibold leading-snug">{resource.title}</p>
                                )}
                                <Badge variant="outline" className={`rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                                  isLink
                                    ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:text-sky-300"
                                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300"
                                }`}>
                                  {isLink ? "Link" : "Document"}
                                </Badge>
                              </div>
                              {resource.description && (
                                <p className="break-words text-xs leading-5 text-muted-foreground">{resource.description}</p>
                              )}
                              {href && (
                                <a href={href} target="_blank" rel="noopener noreferrer" title={href}
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/5 px-2 py-1 text-xs text-sky-700 transition-colors hover:bg-sky-500/10 dark:border-sky-400/20 dark:text-sky-300">
                                  <ExternalLink className="size-3 shrink-0" />
                                  <span className="truncate">{href}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {resource.files.length > 0 ? (
                            <ul className="divide-y overflow-hidden rounded-xl border bg-muted/20">
                              {resource.files.map(file => (
                                <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs transition-colors hover:bg-background/60">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                                      <FileText className="size-3.5" />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium" title={file.fileName}>{file.fileName}</span>
                                      <span className="block text-[10px] text-muted-foreground">{humanSize(file.sizeBytes)}</span>
                                    </span>
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-[11px]" disabled={downloading === file.id}
                                      onClick={() => void download(resource, file)}>
                                      {downloading === file.id
                                        ? <Loader2 className="size-3.5 animate-spin" />
                                        : <Download className="size-3.5" />}
                                      Download
                                    </Button>
                                    {resource.canManage && (
                                      <Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                            <p className="flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                              <Paperclip className="size-3.5 shrink-0" />
                              No file attached yet.
                            </p>
                          )}

                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                            <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock3 className="size-3" />
                              Updated {formatDate(resource.updatedAt)}
                            </p>
                            {manageActions(resource, resource.kind === "LINK")}
                          </div>
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
