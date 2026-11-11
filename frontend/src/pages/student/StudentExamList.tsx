
import { PassBadge } from "@/components/exam/PassBadge";
import {
    getMyExamAttempts,
    getStudentExams,
    type Exam,
    type ExamAttemptSummary,
} from '@/api/exam.api';
import { examApi } from '@/api';
import { EXAM_CATEGORY_LABEL } from '@/types';
import { formatScore } from '@/utils/examScore';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ExamPasswordDialog } from '@/pages/student/components/ExamPasswordDialog';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
    AlertCircle,
    ArrowRight,
    BookOpen,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Lock,
    RefreshCw,
    CheckCircle2,
    ClipboardList,
    Eye,
    Hourglass,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const examsQueryKey = ['student-exams'] as const;
const attemptsQueryKey = ['student-exam-attempts'] as const;

const PAGE_SIZE = 6;
const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_PAGES = 50;

type ExamLock = { locked: boolean; reason: string | null };

async function fetchAllExams(): Promise<Exam[]> {
    const byId = new Map<number, Exam>();
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < MAX_FETCH_PAGES) {
        const data = await getStudentExams(page, FETCH_PAGE_SIZE);
        (data.content ?? []).forEach((exam) => byId.set(exam.id, exam));
        totalPages = data.totalPages ?? 1;
        page += 1;
    }

    return [...byId.values()];
}

function isExamOpen(exam: Exam, now: number) {
    const started = exam.startTime == null || now >= new Date(exam.startTime).getTime();
    const notClosed = exam.endTime == null || now < new Date(exam.endTime).getTime();
    return started && notClosed;
}

function sortExams(exams: Exam[], now: number) {
    return [...exams].sort((a, b) => {
        // Ưu tiên bài thi đang mở
        const openDifference =
            Number(isExamOpen(b, now)) - Number(isExamOpen(a, now));

        if (openDifference !== 0) {
            return openDifference;
        }

        // Trong cùng nhóm, bài mới tạo hiển thị trước
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

        return dateB - dateA;
    });
}

function examCourseLabel(exam: Exam): string | null {
    if (!exam.courseName) return null;
    return [exam.courseName, exam.sectionTitle, exam.lessonTitle].filter(Boolean).join(' › ');
}

function getAttemptStatus(attempt?: ExamAttemptSummary) {
    if (!attempt) return null;

    switch (attempt.status) {
        case 'IN_PROGRESS':
            return { label: 'In Progress', variant: 'secondary' as const };
        case 'PENDING_REVIEW':
            return { label: 'Pending Essay Grading', variant: 'outline' as const };
        case 'SUBMITTED':
            return { label: 'Completed', variant: 'default' as const };
        default:
            return null;
    }
}

function getPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }

    const pages = new Set<number>([1, total, current - 1, current, current + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const result: Array<number | 'ellipsis'> = [];

    sorted.forEach((p, index) => {
        if (index > 0 && p - sorted[index - 1] > 1) result.push('ellipsis');
        result.push(p);
    });

    return result;
}

function ExamCard({
                      exam,
                      attempt,
                      now,
                      onOpen,
                      onReview,
                      disabled: externallyDisabled,
                      lock,
                  }: {
    exam: Exam;
    attempt?: ExamAttemptSummary;
    now: number;
    onOpen: (examId: number) => void;
    onReview: (attemptId: number) => void;
    disabled: boolean;
    lock?: ExamLock;
}) {
    const status = getAttemptStatus(attempt);
    const isInProgress = attempt?.status === 'IN_PROGRESS';
    const isSubmitted = attempt?.status === 'SUBMITTED' || attempt?.status === 'PENDING_REVIEW';

    const locked = lock?.locked === true && !isInProgress;
    const open = isExamOpen(exam, now) && !locked;
    const courseText = examCourseLabel(exam);

    const hasAttempts = (attempt?.attemptsUsed ?? 0) > 0;
    const isResultPublished = attempt?.resultPublished === true;

    const attemptsRemaining = attempt?.attemptsRemaining ?? 0;
    const outOfAttempts = hasAttempts && attemptsRemaining <= 0 && !isInProgress;

    const isManualRelease =
        exam.resultVisibility === 'MANUAL_RELEASE' ||
        exam.resultVisibility === 'AFTER_EXAM_CLOSED';

    // The student may review their own submission when:
    // - Manual release mode: after submission, even before publication.
    // - Other modes: showAnswersAfterExam is enabled.
    const canViewOwnSubmission =
        isSubmitted &&
        (isManualRelease || exam.showAnswersAfterExam === true);

    // Correct answers are available only after publication and when the
    // answer-release conditions are satisfied.
    const canRevealAnswers =
        isResultPublished &&
        (
            isManualRelease ||
            (exam.showAnswersAfterExam === true && attemptsRemaining <= 0)
        );

    const canReview = canViewOwnSubmission;

    const isDisabled = externallyDisabled || locked || outOfAttempts;

    const buttonLabel = locked
        ? 'Locked'
        : isInProgress
            ? 'Continue Exam'
            : outOfAttempts
                ? 'No Attempts Left'
                : 'Start Exam';

    const displayedScore =
        attempt?.bestScore ?? attempt?.finalScore ?? null;

    return (
        <Card
            className={`flex h-full min-h-[320px] flex-col overflow-hidden border bg-card shadow-sm transition-all hover:shadow-md ${
                open
                    ? 'border-emerald-400 ring-1 ring-emerald-200 dark:border-emerald-500/70 dark:ring-emerald-500/25'
                    : locked
                        ? 'border-amber-300 dark:border-amber-500/50'
                        : 'border-border'
            }`}
        >
            <div className="flex min-w-0 flex-1 flex-col">
                <CardHeader className="space-y-2 p-3 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {open && (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                Open
                            </Badge>
                        )}

                        {status && (
                            <Badge variant={status.variant}>
                                {status.label}
                            </Badge>
                        )}

                        {attempt?.passed != null && (
                            <PassBadge
                                passed={attempt.passed}
                                passScore={attempt.passScore}
                            />
                        )}

                        {locked && (
                            <Badge
                                variant="outline"
                                className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300"
                            >
                                <Lock className="size-3" />
                                Locked
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <CardTitle className="text-base font-semibold leading-snug text-foreground sm:text-lg">
                            {exam.title}
                        </CardTitle>

                        <div className="flex min-h-[18px] items-start">
                            {courseText && (
                                <p
                                    className="flex items-start gap-1.5 text-xs text-muted-foreground"
                                    title={courseText}
                                >
                                    <BookOpen className="mt-0.5 size-3.5 shrink-0" />
                                    <span className="break-words">{courseText}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-4" />
                            {exam.durationMinutes} mins
                        </span>

                        {exam.category && (
                            <span className="inline-flex items-center gap-1.5">
                                <ClipboardList className="size-4" />
                                {EXAM_CATEGORY_LABEL[exam.category]}
                            </span>
                        )}

                        <span>
                            Max Score:{' '}
                            <strong className="font-semibold text-foreground">
                                {formatScore(attempt?.maxScore ?? exam.maxScore ?? 10)}
                            </strong>
                        </span>
                    </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col px-3 py-2">
                    {/* Attempt information: luôn ở cùng vị trí */}
                    <div className="min-h-[32px] flex items-center justify-between gap-2 text-xs">
                        {attempt ? (
                            <>
                <span className="text-muted-foreground">
                    Attempt #{attempt.attemptNumber}
                </span>
                                <span className="font-medium text-foreground">
                    {attempt.attemptsUsed}/{exam.maxAttempts ?? 1} used
                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">
                No attempts started
            </span>
                        )}
                    </div>


                    {/* Result information: giữ vị trí thống nhất giữa các card */}
                    <div className="mt-1 min-h-[100px] space-y-2">
                        {locked && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                <div className="flex items-start gap-2">
                                    <Lock className="mt-0.5 size-4 shrink-0" />
                                    <span>
                    {lock?.reason ?? 'Complete the required lessons to unlock this exam.'}
                </span>
                                </div>
                            </div>
                        )}

                        {attempt?.status === 'PENDING_REVIEW' && isResultPublished && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                    Provisional Score
                                </p>
                                <p className="mt-1 text-lg font-semibold text-amber-900 dark:text-amber-200">
                                    {formatScore(attempt.objectiveScore ?? 0)}
                                    <span className="text-sm font-normal">
                    /{formatScore(attempt.maxScore ?? 10)}
                </span>
                                </p>
                                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                    Essays are still waiting for grading.
                                </p>
                            </div>
                        )}

                        {attempt?.status === 'SUBMITTED' && isResultPublished && displayedScore != null && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                    Highest Score
                                </p>
                                <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                                    {formatScore(displayedScore)}
                                    <span className="text-sm font-normal">
                    /{formatScore(attempt.maxScore ?? 10)}
                </span>
                                </p>
                            </div>
                        )}

                        {hasAttempts && !isResultPublished && !isInProgress && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                                <div className="flex items-start gap-2">
                                    <Hourglass className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                            Result Awaiting Publication
                                        </p>
                                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                                            Your teacher has not released the result yet.
                                            {canViewOwnSubmission
                                                ? ' You can still review your own submission.'
                                                : ' Your score and answers are currently unavailable.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isInProgress && (
                            <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
                                Your draft has been saved. You can continue your exam.
                            </div>
                        )}

                        {!attempt && !locked && (
                            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                                You have not started this exam yet.
                            </p>
                        )}

                        {outOfAttempts && (
                            <p className="text-xs text-muted-foreground">
                                You have used all available attempts.
                            </p>
                        )}
                    </div>

                </CardContent>
            </div>

            <CardFooter className="mt-auto flex min-h-[88px] flex-col gap-1.5 border-t border-border bg-muted/20 p-3">
                <div className="flex min-h-[40px] w-full items-center justify-center">
                    {canReview && attempt ? (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => onReview(attempt.id)}
                        >
                            <Eye className="size-4" />
                            {canRevealAnswers
                                ? 'View Results & Answers'
                                : 'View My Submission'}
                        </Button>
                    ) : isResultPublished && !canReview && isSubmitted ? (
                        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                            <CheckCircle2 className="size-3.5" />
                            Result published
                        </div>
                    ) : null}
                </div>

                {/* Nút chính luôn nằm ở hàng cuối */}
                <Button
                    className="w-full bg-cyan-600 text-white hover:bg-cyan-500"
                    disabled={isDisabled}
                    onClick={() => onOpen(exam.id)}
                >
                    {buttonLabel}
                    {locked
                        ? <Lock className="size-4" />
                        : <ArrowRight className="size-4" />
                    }
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function StudentExamList() {
    const navigate = useNavigate();
    const [passwordExam, setPasswordExam] = useState<Exam | null>(null);
    const [now] = useState(() => Date.now());
    const [page, setPage] = useState(1);

    const examsQuery = useQuery({
        queryKey: examsQueryKey,
        queryFn: fetchAllExams,
    });

    const attemptsQuery = useQuery({
        queryKey: attemptsQueryKey,
        queryFn: getMyExamAttempts,
    });

    const isLoading = examsQuery.isLoading || attemptsQuery.isLoading;
    const hasError = examsQuery.isError || attemptsQuery.isError;

    const retry = () => {
        void examsQuery.refetch();
        void attemptsQuery.refetch();
    };

    const exams = sortExams(examsQuery.data ?? [], now);
    const attempts = attemptsQuery.data ?? [];

    const totalPages = Math.max(1, Math.ceil(exams.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const firstIndex = (currentPage - 1) * PAGE_SIZE;
    const pagedExams = exams.slice(firstIndex, firstIndex + PAGE_SIZE);

    const goToPage = (next: number) => {
        setPage(Math.min(Math.max(next, 1), totalPages));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const courseIds = Array.from(
        new Set(exams.map((item) => item.courseId).filter((id): id is number => id != null)),
    );

    const lockQueries = useQueries({
        queries: courseIds.map((courseId) => ({
            queryKey: ['course-exams', courseId],
            queryFn: () => examApi.listByCourse(courseId),
            retry: false,
            staleTime: 30_000,
        })),
    });

    const lockById = new Map<number, ExamLock>();

    lockQueries.forEach((query) =>
        query.data?.forEach((item) =>
            lockById.set(item.id, {
                locked: item.locked,
                reason: item.lockReason,
            }),
        ),
    );

    const openExam = (examId: number) => {
        const exam = exams.find((item) => item.id === examId);
        const isInProgress = attempts.some(
            (item) => item.examId === examId && item.status === 'IN_PROGRESS',
        );

        if (lockById.get(examId)?.locked && !isInProgress) return;

        if (exam?.hasPassword && !isInProgress) {
            setPasswordExam(exam);
            return;
        }

        navigate(`/student/exams/${examId}/take`);
    };

    return (
        <MainLayout pathName={{ exams: 'Exam Schedule' }}>
            <div className="w-full max-w-none space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                            <CalendarDays className="size-5" />
                            <span className="text-sm font-medium">Student Portal</span>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            My Exam Schedule
                        </h1>

                        <p className="mt-2 text-sm text-muted-foreground">
                            Track your exams, resume ongoing attempts, or review past results.
                        </p>
                    </div>

                    {hasError && (
                        <Button variant="outline" onClick={retry}>
                            <RefreshCw className="size-4" />
                            Reload
                        </Button>
                    )}
                </header>

                {hasError && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <p>
                            {examsQuery.isError && attemptsQuery.isError
                                ? 'Unable to load exam schedule and attempt statuses.'
                                : examsQuery.isError
                                    ? 'Unable to load exams list.'
                                    : 'Unable to load attempt statuses. Reload to verify your status before starting.'}
                        </p>
                    </div>
                )}

                {isLoading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {Array.from({ length: 3 }, (_, index) => (
                            <Card
                                key={index}
                                className="h-56 animate-pulse border-border bg-card"
                            >
                                <CardContent className="space-y-4 pt-6">
                                    <div className="h-5 w-24 rounded bg-muted" />
                                    <div className="h-6 w-3/4 rounded bg-muted" />
                                    <div className="h-4 w-1/2 rounded bg-muted" />
                                    <div className="h-9 rounded bg-muted" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : examsQuery.isError ? null : exams.length === 0 ? (
                    <Card className="items-center border-dashed border-border bg-card py-10 text-center">
                        <CardContent className="space-y-2">
                            <CalendarDays className="mx-auto size-8 text-muted-foreground" />
                            <CardTitle className="text-foreground">
                                No Scheduled Exams
                            </CardTitle>
                            <CardDescription>
                                There are currently no exams scheduled for you.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                            {pagedExams.map((exam) => {
                                const examAttempts = attempts.filter(
                                    (item) => item.examId === exam.id,
                                );

                                const attempt =
                                    examAttempts.find((item) => item.status === 'IN_PROGRESS') ??
                                    examAttempts.reduce<ExamAttemptSummary | undefined>(
                                        (latest, item) =>
                                            !latest || item.attemptNumber > latest.attemptNumber
                                                ? item
                                                : latest,
                                        undefined,
                                    );

                                return (
                                    <ExamCard
                                        key={exam.id}
                                        exam={exam}
                                        attempt={attempt}
                                        now={now}
                                        disabled={attemptsQuery.isError}
                                        lock={lockById.get(exam.id)}
                                        onOpen={openExam}
                                        onReview={(attemptId) =>
                                            navigate(`/student/exams/attempts/${attemptId}/review`)
                                        }
                                    />
                                );
                            })}
                        </div>

                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-sm text-muted-foreground">
                                Showing {firstIndex + 1}–
                                {Math.min(firstIndex + PAGE_SIZE, exams.length)} of {exams.length} exam(s)
                            </p>

                            {totalPages > 1 && (
                                <nav
                                    aria-label="Exam pages"
                                    className="flex flex-wrap items-center gap-1"
                                >
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => goToPage(currentPage - 1)}
                                    >
                                        <ChevronLeft className="size-4" />
                                        Previous
                                    </Button>

                                    {getPageNumbers(currentPage, totalPages).map((item, index) =>
                                        item === 'ellipsis' ? (
                                            <span
                                                key={`ellipsis-${index}`}
                                                className="px-2 text-sm text-muted-foreground"
                                            >
                                                …
                                            </span>
                                        ) : (
                                            <Button
                                                key={item}
                                                size="sm"
                                                variant={item === currentPage ? 'default' : 'outline'}
                                                aria-current={item === currentPage ? 'page' : undefined}
                                                onClick={() => goToPage(item)}
                                            >
                                                {item}
                                            </Button>
                                        ),
                                    )}

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => goToPage(currentPage + 1)}
                                    >
                                        Next
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </nav>
                            )}
                        </div>
                    </>
                )}
            </div>

            <ExamPasswordDialog
                open={passwordExam !== null}
                onOpenChange={(open) => {
                    if (!open) setPasswordExam(null);
                }}
                examId={passwordExam?.id ?? null}
                examTitle={passwordExam?.title ?? ''}
                onSuccess={(examId, password) => {
                    sessionStorage.setItem(`exam_pass_${examId}`, password);
                    setPasswordExam(null);
                    navigate(`/student/exams/${examId}/take`);
                }}
            />
        </MainLayout>
    );
}