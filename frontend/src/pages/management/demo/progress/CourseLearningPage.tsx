
import { certificateApi, examApi, progressApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseExam, EnrollmentProgress, LessonProgressItem } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Flag,
  Lock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { LessonPreview } from "../lesson/components/LessonPreview";
import { LessonQnA } from "../lesson/components/LessonQnA";
import { LessonReportDialog } from "../lesson/components/LessonReportDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { LessonProgressSidebar } from "./LessonProgressSidebar";
import { useAdminStudentPreview } from "@/pages/student/useAdminStudentPreview";

export function CourseLearningPage() {
  const { id } = useParams();
  const enrollmentId = Number(id);

  // Deep link from the "your question was answered" email: ?lessonId=&questionId=
  const [searchParams] = useSearchParams();
  const requestedLessonId = Number(searchParams.get("lessonId")) || undefined;
  const requestedQuestionId = Number(searchParams.get("questionId")) || undefined;

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdminStudentPreview = useAdminStudentPreview();

  const coursesPath = isAdminStudentPreview ? "/courses" : "/enrollments";
  const coursesLabel = isAdminStudentPreview ? "Courses" : "My courses";

  const [activeLessonId, setActiveLessonId] = useState<number>();
  const [answerDraft, setAnswerDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  const { hasPermission } = usePermissions();
  const canReport = hasPermission("LESSON_REPORT_CREATE");

  const progressQuery = useQuery({
    queryKey: ["lesson-progress", enrollmentId],
    queryFn: () => progressApi.getByEnrollment(enrollmentId),
    enabled: Number.isInteger(enrollmentId) && enrollmentId > 0,
  });

  const courseId = progressQuery.data?.courseId;

  // Exams linked to this course's lessons/sections, with lock state computed by the backend.
  const examsQuery = useQuery({
    queryKey: ["course-exams", courseId],
    queryFn: () => examApi.listByCourse(courseId as number),
    enabled: !!courseId,
  });

  const openExam = (exam: CourseExam) => {
    if (exam.locked) {
      toast.error(
          exam.lockReason ?? "Complete the required lessons to unlock this exam."
      );
      return;
    }

    navigate(`/student/exams/${exam.id}/take`);
  };

  const certificateQuery = useQuery({
    queryKey: ["course-certificate", enrollmentId, isAdminStudentPreview],
    queryFn: async () => {
      if (isAdminStudentPreview) return certificateApi.getByEnrollment(enrollmentId);

      const certificates = await certificateApi.getMyCertificates();

      return certificates.find(
          (certificate) => certificate.courseId === progressQuery.data?.courseId
      );
    },
    enabled: progressQuery.data?.progressPercentage === 100,
    retry: false,
  });

  const courseCertificate = certificateQuery.data;

  const { mutate: recordAccess } = useMutation({
    mutationFn: (lessonId: number) =>
        progressApi.recordAccess(enrollmentId, lessonId),

    onSuccess: (updated: EnrollmentProgress) => {
      queryClient.setQueryData(["lesson-progress", enrollmentId], updated);
    },

    onError: () => {
      toast.error("Could not record lesson access.");
    },
  });

  useEffect(() => {
    const lessons = progressQuery.data?.lessons ?? [];

    if (
        lessons.length &&
        !lessons.some((lesson) => lesson.lessonId === activeLessonId)
    ) {
      const initialLesson =
          lessons.find((lesson) => lesson.lessonId === requestedLessonId) ??
          lessons.find(
              (lesson) => lesson.lessonId === progressQuery.data?.lastLessonId
          ) ??
          lessons.find((lesson) => !lesson.completed) ??
          lessons[0];

      setActiveLessonId(initialLesson.lessonId);
      recordAccess(initialLesson.lessonId);
    }
  }, [activeLessonId, progressQuery.data, recordAccess, requestedLessonId]);

  const updateMutation = useMutation({
    mutationFn: ({
                   lessonId,
                   completed,
                 }: {
      lessonId: number;
      completed: boolean;
    }) => progressApi.setCompleted(enrollmentId, lessonId, completed),

    onSuccess: (updated: EnrollmentProgress) => {
      queryClient.setQueryData(["lesson-progress", enrollmentId], updated);

      // Completing a lesson can unlock exams: refresh their lock state.
      void queryClient.invalidateQueries({ queryKey: ["course-exams"] });

      toast.success("Progress updated.");
    },

    onError: (error: any) => {
      toast.error(
          error?.response?.data?.message || "Could not update progress."
      );
    },
  });

  const currentLesson = progressQuery.data?.lessons.find(
      (lesson) => lesson.lessonId === activeLessonId
  );

  const currentLessonIndex =
      progressQuery.data?.lessons.findIndex(
          (lesson) => lesson.lessonId === activeLessonId
      ) ?? -1;

  const currentLessonExams = (examsQuery.data ?? []).filter(
      (exam) => exam.lessonId === activeLessonId
  );

  useEffect(() => {
    setAnswerDraft(currentLesson?.studentAnswer ?? "");
  }, [currentLesson?.lessonId, currentLesson?.studentAnswer]);

  const answerMutation = useMutation({
    mutationFn: ({
                   lessonId,
                   answer,
                 }: {
      lessonId: number;
      answer: string;
    }) => progressApi.saveAnswer(enrollmentId, lessonId, answer),

    onSuccess: (updated: EnrollmentProgress) => {
      queryClient.setQueryData(["lesson-progress", enrollmentId], updated);
      toast.success("Answer saved.");
    },

    onError: (error: any) => {
      toast.error(
          error?.response?.data?.message || "Could not save answer."
      );
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
      <MainLayout
          dense
          pathName={{ enrollments: coursesLabel, learn: "Learn" }}
          pathLinks={{ enrollments: coursesPath }}
      >
        <div className="mx-auto w-full max-w-7xl space-y-3">
          <Button asChild variant="ghost" className="-ml-3">
            <Link to={coursesPath}>
              <ArrowLeft className="size-4" /> Back to{" "}
              {coursesLabel.toLowerCase()}
            </Link>
          </Button>

          {progressQuery.isLoading ? (
              <p
                  role="status"
                  className="rounded-xl border p-10 text-center text-sm text-muted-foreground"
              >
                Loading course...
              </p>
          ) : progressQuery.isError || !progressQuery.data ? (
              <div
                  role="alert"
                  className="space-y-3 rounded-xl border border-destructive/30 p-4"
              >
                <p className="text-sm text-destructive">
                  Could not load this course.
                </p>

                <Button
                    variant="outline"
                    onClick={() => void progressQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
          ) : progressQuery.data.lessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-12 text-center">
                <BookOpen className="mx-auto size-12 text-muted-foreground" />

                <h1 className="mt-4 text-xl font-semibold">
                  {progressQuery.data.courseName}
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                  This course has no lessons yet.
                </p>
              </div>
          ) : (
              <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                <LessonProgressSidebar
                    progress={progressQuery.data}
                    activeLessonId={activeLessonId}
                    onLessonSelect={selectLesson}
                    exams={examsQuery.data}
                    onExamOpen={openExam}
                />

                <main className="min-w-0 rounded-2xl border bg-card p-4 sm:p-7">
                  <p className="text-sm text-muted-foreground">
                    {progressQuery.data.courseName}
                  </p>

                  {progressQuery.data.progressPercentage === 100 &&
                      courseCertificate?.verificationToken && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                            <div>
                              <p className="font-semibold">Course completed</p>
                              <p className="text-sm opacity-80">
                                Your certificate is ready.
                              </p>
                            </div>

                            <Button asChild>
                              <Link
                                  to={`/my-certificates/${encodeURIComponent(
                                      courseCertificate.verificationToken
                                  )}`}
                              >
                                <Award className="size-4" /> View certificate
                              </Link>
                            </Button>
                          </div>
                      )}

                  {currentLesson && (
                      <div className="mt-3">
                        <LessonPreview lesson={currentLesson} />

                        {canReport && (
                            <div className="mt-3 flex justify-end">
                              <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground"
                                  onClick={() => setReportOpen(true)}
                              >
                                <Flag className="size-4" /> Report a problem
                              </Button>

                              <LessonReportDialog
                                  key={currentLesson.lessonId}
                                  lessonId={currentLesson.lessonId}
                                  lessonTitle={currentLesson.title}
                                  open={reportOpen}
                                  onOpenChange={setReportOpen}
                              />
                            </div>
                        )}

                        {currentLesson.contentType === "TEXT" && (
                            <section className="mt-5 space-y-2 rounded-xl border bg-muted/20 p-4">
                              <Label htmlFor="student-answer">Your answer</Label>

                              <Textarea
                                  id="student-answer"
                                  value={answerDraft}
                                  maxLength={10_000}
                                  rows={7}
                                  placeholder="Write your answer or notes here..."
                                  onChange={(event) =>
                                      setAnswerDraft(event.target.value)
                                  }
                              />

                              <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          {answerDraft.length}/10000 characters
                        </span>

                                <Button
                                    variant="outline"
                                    disabled={
                                        answerMutation.isPending ||
                                        answerDraft ===
                                        (currentLesson.studentAnswer ?? "")
                                    }
                                    onClick={() =>
                                        answerMutation.mutate({
                                          lessonId: currentLesson.lessonId,
                                          answer: answerDraft,
                                        })
                                    }
                                >
                                  {answerMutation.isPending
                                      ? "Saving..."
                                      : "Save answer"}
                                </Button>
                              </div>
                            </section>
                        )}

                        {/* Previous / Complete / Next lesson buttons */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                          <Button
                              variant="outline"
                              disabled={currentLessonIndex <= 0}
                              onClick={() =>
                                  goToLesson(currentLessonIndex - 1)
                              }
                          >
                            <ChevronLeft className="size-4" /> Previous lesson
                          </Button>

                          <div className="flex flex-wrap justify-end gap-3">
                            <Button
                                disabled={
                                    currentLesson.completed ||
                                    updateMutation.isPending
                                }
                                onClick={() =>
                                    updateMutation.mutate({
                                      lessonId: currentLesson.lessonId,
                                      completed: true,
                                    })
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
                                    currentLessonIndex >=
                                    progressQuery.data.lessons.length - 1
                                }
                                onClick={() =>
                                    goToLesson(currentLessonIndex + 1)
                                }
                            >
                              Next lesson <ChevronRight className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Exams - displayed after lesson completion controls */}
                        {currentLessonExams.map((exam) => (
                            <section
                                key={exam.id}
                                className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4"
                            >
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-medium">
                                  {exam.locked ? (
                                      <Lock className="size-4" />
                                  ) : (
                                      <ClipboardList className="size-4" />
                                  )}

                                  {exam.title}
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  {exam.locked
                                      ? exam.lockReason
                                      : `${exam.durationMinutes} minutes`}
                                </p>
                              </div>

                              <Button
                                  disabled={exam.locked}
                                  onClick={() => openExam(exam)}
                              >
                                {exam.locked ? "Locked" : "Start exam"}
                              </Button>
                            </section>
                        ))}

                        {/* Questions & Answers */}
                        <LessonQnA
                            key={currentLesson.lessonId}
                            lessonId={currentLesson.lessonId}
                            focusQuestionId={
                              currentLesson.lessonId === requestedLessonId
                                  ? requestedQuestionId
                                  : undefined
                            }
                            className="mt-4 border-t pt-3"
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
