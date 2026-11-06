import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import type {
  ResourceKind,
  TemplateResource,
  TemplateResourceCollection,
  TemplateResourcePayload,
} from "@/types/features/project-template-resource";
import { Save, Upload } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

interface TemplateResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: TemplateResource | null;
  collection: TemplateResourceCollection;
  saving: boolean;
  error?: string | null;
  onSubmit: (payload: TemplateResourcePayload, file: File | null) => Promise<void>;
}

const emptyValues = {
  title: "",
  description: "",
  kind: "LINK" as ResourceKind,
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
 * US-RES-001 / AC01 + AC03 — add or edit a template resource.
 * Link and file resources share the same dialog; the file is validated here
 * (extension + size) and again on the server, so an invalid upload never
 * reaches the storage layer.
 */
export function TemplateResourceDialog({
  open,
  onOpenChange,
  resource,
  collection,
  saving,
  error,
  onSubmit,
}: TemplateResourceDialogProps) {
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

  const set = (patch: Partial<Values>) => {
    setValues((current) => ({ ...current, ...patch }));
    if (patch.title !== undefined) setErrors((current) => ({ ...current, title: undefined }));
    if (patch.url !== undefined) setErrors((current) => ({ ...current, url: undefined }));
  };

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

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      idPrefix="template-resource"
      locale="en"
      modalTitle={resource ? "Edit template resource" : "Add template resource"}
      modalDescription="Resources are attached to this template version. Existing projects keep the resources they were assigned with."
      saving={saving}
      error={error}
      submitLabel={resource ? "Save changes" : "Add resource"}
      submitIcon={file ? Upload : Save}
      values={values}
      errors={errors}
      collection={collection}
      maxFileSizeLabel={humanSize(collection.maxFileBytes)}
      fileResetKey={fileInputKey}
      onChange={set}
      onFileChange={(next) => {
        setFile(next);
        setErrors((current) => ({ ...current, file: undefined }));
      }}
      onSubmit={(event) => void submit(event)}
    />
  );
}
