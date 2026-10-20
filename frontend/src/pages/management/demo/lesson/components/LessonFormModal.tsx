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
import {
  LESSON_CONTENT_TYPE_OPTIONS,
  type LessonContentType,
  type LessonDTO,
  type ValidationErrorResponse,
} from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDuration, LessonPreview } from "./LessonPreview";

type YouTubeWindow = Window & {
  YT?: { Player: new (element: HTMLElement, options: Record<string, unknown>) => unknown };
  onYouTubeIframeAPIReady?: () => void;
};

let youtubeApiPromise: Promise<void> | undefined;

function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0])) return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function loadYouTubeApi(): Promise<void> {
  const target = window as YouTubeWindow;
  if (target.YT?.Player) return Promise.resolve();
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = target.onYouTubeIframeAPIReady;
    target.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      youtubeApiPromise = undefined;
      reject(new Error("Could not load YouTube metadata"));
    };
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

async function getYouTubeDuration(videoId: string): Promise<number> {
  await loadYouTubeApi();
  const target = window as YouTubeWindow;

  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.hidden = true;
    document.body.appendChild(host);

    const cleanUp = (player?: { destroy?: () => void }) => {
      player?.destroy?.();
      host.remove();
    };

    const player = new target.YT!.Player(host, {
      videoId,
      events: {
        onReady: (event: { target: { getDuration: () => number; destroy?: () => void } }) => {
          const seconds = Math.round(event.target.getDuration());
          cleanUp(event.target);
          if (seconds > 0) resolve(seconds);
          else reject(new Error("Video duration is unavailable"));
        },
        onError: () => {
          cleanUp(player as { destroy?: () => void });
          reject(new Error("Video duration is unavailable"));
        },
      },
    }) as { destroy?: () => void };
  });
}

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

const LESSON_TEMPLATES: Array<{ label: string; values: Omit<FormState, "orderIndex"> }> = [
  {
    label: "Course welcome (Text)",
    values: {
      title: "Course Welcome and Overview",
      contentType: "TEXT",
      contentUrl: "",
      textContent: "Welcome to this course. Review the learning objectives and course structure before continuing.",
      duration: "300",
    },
  },
  {
    label: "Concept video (Video)",
    values: {
      title: "Concept Video",
      contentType: "VIDEO",
      contentUrl: "https://www.youtube.com/watch?v=iCYoaTvE9vo",
      textContent: "",
      duration: "",
    },
  },
  {
    label: "Guided tutorial (Video)",
    values: {
      title: "Guided Tutorial",
      contentType: "VIDEO",
      contentUrl: "https://www.youtube.com/watch?v=efC0Nw5rdA4",
      textContent: "",
      duration: "",
    },
  },
  {
    label: "Reading material (Document)",
    values: {
      title: "Reading Material",
      contentType: "DOCUMENT",
      contentUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      textContent: "",
      duration: "300",
    },
  },
  {
    label: "Practice exercise (Text)",
    values: {
      title: "Practice Exercise",
      contentType: "TEXT",
      contentUrl: "",
      textContent: "Complete the practice task, record your answer, and review the key concepts from this section.",
      duration: "600",
    },
  },
  {
    label: "Reference resource (Link)",
    values: {
      title: "Reference Resource",
      contentType: "LINK",
      contentUrl: "https://docs.oracle.com/en/java/",
      textContent: "",
      duration: "300",
    },
  },
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
  const [durationStatus, setDurationStatus] = useState("");

  // Reset form mỗi lần mở modal hoặc đổi bài học đang sửa
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(lesson, defaultOrderIndex));
      setErrors({});
      setShowPreview(false);
      setDurationStatus("");
    }
  }, [open, lesson, defaultOrderIndex]);

  useEffect(() => {
    if (!open || form.contentType !== "VIDEO") {
      setDurationStatus("");
      return;
    }

    const videoId = getYouTubeVideoId(form.contentUrl);
    if (!videoId) {
      setDurationStatus(form.contentUrl.trim() ? "Enter duration manually for non-YouTube videos." : "");
      return;
    }

    let cancelled = false;
    setDurationStatus("Reading duration from YouTube...");
    const timer = window.setTimeout(() => {
      void getYouTubeDuration(videoId)
        .then((seconds) => {
          if (cancelled) return;
          setForm((current) => ({ ...current, duration: String(seconds) }));
          setErrors((current) => ({ ...current, duration: undefined }));
          setDurationStatus(`Detected automatically: ${formatDuration(seconds)}`);
        })
        .catch(() => {
          if (!cancelled) setDurationStatus("Could not detect duration. You can enter it manually.");
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, form.contentType, form.contentUrl]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const mutation = useMutation({
    mutationFn: (payload: LessonDTO) =>
      isEdit ? lessonApi.update(String(lesson!.id), payload) : lessonApi.create(payload),
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
      isActive: lesson?.isActive ?? true,
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
          {!isEdit && (
            <div className="grid gap-1.5">
              <Label>Lesson template</Label>
              <Select
                onValueChange={(label) => {
                  const template = LESSON_TEMPLATES.find((item) => item.label === label);
                  if (!template) return;
                  setForm((current) => ({ ...current, ...template.values }));
                  setErrors({});
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a lesson template" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TEMPLATES.map((template) => (
                    <SelectItem key={template.label} value={template.label}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose a preset, then customize any field before creating the lesson.
              </p>
            </div>
          )}

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
            <FieldMessage message={errors.title} />
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-3">
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
              <p className="min-h-4 text-xs text-muted-foreground">&nbsp;</p>
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
                <p className="min-h-4 text-xs text-muted-foreground">{durationHint}</p>
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
              <FieldMessage message={errors.orderIndex} />
              {!errors.orderIndex && <p className="min-h-4 text-xs text-muted-foreground">&nbsp;</p>}
            </div>
          </div>

          {needsUrl(form.contentType) ? (
            <div className="grid gap-1.5">
              <Label htmlFor="lesson-url">
                {form.contentType === "VIDEO" ? "Video URL" : "Resource URL"}
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
                    : "https://example.com/material.pdf"
                }
              />
              <FieldMessage message={errors.contentUrl} />
              {form.contentType === "VIDEO" && durationStatus && (
                <p className="text-xs text-muted-foreground">{durationStatus}</p>
              )}
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
