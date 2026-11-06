import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";
import { ResourceFormDialog } from "@/components/resources/ResourceFormDialog";
import { normalizeExternalUrl } from "@/lib/utils";
import type { WorkspaceResource, WorkspaceResourceCollection, WorkspaceResourceKind, WorkspaceResourcePayload } from "@/types/features/workspace-resource";

interface WorkspaceResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: WorkspaceResource | null;
  collection: WorkspaceResourceCollection;
  saving: boolean;
  error?: string | null;
  initialKind?: WorkspaceResourceKind;
  onSubmit: (payload: WorkspaceResourcePayload, file: File | null) => Promise<void>;
}

type Values = {
  title: string;
  description: string;
  kind: WorkspaceResourceKind;
  url: string;
  category: string;
};
type Errors = Partial<Record<"title" | "url" | "file", string>>;

function humanSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
  return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
}

function webUrl(raw: string) {
  try {
    const url = new URL(normalizeExternalUrl(raw) ?? "");
    if (["https:", "http:"].includes(url.protocol) && url.hostname && !url.username && !url.password) return url.href;
  } catch { /* The form reports invalid URLs without opening them. */ }
}

export function WorkspaceResourceDialog(props: WorkspaceResourceDialogProps) {
  return props.open ? <WorkspaceResourceForm key={props.resource?.id ?? "new"} {...props} /> : null;
}

function WorkspaceResourceForm({ open, onOpenChange, resource, collection, saving, error, onSubmit, initialKind = "LINK" }: WorkspaceResourceDialogProps) {
  const [values, setValues] = useState(() => ({
    title: resource?.title ?? "", description: resource?.description ?? "", kind: resource?.kind ?? initialKind,
    url: resource?.url ?? "", category: resource ? resource.category ?? "" : "Docs",
  }));
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const replaceMode = !!resource?.files.length;
  const set = (patch: Partial<Values>) => {
    setValues(current => ({ ...current, ...patch }));
    if (patch.title !== undefined) setErrors(current => ({ ...current, title: undefined }));
    if (patch.url !== undefined) setErrors(current => ({ ...current, url: undefined }));
  };

  function fileError(selected: File) {
    const extension = selected.name.includes(".") ? selected.name.split(".").pop()!.toLowerCase() : "";
    if (!collection.allowedExtensions.includes(extension)) return `Định dạng .${extension || "?"} không được hỗ trợ. Chọn tệp: ${collection.allowedExtensions.join(", ")}.`;
    if (selected.size > collection.maxFileBytes) return `Tệp vượt quá giới hạn ${humanSize(collection.maxFileBytes)}.`;
  }
  function chooseFile(selected: File | null) {
    setFile(selected);
    setErrors(current => ({ ...current, file: selected ? fileError(selected) : undefined }));
    if (selected && !values.title.trim()) set({ title: selected.name.slice(0, 255) });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const next: Errors = {};
    if (!values.title.trim()) next.title = "Vui lòng nhập tiêu đề tài nguyên.";
    if (values.kind === "LINK" && (!values.url.trim() || !webUrl(values.url))) next.url = "Vui lòng nhập URL HTTP hoặc HTTPS hợp lệ, không chứa thông tin đăng nhập.";
    if (file) next.file = fileError(file);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    await onSubmit({
      title: values.title.trim(), description: values.description.trim() || null, kind: values.kind,
      url: values.kind === "LINK" ? webUrl(values.url) ?? null : null,
      category: values.category.trim() || null, orderIndex: resource?.orderIndex ?? null,
    }, file);
  }

  return (
    <ResourceFormDialog
      open={open}
      onOpenChange={onOpenChange}
      idPrefix="workspace-resource"
      locale="vi"
      modalTitle={resource ? "Chỉnh sửa tài nguyên Workspace" : "Thêm tài nguyên Workspace"}
      modalDescription="Chia sẻ tài liệu và liên kết với nhóm trong workspace này. Chỉ thành viên của workspace này nhìn thấy tài nguyên."
      saving={saving}
      error={error}
      submitLabel={resource ? "Lưu thay đổi" : "Thêm tài nguyên"}
      submitIcon={Save}
      values={values}
      errors={errors}
      collection={collection}
      maxFileSizeLabel={humanSize(collection.maxFileBytes)}
      extraNote={replaceMode && resource ? (
        <p className="break-words text-xs text-muted-foreground">
          Tệp hiện tại: {resource.files.map(item => item.fileName).join(", ")}. Tệp mới sẽ thay thế tệp đang đính kèm.
        </p>
      ) : undefined}
      onChange={set}
      onFileChange={chooseFile}
      onSubmit={event => void submit(event)}
    />
  );
}

