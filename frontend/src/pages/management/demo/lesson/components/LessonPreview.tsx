import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Link2, PlayCircle } from "lucide-react";

type LessonDTO = {
  title?: string | null;
  contentType?: string | null;
  contentUrl?: string | null;
  textContent?: string | null;
  duration?: number | null;
};

/** "125" -> "2:05", "3725" -> "1:02:05" */
export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Chỉ cho phép http/https để tránh các URL kiểu javascript: */
function toSafeUrl(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

type VideoSource =
  | { kind: "embed"; src: string }
  | { kind: "file"; src: string }
  | { kind: "unknown"; src: string };

function resolveVideoSource(url: URL): VideoSource {
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (id) return { kind: "embed", src: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id =
      url.searchParams.get("v") ??
      (["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : undefined);
    if (id) return { kind: "embed", src: `https://www.youtube.com/embed/${id}` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
    if (id) return { kind: "embed", src: `https://player.vimeo.com/video/${id}` };
  }
  if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) {
    return { kind: "file", src: url.toString() };
  }
  return { kind: "unknown", src: url.toString() };
}

function OpenLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="size-4" /> {label}
      </a>
    </Button>
  );
}

function InvalidContent({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function VideoPreview({ lesson }: { lesson: LessonDTO }) {
  const url = toSafeUrl(lesson.contentUrl);
  if (!url) return <InvalidContent message="Video URL is missing or invalid." />;

  const source = resolveVideoSource(url);

  if (source.kind === "embed") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
        <iframe
          src={source.src}
          title={lesson.title || "Lesson video"}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  if (source.kind === "file") {
    return (
      <video
        key={source.src}
        src={source.src}
        controls
        preload="metadata"
        className="aspect-video w-full rounded-xl border bg-black"
      />
    );
  }

  // Nguồn video không nhúng được (host lạ) -> mở bằng link
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-8 text-center">
      <PlayCircle className="size-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground break-all">{source.src}</p>
      <OpenLinkButton href={source.src} label="Open video" />
    </div>
  );
}

function TextPreview({ lesson }: { lesson: LessonDTO }) {
  if (!lesson.textContent?.trim()) {
    return <InvalidContent message="This lesson has no text content." />;
  }
  // Render dạng text thuần (không dùng dangerouslySetInnerHTML) -> an toàn với XSS
  return (
    <article className="max-h-[60vh] overflow-y-auto rounded-xl border bg-card p-5 text-sm leading-7 whitespace-pre-wrap break-words">
      {lesson.textContent}
    </article>
  );
}

function ResourcePreview({ lesson }: { lesson: LessonDTO }) {
  const url = toSafeUrl(lesson.contentUrl);
  if (!url) return <InvalidContent message="Resource link is missing or invalid." />;

  const Icon = lesson.contentType === "DOCUMENT" ? FileText : Link2;
  const isPdf = /\.pdf$/i.test(url.pathname);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-background border">
          <Icon className="size-6 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{lesson.title || "Resource"}</p>
          <p className="truncate text-xs text-muted-foreground">{url.hostname}</p>
          <p className="truncate text-xs text-muted-foreground">{url.toString()}</p>
        </div>
        <OpenLinkButton href={url.toString()} label="Open" />
      </div>
      {isPdf && (
        <iframe
          src={url.toString()}
          title={lesson.title || "Document"}
          className="h-[50vh] w-full rounded-xl border"
        />
      )}
    </div>
  );
}

interface LessonPreviewProps {
  lesson: LessonDTO;
  /** Ẩn tiêu đề/badge nếu nơi dùng đã tự hiển thị. */
  hideHeader?: boolean;
}

/**
 * Preview nội dung bài học theo contentType:
 * - VIDEO            -> video (YouTube/Vimeo embed hoặc file mp4/webm)
 * - TEXT             -> nội dung văn bản
 * - DOCUMENT / LINK  -> resource link
 */
export function LessonPreview({ lesson, hideHeader = false }: LessonPreviewProps) {
  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{lesson.title}</h3>
          {lesson.contentType && <Badge variant="secondary">{lesson.contentType}</Badge>}
          {lesson.duration !== undefined && lesson.duration !== null && (
            <span className="text-xs text-muted-foreground">{formatDuration(lesson.duration)}</span>
          )}
        </div>
      )}

      {lesson.contentType === "VIDEO" && <VideoPreview lesson={lesson} />}
      {lesson.contentType === "TEXT" && <TextPreview lesson={lesson} />}
      {(lesson.contentType === "DOCUMENT" || lesson.contentType === "LINK") && (
        <ResourcePreview lesson={lesson} />
      )}
      {!lesson.contentType && <InvalidContent message="No content type selected." />}
    </div>
  );
}

export default LessonPreview;
