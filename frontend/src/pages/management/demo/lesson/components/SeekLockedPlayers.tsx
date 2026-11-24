import { Lock } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Các player đã khóa tua. Học viên vẫn xem / tạm dừng / tua LÙI được,
 * nhưng không thể nhảy tới đoạn chưa xem (vị trí xa nhất đã xem được ghi nhớ).
 */

/** Sai số cho phép (giây) để tránh giật do độ trễ của timeupdate. */
const TOLERANCE = 1.5;

export function SeekLockedNotice() {
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="size-3.5" /> Skipping ahead is disabled for this lesson. You can rewind and replay.
    </p>
  );
}

/* ---------------------------------- file ---------------------------------- */

export function LockedFileVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const maxWatched = useRef(0);

  useEffect(() => {
    maxWatched.current = 0;
  }, [src]);

  return (
    <video
      key={src}
      ref={ref}
      src={src}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      preload="metadata"
      className="aspect-video w-full rounded-xl border bg-black"
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (!v.seeking && v.currentTime <= maxWatched.current + TOLERANCE) {
          maxWatched.current = Math.max(maxWatched.current, v.currentTime);
        }
      }}
      onSeeking={(e) => {
        const v = e.currentTarget;
        if (v.currentTime > maxWatched.current + TOLERANCE) {
          v.currentTime = maxWatched.current;
        }
      }}
    />
  );
}

/* --------------------------------- audio ---------------------------------- */

export function LockedAudio({ src }: { src: string }) {
  const maxWatched = useRef(0);

  useEffect(() => {
    maxWatched.current = 0;
  }, [src]);

  return (
    <audio
      key={src}
      src={src}
      controls
      controlsList="nodownload noplaybackrate"
      preload="metadata"
      className="w-full"
      onTimeUpdate={(e) => {
        const a = e.currentTarget;
        if (!a.seeking && a.currentTime <= maxWatched.current + TOLERANCE) {
          maxWatched.current = Math.max(maxWatched.current, a.currentTime);
        }
      }}
      onSeeking={(e) => {
        const a = e.currentTarget;
        if (a.currentTime > maxWatched.current + TOLERANCE) a.currentTime = maxWatched.current;
      }}
    />
  );
}

/* --------------------------------- script --------------------------------- */

const scriptPromises = new Map<string, Promise<void>>();
function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  let p = scriptPromises.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        scriptPromises.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(el);
    });
    scriptPromises.set(src, p);
  }
  return p;
}

/* --------------------------------- YouTube -------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function LockedYouTubeVideo({ videoId, title }: { videoId: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: any;
    let timer: number | undefined;
    let maxWatched = 0;

    const init = async () => {
      const w = window as any;
      if (!w.YT?.Player) {
        await new Promise<void>((resolve, reject) => {
          const prev = w.onYouTubeIframeAPIReady;
          w.onYouTubeIframeAPIReady = () => {
            prev?.();
            resolve();
          };
          loadScript("https://www.youtube.com/iframe_api", () => !!w.YT?.Player).catch(reject);
        });
      }
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement("div");
      hostRef.current.replaceChildren(mount);
      player = new w.YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, disablekb: 1, playsinline: 1, origin: window.location.origin },
        events: {
          onReady: () => {
            timer = window.setInterval(() => {
              if (!player?.getCurrentTime) return;
              const t = player.getCurrentTime() as number;
              if (t > maxWatched + TOLERANCE) player.seekTo(maxWatched, true);
              else maxWatched = Math.max(maxWatched, t);
            }, 250);
          },
        },
      });
    };
    void init().catch(() => undefined);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [videoId]);

  return (
    <div
      ref={hostRef}
      role="region"
      aria-label={title}
      className="aspect-video w-full overflow-hidden rounded-xl border bg-black [&_iframe]:h-full [&_iframe]:w-full"
    />
  );
}

/* ---------------------------------- Vimeo --------------------------------- */

export function LockedVimeoVideo({ videoId, title }: { videoId: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: any;
    let maxWatched = 0;

    loadScript("https://player.vimeo.com/api/player.js", () => !!(window as any).Vimeo?.Player)
      .then(() => {
        if (cancelled || !iframeRef.current) return;
        player = new (window as any).Vimeo.Player(iframeRef.current);
        player.on("timeupdate", (d: { seconds: number }) => {
          if (d.seconds <= maxWatched + TOLERANCE) maxWatched = Math.max(maxWatched, d.seconds);
          else void player.setCurrentTime(maxWatched);
        });
        player.on("seeked", (d: { seconds: number }) => {
          if (d.seconds > maxWatched + TOLERANCE) void player.setCurrentTime(maxWatched);
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      try {
        void player?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [videoId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
      <iframe
        ref={iframeRef}
        src={`https://player.vimeo.com/video/${videoId}`}
        title={title}
        className="h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
