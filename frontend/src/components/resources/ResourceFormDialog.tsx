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
import { AlertCircle, Loader2, Save, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";

export type ResourceDialogKind = "LINK" | "FILE";

/** Fields the dialog needs from a resource; both template and workspace resources satisfy it. */
export interface ResourceDialogResource {
  title?: string | null;
  description?: string | null;
  kind?: ResourceDialogKind | null;
  url?: string | null;
  orderIndex?: number | null;
}

export interface ResourceDialogCollection {
  allowedExtensions: string[];
  maxFileBytes: number;
}

export interface ResourceDialogPayload {
  title: string;
  description: string | null;
  kind: ResourceDialogKind;
  url: string | null;
  orderIndex: number | null;
}

export interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefix for the input ids so dialogs on different screens never collide. */
  idPrefix: string;
  modalTitle: string;
  modalDescription: string;
  submitLabel: string;
  saving: boolean;
  error?: string | null;
  resource: ResourceDialogResource | null;
  collection: ResourceDialogCollection;
  onSubmit: (payload: ResourceDialogPayload, file: File | null) => Promise<void>;
}

type Values = {
  title: string;
  description: string;
  kind: ResourceDialogKind;
  url: string;
};

type Errors = Partial<Record<"title" | "url" | "file", string>>;

function humanSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${bytes} bytes`;
}

function extensionOf(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
}

/**
 * Shared "add / edit resource" dialog used by the project template resources tab
 * and the workspace resources tab, so the two screens never drift apart.
 * The file is validated here (extension + size) and again on the server.
 */
export function ResourceFormDialog(props: ResourceFormDialogProps) {
  // Mounting only while open resets the form for every create / edit session.
  return props.open ? <ResourceForm key={props.resource ? "edit" : "create"} {...props} /> : null;
}

function ResourceForm({
  onOpenChange,
  idPrefix,
  modalTitle,
  modalDescription,
  submitLabel,
  saving,
  error,
  resource,
  collection,
  onSubmit,
}: ResourceFormDialogProps) {
  const [values, setValues] = useState<Values>(() => ({
    title: resource?.title ?? "",
    description: resource?.description ?? "",
    kind: resource?.kind ?? "LINK",
    url: resource?.url ?? "",
  }));
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});

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
      orderIndex: resource?.orderIndex ?? null,
    }, file);
  };

  const accepted = collection.allowedExtensions.map((extension) => `.${extension}`).join(",");

  return (
    <Dialog open onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent showCloseButton={!saving} className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>{modalDescription}</DialogDescription>
          </DialogHeader>

          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-title`}>Title <span className="text-destructive">*</span></Label>
            <Input id={`${idPrefix}-title`} value={values.title} maxLength={255} disabled={saving}
              aria-invalid={!!errors.title}
              onChange={(event) => { set({ title: event.target.value }); setErrors((current) => ({ ...current, title: undefined })); }} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-kind`}>Type</Label>
            <Select value={values.kind} disabled={saving}
              onValueChange={(value: ResourceDialogKind) => set({ kind: value })}>
              <SelectTrigger id={`${idPrefix}-kind`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LINK">Link</SelectItem>
                <SelectItem value="FILE">File</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.kind === "LINK" && (
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-url`}>URL <span className="text-destructive">*</span></Label>
              <Input id={`${idPrefix}-url`} value={values.url} maxLength={1000} placeholder="https://"
                disabled={saving} aria-invalid={!!errors.url}
                onChange={(event) => { set({ url: event.target.value }); setErrors((current) => ({ ...current, url: undefined })); }} />
              {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-description`}>Description</Label>
            <Textarea id={`${idPrefix}-description`} value={values.description} maxLength={1000} rows={3}
              disabled={saving} onChange={(event) => set({ description: event.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-file`}>
              Attach file <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id={`${idPrefix}-file`} type="file" accept={accepted} disabled={saving}
              aria-invalid={!!errors.file}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors((current) => ({ ...current, file: undefined }));
              }} />
            <p className="text-xs text-muted-foreground">
              {collection.allowedExtensions.join(", ")} · maximum {humanSize(collection.maxFileBytes)}
            </p>
            {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : file ? <Upload /> : <Save />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
