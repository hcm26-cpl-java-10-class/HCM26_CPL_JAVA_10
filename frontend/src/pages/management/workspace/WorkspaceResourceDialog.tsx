import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, CloudUpload, FileText, FolderPlus, Link2, Save, ShieldCheck, Trash2, Zap } from "lucide-react";
import { SiFigma, SiGithub, SiGoogledrive, SiMiro, SiNotion } from "react-icons/si";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn, normalizeExternalUrl } from "@/lib/utils";
import type { WorkspaceResource, WorkspaceResourceCollection, WorkspaceResourceKind, WorkspaceResourcePayload } from "@/types/features/workspace-resource";
import { WorkspaceFormDialog } from "./WorkspaceFormDialog";

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

const CATEGORIES = [
  { value: "Docs", label: "Docs & Đặc tả" },
  { value: "Design", label: "Thiết kế & Prototype" },
  { value: "Repository", label: "Kho mã nguồn (Git)" },
  { value: "Sprint", label: "Kế hoạch & Sprint" },
  { value: "Asset", label: "Media & Tệp tin" },
  { value: "Other", label: "Khác" },
];
const PRESETS = [
  { label: "Figma", url: "https://www.figma.com/file/", category: "Design", icon: SiFigma, color: "text-violet-600" },
  { label: "Drive", url: "https://drive.google.com/", category: "Docs", icon: SiGoogledrive, color: "text-emerald-600" },
  { label: "Notion", url: "https://www.notion.so/", category: "Docs", icon: SiNotion, color: "text-foreground" },
  { label: "GitHub", url: "https://github.com/", category: "Repository", icon: SiGithub, color: "text-foreground" },
  { label: "Miro", url: "https://miro.com/app/board/", category: "Design", icon: SiMiro, color: "text-amber-600" },
];
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
  const [urlChecked, setUrlChecked] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const fileAttachment = useRef<HTMLDetailsElement>(null);
  const set = (patch: Partial<typeof values>) => setValues(current => ({ ...current, ...patch }));
  const accepted = collection.allowedExtensions.map(extension => `.${extension}`).join(",");
  const replaceMode = !!resource?.files.length;

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
  function checkUrl() {
    const valid = !!values.url.trim() && !!webUrl(values.url);
    setErrors(current => ({ ...current, url: valid ? undefined : "Vui lòng nhập URL HTTP hoặc HTTPS hợp lệ, không chứa thông tin đăng nhập." }));
    setUrlChecked(valid);
    if (!valid) urlInput.current?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const next: Errors = {};
    if (!values.title.trim()) next.title = "Vui lòng nhập tiêu đề tài nguyên.";
    if (values.kind === "LINK" && (!values.url.trim() || !webUrl(values.url))) next.url = "Vui lòng nhập URL HTTP hoặc HTTPS hợp lệ, không chứa thông tin đăng nhập.";
    if (file) next.file = fileError(file);
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      if (next.file && fileAttachment.current) fileAttachment.current.open = true;
      return;
    }
    await onSubmit({
      title: values.title.trim(), description: values.description.trim() || null, kind: values.kind,
      url: values.kind === "LINK" ? webUrl(values.url) ?? null : null,
      category: values.category.trim() || null, orderIndex: resource?.orderIndex ?? null,
    }, file);
  }

  const upload = <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-1 text-xs"><Label className="text-xs" htmlFor="workspace-resource-file">{replaceMode ? "Thay tệp đính kèm" : "Tệp tin đính kèm"}</Label><span className="text-muted-foreground">Tối đa {humanSize(collection.maxFileBytes)}</span></div>
    <div onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = saving ? "none" : "copy"; }} onDrop={event => { event.preventDefault(); if (!saving && event.dataTransfer.files[0]) chooseFile(event.dataTransfer.files[0]); }}
      className={cn("relative rounded-xl border border-dashed bg-muted/20 transition-colors focus-within:ring-2 focus-within:ring-blue-500/30", !saving && "hover:border-blue-400 hover:bg-blue-50/20", errors.file && "border-destructive")}>
      <input ref={fileInput} id="workspace-resource-file" type="file" className="sr-only" accept={accepted} disabled={saving} aria-invalid={!!errors.file} aria-describedby={`workspace-resource-file-hint${errors.file ? " workspace-resource-file-error" : ""}`}
        onChange={event => chooseFile(event.target.files?.[0] ?? null)} />
      {file ? <div className="flex min-w-0 items-center gap-3 p-3">
        <label htmlFor="workspace-resource-file" className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-3", saving && "pointer-events-none opacity-50")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><FileText className="size-5" /></span>
          <span className="min-w-0"><span className="block truncate text-xs font-medium" title={file.name}>{file.name}</span><span className="mt-1 block text-[11px] text-muted-foreground">{humanSize(file.size)} · Sẽ tải lên khi lưu</span></span>
        </label>
        <span id="workspace-resource-file-hint" className="sr-only">Bấm tên tệp để chọn tệp khác. Giới hạn {humanSize(collection.maxFileBytes)}.</span>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Bỏ tệp đã chọn" disabled={saving} onClick={() => { chooseFile(null); if (fileInput.current) fileInput.current.value = ""; }}><Trash2 className="size-4 text-destructive" /></Button>
      </div> : <label htmlFor="workspace-resource-file" className={cn("flex cursor-pointer flex-col items-center gap-2 px-4 py-5 text-center", saving && "pointer-events-none opacity-50")}>
        <span className="flex size-10 items-center justify-center rounded-xl border bg-background text-blue-600 dark:text-blue-400"><CloudUpload className="size-5" /></span>
        <span className="text-xs font-medium"><span className="text-blue-600 dark:text-blue-400">Bấm để chọn tệp</span> hoặc kéo thả vào đây</span>
        <span id="workspace-resource-file-hint" className="max-w-full break-words text-[11px] leading-5 text-muted-foreground">{collection.allowedExtensions.map(extension => extension.toUpperCase()).join(", ")}</span>
      </label>}
    </div>
    {!file && replaceMode && <p className="break-words text-xs text-muted-foreground">Tệp hiện tại: {resource.files.map(item => item.fileName).join(", ")}. Chọn tệp mới để thay thế.</p>}
    <p className="text-[11px] leading-5 text-muted-foreground">{replaceMode ? "Tệp mới sẽ thay các tệp đang đính kèm tài nguyên này." : "Có thể bổ sung tệp sau khi lưu tài nguyên."}</p>
    {errors.file && <p id="workspace-resource-file-error" role="alert" className="text-xs text-destructive">{errors.file}</p>}
  </div>;

  return <WorkspaceFormDialog open={open} onOpenChange={onOpenChange} busy={saving} title={resource ? "Chỉnh sửa tài nguyên Workspace" : "Thêm tài nguyên Workspace"}
    description="Chia sẻ tài liệu và liên kết với nhóm trong workspace này."
    icon={FolderPlus} badge={<Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-normal text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" />Chỉ workspace này</Badge>}
    submitLabel={resource ? "Lưu thay đổi" : "Thêm tài nguyên"} submitIcon={Save} onSubmit={event => void submit(event)}>
    {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
    <fieldset disabled={saving} className="min-w-0 space-y-2">
      <legend className="mb-2 text-xs font-medium">Loại tài nguyên <span className="text-destructive">*</span></legend>
      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/50 p-1">{([
        { kind: "LINK", label: "Liên kết ngoài (URL)", icon: Link2 },
        { kind: "FILE", label: "Tải lên tệp tin (File)", icon: CloudUpload },
      ] as const).map(({ kind, label, icon: Icon }) => <Button type="button" variant="ghost" key={kind} aria-pressed={values.kind === kind}
        className={cn("h-auto min-h-10 whitespace-normal rounded-lg px-2 py-2 text-xs", values.kind === kind && "bg-background text-blue-600 shadow-sm hover:bg-background hover:text-blue-600 dark:text-blue-400")}
        onClick={() => { set({ kind }); setErrors(current => ({ ...current, url: undefined })); }}><Icon className="size-4 shrink-0" />{label}</Button>)}</div>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2">
        <Label className="text-xs" htmlFor="workspace-resource-title">Tiêu đề tài nguyên <span className="text-destructive">*</span></Label>
        <Input id="workspace-resource-title" value={values.title} required maxLength={255} disabled={saving} placeholder="VD: Tài liệu thiết kế Figma, SRS Specs…" className="h-10 rounded-xl text-sm" aria-invalid={!!errors.title} aria-describedby={errors.title ? "workspace-resource-title-error" : undefined}
          onChange={event => { set({ title: event.target.value }); setErrors(current => ({ ...current, title: undefined })); }} />
        {errors.title && <p id="workspace-resource-title-error" role="alert" className="text-xs text-destructive">{errors.title}</p>}
      </div>
      <div className="min-w-0 space-y-2">
        <Label className="text-xs" htmlFor="workspace-resource-category">Phân loại (Category)</Label>
        <Select value={values.category || "__none"} disabled={saving} onValueChange={category => set({ category: category === "__none" ? "" : category })}>
          <SelectTrigger id="workspace-resource-category" className="h-10 w-full min-w-0 rounded-xl [&_[data-slot=select-value]]:truncate"><SelectValue placeholder="Chọn phân loại" /></SelectTrigger>
          <SelectContent><SelectItem value="__none">Chưa phân loại</SelectItem>{CATEGORIES.map(category => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}{values.category && !CATEGORIES.some(category => category.value === values.category) && <SelectItem value={values.category}>{values.category}</SelectItem>}</SelectContent>
        </Select>
      </div>
    </div>
    {values.kind === "LINK" ? <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1"><Label className="text-xs" htmlFor="workspace-resource-url">Địa chỉ URL <span className="text-destructive">*</span></Label><span className="text-[11px] text-muted-foreground">HTTP hoặc HTTPS</span></div>
        <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-3 size-4 text-blue-600 dark:text-blue-400" />
          <Input ref={urlInput} id="workspace-resource-url" value={values.url} required maxLength={1000} disabled={saving} autoComplete="off" spellCheck={false} placeholder="https://figma.com/file/… hoặc https://github.com/…" className="h-10 rounded-xl pl-9 pr-28 text-sm" aria-invalid={!!errors.url} aria-describedby={errors.url ? "workspace-resource-url-error" : urlChecked ? "workspace-resource-url-status" : undefined}
            onChange={event => { set({ url: event.target.value }); setUrlChecked(false); setErrors(current => ({ ...current, url: undefined })); }} />
          <Button type="button" variant="secondary" size="xs" className="absolute right-2 top-2 text-[11px]" title="Kiểm tra định dạng URL, chưa kiểm tra quyền truy cập" disabled={saving} onClick={checkUrl}>Kiểm tra URL</Button>
        </div>
        {errors.url && <p id="workspace-resource-url-error" role="alert" className="text-xs text-destructive">{errors.url}</p>}
        {urlChecked && <p id="workspace-resource-url-status" role="status" className="flex items-start gap-1.5 text-[11px] leading-5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />URL đúng định dạng. Quyền truy cập phụ thuộc nền tảng chia sẻ.</p>}
      </div>
      <div className="space-y-1.5"><p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Zap className="size-3.5 text-amber-500" />Gợi ý nền tảng nhanh:</p><div className="flex flex-wrap gap-1.5">{PRESETS.map(({ label, url, category, icon: Icon, color }) => <Button type="button" size="xs" variant="outline" key={label} disabled={saving} className="h-7 rounded-lg bg-muted/20 px-2.5 text-xs" onClick={() => { set({ url, category }); setUrlChecked(false); setErrors(current => ({ ...current, url: undefined })); urlInput.current?.focus(); }}><Icon className={cn("size-3", color)} />{label}</Button>)}</div></div>
    </div> : upload}
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-1"><Label className="text-xs" htmlFor="workspace-resource-description">Mô tả chi tiết <span className="font-normal text-muted-foreground">(không bắt buộc)</span></Label><span className="text-[11px] tabular-nums text-muted-foreground">{values.description.length}/1000 ký tự</span></div>
      <Textarea id="workspace-resource-description" value={values.description} maxLength={1000} rows={3} disabled={saving} className="min-h-20 resize-y rounded-xl text-sm" placeholder="Ghi chú mục đích tài nguyên và cách truy cập dành cho nhóm…" onChange={event => set({ description: event.target.value })} />
    </div>
    {values.kind === "LINK" && <details ref={fileAttachment} className="group rounded-xl border bg-muted/10" open={!!errors.file || undefined}><summary className="cursor-pointer px-3 py-2.5 text-xs font-medium">{replaceMode ? "Tệp đính kèm hiện có / thay thế" : "Đính kèm tệp"} <span className="font-normal text-muted-foreground">(không bắt buộc)</span>{file && <span className="ml-2 text-blue-600 dark:text-blue-400">1 tệp đã chọn</span>}</summary><div className="border-t p-3">{upload}</div></details>}
    <div className="flex items-start gap-2.5 rounded-xl border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" /><p>Tài nguyên được chia sẻ theo quyền truy cập của nhóm trong <strong className="font-medium text-foreground">workspace này</strong>. Người có quyền quản lý tài nguyên mới có thể sửa hoặc xóa.</p></div>
  </WorkspaceFormDialog>;
}
