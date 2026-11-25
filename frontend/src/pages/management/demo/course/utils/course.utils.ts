import type { CourseLevel } from "@/types";

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const LEVEL_BADGE_CLASS: Record<CourseLevel, string> = {
  BEGINNER: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  INTERMEDIATE: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  ADVANCED: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

/** Thời lượng (giây) -> "1h 05m", "12m", "45s". */
export function formatTotalDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

/** Thời lượng bài học (giây) -> "2:05" hoặc "1:02:05". */
export function formatLessonDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) return "";
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string } | undefined;
  return anyError?.response?.data?.message || anyError?.message || fallback;
}

export function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | undefined)?.response?.status;
}
