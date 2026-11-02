import { templateResourceApi } from "@/api/features/template-resource.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeExternalUrl } from "@/lib/utils";
import type {
  TemplateResource,
  TemplateResourceCollection,
  TemplateResourceFile,
  TemplateResourcePayload,
} from "@/types/features/project-template-resource";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getTemplateError } from "../project-template.utils";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { TemplateResourceDialog } from "./TemplateResourceDialog";

type PendingDelete =
  | { kind: "resource"; resource: TemplateResource }
  | { kind: "file"; resource: TemplateResource; file: TemplateResourceFile };

function humanSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function extensionOf(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
}

/**
 * US-RES-001 — Resources tab of a template version.
 * Add / edit / delete link and file resources, upload and download the
 * attached documents. Read-only versions keep the list visible but hide the
 * mutation controls.
 */
export function TemplateResourcesPanel({ versionId, editable }: { versionId: number; editable: boolean }) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const queryKey = ["project-template-versions", user.email, activeRole, "resources", versionId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => templateResourceApi.getByVersion(versionId, signal),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateResource | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const refresh = async () => {
    await client.invalidateQueries({ queryKey });
  };

  if (query.isLoading) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;

  const collection: TemplateResourceCollection = query.data;
  const canEdit = editable && collection.editable;

  const openCreate = () => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEdit = (resource: TemplateResource) => {
    setEditing(resource);
    setDialogError(null);
    setDialogOpen(true);
  };

  const submitResource = async (payload: TemplateResourcePayload, file: File | null) => {
    if (saving) return;
    setSaving(true);
    setDialogError(null);
    try {
      const saved = editing
        ? await templateResourceApi.update(versionId, editing.id, payload)
        : await templateResourceApi.create(versionId, payload);
      if (file) await templateResourceApi.uploadFile(versionId, saved.id, file);
      await refresh();
      setDialogOpen(false);
      setEditing(null);
      toast.success(editing ? "Template resource updated." : "Template resource added.");
    } catch (error) {
      const result = getTemplateError(error);
      const message = Object.values(result.fields).flat()[0] ?? result.message;
      setDialogError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const attachFile = async (resource: TemplateResource, file: File) => {
    const extension = extensionOf(file);
    if (!collection.allowedExtensions.includes(extension)) {
      toast.error(`.${extension || "?"} files are not allowed. Allowed: ${collection.allowedExtensions.join(", ")}`);
      return;
    }
    if (file.size > collection.maxFileBytes) {
      toast.error(`File exceeds the ${humanSize(collection.maxFileBytes)} limit`);
      return;
    }
    setUploadingId(resource.id);
    try {
      await templateResourceApi.uploadFile(versionId, resource.id, file);
      await refresh();
      toast.success(`File "${file.name}" attached.`);
    } catch (error) {
      const result = getTemplateError(error);
      toast.error(Object.values(result.fields).flat()[0] ?? result.message);
    } finally {
      setUploadingId(null);
    }
  };

  const downloadFile = async (file: TemplateResourceFile) => {
    try {
      const blob = await templateResourceApi.downloadFile(versionId, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getTemplateError(error).message);
    }
  };

  const confirmDelete = async () => {
    if (!pending || deleting) return;
    setDeleting(true);
    try {
      if (pending.kind === "resource") {
        await templateResourceApi.remove(versionId, pending.resource.id);
        toast.success("Template resource removed.");
      } else {
        await templateResourceApi.deleteFile(versionId, pending.file.id);
        toast.success("Attached file removed.");
      }
      await refresh();
      setPending(null);
    } catch (error) {
      const result = getTemplateError(error);
      toast.error(Object.values(result.fields).flat()[0] ?? result.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="grid min-w-0 gap-4" aria-label="Template resources">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><FolderOpen className="size-5" />Resources</CardTitle>
              <CardDescription className="mt-2">
                Links and documents every team inherits when this version is assigned. Changing them only affects future assignments.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{collection.items.length} {collection.items.length === 1 ? "resource" : "resources"}</Badge>
              {canEdit && <Button onClick={openCreate}><Plus />Add resource</Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!canEdit && (
            <Alert>
              <Info />
              <AlertDescription>
                This version is read-only. Create a new draft version to change its resource list.
              </AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">
            Allowed uploads: {collection.allowedExtensions.join(", ")} · maximum {humanSize(collection.maxFileBytes)} per file.
          </p>
        </CardContent>
      </Card>

      {!collection.items.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No template resources yet.{canEdit ? " Add a link or upload a document to get started." : ""}
        </p>
      ) : (
        <ul className="grid gap-3">
          {collection.items.map((resource) => (
            <li key={resource.id}>
              <Card className="min-w-0">
                <CardContent className="grid gap-3 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {resource.kind === "LINK"
                          ? <Link2 className="size-4 text-muted-foreground" />
                          : <FileText className="size-4 text-muted-foreground" />}
                        <span className="break-words font-medium">{resource.title}</span>
                        <Badge variant="secondary" className="text-[11px]">{resource.kind}</Badge>
                        {resource.category && <Badge variant="outline" className="text-[11px]">{resource.category}</Badge>}
                      </div>
                      {resource.description && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{resource.description}</p>
                      )}
                      {resource.kind === "LINK" && normalizeExternalUrl(resource.url) && (
                        <a href={normalizeExternalUrl(resource.url)} target="_blank" rel="noreferrer noopener"
                          className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm text-primary hover:underline">
                          <ExternalLink className="size-3.5 shrink-0" />{normalizeExternalUrl(resource.url)}
                        </a>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-1">
                        <input ref={(element) => { fileInputs.current[resource.id] = element; }} type="file" hidden
                          accept={collection.allowedExtensions.map((extension) => `.${extension}`).join(",")}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void attachFile(resource, file);
                          }} />
                        <Button variant="outline" size="sm" disabled={uploadingId === resource.id}
                          onClick={() => fileInputs.current[resource.id]?.click()}>
                          {uploadingId === resource.id ? <Loader2 className="animate-spin" /> : <Paperclip />}Attach file
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(resource)}><Pen />Edit</Button>
                        <Button variant="outline" size="sm" className="text-destructive"
                          onClick={() => setPending({ kind: "resource", resource })}><Trash2 />Delete</Button>
                      </div>
                    )}
                  </div>

                  {!!resource.files.length && (
                    <ul className="divide-y rounded-lg border">
                      {resource.files.map((file) => (
                        <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{file.originalName}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{humanSize(file.sizeBytes)}</span>
                          </span>
                          <span className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => void downloadFile(file)}>
                              <Download />Download
                            </Button>
                            {canEdit && (
                              <Button variant="ghost" size="sm" className="text-destructive"
                                onClick={() => setPending({ kind: "file", resource, file })}>
                                <X />Remove
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <TemplateResourceDialog open={dialogOpen} onOpenChange={(value) => { if (!saving) setDialogOpen(value); }}
        resource={editing} collection={collection} saving={saving} error={dialogError} onSubmit={submitResource} />

      <ConfirmDialog
        open={!!pending}
        destructive
        loading={deleting}
        title={pending?.kind === "resource" ? "Delete this template resource?" : "Remove this attached file?"}
        description={pending?.kind === "resource"
          ? `"${pending.resource.title}" and its attached files will be removed from this version. Existing projects keep their own copy.`
          : `"${pending?.file.originalName}" will be removed from this version. Existing projects keep their own copy.`}
        confirmLabel={pending?.kind === "resource" ? "Delete resource" : "Remove file"}
        onCancel={() => { if (!deleting) setPending(null); }}
        onConfirm={() => void confirmDelete()} />
    </section>
  );
}
