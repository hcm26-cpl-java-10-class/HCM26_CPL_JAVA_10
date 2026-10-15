import { progressApi } from "@/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { ProgressLesson } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface LessonProgressSidebarProps {
    enrollmentId: number;
    lessons: ProgressLesson[];
    activeLessonId?: number;
    onLessonSelect?: (lessonId: number) => void;
}

export function LessonProgressSidebar({
    enrollmentId,
    lessons,
    activeLessonId,
    onLessonSelect,
}: LessonProgressSidebarProps) {
    const queryClient = useQueryClient();
    const queryKey = ["lesson-progress", enrollmentId];
    const { data: progress = [], isLoading, isError } = useQuery({
        queryKey,
        queryFn: () => progressApi.getByEnrollment(enrollmentId),
    });
    const updateProgress = useMutation({
        mutationFn: ({ lessonId, completed }: { lessonId: number; completed: boolean }) =>
            progressApi.setCompleted(enrollmentId, lessonId, completed),
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const completedLessonIds = new Set(
        progress.filter((item) => item.isCompleted).map((item) => item.lessonId),
    );
    const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
    const percentage = lessons.length === 0
        ? 0
        : Math.round((completedCount / lessons.length) * 100);

    return (
        <aside className="w-full rounded-xl border bg-card p-4 lg:w-80" aria-label="Course lessons">
            <div className="mb-5">
                <div className="flex items-center justify-between gap-4">
                    <h2 className="font-semibold">Course progress</h2>
                    <span className="text-sm font-medium">{percentage}%</span>
                </div>
                <Progress value={percentage} className="mt-2" aria-label={`${percentage}% complete`} />
                <p className="mt-2 text-xs text-muted-foreground">
                    {completedCount} of {lessons.length} lessons completed
                </p>
            </div>

            {isLoading ? (
                <p role="status" className="text-sm text-muted-foreground">Loading progress...</p>
            ) : isError ? (
                <p role="alert" className="text-sm text-destructive">Could not load lesson progress.</p>
            ) : lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons are available yet.</p>
            ) : (
                <ol className="space-y-1">
                    {lessons.map((lesson, index) => {
                        const completed = completedLessonIds.has(lesson.id);
                        const pending = updateProgress.isPending
                            && updateProgress.variables?.lessonId === lesson.id;

                        return (
                            <li
                                key={lesson.id}
                                className={activeLessonId === lesson.id
                                    ? "rounded-lg bg-accent"
                                    : "rounded-lg hover:bg-accent/60"}
                            >
                                <div className="flex items-start gap-3 p-3">
                                    <Checkbox
                                        checked={completed}
                                        disabled={pending}
                                        aria-label={`Mark ${lesson.title} as ${completed ? "incomplete" : "complete"}`}
                                        onCheckedChange={(checked) => updateProgress.mutate({
                                            lessonId: lesson.id,
                                            completed: checked === true,
                                        })}
                                    />
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 text-left"
                                        onClick={() => onLessonSelect?.(lesson.id)}
                                    >
                                        <span className="block text-xs text-muted-foreground">
                                            Lesson {index + 1}
                                            {lesson.sectionTitle ? ` · ${lesson.sectionTitle}` : ""}
                                        </span>
                                        <span className={completed ? "block text-sm line-through opacity-70" : "block text-sm"}>
                                            {lesson.title}
                                        </span>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </aside>
    );
}
