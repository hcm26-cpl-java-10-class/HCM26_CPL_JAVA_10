import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, normalizeExternalUrl } from "@/lib/utils";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Link2,
  Loader2,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";

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

type KindTone = {
  header: string;
  icon: string;
  card: string;
  check: string;
  dot: string;
};

const KIND_TONES: Record<ResourceDialogKind, KindTone> = {
  LINK: {
    header: "from-sky-500/10 via-sky-400/5 to-transparent",
    icon: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300",
    card: "border-sky-500/60 bg-sky-500/[0.06] shadow-sm shadow-sky-500/10",
    check: "border-sky-500 bg-sky-500 text-white",
    dot: "bg-sky-500",
  },
  FILE: {
    header: "from-emerald-500/10 via-emerald-400/5 to-transparent",
    icon: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
    card: "border-emerald-500/60 bg-emerald-500/[0.06] shadow-sm shadow-emerald-500/10",
    check: "border-emerald-500 bg-emerald-500 text-white",
    dot: "bg-emerald-500",
  },
};

const KIND_OPTIONS: Array<{
  kind: ResourceDialogKind;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    kind: "LINK",
    label: "External link",
    description: "Point your team to a page, video or online document.",
    icon: Link2,
  },
  {
    kind: "FILE",
    label: "Document",
    description: "Attach a file your team can open or download.",
    icon: FileText,
  },
];

function humanSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    const value = bytes / (1024 * 1024);
    return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function extensionOf(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
}

/** Positive-only hint: never blocks a submit, it just tells the user the link looks complete. */
function linkLooksValid(raw: string) {
  const value = raw.trim();
  if (!value) return false;
  try {
    const normalized = normalizeExternalUrl(value);
    if (!normalized) return false;
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.hostname === "localhost" || parsed.hostname.includes(".");
    }
    return true;
  } catch {
    return false;
  }
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p
      id={id}
      role="alert"
      className="animate-in fade-in slide-in-from-top-1 flex items-start gap-1.5 text-xs font-medium text-destructive duration-200"
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
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
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error]);

  const tone = KIND_TONES[values.kind];
  const HeaderIcon = values.kind === "LINK" ? Link2 : FileText;
  const titleId = `${idPrefix}-title`;
  const descriptionId = `${idPrefix}-description`;
  const urlId = `${idPrefix}-url`;
  const fileId = `${idPrefix}-file`;
  const titleErrorId = `${titleId}-error`;
  const urlHelpId = `${urlId}-help`;
  const fileErrorId = `${fileId}-error`;

  const titleCount = values.title.length;
  const descriptionCount = values.description.length;
  const urlValid = linkLooksValid(values.url);
  const savingLabel = resource
    ? file
      ? "Saving and uploading…"
      : "Saving changes…"
    : file
      ? "Adding and uploading…"
      : "Adding resource…";

  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));

  const fileProblem = (candidate: File) => {
    const extension = extensionOf(candidate);
    if (!collection.allowedExtensions.includes(extension)) {
      return `.${extension || "?"} files are not allowed. Try ${collection.allowedExtensions
        .map((item) => `.${item}`)
        .join(", ")}.`;
    }
    if (candidate.size > collection.maxFileBytes) {
      return `That file is ${humanSize(candidate.size)}. The limit is ${humanSize(collection.maxFileBytes)}.`;
    }
    return undefined;
  };

  const chooseFile = (candidate: File | null) => {
    if (!candidate) {
      setFile(null);
      setErrors((current) => ({ ...current, file: undefined }));
      return;
    }
    setFile(candidate);
    setErrors((current) => ({ ...current, file: fileProblem(candidate) }));
  };

  const clearFile = () => {
    chooseFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = () => {
    const next: Errors = {};
    if (!values.title.trim()) next.title = "Title is required";
    if (values.kind === "LINK" && !values.url.trim()) next.url = "URL is required for a link resource";
    if (file) {
      const problem = fileProblem(file);
      if (problem) next.file = problem;
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

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (saving) return;
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped) chooseFile(dropped);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  const accepted = collection.allowedExtensions.map((extension) => `.${extension}`).join(",");

  return (
    <Dialog open onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/30 backdrop-blur-sm supports-backdrop-filter:backdrop-blur-md"
        className="max-h-[92vh] gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl ring-1 ring-foreground/10 sm:max-w-2xl"
      >
        <form
          noValidate
          aria-busy={saving}
          onSubmit={(event) => void submit(event)}
          className="flex max-h-[92vh] min-h-0 flex-col"
        >
          <div className="relative shrink-0 overflow-hidden border-b px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
            <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", tone.header)} />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-14 -top-20 size-52 rounded-full bg-background/50 blur-3xl"
            />
            <div className="relative flex items-start gap-3.5 pr-10">
              <span
                key={values.kind}
                className={cn(
                  "animate-in fade-in zoom-in-95 flex size-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm duration-200",
                  tone.icon,
                )}
              >
                <HeaderIcon className="size-5" />
              </span>
              <DialogHeader className="min-w-0 flex-1 gap-1.5 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg font-semibold tracking-tight">{modalTitle}</DialogTitle>
                  <Badge
                    variant="outline"
                    className="h-5 border-foreground/15 bg-background/70 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur"
                  >
                    {resource ? "Editing" : "New"}
                  </Badge>
                  {saving && (
                    <span
                      role="status"
                      className="inline-flex h-5 items-center gap-1.5 rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary"
                    >
                      <Loader2 className="size-3 animate-spin" />
                      Saving
                    </span>
                  )}
                </div>
                <DialogDescription className="text-[13px] leading-relaxed">{modalDescription}</DialogDescription>
              </DialogHeader>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={saving}
                aria-label="Close dialog"
                className="absolute right-3 top-3 rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <X />
              </Button>
            </DialogClose>
          </div>

          <p className="sr-only" aria-live="polite">
            {saving ? savingLabel : error ? `Error: ${error}` : ""}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-5">
              {error && (
                <div ref={errorRef} className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <Alert
                    variant="destructive"
                    className="rounded-xl border-destructive/30 bg-destructive/[0.05] px-3.5 py-3"
                  >
                    <AlertCircle />
                    <AlertTitle>Couldn&apos;t save this resource</AlertTitle>
                    <AlertDescription className="text-[13px]">{error}</AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="grid gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Resource type
                  </p>
                  <span className="text-[11px] text-muted-foreground">Choose one</span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-label="Resource type">
                  {KIND_OPTIONS.map((option) => {
                    const selected = values.kind === option.kind;
                    const optionTone = KIND_TONES[option.kind];
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.kind}
                        type="button"
                        disabled={saving}
                        aria-pressed={selected}
                        onClick={() => set({ kind: option.kind })}
                        className={cn(
                          "group relative flex items-start gap-3 rounded-xl border p-3 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
                          selected
                            ? optionTone.card
                            : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/40 hover:shadow-sm",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                            selected
                              ? optionTone.icon
                              : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {option.label}
                            {selected && <span className={cn("size-1.5 rounded-full", optionTone.dot)} />}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                            selected
                              ? optionTone.check
                              : "border-border/80 bg-background text-transparent group-hover:border-foreground/30",
                          )}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div aria-hidden className="h-px bg-border/70" />

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={titleId}>
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums text-muted-foreground",
                      titleCount >= 255 && "font-medium text-destructive",
                      titleCount >= 230 && titleCount < 255 && "font-medium text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {titleCount}/255
                  </span>
                </div>
                <Input
                  id={titleId}
                  value={values.title}
                  maxLength={255}
                  placeholder="e.g. Project brief, Kick-off recording"
                  autoFocus
                  disabled={saving}
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? titleErrorId : undefined}
                  className="h-10 rounded-lg bg-background"
                  onChange={(event) => {
                    set({ title: event.target.value });
                    setErrors((current) => ({ ...current, title: undefined }));
                  }}
                  onBlur={() => {
                    if (!values.title.trim()) {
                      setErrors((current) => ({ ...current, title: "Title is required" }));
                    }
                  }}
                />
                <FieldError id={titleErrorId}>{errors.title}</FieldError>
              </div>

              {values.kind === "LINK" && (
                <div className="animate-in fade-in slide-in-from-top-1 grid gap-2 duration-200">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={urlId}>
                      URL <span className="text-destructive">*</span>
                    </Label>
                    {urlValid && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Looks valid
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id={urlId}
                      type="url"
                      value={values.url}
                      maxLength={1000}
                      placeholder="https://example.com/project-brief"
                      disabled={saving}
                      aria-invalid={!!errors.url}
                      aria-describedby={urlHelpId}
                      className={cn("h-10 rounded-lg bg-background pl-9", urlValid && "pr-9")}
                      onChange={(event) => {
                        set({ url: event.target.value });
                        setErrors((current) => ({ ...current, url: undefined }));
                      }}
                      onBlur={() => {
                        if (!values.url.trim()) {
                          setErrors((current) => ({
                            ...current,
                            url: "URL is required for a link resource",
                          }));
                        }
                      }}
                    />
                    {urlValid && (
                      <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500 animate-in fade-in zoom-in-95 duration-200" />
                    )}
                  </div>
                  {errors.url ? (
                    <FieldError id={urlHelpId}>{errors.url}</FieldError>
                  ) : (
                    <p id={urlHelpId} className="text-[11px] text-muted-foreground">
                      Paste the full address your team should open.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={descriptionId}>
                    Description <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums text-muted-foreground",
                      descriptionCount >= 1000 && "font-medium text-destructive",
                      descriptionCount >= 900 && descriptionCount < 1000 && "font-medium text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {descriptionCount}/1000
                  </span>
                </div>
                <Textarea
                  id={descriptionId}
                  value={values.description}
                  maxLength={1000}
                  rows={3}
                  placeholder="Add context so your team knows when to use this resource."
                  disabled={saving}
                  className="min-h-20 resize-none rounded-lg bg-background"
                  onChange={(event) => set({ description: event.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={fileId}>
                    {values.kind === "FILE" ? "Document" : "Supporting file"}{" "}
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  {file && !errors.file && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Ready to upload
                    </span>
                  )}
                </div>

                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={cn(
                    "relative rounded-xl border-2 border-dashed p-4 transition-all duration-200 focus-within:ring-4 focus-within:ring-primary/10",
                    dragging
                      ? "border-primary bg-primary/[0.06] ring-4 ring-primary/10"
                      : errors.file
                        ? "border-destructive/50 bg-destructive/[0.04]"
                        : file
                          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                          : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    id={fileId}
                    type="file"
                    accept={accepted}
                    disabled={saving}
                    aria-invalid={!!errors.file}
                    aria-describedby={errors.file ? fileErrorId : undefined}
                    className="sr-only"
                    onChange={(event) => {
                      const next = event.target.files?.[0] ?? null;
                      chooseFile(next);
                      event.target.value = "";
                    }}
                  />

                  {file ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                          errors.file
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                        )}
                      >
                        <FileText className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                        <p className={cn("mt-0.5 text-[11px]", errors.file ? "text-destructive" : "text-muted-foreground")}>
                          {humanSize(file.size)} · {errors.file ? "Needs attention" : "Ready to upload"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          className="h-7 rounded-lg px-2.5 text-xs"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadCloud className="size-3.5" />
                          Replace
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={saving}
                          aria-label={`Remove ${file.name}`}
                          className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={clearFile}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor={fileId}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center gap-1.5 py-2 text-center",
                        saving && "pointer-events-none opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-transform duration-200",
                          dragging && "scale-110 border-primary/40 text-primary",
                        )}
                      >
                        {dragging ? <FileUp className="size-5" /> : <UploadCloud className="size-5" />}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {dragging ? "Drop to attach" : "Drag & drop or click to browse"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {collection.allowedExtensions.map((extension) => extension.toUpperCase()).join(" · ")}
                        {" · up to "}
                        {humanSize(collection.maxFileBytes)}
                      </span>
                    </label>
                  )}
                </div>

                <FieldError id={fileErrorId}>{errors.file}</FieldError>
                <p aria-live="polite" className="sr-only">
                  {file ? `${file.name} selected.${errors.file ? ` ${errors.file}` : ""}` : ""}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 mt-0 flex-col-reverse gap-3 rounded-none border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {saving ? (
                <span role="status" className="inline-flex items-center gap-1.5 font-medium text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  {savingLabel}
                </span>
              ) : (
                <>
                  <span>
                    <span className="text-destructive">*</span> Required
                  </span>
                  <span aria-hidden className="text-border">·</span>
                  <span>
                    <kbd className="rounded border bg-background px-1 font-sans text-[10px] text-muted-foreground">
                      Esc
                    </kbd>{" "}
                    to close
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className="h-9 w-full rounded-lg sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className={cn("h-9 w-full min-w-32 rounded-lg shadow-sm sm:w-auto", saving && "cursor-wait")}
              >
                {saving ? <Loader2 className="animate-spin" /> : file ? <UploadCloud /> : <Check />}
                {saving ? savingLabel : submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
