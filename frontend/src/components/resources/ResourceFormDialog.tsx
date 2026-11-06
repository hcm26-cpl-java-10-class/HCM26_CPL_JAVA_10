import type { FormEvent, ReactNode } from "react";
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
import {
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_NONE,
  isKnownResourceCategory,
  resourceCategoryLabel,
} from "@/lib/resource-categories";
import { AlertCircle, Loader2, type LucideIcon } from "lucide-react";

export type ResourceFormLocale = "en" | "vi";
export type ResourceFormKind = "LINK" | "FILE";

export interface ResourceFormValues {
  title: string;
  kind: ResourceFormKind;
  url: string;
  description: string;
  category: string;
}

export interface ResourceFormErrors {
  title?: string;
  url?: string;
  file?: string;
}

/** Copy for the shared resource dialog. */
export interface ResourceFormText {
  title: string;
  type: string;
  category: string;
  categoryPlaceholder: string;
  noCategory: string;
  url: string;
  description: string;
  attachFile: string;
  optional: string;
  cancel: string;
  linkOption: string;
  fileOption: string;
  maxSizePrefix: string;
}

export const RESOURCE_FORM_TEXT: Record<ResourceFormLocale, ResourceFormText> = {
  en: {
    title: "Title",
    type: "Type",
    category: "Category",
    categoryPlaceholder: "Select a category",
    noCategory: "No category",
    url: "URL",
    description: "Description",
    attachFile: "Attach file",
    optional: "(optional)",
    cancel: "Cancel",
    linkOption: "Link",
    fileOption: "File",
    maxSizePrefix: "maximum",
  },
  vi: {
    title: "Tiêu đề",
    type: "Loại",
    category: "Phân loại",
    categoryPlaceholder: "Chọn phân loại",
    noCategory: "Chưa phân loại",
    url: "Đường dẫn (URL)",
    description: "Mô tả",
    attachFile: "Tệp đính kèm",
    optional: "(không bắt buộc)",
    cancel: "Hủy bỏ",
    linkOption: "Liên kết",
    fileOption: "Tệp tin",
    maxSizePrefix: "tối đa",
  },
};

export interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Used for the label/input ids so the two dialogs never collide. */
  idPrefix: string;
  locale?: ResourceFormLocale;
  modalTitle: string;
  modalDescription: string;
  saving: boolean;
  error?: string | null;
  submitLabel: string;
  submitIcon: LucideIcon;
  values: ResourceFormValues;
  errors: ResourceFormErrors;
  collection: { allowedExtensions: string[]; maxFileBytes: number };
  /** Human readable maximum upload size, e.g. `25 MB`. */
  maxFileSizeLabel: string;
  /** Changing this value resets the native file input. */
  fileResetKey?: number | string;
  /** Extra note rendered under the file input (e.g. files being replaced). */
  extraNote?: ReactNode;
  onChange: (patch: Partial<ResourceFormValues>) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Shared "add / edit resource" dialog used by both the project template
 * resources tab and the workspace resources tab, so the two screens never
 * drift apart. The parent owns the state and validation; this component only
 * renders the form.
 */
export function ResourceFormDialog({
  open,
  onOpenChange,
  idPrefix,
  locale = "en",
  modalTitle,
  modalDescription,
  saving,
  error,
  submitLabel,
  submitIcon: SubmitIcon,
  values,
  errors,
  collection,
  maxFileSizeLabel,
  fileResetKey,
  extraNote,
  onChange,
  onFileChange,
  onSubmit,
}: ResourceFormDialogProps) {
  const text = RESOURCE_FORM_TEXT[locale];
  const accepted = collection.allowedExtensions.map((extension) => `.${extension}`).join(",");

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!saving) onOpenChange(value); }}>
      <DialogContent showCloseButton={!saving} className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>{modalDescription}</DialogDescription>
          </DialogHeader>

          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-title`}>{text.title} <span className="text-destructive">*</span></Label>
            <Input id={`${idPrefix}-title`} value={values.title} maxLength={255} disabled={saving}
              aria-invalid={!!errors.title} onChange={(event) => onChange({ title: event.target.value })} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-kind`}>{text.type}</Label>
              <Select value={values.kind} disabled={saving}
                onValueChange={(value: ResourceFormKind) => onChange({ kind: value })}>
                <SelectTrigger id={`${idPrefix}-kind`} className="w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LINK">{text.linkOption}</SelectItem>
                  <SelectItem value="FILE">{text.fileOption}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-category`}>{text.category}</Label>
              <Select
                value={values.category || RESOURCE_CATEGORY_NONE}
                disabled={saving}
                onValueChange={(value) => onChange({ category: value === RESOURCE_CATEGORY_NONE ? "" : value })}
              >
                <SelectTrigger id={`${idPrefix}-category`} className="w-full min-w-0">
                  <SelectValue placeholder={text.categoryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={RESOURCE_CATEGORY_NONE}>{text.noCategory}</SelectItem>
                  {RESOURCE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {locale === "vi" ? category.labelVi : category.label}
                    </SelectItem>
                  ))}
                  {values.category && !isKnownResourceCategory(values.category) && (
                    <SelectItem value={values.category}>{resourceCategoryLabel(values.category, locale)}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {values.kind === "LINK" && (
            <div className="grid gap-2">
              <Label htmlFor={`${idPrefix}-url`}>{text.url} <span className="text-destructive">*</span></Label>
              <Input id={`${idPrefix}-url`} value={values.url} maxLength={1000} placeholder="https://"
                disabled={saving} aria-invalid={!!errors.url}
                onChange={(event) => onChange({ url: event.target.value })} />
              {errors.url && <p className="text-xs text-destructive">{errors.url}</p>}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-description`}>{text.description}</Label>
            <Textarea id={`${idPrefix}-description`} value={values.description} maxLength={1000} rows={3}
              disabled={saving} onChange={(event) => onChange({ description: event.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-file`}>
              {text.attachFile} <span className="text-xs font-normal text-muted-foreground">{text.optional}</span>
            </Label>
            <Input key={fileResetKey} id={`${idPrefix}-file`} type="file" accept={accepted} disabled={saving}
              aria-invalid={!!errors.file}
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">
              {collection.allowedExtensions.join(", ")} · {text.maxSizePrefix} {maxFileSizeLabel}
            </p>
            {extraNote}
            {errors.file && <p className="text-xs text-destructive">{errors.file}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{text.cancel}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <SubmitIcon />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
