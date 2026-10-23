import { lessonApi } from "@/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LessonContentType, LessonDTO, ValidationErrorResponse } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDuration, LessonPreview } from "./LessonPreview";

interface LessonFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Section mà bài học thuộc về (bắt buộc khi tạo mới). */
  sectionId: number;
  /** Có giá trị -> chế độ sửa, không có -> chế độ thêm mới. */
  lesson?: LessonDTO | null;
  /** Gợi ý orderIndex cho bài học mới (thường là max + 1). */
  defaultOrderIndex?: number;
  onSuccess?: (lesson: LessonDTO) => void;
}

interface FormState {
  title: string;
  contentType: LessonContentType;
  contentUrl: string;
  textContent: string;
  duration: string;
  orderIndex: string;
}

const LESSON_CONTENT_TYPE_OPTIONS: { value: LessonContentType; label: string }[] = [
  { value: "VIDEO", label: "Video" },
  { value: "AUDIO", label: "Audio" },
  { value: "TEXT", label: "Text" },
  { value: "DOCUMENT", label: "Document" },
  { value: "LINK", label: "Link" },
];

type FieldErrors = Partial<Record<keyof FormState, string>>;

const needsUrl = (type: LessonContentType) => type !== "TEXT";

function buildInitialState(lesson?: LessonDTO | null, defaultOrderIndex = 0): FormState {
  return {
    title: lesson?.title ?? "",
    contentType: lesson?.contentType ?? "VIDEO",
    contentUrl: lesson?.contentUrl ?? "",
    textContent: lesson?.textContent ?? "",
    duration: lesson?.duration != null ? String(lesson.duration) : "",
    orderIndex: String(lesson?.orderIndex ?? defaultOrderIndex),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Validate phía client, khớp với rule ở LessonDTO / LessonServiceImpl. */
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  const title = form.title.trim();
  if (!title) errors.title = "Lesson title is required";
  else if (title.length > 200) errors.title = "Title must not exceed 200 characters";

  if (needsUrl(form.contentType)) {
    const url = form.contentUrl.trim();
    if (!url) errors.contentUrl = `Content URL is required for ${form.contentType} lessons`;
    else if (url.length > 500) errors.contentUrl = "Content URL must not exceed 500 characters";
    else if (!isHttpUrl(url)) errors.contentUrl = "Content URL must start with http:// or https://";
  } else if (!form.textContent.trim()) {
    errors.textContent = "Text content is required for TEXT lessons";
  }

  if (form.duration !== "") {
    const d = Number(form.duration);
    if (!Number.isInteger(d) || d < 0) errors.duration = "Duration must be a non-negative whole number";
  }

  const order = Number(form.orderIndex);
  if (form.orderIndex === "" || !Number.isInteger(order) || order < 0) {
    errors.orderIndex = "Order index must be a non-negative whole number";
  }

  return errors;
}

function FieldMessage({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function LessonFormModal({
  open,
  onOpenChange,
  sectionId,
  lesson,
  defaultOrderIndex = 0,
  onSuccess,
}: LessonFormModalProps) {
  const isEdit = !!lesson?.id;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => buildInitialState(lesson, defaultOrderIndex));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPreview, setShowPreview] = useState(false);

  // Reset form mỗi lần mở modal hoặc đổi bài học đang sửa
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(lesson, defaultOrderIndex));
      setErrors({});
      setShowPreview(false);
    }
  }, [open, lesson, defaultOrderIndex]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const mutation = useMutation({
    mutationFn: async (payload: LessonDTO) => {
      // Dùng API service chung để request đi qua axiosInstance đã cấu hình
      // baseURL, JWT Authorization và refresh token của project.
      return isEdit
        ? await lessonApi.update(String(lesson!.id), payload)
        : await lessonApi.create(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["lessons"] });
      toast.success(isEdit ? "Lesson updated." : "Lesson created.");
      onSuccess?.(saved);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const body = error.response?.data as ValidationErrorResponse | undefined;
        // Backend trả 400 kèm { errors: { field: [msg] } } -> hiện lỗi dưới từng field
        if (error.response?.status === 400 && body?.errors) {
          const mapped: FieldErrors = {};
          Object.entries(body.errors).forEach(([field, messages]) => {
            mapped[field as keyof FormState] = messages?.[0];
          });
          setErrors(mapped);
          toast.error(body.message || "Please fix the highlighted fields.");
          return;
        }
        toast.error(error.response?.data?.message || "Could not save the lesson.");
        return;
      }
      toast.error("Could not save the lesson.");
    },
  });

  const handleSubmit = () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload: LessonDTO = {
      sectionId,
      title: form.title.trim(),
      contentType: form.contentType,
      orderIndex: Number(form.orderIndex),
    };
    if (form.duration !== "") payload.duration = Number(form.duration);

    // Chỉ gửi field có ý nghĩa với loại nội dung đang chọn
    if (needsUrl(form.contentType)) payload.contentUrl = form.contentUrl.trim();
    else payload.textContent = form.textContent;

    mutation.mutate(payload);
  };

  const previewLesson: LessonDTO = {
    title: form.title || "Preview",
    contentType: form.contentType,
    contentUrl: form.contentUrl,
    textContent: form.textContent,
    duration: form.duration !== "" ? Number(form.duration) : undefined,
  };

  const durationHint =
    form.duration !== "" && !errors.duration && Number.isFinite(Number(form.duration))
      ? `= ${formatDuration(Number(form.duration))}`
      : "In seconds";

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit lesson" : "Add lesson"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update lesson #${lesson?.id} of section #${sectionId}.`
              : `Create a new lesson in section #${sectionId}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={form.title}
              maxLength={200}
              aria-invalid={!!errors.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Introduction to variables"
            />
            <p className="text-xs text-muted-foreground">Required · max 200 characters ({form.title.length}/200)</p>
            <FieldMessage message={errors.title} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5 sm:col-span-1">
              <Label>Content type</Label>
              <Select
                value={form.contentType}
                onValueChange={(v) => setField("contentType", v as LessonContentType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_CONTENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lesson-duration">Duration</Label>
              <Input
                id="lesson-duration"
                type="number"
                min={0}
                step={1}
                value={form.duration}
                aria-invalid={!!errors.duration}
                onChange={(e) => setField("duration", e.target.value)}
              />
              {errors.duration ? (
                <FieldMessage message={errors.duration} />
              ) : (
                <p className="text-xs text-muted-foreground">Optional · whole seconds ≥ 0 {durationHint !== "In seconds" ? durationHint : ""}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lesson-order">Order index</Label>
              <Input
                id="lesson-order"
                type="number"
                min={0}
                step={1}
                value={form.orderIndex}
                aria-invalid={!!errors.orderIndex}
                onChange={(e) => setField("orderIndex", e.target.value)}
              />
              {errors.orderIndex ? (
                <FieldMessage message={errors.orderIndex} />
              ) : (
                <p className="text-xs text-muted-foreground">Whole number ≥ 0, unique in this section</p>
              )}
            </div>
          </div>

          {needsUrl(form.contentType) ? (
            <div className="grid gap-1.5">
              <Label htmlFor="lesson-url">
                {form.contentType === "VIDEO"
                  ? "Video URL"
                  : form.contentType === "AUDIO"
                    ? "Audio URL"
                    : "Resource URL"}
              </Label>
              <Input
                id="lesson-url"
                value={form.contentUrl}
                maxLength={500}
                aria-invalid={!!errors.contentUrl}
                onChange={(e) => setField("contentUrl", e.target.value)}
                placeholder={
                  form.contentType === "VIDEO"
                    ? "https://www.youtube.com/watch?v=..."
                    : form.contentType === "AUDIO"
                      ? "https://example.com/audio.mp3"
                      : "https://example.com/material.pdf"
                }
              />
              <p className="text-xs text-muted-foreground">
                Required · must start with http:// or https:// · max 500 characters
              </p>
              <FieldMessage message={errors.contentUrl} />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="lesson-text">Text content</Label>
              <Textarea
                id="lesson-text"
                rows={8}
                value={form.textContent}
                aria-invalid={!!errors.textContent}
                onChange={(e) => setField("textContent", e.target.value)}
                placeholder="Write the lesson content here..."
              />
              <p className="text-xs text-muted-foreground">Required for Text lessons</p>
              <FieldMessage message={errors.textContent} />
            </div>
          )}

          {showPreview && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <LessonPreview lesson={previewLesson} hideHeader />
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPreview((v) => !v)}
            disabled={mutation.isPending}
          >
            {showPreview ? "Hide preview" : "Preview content"}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Save changes" : "Create lesson"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LessonFormModal;
