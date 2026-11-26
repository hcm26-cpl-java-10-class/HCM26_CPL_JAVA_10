import { useEffect, useRef } from "react";

type Options = {
  /** Bài học đang xem. */
  lessonId?: number;
  /** Hàm gửi số giây đã học lên server. */
  onTick: (seconds: number) => void;
  /** Chu kỳ ghi nhận (ms). Mặc định 30 giây. */
  intervalMs?: number;
  /** Tạm dừng khi tab ẩn (mặc định có). */
  pauseWhenHidden?: boolean;
};

/**
 * Đo thời gian học viên dành cho bài đang xem.
 *
 * <p>Cứ mỗi {@code intervalMs} hàm {@code onTick} được gọi với số giây đã trôi qua
 * kể từ lần ghi nhận gần nhất. Số giây bị bỏ qua khi tab ẩn để không tính nhầm
 * thời gian người học đang ở nơi khác.
 */
export function useStudyTimeTracker({
  lessonId,
  onTick,
  intervalMs = 30_000,
  pauseWhenHidden = true,
}: Options) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!lessonId) return;

    let elapsed = 0;
    let lastTick = Date.now();

    const timer = window.setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.floor((now - lastTick) / 1000);
      lastTick = now;

      if (pauseWhenHidden && document.hidden) return;
      if (deltaSeconds <= 0) return;

      elapsed += deltaSeconds;
      onTickRef.current(elapsed);
      elapsed = 0;
    }, intervalMs);

    // Ghi nhận nốt phần thời gian còn dư khi rời bài / unmount.
    const flush = () => {
      const now = Date.now();
      const deltaSeconds = Math.floor((now - lastTick) / 1000);
      lastTick = now;
      if (pauseWhenHidden && document.hidden) return;
      if (deltaSeconds <= 0) return;
      elapsed += deltaSeconds;
      onTickRef.current(elapsed);
      elapsed = 0;
    };

    window.addEventListener("beforeunload", flush);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [lessonId, intervalMs, pauseWhenHidden]);
}
