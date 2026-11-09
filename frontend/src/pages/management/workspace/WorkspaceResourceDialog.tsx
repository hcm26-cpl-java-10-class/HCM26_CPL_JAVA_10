import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  WorkspaceResource,
  WorkspaceResourceCollection,
  WorkspaceResourceKind,
  WorkspaceResourcePayload,
} from "@/types/features/workspace-resource";
import { AlertCircle, Loader2, Save, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

interface WorkspaceResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: WorkspaceResource | null;
  collection: WorkspaceResourceCollection;
  saving: boolean;
  error?: string | null;
  onSubmit: (payload: WorkspaceResourcePayload, file: File | null) => Promise<void>;
}

const emptyValues = {
  title: "",
  description: "",
  kind: "LINK" as WorkspaceResourceKind,
  url: "",
  category: "",
};

type Values = typeof emptyValues;
type Errors = Partial<Record<"title" | "url" | "file", string>>;

function humanSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${bytes} bytes`;
}

function extensionOf(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
}

/**
 * US-RES-003 / AC01 + AC02 — add or edit a resource of the team workspace.
 * Link and file resources share the same dialog; the file is validated here
 * (extension + size) and again on the server, so an invalid upload never
 * reaches the storage layer.
 */
export function WorkspaceResourceDialog({
  open,
  onOpenChange,
  resource,
  collection,
  saving,
  error,
  onSubmit,
}: WorkspaceResourceDialogProps) {
  const [values, setValues] = useState<Values>(emptyValues);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setValues(resource ? {
      title: resource.title ?? "",
      description: resource.description ?? "",
      kind: resource.kind ?? "LINK",
      url: resource.url ?? "",
      category: resource.category ?? "",
    } : emptyValues);
    setFile(null);
    setErrors({});
    setFileInputKey((key) => key + 1);
  }, [open, resource]);

  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));

  const validate = () => {
    const next: Errors = {};
    if (!values.title.trim()) next.title = "Title is required";
    if (values.kind === "LINK" && !values.url.trim()) next.url = "URL is required for a link resource";
    if (file) {
      const extension = extensionOf(file);
      if (!collection.allowedExtensions.includes(extension)) {
        next.file = `.${extension || "?"} files are not allowed. Allowed: ${collection.allowedExtensions.join(", ")}`;
      } else if (file.size > collection.maxFileBytes) {
        next.file = `File exceeds the ${humanSize(collection.maxFileBytes)} limit`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !validate()) return;
    await onSubmit({
      title: values.title.trim(),
      description: values.description.trim() || null,
      kind: values.kind,
      url: values.kind === "LINK" ? values.url.trim() : null,
      category: values.category.trim() || null,
      orderIndex: resource?.orderIndex ?? null,
    }, file);
  };

  const fileError = errors.file;
  const accepted = collection.allowedExtensions.map((extension) => `.${extension}`).join(",");
  const replaceMode = !!resource && resource.files.length > 0;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent showCloseButton={!saving} className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{resource ? "Edit workspace resource" : "Add workspace resource"}</DialogTitle>
            <DialogDescription>
              Changes apply to this team workspace only. The source template and other teams are not affected.
            </DialogDescription>
          </DialogHeader>

          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid gap-2">
            <Label htmlFor="workspace-resource-title">Title <span className="text-destructive">*</span></Label>
            <Input id="workspace-resource-title" value={values.title} maxLength={255} disabled={saving}
              aria-invalid={!!errors.title}
              onChange={(event) => { set({ title: event.target.value }); setErrors((current) => ({ ...current, title: undefined })); }} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="workspace-resource-kind">Type</Label>
              <Select value={values.kind} disabled={saving}
                onValueChange={(value: WorkspaceResourceKind) => set({ kind: value })}>
                <SelectTrigger id="workspace-resource-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LINK">Link</SelectItem>
                  <SelectItem value="FILE">File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="workspace-resource-category">Category</Label>
              <Input id="workspace-resource-category" value={values.category} maxLength={50} placeholder="Git, Docs, Figma..."
                disabled={saving} onChange={(event) => set({ category: event.target.value })} />
            </div>
          </div>

          {values.kind === "LINK" && (
            <div className="grid gap-2">
              <Label htmlFor="workspace-resource-url">URL <span className="text-destructive">*</span></Label>
              <Input id="workspace-resource-url" value={values.url} maxLength={1000} placeholder="https://"
                disabled={saving} aria-invalid={!!errors.url}
                onChange={(event) => { set({ url: event.target.value }); setErrors((current) => ({ ...current, url: undefined })); }} />
              {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="workspace-resource-description">Description</Label>
            <Textarea id="workspace-resource-description" value={values.description} maxLength={1000} rows={3}
              disabled={saving} onChange={(event) => set({ description: event.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="workspace-resource-file">
              {replaceMode ? "Replace attached file" : "Attach file"}{" "}
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input key={fileInputKey} id="workspace-resource-file" type="file" accept={accepted} disabled={saving}
              aria-invalid={!!fileError}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors((current) => ({ ...current, file: undefined }));
              }} />
            <p className="text-xs text-muted-foreground">
              {replaceMode
                ? "A new file replaces the documents currently attached to this resource. "
                : ""}
              {collection.allowedExtensions.join(", ")} · maximum {humanSize(collection.maxFileBytes)}
            </p>
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : file ? <Upload /> : <Save />}
              {resource ? "Save changes" : "Add resource"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
