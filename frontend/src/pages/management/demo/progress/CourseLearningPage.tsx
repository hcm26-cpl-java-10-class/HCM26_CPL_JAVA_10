import { progressApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EnrollmentProgress, LessonProgressItem } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LessonPreview } from "../lesson/components/LessonPreview";
import { LessonQnA } from "../lesson/components/LessonQnA";
import { LessonProgressSidebar } from "./LessonProgressSidebar";

export function CourseLearningPage() {
  const { id } = useParams();
  const enrollmentId = Number(id);
  const queryClient = useQueryClient();
  const [activeLessonId, setActiveLessonId] = useState<number>();
  const [answerDraft, setAnswerDraft] = useState("");

  const progressQuery = useQuery({
    queryKey: ["lesson-progress", enrollmentId],
    queryFn: () => progressApi.getByEnrollment(enrollmentId),
    enabled: Number.isInteger(enrollmentId) && enrollmentId > 0,
  });

  const { mutate: recordAccess } = useMutation({
    mutationFn: (lessonId: number) => progressApi.recordAccess(enrollmentId, lessonId),
    onSuccess: (updated: EnrollmentProgress) => {
      queryClient.setQueryData(["lesson-progress", enrollmentId], updated);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not record lesson access.");
    },
  });

  useEffect(() => {
    const lessons = progressQuery.data?.lessons ?? [];
    if (lessons.length && !lessons.some((lesson) => lesson.lessonId === activeLessonId)) {
      const initialLesson =
        lessons.find((lesson) => lesson.lessonId === progressQuery.data?.lastLessonId) ??
        lessons.find((lesson) => !lesson.completed) ??
        lessons[0];
      setActiveLessonId(initialLesson.lessonId);
      recordAccess(initialLesson.lessonId);
    }
  }, [activeLessonId, progressQuery.data, recordAccess]);

  const updateMutation = useMutation({
    mutationFn: ({ lessonId, completed }: { lessonId: number; completed: boolean }) =>
      progressApi.setCompleted(enrollmentId, lessonId, completed),
    onSuccess: (updated: EnrollmentProgress) => {
      queryClient.setQueryData(["lesson-progress", enrollmentId], updated);
      toast.success("Progress updated.");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not update progress.");
    },
  });

  const currentLesson = progressQuery.data?.lessons.find(
    (lesson) => lesson.lessonId === activeLessonId,
  );
  const currentLessonIndex = progressQuery.data?.lessons.findIndex(
    (lesson) => lesson.lessonId === activeLessonId,
  ) ?? -1;

  useEffect(() => {
    setAnswerDraft(currentLesson?.studentAnswer ?? "");
  }, [currentLesson?.lessonId, currentLesson?.studentAnswer]);

  const answerMutation = useMutation({
    mutationFn: ({ lessonId, answer }: { lessonId: number; answer: string }) =>
      progressApi.saveAnswer(enrollmentId, lessonId, answer),
    onSuccess: (updated: EnrollmentProgress) => {
      queryClient.setQueryData(["lesson-progress", enrollmentId], updated);
      toast.success("Answer saved.");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Could not save answer.");
    },
  });

  const selectLesson = (lesson: LessonProgressItem) => {
    setActiveLessonId(lesson.lessonId);
    recordAccess(lesson.lessonId);
  };

  const goToLesson = (index: number) => {
    const lesson = progressQuery.data?.lessons[index];
    if (lesson) selectLesson(lesson);
  };

  return (
    <MainLayout pathName={{ enrollments: "My courses", learn: "Learn" }}>
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <Button asChild variant="ghost" className="-ml-3">
          <Link to="/enrollments">
            <ArrowLeft className="size-4" /> Back to my courses
          </Link>
        </Button>

        {progressQuery.isLoading ? (
          <p role="status" className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
            Loading course...
          </p>
        ) : progressQuery.isError || !progressQuery.data ? (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-6">
            <p className="text-sm text-destructive">Could not load this course.</p>
            <Button variant="outline" onClick={() => void progressQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : progressQuery.data.lessons.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <BookOpen className="mx-auto size-12 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">{progressQuery.data.courseName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">This course has no lessons yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <LessonProgressSidebar
              progress={progressQuery.data}
              activeLessonId={activeLessonId}
              onLessonSelect={selectLesson}
            />
            <main className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7">
              <p className="text-sm text-muted-foreground">{progressQuery.data.courseName}</p>
              {currentLesson && (
                <div className="mt-3">
                  <LessonPreview lesson={currentLesson} />
                  {currentLesson.contentType === "TEXT" && (
                    <section className="mt-5 space-y-2 rounded-xl border bg-muted/20 p-4">
                      <Label htmlFor="student-answer">Your answer</Label>
                      <Textarea
                        id="student-answer"
                        value={answerDraft}
                        maxLength={10_000}
                        rows={7}
                        placeholder="Write your answer or notes here..."
                        onChange={(event) => setAnswerDraft(event.target.value)}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          {answerDraft.length}/10000 characters
                        </span>
                        <Button
                          variant="outline"
                          disabled={
                            answerMutation.isPending ||
                            answerDraft === (currentLesson.studentAnswer ?? "")
                          }
                          onClick={() =>
                            answerMutation.mutate({
                              lessonId: currentLesson.lessonId,
                              answer: answerDraft,
                            })
                          }
                        >
                          {answerMutation.isPending ? "Saving..." : "Save answer"}
                        </Button>
                      </div>
                    </section>
                  )}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                    <Button
                      variant="outline"
                      disabled={currentLessonIndex <= 0}
                      onClick={() => goToLesson(currentLessonIndex - 1)}
                    >
                      <ChevronLeft className="size-4" /> Previous lesson
                    </Button>
                    <div className="flex flex-wrap justify-end gap-3">
                      <Button
                        disabled={currentLesson.completed || updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({ lessonId: currentLesson.lessonId, completed: true })
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        {currentLesson.completed
                          ? "Lesson completed"
                          : updateMutation.isPending
                            ? "Saving..."
                            : "Mark lesson complete"}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          currentLessonIndex < 0 ||
                          currentLessonIndex >= progressQuery.data.lessons.length - 1
                        }
                        onClick={() => goToLesson(currentLessonIndex + 1)}
                      >
                        Next lesson <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <LessonQnA
                    key={currentLesson.lessonId}
                    lessonId={currentLesson.lessonId}
                    className="mt-8 border-t pt-6"
                  />
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default CourseLearningPage;