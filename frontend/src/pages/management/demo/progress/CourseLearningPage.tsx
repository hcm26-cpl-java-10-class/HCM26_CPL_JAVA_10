import { learningCurriculum, type LearningItem } from "@/utils/learning-curriculum";
import { AssessmentPreparationContent } from "@/pages/student/StudentExamPreparationPage";
import { assessmentPreparationPath } from "@/utils/assessment-navigation";
import { COURSE_GRADE_STATUS_LABEL } from "@/types/features/course-my-scores";

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
import { useStudyTimeTracker } from "@/hooks/useStudyTimeTracker";
import { AssessmentIndicator, lessonOutcome, LessonProgressSidebar } from "./LessonProgressSidebar";
import { useAdminStudentPreview } from "@/pages/student/useAdminStudentPreview";
import { CourseReviewPrompt } from "../course_review/components/CourseReviewPrompt";

export function CourseLearningPage() {
  const { id } = useParams();
  const enrollmentId = Number(id);

  // Deep link from the "your question was answered" email: ?lessonId=&questionId=
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedExamId = Number(searchParams.get("assessmentId")) || undefined;
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

  // Exams linked to this course's curriculum, with lock state computed by the backend.
  const examsQuery = useQuery({
    queryKey: ["course-exams", courseId],
    queryFn: () => examApi.listByCourse(courseId as number),
    enabled: !!courseId,
  });

  const openExam = (exam: CourseExam) => {
    navigate(assessmentPreparationPath(exam.id, `/enrollments/${enrollmentId}/learn${exam.lessonId || activeLessonId ? `?lessonId=${exam.lessonId || activeLessonId}` : ""}`));
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
    enabled: progressQuery.data?.courseCompleted === true,
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
        (!lessons.some((lesson) => lesson.lessonId === activeLessonId) || (requestedLessonId != null && requestedLessonId !== activeLessonId))
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
      void queryClient.invalidateQueries({ queryKey: ["student-exam-locks"] });
      toast.success("Progress updated.");
      void queryClient.invalidateQueries({ queryKey: ["personal-learning-roadmap"] });
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

  const currentLessonExams = (examsQuery.data ?? []).filter(
      (exam) => exam.lessonId === activeLessonId
  );

  const embeddedExamId = requestedExamId ?? (["QUIZ", "EXAM", "ASSIGNMENT"].includes(currentLesson?.contentType ?? "") ? currentLessonExams[0]?.id : undefined);
  const embeddedReturn = assessmentPreparationPath(embeddedExamId ?? 0, `/enrollments/${enrollmentId}/learn${activeLessonId ? `?lessonId=${activeLessonId}` : ""}`);
  const curriculum = learningCurriculum(progressQuery.data?.lessons ?? [], examsQuery.data ?? []);
  const itemIndex = curriculum.findIndex(item => embeddedExamId
    ? "exam" in item && item.exam.id === embeddedExamId
    : "lesson" in item && item.lesson.lessonId === activeLessonId);
  const previousItem = itemIndex > 0 ? curriculum[itemIndex - 1] : undefined;
  const nextItem = itemIndex >= 0 ? curriculum[itemIndex + 1] : undefined;
  const currentOutcome = lessonOutcome(currentLessonExams, progressQuery.data?.assessmentOutcomes ?? {});

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
    setSearchParams({ lessonId: String(lesson.lessonId) });
    setActiveLessonId(lesson.lessonId);
    recordAccess(lesson.lessonId);
  };

  // Ghi nhận thời gian học viên dành cho bài đang xem (mỗi 30s + khi rời bài).
  useStudyTimeTracker({
    lessonId: embeddedExamId ? undefined : activeLessonId,
    onTick: (seconds) => {
      if (!activeLessonId) return;
      progressApi
        .addStudyTime(enrollmentId, activeLessonId, seconds)
        .catch(() => {
            // Bỏ qua lỗi ghi nhận thời gian để không ảnh hưởng trải nghiệm học.
        });
    },
  });

  const selectItem = (item: LearningItem | undefined) => {
    if (!item) return;
    if ("exam" in item) openExam(item.exam);
    else selectLesson(item.lesson);
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
          ) : progressQuery.data.lessons.length === 0 && !requestedExamId ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-dashed p-12 text-center">
                  <BookOpen className="mx-auto size-12 text-muted-foreground" />

                  <h1 className="mt-4 text-xl font-semibold">
                    {progressQuery.data.courseName}
                  </h1>

                  <p className="mt-2 text-sm text-muted-foreground">
                    This course has no lessons yet.
                  </p>
                </div>

                <LessonProgressSidebar
                    progress={progressQuery.data}
                    activeLessonId={activeLessonId}
                    activeExamId={embeddedExamId}
                    onLessonSelect={selectLesson}
                    exams={examsQuery.data}
                    onExamOpen={openExam}
                />
              </div>
          ) : (
              <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
                <LessonProgressSidebar
                    progress={progressQuery.data}
                    activeLessonId={activeLessonId}
                    activeExamId={embeddedExamId}
                    onLessonSelect={selectLesson}
                    exams={examsQuery.data}
                    onExamOpen={openExam}
                />

                <main className="min-w-0 rounded-2xl border bg-card p-4 sm:p-7">
                  <p className="text-sm text-muted-foreground">
                    {progressQuery.data.courseName}
                  </p>

                  <div className="mt-3 rounded border p-3 text-sm" role="status">
                    <p>{progressQuery.data.courseCompleted ? "Course completed" : "Course in progress"} · {COURSE_GRADE_STATUS_LABEL[progressQuery.data.assessmentStatus] || progressQuery.data.assessmentStatus}</p>
                    {progressQuery.data.overallScore != null && <p>Final course grade: {progressQuery.data.overallScore.toFixed(2)} / 10</p>}
                    {!progressQuery.data.courseCompleted && <p className="text-muted-foreground">Complete the lessons and meet the course assessment requirements to earn your certificate.</p>}
                  </div>

                  {progressQuery.data.courseCompleted === true &&
                      courseCertificate?.verificationToken && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                            <div>
                              <p className="font-semibold">Course completed</p>
                              <p className="text-sm opacity-80">
                                Your certificate is ready.
                              </p>
                            </div>

                            <Button asChild className="bg-green-600 text-white hover:bg-green-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700">
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

                  {progressQuery.data.courseCompleted === true &&
                      <CourseReviewPrompt
                        courseId={progressQuery.data.courseId}
                      />
                  }

                  {embeddedExamId && examsQuery.isLoading ? <p role="status">Loading assessment selection…</p> : embeddedExamId && (examsQuery.isError || !examsQuery.data?.some(e => e.id === embeddedExamId)) ? <p role="alert" className="mt-4 rounded-xl border p-5">This assessment is unavailable in this course.</p> : embeddedExamId ? <AssessmentPreparationContent key={embeddedExamId} id={embeddedExamId} returnTo={embeddedReturn}
                    onPrevious={previousItem ? () => selectItem(previousItem) : undefined}
                    onNext={nextItem ? () => selectItem(nextItem) : undefined} /> : currentLesson && (
                      <div className="mt-3">
                        {["QUIZ", "EXAM", "ASSIGNMENT"].includes(currentLesson.contentType)
                          ? <div role="status" className="rounded-xl border p-5"><h1 className="text-xl font-semibold">{currentLesson.title}</h1><p>No linked assessment is currently available.</p></div>
                          : <LessonPreview lesson={currentLesson} restrictSeeking />}

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
                              disabled={!previousItem || examsQuery.isLoading || examsQuery.isError}
                              onClick={() =>
                                  selectItem(previousItem)
                              }
                          >
                            <ChevronLeft className="size-4" /> Previous lesson
                          </Button>

                          <div className="flex flex-wrap justify-end gap-3">
                            {["QUIZ", "EXAM", "ASSIGNMENT"].includes(currentLesson.contentType) ? <div role="status" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                              <AssessmentIndicator outcome={currentOutcome} />
                              {({PASSED:"Assessment passed",FAILED:"Assessment failed",COMPLETED:"Assessment completed",AWAITING_RESULTS:"Awaiting graded, published results",IN_PROGRESS:"Assessment in progress",NOT_STARTED:"Complete the assessment to see your result"})[currentOutcome ?? "NOT_STARTED"]}
                            </div> : <>
                            <Button
                                disabled={
                                    currentLesson.completed ||
                                    ["QUIZ", "EXAM", "ASSIGNMENT"].includes(currentLesson.contentType) ||
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
                                      : ["QUIZ", "EXAM", "ASSIGNMENT"].includes(currentLesson.contentType) ? "Completes after graded results are published" : "Mark lesson complete"}
                            </Button></>}

                            <Button
                                variant="outline"
                                disabled={
                                    !nextItem || examsQuery.isLoading || examsQuery.isError
                                }
                                onClick={() =>
                                    selectItem(nextItem)
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
                                  {progressQuery.data.assessmentOutcomes?.[exam.id] ? <AssessmentIndicator outcome={progressQuery.data.assessmentOutcomes[exam.id]} /> : exam.locked ? (
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
                                {exam.locked ? "Locked" : "View assessment"}
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
