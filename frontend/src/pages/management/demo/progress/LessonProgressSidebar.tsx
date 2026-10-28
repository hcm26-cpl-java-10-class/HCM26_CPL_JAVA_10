import { Progress } from "@/components/ui/progress";
import type { EnrollmentProgress, LessonProgressItem } from "@/types";
import { CheckCircle2, Circle } from "lucide-react";

interface LessonProgressSidebarProps {
  progress: EnrollmentProgress;
  activeLessonId?: number;
  onLessonSelect: (lesson: LessonProgressItem) => void;
}

export function LessonProgressSidebar({
  progress,
  activeLessonId,
  onLessonSelect,
}: LessonProgressSidebarProps) {
  const sections = progress.lessons.reduce<Map<number, LessonProgressItem[]>>((groups, lesson) => {
    const group = groups.get(lesson.sectionId) ?? [];
    group.push(lesson);
    groups.set(lesson.sectionId, group);
    return groups;
  }, new Map());

  return (
    <aside className="space-y-5 rounded-2xl border bg-card p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-medium">
          <span>Course progress</span>
          <span>{progress.progressPercentage}%</span>
        </div>
        <Progress value={progress.progressPercentage} aria-label="Course progress" />
        <p className="text-xs text-muted-foreground">
          {progress.completedLessons} of {progress.totalLessons} lessons completed
        </p>
      </div>

      <div className="space-y-5">
        {[...sections.entries()].map(([sectionId, lessons]) => (
          <section key={sectionId} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {lessons[0]?.sectionTitle || `Section ${sectionId}`}
            </h2>
            <div className="space-y-1">
              {lessons.map((lesson) => {
                const active = lesson.lessonId === activeLessonId;
                return (
                  <div
                    key={lesson.lessonId}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                      onClick={() => onLessonSelect(lesson)}
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{lesson.title}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
