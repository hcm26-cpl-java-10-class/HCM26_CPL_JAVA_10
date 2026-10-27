import {
    saveExamAnswers,
    sendIntegrityEvents, // NEW (anti-cheat)
    startOrResumeExam,
    submitExamAttempt,
    type ExamAttemptAnswer,
    type SaveExamAnswerRequest,
} from '@/api/exam.api';
import { formatScore, questionScore } from '@/utils/examScore';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Star } from 'lucide-react';
import { toast } from 'sonner';
import { ExamIntegrityNotice, useExamIntegrity } from '@/hooks/useExamIntegrity'; // NEW (anti-cheat)

const attemptQueryKey = (examId: number) => ['student-exam-attempt', examId] as const;

interface ExtendedAnswer extends ExamAttemptAnswer {
    saved?: boolean;
}

interface ExtendedSaveRequest extends SaveExamAnswerRequest {
    markSaved?: boolean;
}

function toAnswerRequests(answers: Record<number, ExtendedAnswer>): SaveExamAnswerRequest[] {
    return Object.values(answers).map((answer) => ({
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        textAnswer: answer.textAnswer,
    }));
}

function getStartErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (!error.response) return 'Cannot connect to server. Please check your network connection and try again.';
        const message = (error.response.data as { message?: string } | undefined)?.message;
        if (error.response.status === 403) return 'You do not have permission to take this exam.';
        if (error.response.status === 404) return 'Exam not found or has been disabled.';
        if (message) return message;
    }
    return 'Unable to open exam. Please try again.';
}

function getCountdown(deadlineAt: string, now: number): number {
    return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000));
}

function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

export default function StudentExamTakingPage() {
    const { examId: rawExamId } = useParams();
    const examId = Number(rawExamId);
    const validExamId = Number.isSafeInteger(examId) && examId > 0;
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const essayParam = Number(searchParams.get('essay'));
    const queryClient = useQueryClient();
    const timerRefs = useRef(new Map<number, number>());
    const autoSubmitStarted = useRef(false);
    const submitStartedRef = useRef(false);

    const pendingAnswersRef = useRef(
        new Map<number, ExtendedSaveRequest>(),
    );
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaveError, setHasSaveError] = useState(false);

    const [answers, setAnswers] = useState<Record<number, ExtendedAnswer>>({});
    const answersRef = useRef(answers);
    answersRef.current = answers;

    const [now, setNow] = useState(() => Date.now());

    const attemptQuery = useQuery({
        queryKey: validExamId ? attemptQueryKey(examId) : ['student-exam-attempt', 'invalid'],
        queryFn: () => startOrResumeExam(examId),
        enabled: validExamId,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Infinity,
    });

    const submitMutation = useMutation({
        mutationFn: ({ attemptId, submittedAnswers }: { attemptId: number; submittedAnswers: SaveExamAnswerRequest[] }) =>
            submitExamAttempt(attemptId, submittedAnswers),
        onSuccess: (attempt) => {
            queryClient.setQueryData(attemptQueryKey(examId), attempt);
            clearAllPendingSaves();
            queryClient.invalidateQueries({ queryKey: ["my-exam-scores"] });
            if (attempt.status === 'EXPIRED') {
                toast.warning('Time is up! Your exam has been automatically submitted.');
            } else {
                toast.success(attempt.status === 'PENDING_REVIEW' ? 'Submitted successfully! Essay questions are pending review.' : 'Submitted successfully!');
            }
        },
        onError: () => toast.error('Failed to submit exam. Please try again.'),
    });

    const attempt = attemptQuery.data;

    // NEW (anti-cheat): theo doi tab / chan copy-paste / toan man hinh
    const integrity = useExamIntegrity({
        attemptId: attempt?.id,
        config: attempt?.integrity,
        active: attempt?.status === 'IN_PROGRESS',
        send: sendIntegrityEvents,
    });

    const [flagged, setFlagged] = useState<Set<number>>(new Set());
    const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
    const flagKey = attempt ? `exam-flagged-${attempt.id}` : null;

    useEffect(() => {
        if (!flagKey) return;
        try {
            const raw = localStorage.getItem(flagKey);
            setFlagged(new Set<number>(raw ? JSON.parse(raw) : []));
        } catch {
            setFlagged(new Set());
        }
    }, [flagKey]);

    const toggleFlag = (questionId: number) => {
        setFlagged((prev) => {
            const next = new Set(prev);
            if (next.has(questionId)) next.delete(questionId);
            else next.add(questionId);
            if (flagKey) {
                try {
                    localStorage.setItem(flagKey, JSON.stringify([...next]));
                } catch {
                }
            }
            return next;
        });
    };

    function clearAllPendingSaves() {
        timerRefs.current.forEach((timer) => window.clearTimeout(timer));
        timerRefs.current.clear();
        pendingAnswersRef.current.clear();
    }

    const flushPendingAnswers = async (
        attemptId: number,
    ): Promise<boolean> => {
        while (savingRef.current) {
            await new Promise<void>((resolve) => {
                window.setTimeout(resolve, 50);
            });
        }

        if (pendingAnswersRef.current.size === 0) {
            setHasSaveError(false);
            return true;
        }

        savingRef.current = true;
        setIsSaving(true);

        try {
            while (pendingAnswersRef.current.size > 0) {
                const entry = pendingAnswersRef.current.entries().next().value as
                    | [number, ExtendedSaveRequest]
                    | undefined;

                if (!entry) break;

                const [questionId, request] = entry;
                pendingAnswersRef.current.delete(questionId);

                try {
                    const saved = await saveExamAnswers(attemptId, [request]);
                    if (saved.status !== 'IN_PROGRESS') {
                        clearAllPendingSaves();
                        queryClient.setQueryData(attemptQueryKey(examId), saved);
                        toast.warning(
                            saved.status === 'EXPIRED'
                                ? 'Time is up! Your exam has been automatically submitted.'
                                : 'This exam has already been submitted (possibly from another tab). Latest changes were not saved.',
                        );
                        setHasSaveError(false);
                        return true;
                    }
                } catch {
                    if (!pendingAnswersRef.current.has(questionId)) {
                        pendingAnswersRef.current.set(questionId, request);
                    }

                    setHasSaveError(true);
                    return false;
                }
            }

            setHasSaveError(false);
            return true;
        } finally {
            savingRef.current = false;
            setIsSaving(pendingAnswersRef.current.size > 0);
        }
    };

    useEffect(() => {
        if (!attempt) return;
        setAnswers(Object.fromEntries(
            attempt.answers.map((answer) => [answer.questionId, answer]),
        ));
        autoSubmitStarted.current = false;
    }, [attempt?.id]);

    useEffect(() => {
        if (attempt?.status !== 'IN_PROGRESS') return;
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [attempt?.status]);

    useEffect(() => {
        if (!attempt || attempt.status !== 'IN_PROGRESS') return;

        const retryPendingAnswers = () => {
            void flushPendingAnswers(attempt.id);
        };

        window.addEventListener('online', retryPendingAnswers);

        return () => {
            window.removeEventListener('online', retryPendingAnswers);
        };
    }, [attempt?.id, attempt?.status]);

    useEffect(() => () => {
        timerRefs.current.forEach((timer) => window.clearTimeout(timer));
        timerRefs.current.clear();
    }, []);

    useEffect(() => {
        if (attempt?.status !== 'IN_PROGRESS') return;

        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', warnBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', warnBeforeUnload);
        };
    }, [attempt?.id, attempt?.status]);

    const handleLeaveExam = () => {
        if (
            attempt?.status === 'IN_PROGRESS' &&
            !window.confirm(
                'You are currently taking the exam. Are you sure you want to leave?',
            )
        ) {
            return;
        }

        navigate('/invitations');
    };

    const submitCurrentAnswers = async (requireConfirmation = false) => {
        if (
            !attempt ||
            attempt.status !== 'IN_PROGRESS' ||
            submitMutation.isPending ||
            submitStartedRef.current
        ) {
            return;
        }

        if (
            requireConfirmation &&
            !window.confirm(
                'Are you sure you want to submit your exam? Please double-check your answers before proceeding.' +
                (() => {
                    const unsaved = attempt.questions.filter((q) => q.type === 'ESSAY' && !answersRef.current[q.id]?.saved).length;
                    return unsaved > 0 ? `\n\nThere are ${unsaved} essay question(s) that have not been saved (unsaved content will still be submitted).` : '';
                })()
            )
        ) {
            return;
        }

        submitStartedRef.current = true;

        timerRefs.current.forEach((timer) => window.clearTimeout(timer));
        timerRefs.current.clear();

        try {
            const saved = await flushPendingAnswers(attempt.id);

            if (!saved && requireConfirmation) {
                toast.error(
                    'Failed to save some answers. Please check your network connection and try again.',
                );
                return;
            }

            await submitMutation.mutateAsync({
                attemptId: attempt.id,
                submittedAnswers: toAnswerRequests(answersRef.current),
            });

            pendingAnswersRef.current.clear();
            setHasSaveError(false);
        } catch {
        } finally {
            submitStartedRef.current = false;
        }
    };

    const secondsRemaining = attempt ? getCountdown(attempt.deadlineAt, now) : 0;

    useEffect(() => {
        if (
            attempt?.status === 'IN_PROGRESS'
            && secondsRemaining === 0
            && !autoSubmitStarted.current
            && !submitMutation.isPending
        ) {
            autoSubmitStarted.current = true;
            void submitCurrentAnswers();
        }
    }, [attempt?.status, secondsRemaining, submitMutation.isPending]);

    const scheduleAnswerSave = (
        questionId: number,
        answer: ExtendedAnswer,
    ) => {
        if (!attempt || attempt.status !== 'IN_PROGRESS') return;

        const existingTimer = timerRefs.current.get(questionId);

        if (existingTimer !== undefined) {
            window.clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(() => {
            pendingAnswersRef.current.set(questionId, {
                questionId,
                selectedOptionIds: [...answer.selectedOptionIds],
                textAnswer: answer.textAnswer,
            });

            timerRefs.current.delete(questionId);
            void flushPendingAnswers(attempt.id);
        }, 400);

        timerRefs.current.set(questionId, timer);
    };

    const updateAnswer = (questionId: number, update: Partial<ExtendedAnswer>) => {
        const current = answers[questionId] ?? {
            questionId,
            selectedOptionIds: [],
            textAnswer: null,
        };
        const next = { ...current, ...update };
        if (update.textAnswer !== undefined && (update.textAnswer ?? '') !== (current.textAnswer ?? '')) {
            next.saved = false;
        }
        setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: next }));
        scheduleAnswerSave(questionId, next);
    };

    const openEssay = (questionId: number) => setSearchParams({ essay: String(questionId) });
    const closeEssay = () => setSearchParams({});

    const hasText = (questionId: number) => (answers[questionId]?.textAnswer ?? '').trim().length > 0;
    const isAnswered = (question: { id: number; type: string }) =>
        question.type === 'ESSAY'
            ? hasText(question.id)
            : (answers[question.id]?.selectedOptionIds.length ?? 0) > 0;

    const saveEssay = async (questionId: number) => {
        if (!attempt || attempt.status !== 'IN_PROGRESS') return;
        if (!hasText(questionId)) {
            toast.error('Please enter your answer content before saving.');
            return;
        }
        const timer = timerRefs.current.get(questionId);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            timerRefs.current.delete(questionId);
        }
        const current = answersRef.current[questionId];
        pendingAnswersRef.current.set(questionId, {
            questionId,
            selectedOptionIds: [],
            textAnswer: current?.textAnswer ?? '',
            markSaved: true,
        });
        const ok = await flushPendingAnswers(attempt.id);
        if (!ok) {
            toast.error('Could not save answer. Please check your network connection and click Save again.');
            return;
        }
        setAnswers((all) => ({ ...all, [questionId]: { ...all[questionId], questionId, saved: true } as ExtendedAnswer }));
        toast.success('Essay answer saved successfully.');
        closeEssay();
    };

    const jumpToQuestion = (question: { id: number; type: string }) => {
        setActiveQuestionId(question.id);
        if (question.type === 'ESSAY') {
            openEssay(question.id);
            return;
        }
        if (essayParam) closeEssay();
        window.setTimeout(() => document.getElementById(`question-card-${question.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    };

    if (!validExamId) {
        return (
            <MainLayout>
                <div role="alert" className="rounded-lg border border-destructive p-6 text-destructive">
                    Invalid exam ID.
                </div>
            </MainLayout>
        );
    }

    if (attemptQuery.isLoading) {
        return <MainLayout><p className="p-6">Loading exam...</p></MainLayout>;
    }

    if (attemptQuery.isError || !attempt) {
        return (
            <MainLayout>
                <div role="alert" className="space-y-4 rounded-lg border border-destructive p-6 text-destructive">
                    <p>{getStartErrorMessage(attemptQuery.error)}</p>
                    <Button variant="outline" onClick={() => navigate('/invitations')}>Back to Invitations</Button>
                </div>
            </MainLayout>
        );
    }

    const isFinished = attempt.status !== 'IN_PROGRESS';
    const essayQuestions = attempt.questions.filter((q) => q.type === 'ESSAY');
    const currentEssay = attempt.questions.find((q) => q.id === essayParam && q.type === 'ESSAY');
    const currentEssayIndex = currentEssay ? attempt.questions.indexOf(currentEssay) : -1;
    const currentAnswer = currentEssay ? answers[currentEssay.id] : undefined;
    const currentSaved = Boolean(currentAnswer?.saved);

    const activeId = currentEssay ? currentEssay.id : activeQuestionId;

    const timerBox = (
        <div role="timer" aria-live="polite" className={`pointer-events-auto shrink-0 rounded-lg border bg-card px-4 py-2 font-mono text-xl ${secondsRemaining <= 60 ? 'border-red-500 text-red-500' : ''}`}>
            {formatCountdown(secondsRemaining)}
        </div>
    );

    const starButton = (questionId: number, number: number) => {
        const isFlagged = flagged.has(questionId);
        return (
            <button
                type="button"
                onClick={() => toggleFlag(questionId)}
                aria-pressed={isFlagged}
                aria-label={isFlagged ? `Unflag question ${number}` : `Flag question ${number}`}
                title={isFlagged ? 'Unflag' : 'Flag this question'}
                className="rounded-md p-1 transition-colors hover:bg-muted"
            >
                <Star className={`h-5 w-5 ${isFlagged ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
        );
    };

    const pinnedBar = (
        <div className="pointer-events-none sticky top-0 z-30 flex items-start justify-between gap-4 py-3">
            {timerBox}
            <div className="pointer-events-auto flex w-[15.5rem] shrink-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="w-full text-sm font-semibold text-foreground">Questions Navigation</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-black ring-1 ring-border" /> Unanswered</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-green-600" /> Answered</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-yellow-400" /> Flagged</span>
                </div>
                <div className="grid max-h-[8.5rem] grid-cols-5 justify-items-center gap-2 overflow-y-auto p-1">
                    {attempt.questions.map((question, index) => {
                        const isFlagged = flagged.has(question.id);
                        const color = isFlagged
                            ? 'bg-yellow-400 text-black'
                            : isAnswered(question)
                                ? 'bg-green-600 text-white'
                                : 'bg-black text-white';
                        const ring = activeId === question.id ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-background' : '';
                        return (
                            <button
                                key={question.id}
                                type="button"
                                title={`Question ${index + 1}${question.type === 'ESSAY' ? ' (Essay)' : ''}${isFlagged ? ' · Flagged' : ''}`}
                                aria-label={`Question ${index + 1}: ${isAnswered(question) ? 'Answered' : 'Unanswered'}${isFlagged ? ', Flagged' : ''}`}
                                aria-current={activeId === question.id ? 'true' : undefined}
                                onClick={() => jumpToQuestion(question)}
                                className={`flex h-8 w-8 items-center justify-center rounded-sm text-xs font-medium ${color} ${ring}`}
                            >
                                {index + 1}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const submitButton = (
        <Button onClick={() => void submitCurrentAnswers(true)} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Submitting...' : 'Submit Exam'}
        </Button>
    );

    if (!isFinished && currentEssay) {
        return (
            <MainLayout pathName={{ exams: 'Exam Schedule', take: 'Take Exam' }}>
                <main className="flex h-[calc(100dvh-10rem)] w-full flex-col gap-4 overflow-hidden">
                    <ExamIntegrityNotice config={attempt.integrity} state={integrity} />
                    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            {timerBox}
                            <Button variant="outline" onClick={closeEssay}>
                                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Exam
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {currentSaved && <span className="font-medium text-green-600">Saved</span>}
                            {isSaving && <span>Saving...</span>}
                        </div>
                        <Button
                            onClick={() => void saveEssay(currentEssay.id)}
                            className={currentSaved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                        >
                            <Save className="mr-1 h-4 w-4" /> {currentSaved ? 'Saved' : 'Save Answer'}
                        </Button>
                    </header>

                    {hasSaveError && (
                        <p role="alert" className="shrink-0 text-sm text-destructive">
                            Some changes have not been saved to the server.{' '}
                            <Button variant="outline" size="sm" onClick={() => void flushPendingAnswers(attempt.id)}>Retry Saving</Button>
                        </p>
                    )}

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-5">
                        <section className="min-h-0 overflow-auto rounded-xl border p-4 md:col-span-1">
                            <h2 className="font-semibold">Question Prompt</h2>
                            <p className="mt-3 whitespace-pre-wrap text-sm">{currentEssay.content}</p>
                            {currentEssay.imageUrl?.trim() && (
                                <div className="mt-3">
                                    <img
                                        src={currentEssay.imageUrl}
                                        alt={`Question ${currentEssayIndex + 1} image`}
                                        className="max-h-64 rounded-md border object-contain shadow-sm"
                                    />
                                </div>
                            )}
                        </section>
                        <section className="flex min-h-0 flex-col rounded-xl border p-4 md:col-span-4">
                            <h2 className="mb-3 shrink-0 font-semibold">Your Answer</h2>
                            <textarea
                                aria-label={`Answer for question ${currentEssayIndex + 1}`}
                                className="min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="Type your answer here..."
                                value={currentAnswer?.textAnswer ?? ''}
                                onChange={(event) => updateAnswer(currentEssay.id, { textAnswer: event.target.value })}
                            />
                        </section>
                    </div>
                </main>
            </MainLayout>
        );
    }

    return (
        <MainLayout pathName={{ exams: 'Exam Schedule', take: 'Take Exam' }}>
            <main className="flex w-full flex-col gap-5">
                {!isFinished && pinnedBar}
                {!isFinished && <ExamIntegrityNotice config={attempt.integrity} state={integrity} />}
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Exam</p>
                            <h1 className="mt-1 text-2xl font-semibold">{attempt.title}</h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Attempt #{attempt.attemptNumber} · Duration: {attempt.durationMinutes} mins · Max Score: {formatScore(attempt.maxScore ?? 10)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Official Deadline: {attempt.officialDeadlineAt
                                ? new Date(attempt.officialDeadlineAt).toLocaleString()
                                : 'Based on exam duration'}
                                {attempt.officialDeadlineAt && attempt.deadlineAt !== attempt.officialDeadlineAt
                                    ? ` · Extended Deadline: ${new Date(attempt.deadlineAt).toLocaleString()}`
                                    : ''}
                            </p>
                        </div>
                    </header>

                    {isFinished ? (
                        <section className="rounded-xl border p-6">
                            <h2 className="text-xl font-semibold">
                                {attempt.status === 'EXPIRED' && 'Time is up — Exam auto-submitted'}
                                {attempt.status === 'PENDING_REVIEW' && 'Submitted — Pending essay review'}
                                {attempt.status === 'SUBMITTED' && 'Exam Completed'}
                            </h2>
                            <p className="mt-3 text-lg">
                                {attempt.finalScore == null
                                    ? `Provisional Score: ${formatScore(attempt.provisionalScore ?? attempt.objectiveScore ?? 0)}/${formatScore(attempt.maxScore ?? 10)} (ungraded essays count as 0)`
                                    : `Score: ${formatScore(attempt.finalScore)}/${formatScore(attempt.maxScore ?? 10)}`}
                            </p>
                            {attempt.status === 'EXPIRED' && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Exam time has ended. Only answers provided before the deadline were graded.
                                </p>
                            )}
                            {attempt.bestScore != null && (
                                <p className="mt-2 text-sm font-medium text-emerald-700">
                                    Highest Score: {formatScore(attempt.bestScore)}/{formatScore(attempt.maxScore ?? 10)}
                                </p>
                            )}
                            {attempt.late && (
                                <p className="mt-2 text-sm text-amber-700">
                                    Submitted during extended deadline.
                                    {attempt.latePenaltyPercentApplied != null
                                        ? ` Applied penalty: -${attempt.latePenaltyPercentApplied}%.`
                                        : ''}
                                </p>
                            )}
                            {attempt.finalScore === null && attempt.status !== 'SUBMITTED' && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Final score will be updated once your teacher finishes grading the essay questions.
                                </p>
                            )}
                            <Button className="mt-5" variant="outline" onClick={() => navigate('/invitations')}>
                                Back to Invitations
                            </Button>
                        </section>
                    ) : (
                        <>
                            {essayQuestions.length > 0 && (
                                <section className="rounded-xl border p-4">
                                    <h2 className="mb-3 font-semibold">Essay Questions</h2>
                                    <div className="grid gap-2">
                                        {essayQuestions.map((question) => {
                                            const saved = Boolean(answers[question.id]?.saved);
                                            return (
                                                <div key={question.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium">
                                                            Question {attempt.questions.indexOf(question) + 1}
                                                            <span className="ml-2 font-normal text-muted-foreground">{formatScore(questionScore(attempt.maxScore, question.points, attempt.totalPoints))} pts</span>
                                                        </p>
                                                        <p className="truncate text-sm text-muted-foreground">{question.content}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-3">
                                                        {starButton(question.id, attempt.questions.indexOf(question) + 1)}
                                                        {saved && <span className="text-sm font-medium text-green-600">Saved</span>}
                                                        {!saved && hasText(question.id) && <span className="text-sm text-muted-foreground">Drafting</span>}
                                                        <Button
                                                            size="sm"
                                                            className={saved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                                                            onClick={() => openEssay(question.id)}
                                                        >
                                                            {saved ? 'Edit Answer' : hasText(question.id) ? 'Continue' : 'Start Answer'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                <span>Your answers are automatically saved as you make changes.</span>

                                {isSaving && <span>Saving...</span>}

                                {hasSaveError && (
                                    <span role="alert" className="text-destructive">
                                        Some answers were not saved.
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void flushPendingAnswers(attempt.id)}
                                        >
                                            Retry Saving
                                        </Button>
                                    </span>
                                )}
                            </div>

                            {attempt.questions.map((question, index) => {
                                const answer = answers[question.id] ?? {
                                    questionId: question.id,
                                    selectedOptionIds: [],
                                    textAnswer: null,
                                };

                                return (
                                    <section
                                        key={question.id}
                                        id={`question-card-${question.id}`}
                                        className={`rounded-xl border p-5 transition-all ${
                                            activeId === question.id ? 'ring-2 ring-red-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <h2 className="font-semibold">
                                                Question {index + 1}
                                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                    {formatScore(questionScore(attempt.maxScore, question.points, attempt.totalPoints))} pts
                                                </span>
                                            </h2>
                                            {starButton(question.id, index + 1)}
                                        </div>

                                        <p className="mt-3 whitespace-pre-wrap">{question.content}</p>

                                        {question.imageUrl?.trim() && (
                                            <div className="mt-3">
                                                <img
                                                    src={question.imageUrl}
                                                    alt={`Question ${index + 1} image`}
                                                    className="max-h-64 rounded-md border object-contain shadow-sm"
                                                />
                                            </div>
                                        )}

                                        {question.type === 'ESSAY' ? (
                                            <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                                                <span className="text-sm text-muted-foreground">
                                                    {hasText(question.id)
                                                        ? 'Essay content available'
                                                        : 'No answer provided yet'}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    className={
                                                        answer.saved
                                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                                    }
                                                    onClick={() => openEssay(question.id)}
                                                >
                                                    {answer.saved
                                                        ? 'Edit Essay Answer'
                                                        : hasText(question.id)
                                                            ? 'Continue Answer'
                                                            : 'Open Essay Answer'}
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="mt-4 grid gap-3">
                                                {question.options.map((option) => {
                                                    const checked = answer.selectedOptionIds.includes(option.id);
                                                    const isMulti = question.multiSelect;
                                                    const inputType = isMulti ? 'checkbox' : 'radio';
                                                    return (
                                                        <label
                                                            key={option.id}
                                                            className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                                                        >
                                                            <input
                                                                type={inputType}
                                                                name={`question-${question.id}`}
                                                                checked={checked}
                                                                onChange={() => {
                                                                    const selectedOptionIds = !isMulti
                                                                        ? [option.id]
                                                                        : checked
                                                                            ? answer.selectedOptionIds.filter((id) => id !== option.id)
                                                                            : [...answer.selectedOptionIds, option.id];
                                                                    updateAnswer(question.id, { selectedOptionIds });
                                                                }}
                                                                disabled={isFinished}
                                                                className="mt-1"
                                                            />
                                                            <div className="flex flex-col gap-2">
                                                                <span>{option.content}</span>
                                                                {option.imageUrl?.trim() && (
                                                                    <img
                                                                        src={option.imageUrl}
                                                                        alt=""
                                                                        className="max-h-40 rounded border object-contain"
                                                                    />
                                                                )}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}

                            <footer className="flex flex-wrap justify-between gap-3 border-t pt-4">
                                <Button variant="outline" onClick={handleLeaveExam}>
                                    Leave Exam
                                </Button>
                                {submitButton}
                            </footer>
                        </>
                    )}
                </div>
            </main>
        </MainLayout>
    );
}
