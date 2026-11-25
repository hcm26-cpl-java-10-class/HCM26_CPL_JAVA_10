import { Progress } from "@/components/ui/progress";
import type { CourseExam, EnrollmentProgress, LessonProgressItem } from "@/types";
import { CheckCircle2, Circle, ClipboardList, Lock, CircleAlert, Clock3 } from "lucide-react";

interface LessonProgressSidebarProps {
  progress: EnrollmentProgress;
  activeLessonId?: number;
  activeExamId?: number;
  onLessonSelect: (lesson: LessonProgressItem) => void;
  exams?: CourseExam[];
  onExamOpen?: (exam: CourseExam) => void;
}

type Outcome = "PASSED" | "FAILED" | "COMPLETED" | "AWAITING_RESULTS" | "IN_PROGRESS" | "NOT_STARTED";
export function AssessmentIndicator({ outcome }: { outcome?: Outcome }) {
  const label = outcome === "PASSED" ? "Passed" : outcome === "FAILED" ? "Failed" : outcome === "COMPLETED" ? "Completed (no pass requirement)" : outcome === "AWAITING_RESULTS" ? "Awaiting results" : outcome === "IN_PROGRESS" ? "In progress" : "Not started";
  return <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
    {outcome === "PASSED" ? <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
      : outcome === "FAILED" ? <CircleAlert aria-hidden="true" className="size-4 text-red-600 dark:text-red-400" />
      : outcome === "AWAITING_RESULTS" || outcome === "IN_PROGRESS" ? <Clock3 aria-hidden="true" className="size-4 text-muted-foreground" />
      : <ClipboardList aria-hidden="true" className="size-4 text-muted-foreground" />}
  </span>;
}
export function lessonOutcome(exams: CourseExam[], outcomes: Record<string, Outcome>): Outcome | undefined {
  const states=exams.map(e=>outcomes[e.id]);
  if (states.includes("FAILED")) return "FAILED";
  if (states.length && states.every(s=>s==="PASSED")) return "PASSED";
  if (states.includes("AWAITING_RESULTS")) return "AWAITING_RESULTS";
  if (states.includes("IN_PROGRESS")) return "IN_PROGRESS";
  if (states.length && states.every(s=>s==="PASSED" || s==="COMPLETED")) return "COMPLETED";
  return undefined;
}
function ExamRow({ exam, onOpen, outcome, active }: { exam: CourseExam; onOpen?: (exam: CourseExam) => void; outcome?: Outcome; active?: boolean }) {
  return (
      <button
          type="button"
          aria-current={active ? "page" : undefined}
          aria-disabled={exam.locked}
          title={exam.locked ? (exam.lockReason ?? "Locked") : undefined}
          onClick={() => onOpen?.(exam)}
          className={`ml-6 flex w-[calc(100%-1.5rem)] min-w-0 items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-sm ${
              active ? "border-primary bg-primary/10" : exam.locked ? "cursor-not-allowed opacity-60" : "hover:bg-muted/60"
          }`}
      >
        {outcome && outcome !== "NOT_STARTED" ? <AssessmentIndicator outcome={outcome} /> : exam.locked ? (
            <Lock className="size-4 shrink-0 text-muted-foreground" />
        ) : (
            <ClipboardList className="size-4 shrink-0 text-primary" />
        )}
        <span className="min-w-0 flex-1">
        <span className="block truncate">{exam.title}</span>
          {exam.locked && exam.lockReason && (
              <span className="block text-xs text-muted-foreground">{exam.lockReason}</span>
          )}
      </span>
      </button>
  );
}

export function LessonProgressSidebar({
                                        progress,
                                        activeLessonId,
                                        activeExamId,
                                        onLessonSelect,
                                        exams = [],
                                        onExamOpen,
                                      }: LessonProgressSidebarProps) {
  const outcomes = progress.assessmentOutcomes ?? {};
  const sections = progress.lessons.reduce<Map<number, LessonProgressItem[]>>((groups, lesson) => {
    const group = groups.get(lesson.sectionId) ?? [];
    group.push(lesson);
    groups.set(lesson.sectionId, group);
    return groups;
  }, new Map());

  return (
      <aside className="space-y-3 rounded-2xl border bg-card p-4">
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

        <div className="space-y-3">
          {[...sections.entries()].map(([sectionId, lessons]) => (
              <section key={sectionId} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {lessons[0]?.sectionTitle || `Section ${sectionId}`}
                </h2>
                <div className="space-y-1">
                  {lessons.map((lesson) => {
                    const active = !activeExamId && lesson.lessonId === activeLessonId;
                    const lessonExams = exams.filter((e) => e.lessonId === lesson.lessonId);
                    return (
                        <div key={lesson.lessonId} className="space-y-1">
                          <div
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                                  active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"
                              }`}
                          >
                            <button
                                type="button"
                                aria-current={active ? "page" : undefined}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                                onClick={() => onLessonSelect(lesson)}
                            >
                              {["QUIZ", "EXAM", "ASSIGNMENT"].includes(lesson.contentType) ? <AssessmentIndicator outcome={lessonOutcome(lessonExams, outcomes)} /> : lesson.completed ? (
                                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                              ) : (
                                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              <span className="truncate">{lesson.title}</span>
                            </button>
                          </div>
                          {lessonExams.map((exam) => (
                              <ExamRow key={exam.id} active={exam.id === activeExamId} exam={exam} outcome={outcomes[exam.id]} onOpen={onExamOpen} />
                          ))}
                        </div>
                    );
                  })}
                  {exams
                      .filter((e) => e.sectionId === sectionId && e.lessonId == null)
                      .map((exam) => (
                          <ExamRow key={exam.id} active={exam.id === activeExamId} exam={exam} outcome={outcomes[exam.id]} onOpen={onExamOpen} />
                      ))}
                </div>
              </section>
          ))}
          {exams.some((exam) =>
              exam.category === "FINAL_TEST" &&
              exam.sectionId == null &&
              exam.lessonId == null
          ) && (
              <section className="space-y-2 border-t pt-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Final exam
                </h2>
                <div className="space-y-1">
                  {exams
                      .filter((exam) => exam.category === "FINAL_TEST")
                      .filter((exam) => exam.sectionId == null && exam.lessonId == null)
                      .map((exam) => (
                          <ExamRow key={exam.id} active={exam.id === activeExamId} exam={exam} outcome={outcomes[exam.id]} onOpen={onExamOpen} />
                      ))}
                </div>
              </section>
          )}
        </div>
      </aside>
  );
}