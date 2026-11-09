import { useState } from "react";
import { X, BookMarked, Clock, GraduationCap, Loader2 } from "lucide-react";
import type { CourseItem } from "@/pages/management/demo/course/types";

export interface EnrollConfirmationModalProps {
  isOpen: boolean;
  course: CourseItem | null;
  onClose: () => void;
  onConfirm: (course: CourseItem) => Promise<void> | void;
  lessonCount?: number;
  duration?: string;
}

export function EnrollConfirmationModal({
  isOpen,
  course,
  onClose,
  onConfirm,
  lessonCount = 10,
  duration = "57m",
}: EnrollConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !course) return null;

  const courseTitle = course.courseName || course.name;
  const lessons = course.lessonCount ?? lessonCount;
  const courseDuration = course.duration || duration;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    // Brief 400ms loading spinner state before completing enrollment
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      await onConfirm(course);
      onClose();
    } catch {
      // Error handling is handled in caller or toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderLevelBadge = (level: string) => {
    const normalized = (level || "").toLowerCase();
    if (normalized === "beginner") {
      return (
        <span className="rounded-full px-2.5 py-0.5 font-semibold text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-500/30">
          Beginner
        </span>
      );
    }
    if (normalized === "intermediate") {
      return (
        <span className="rounded-full px-2.5 py-0.5 font-semibold text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-500/30">
          Intermediate
        </span>
      );
    }
    return (
      <span className="rounded-full px-2.5 py-0.5 font-semibold text-[11px] bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-500/30">
        Advanced
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-enrollment-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 max-w-md w-full shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <h2
              id="confirm-enrollment-title"
              className="text-lg font-bold text-slate-900 dark:text-zinc-100"
            >
              Confirm Course Enrollment
            </h2>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              {course.category}
            </span>
            {renderLevelBadge(course.courseLevel)}
          </div>
        </div>

        {/* Body Summary Box */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/40 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center flex-shrink-0 shadow-2xs">
              {course.thumbnailUrl ? (
                <img
                  src={course.thumbnailUrl}
                  alt={courseTitle}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-1"
                title={courseTitle}
              >
                {courseTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Instructor: {course.instructor || "Teacher User"}
              </p>
            </div>
          </div>

          {/* Meta row: Lessons & Duration */}
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-400 pt-2 border-t border-slate-200/70 dark:border-zinc-700/60">
            <span className="flex items-center gap-1.5 font-medium">
              <BookMarked className="w-3.5 h-3.5 text-slate-400" />
              {lessons} lessons
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {courseDuration}
            </span>
          </div>

          {/* Confirmation Text */}
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-lg p-2.5">
            Are you sure you want to enroll in this course? Your learning progress will be tracked automatically.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75 shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Enrolling...</span>
              </>
            ) : (
              <span>Confirm &amp; Start Learning</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}