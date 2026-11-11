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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const examsQueryKey = ['student-exams'] as const;
const attemptsQueryKey = ['student-exam-attempts'] as const;

/** Exams shown per page (3 columns x 3 rows). */
const PAGE_SIZE = 9;
/** Each API call fetches up to this many exams; calls repeat until everything is loaded. */
const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_PAGES = 50;

type ExamLock = { locked: boolean; reason: string | null };

/** Fetch ALL exams (looping over the backend pages) so the UI can sort and paginate them. */
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

/** An exam is open when "now" is inside its start/end window (a missing bound means unbounded). */
function isExamOpen(exam: Exam, now: number) {
    const started = exam.startTime == null || now >= new Date(exam.startTime).getTime();
    const notClosed = exam.endTime == null || now < new Date(exam.endTime).getTime();
    return started && notClosed;
}

/** Open exams first across the whole list; the backend order is kept inside each group. */
function sortExams(exams: Exam[], now: number) {
    return [...exams].sort((a, b) => Number(isExamOpen(b, now)) - Number(isExamOpen(a, now)));
}

/** "Course › Section › Lesson" the exam belongs to, or null when it is not linked to a course. */
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

/** Compact page list, e.g. 1 … 4 5 6 … 12 */
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
    const canReview = (attempt?.status === 'SUBMITTED' || attempt?.status === 'PENDING_REVIEW')
        && (exam.showAnswersAfterExam === true || exam.resultVisibility === 'MANUAL_RELEASE');
    const isInProgress = attempt?.status === 'IN_PROGRESS';
    // Locked by the lesson/section progress rules of the course the exam belongs to.
    const locked = lock?.locked === true && !isInProgress;
    // Highlighted only when the exam is inside its window and not blocked by lesson progress.
    const open = isExamOpen(exam, now) && !locked;
    const courseText = examCourseLabel(exam);
    const hasAttempts = (attempt?.attemptsUsed ?? 0) > 0;
    const isResultPublished = attempt?.resultPublished !== false;
    const outOfAttempts = hasAttempts && (attempt?.attemptsRemaining ?? 0) <= 0 && !isInProgress;
    const isDisabled = externallyDisabled || locked || outOfAttempts;
    const buttonLabel = locked
        ? 'Locked'
        : isInProgress
            ? 'Continue Exam'
            : outOfAttempts
                ? 'No Attempts Left'
                : 'Start Exam';

    return (
        <Card
            className={`flex h-full flex-col bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                open
                    ? 'border-emerald-400 ring-2 ring-emerald-200 dark:border-emerald-500/70 dark:ring-emerald-500/25'
                    : locked
                        ? 'border-amber-300 dark:border-amber-500/50'
                        : 'border-border'
            }`}
        >
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                        variant="secondary"
                        className="gap-1 bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                    >
                        <Clock3 className="size-3" />
                        {exam.durationMinutes} mins
                    </Badge>
                    {open && (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-500">
                            Open
                        </Badge>
                    )}
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                    {attempt?.passed != null && <PassBadge passed={attempt.passed} passScore={attempt.passScore} />}
                    {exam.category && (
                        <Badge variant="outline">{EXAM_CATEGORY_LABEL[exam.category]}</Badge>
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
                <CardTitle className="pt-2 text-lg text-foreground">{exam.title}</CardTitle>
                {courseText && (
                    <p className="flex items-start gap-1 text-xs text-muted-foreground" title={courseText}>
                        <BookOpen className="mt-0.5 size-3 shrink-0" />
                        <span className="break-words">{courseText}</span>
                    </p>
                )}
                <CardDescription>
                    Max Score:{' '}
                    <span className="font-medium text-foreground">
                        {formatScore(attempt?.maxScore ?? exam.maxScore ?? 10)}
                    </span>
                </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
                {locked && (
                    <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">
                        {lock?.reason ?? 'Complete the required lessons to unlock this exam.'}
                    </p>
                )}
                {attempt?.status === 'PENDING_REVIEW' && isResultPublished && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Provisional Score: {formatScore(attempt.objectiveScore ?? 0)}/{formatScore(attempt.maxScore ?? 10)} (ungraded essays count as 0).
                    </p>
                )}
                {attempt?.status === 'SUBMITTED' && isResultPublished && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        Highest Score: {formatScore(attempt.bestScore ?? attempt.finalScore ?? 0)}/{formatScore(attempt.maxScore ?? 10)}.
                    </p>
                )}
                {hasAttempts && attempt?.status !== 'SUBMITTED' && attempt?.bestScore != null && isResultPublished && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        Highest Score: {formatScore(attempt.bestScore)}/{formatScore(attempt.maxScore ?? 10)}.
                    </p>
                )}
                {attempt && !isResultPublished && attempt.status !== 'IN_PROGRESS' && (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Awaiting publication — your teacher has not released the results yet.
                    </p>
                )}
                {attempt && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        Attempt #{attempt.attemptNumber} · Used {attempt.attemptsUsed}/{exam.maxAttempts ?? 1} attempt(s)
                    </p>
                )}

                {attempt?.status === 'IN_PROGRESS' && (
                    <p className="text-sm text-sky-700 dark:text-sky-400">
                        Your draft has been saved. You can resume your exam.
                    </p>
                )}
                {!attempt && !locked && (
                    <p className="text-sm text-muted-foreground">
                        You have not started this exam yet.
                    </p>
                )}
            </CardContent>

            <CardFooter className="flex-col gap-2 border-t border-border pt-4">
                <Button className="w-full bg-cyan-600 text-white hover:bg-cyan-500" disabled={isDisabled} onClick={() => onOpen(exam.id)}>
                    {buttonLabel}
                    {locked ? <Lock className="size-4" /> : <ArrowRight className="size-4" />}
                </Button>
                {canReview && attempt && (
                    <Button
                        variant="outline"
                        className="w-full"
                        title={
                            isResultPublished
                                ? undefined
                                : 'Your answers are available for review. Scores are published later.'
                        }
                        onClick={() => onReview(attempt.id)}
                    >
                        {isResultPublished ? 'View Answers' : 'Review Your Answers'}
                    </Button>
                )}
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

    // Lock state comes from the course the exam is linked to (shares the cache with the course learning page).
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
        query.data?.forEach((item) => lockById.set(item.id, { locked: item.locked, reason: item.lockReason })),
    );

    const openExam = (examId: number) => {
        const exam = exams.find((item) => item.id === examId);
        const isInProgress = attempts.some((item) => item.examId === examId && item.status === 'IN_PROGRESS');
        if (lockById.get(examId)?.locked && !isInProgress) return;
        if (exam?.hasPassword && !isInProgress) {
            setPasswordExam(exam);
            return;
        }
        navigate(`/student/exams/${examId}/take`);
    };

    return (
        <MainLayout pathName={{ exams: 'Exam Schedule' }}>
            <div className="mx-auto w-full max-w-6xl space-y-6">
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
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }, (_, index) => (
                            <Card key={index} className="h-56 animate-pulse border-border bg-card">
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
                            <CardTitle className="text-foreground">No Scheduled Exams</CardTitle>
                            <CardDescription>
                                There are currently no exams scheduled for you.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {pagedExams.map((exam) => {
                                const examAttempts = attempts.filter((item) => item.examId === exam.id);
                                const attempt = examAttempts.find((item) => item.status === 'IN_PROGRESS')
                                    ?? examAttempts.reduce<ExamAttemptSummary | undefined>((latest, item) =>
                                        !latest || item.attemptNumber > latest.attemptNumber ? item : latest, undefined);
                                return (
                                    <ExamCard
                                        key={exam.id}
                                        exam={exam}
                                        attempt={attempt}
                                        now={now}
                                        disabled={attemptsQuery.isError}
                                        lock={lockById.get(exam.id)}
                                        onOpen={openExam}
                                        onReview={(attemptId) => navigate(`/student/exams/attempts/${attemptId}/review`)}
                                    />
                                );
                            })}
                        </div>

                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-sm text-muted-foreground">
                                Showing {firstIndex + 1}–{Math.min(firstIndex + PAGE_SIZE, exams.length)} of {exams.length} exam(s)
                            </p>
                            {totalPages > 1 && (
                                <nav aria-label="Exam pages" className="flex flex-wrap items-center gap-1">
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
                                            <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">
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