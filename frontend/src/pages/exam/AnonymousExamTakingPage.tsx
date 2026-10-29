import {
    runAnonymousCode,
    saveAnonymousAnswers,
    sendAnonymousIntegrityEvents, // NEW (anti-cheat)
    startAnonymousExam,
    submitAnonymousExam,
    SESSION_EMAIL_KEY,
    SESSION_TOKEN_KEY,
    type ExamAttemptAnswer,
    type SaveExamAnswerRequest,
} from "@/api/exam.api";
import { formatScore, questionScore } from '@/utils/examScore';
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { CodingWorkspace } from '@/pages/student/components/CodingWorkspace';
import { EssayPopup } from '@/pages/student/components/EssayPopup';
import { ExamIntegrityNotice, useExamIntegrity } from '@/hooks/useExamIntegrity'; // NEW (anti-cheat)

const attemptQueryKey = (examId: string) => ["anonymous-exam-attempt", examId] as const;

interface ExtendedAnswer extends ExamAttemptAnswer {
    saved?: boolean;
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
        const message = (error.response?.data as { message?: string } | undefined)?.message;
        if (message) return message;
        if (error.response?.status === 401) {
            return "Phiên thi đã hết hạn. Vui lòng mở lại link truy cập.";
        }
    }
    return "Không thể mở bài thi. Vui lòng thử lại.";
}

function getCountdown(deadlineAt: string, now: number): number {
    return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000));
}

function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

export default function AnonymousExamTakingPage() {
    const queryClient = useQueryClient();
    const sessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY) ?? "";
    const studentName = sessionStorage.getItem('anonymous_student_name') ?? '';
    const studentEmail = sessionStorage.getItem(SESSION_EMAIL_KEY) ?? '';

    const timerRefs = useRef(new Map<number, number>());
    const autoSubmitStarted = useRef(false);
    const submitStartedRef = useRef(false);
    const pendingAnswersRef = useRef(new Map<number, SaveExamAnswerRequest>());
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaveError, setHasSaveError] = useState(false);

    const [answers, setAnswers] = useState<Record<number, ExtendedAnswer>>({});
    const answersRef = useRef(answers);
    answersRef.current = answers;

    const [now, setNow] = useState(() => Date.now());
    const [flagged, setFlagged] = useState<Set<number>>(new Set());

    const attemptQuery = useQuery({
        queryKey: attemptQueryKey(sessionToken),
        queryFn: () => startAnonymousExam(sessionToken),
        enabled: Boolean(sessionToken),
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
    });

    const attempt = attemptQuery.data;

    // NEW (anti-cheat)
    const integrity = useExamIntegrity({
        attemptId: attempt?.id,
        config: attempt?.integrity,
        active: attempt?.status === 'IN_PROGRESS',
        send: (id, payload) => sendAnonymousIntegrityEvents(id, sessionToken, payload),
    });
    const flagKey = attempt ? `anonymous-exam-flagged-${attempt.id}` : null;

    const submitMutation = useMutation({
        mutationFn: ({ attemptId, submittedAnswers }: { attemptId: number; submittedAnswers: SaveExamAnswerRequest[] }) =>
            submitAnonymousExam(attemptId, sessionToken, submittedAnswers),
        onSuccess: (submitted) => {
            queryClient.setQueryData(attemptQueryKey(sessionToken), submitted);
            clearAllPendingSaves();
            if (submitted.status === 'PENDING_REVIEW') {
                toast.success('Đã nộp bài! Câu tự luận đang chờ giáo viên chấm.');
            } else {
                toast.success(`Đã nộp bài! Kết quả sẽ gửi về ${studentEmail || 'email của bạn'}.`);
            }
        },
        onError: (error: unknown) =>
            toast.error(
                axios.isAxiosError(error)
                    ? ((error.response?.data as { message?: string } | undefined)?.message ??
                        'Không thể nộp bài.')
                    : 'Không thể nộp bài.',
            ),
    });

    useEffect(() => {
        if (!flagKey) return;
        try {
            const raw = localStorage.getItem(flagKey);
            setFlagged(new Set<number>(raw ? JSON.parse(raw) : []));
        } catch {
            setFlagged(new Set<number>());
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

    const flushPendingAnswers = async (attemptId: number): Promise<boolean> => {
        while (savingRef.current) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
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
                    | [number, SaveExamAnswerRequest]
                    | undefined;

                if (!entry) break;

                const [questionId, request] = entry;
                pendingAnswersRef.current.delete(questionId);

                try {
                    const saved = await saveAnonymousAnswers(attemptId, sessionToken, [request]);
                    if (saved.status !== 'IN_PROGRESS') {
                        clearAllPendingSaves();
                        queryClient.setQueryData(attemptQueryKey(sessionToken), saved);
                        toast.warning('Bài thi đã được nộp từ nơi khác. Thay đổi chưa được lưu.');
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
        setAnswers(
            Object.fromEntries(attempt.answers.map((answer) => [answer.questionId, answer])),
        );
        autoSubmitStarted.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt?.id]);

    useEffect(() => {
        if (attempt?.status !== 'IN_PROGRESS') return;
        const interval = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(interval);
    }, [attempt?.status]);

    useEffect(() => {
        if (attempt?.status !== 'IN_PROGRESS') return;
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warnBeforeUnload);
        return () => window.removeEventListener('beforeunload', warnBeforeUnload);
    }, [attempt?.status]);

    const scheduleAnswerSave = (questionId: number, answer: ExtendedAnswer) => {
        const existingTimer = timerRefs.current.get(questionId);
        if (existingTimer !== undefined) window.clearTimeout(existingTimer);

        const timer = window.setTimeout(() => {
            pendingAnswersRef.current.set(questionId, {
                questionId,
                selectedOptionIds: [...answer.selectedOptionIds],
                textAnswer: answer.textAnswer,
            });
            timerRefs.current.delete(questionId);
            void flushPendingAnswers(attempt!.id);
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
        if (
            update.textAnswer !== undefined &&
            (update.textAnswer ?? '') !== (current.textAnswer ?? '')
        ) {
            next.saved = false;
        }
        setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: next }));
        scheduleAnswerSave(questionId, next);
    };

    const [essayId, setEssayId] = useState<number | null>(null);
    const [codeId, setCodeId] = useState<number | null>(null);

    const saveEssay = async (questionId: number) => {
        if (!attempt || attempt.status !== 'IN_PROGRESS') return;
        const current = answersRef.current[questionId];
        if (!current?.textAnswer?.trim()) {
            toast.error('Vui lòng nhập nội dung trước khi lưu.');
            return;
        }
        const timer = timerRefs.current.get(questionId);
        if (timer !== undefined) {
            window.clearTimeout(timer);
            timerRefs.current.delete(questionId);
        }
        pendingAnswersRef.current.set(questionId, {
            questionId,
            selectedOptionIds: [],
            textAnswer: current.textAnswer,
            markSaved: true,
        });
        const ok = await flushPendingAnswers(attempt.id);
        if (!ok) {
            toast.error('Không lưu được. Kiểm tra kết nối mạng rồi bấm Lưu lại.');
            return;
        }
        setAnswers((all) => ({
            ...all,
            [questionId]: { ...all[questionId], questionId, saved: true } as ExtendedAnswer,
        }));
        toast.success('Đã lưu câu tự luận.');
    };

    const secondsRemaining = attempt ? getCountdown(attempt.deadlineAt, now) : 0;

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
            !window.confirm('Bạn có chắc muốn nộp bài? Vui lòng kiểm tra lại các câu trả lời.')
        ) {
            return;
        }

        submitStartedRef.current = true;
        timerRefs.current.forEach((timer) => window.clearTimeout(timer));
        timerRefs.current.clear();

        try {
            const saved = await flushPendingAnswers(attempt.id);
            if (!saved && requireConfirmation) {
                toast.error('Không lưu được một số câu trả lời. Kiểm tra mạng rồi thử lại.');
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

    useEffect(() => {
        if (
            attempt?.status === 'IN_PROGRESS' &&
            secondsRemaining === 0 &&
            !autoSubmitStarted.current &&
            !submitMutation.isPending
        ) {
            autoSubmitStarted.current = true;
            void submitCurrentAnswers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt?.status, secondsRemaining, submitMutation.isPending]);

    if (!sessionToken) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
                <div role="alert" className="max-w-md rounded-lg border border-destructive p-6 text-center text-destructive">
                    <p className="font-medium">Chưa có phiên thi</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Vui lòng mở lại link truy cập do giáo viên cung cấp.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link to="/anonymous-exam">Về trang truy cập</Link>
                </Button>
            </div>
        );
    }

    if (attemptQuery.isLoading) {
        return <div className="flex min-h-screen items-center justify-center">Đang tải bài thi...</div>;
    }

    if (attemptQuery.isError || !attempt) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
                <div role="alert" className="max-w-md rounded-lg border border-destructive p-6 text-center text-destructive">
                    <p>{getStartErrorMessage(attemptQuery.error)}</p>
                </div>
                <Button asChild variant="outline">
                    <Link to="/anonymous-exam">Về trang truy cập</Link>
                </Button>
            </div>
        );
    }

    const isFinished = attempt.status !== 'IN_PROGRESS';
    const hasText = (questionId: number) =>
        (answers[questionId]?.textAnswer ?? '').trim().length > 0;
    const codingQuestions = attempt.questions.filter((q) => q.type === 'CODING');
    const currentCode = attempt.questions.find((q) => q.id === codeId && q.type === 'CODING');
    const currentEssay = attempt.questions.find((q) => q.id === essayId && q.type === 'ESSAY');
    const openQuestion = (question: { id: number; type: string }) => {
        if (question.type === 'CODING') {
            setEssayId(null);
            setCodeId(question.id);
        } else if (question.type === 'ESSAY') {
            setCodeId(null);
            setEssayId(question.id);
        } else {
            setEssayId(null);
            setCodeId(null);
            window.setTimeout(
                () => document.getElementById(`question-card-${question.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                50,
            );
        }
    };

    const timerBox = (
        <div
            role="timer"
            aria-live="polite"
            className={`shrink-0 rounded-lg border bg-card px-4 py-2 font-mono text-xl ${
                secondsRemaining <= 60 ? 'border-red-500 text-red-500' : ''
            }`}
        >
            {formatCountdown(secondsRemaining)}
        </div>
    );

    const starButton = (questionId: number, number: number) => (
        <button
            type="button"
            onClick={() => toggleFlag(questionId)}
            aria-pressed={flagged.has(questionId)}
            aria-label={
                flagged.has(questionId)
                    ? `Bỏ đánh dấu câu ${number}`
                    : `Đánh dấu câu ${number}`
            }
            className="rounded-md p-1 transition-colors hover:bg-muted"
        >
            <Star
                className={`h-5 w-5 ${
                    flagged.has(questionId) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                }`}
            />
        </button>
    );

    const navigationPanel = (
        <div className="flex shrink-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="w-full text-sm font-semibold text-foreground">Questions</span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-sm bg-black ring-1 ring-border" /> Chưa trả lời
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-sm bg-green-600" /> Đã trả lời
                </span>
                <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-sm bg-yellow-400" /> Đánh dấu
                </span>
            </div>
            <div className="grid max-h-[8.5rem] grid-cols-5 justify-items-center gap-2 overflow-y-auto p-1">
                {attempt.questions.map((question, index) => {
                    const isFlagged = flagged.has(question.id);
                    const color = isFlagged
                        ? 'bg-yellow-400 text-black'
                        : (answers[question.id]?.selectedOptionIds.length ?? 0) > 0 ||
                        hasText(question.id)
                            ? 'bg-green-600 text-white'
                            : 'bg-black text-white';
                    return (
                        <button
                            key={question.id}
                            type="button"
                            title={`Câu ${index + 1}`}
                            className={`flex h-8 w-8 items-center justify-center rounded-sm text-xs font-medium ${color}`}
                            onClick={() => openQuestion(question)}
                        >
                            {index + 1}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    if (!isFinished && currentCode) {
        const answer = answers[currentCode.id];
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-4">
                <CodingWorkspace
                    key={currentCode.id}
                    question={currentCode}
                    index={attempt.questions.indexOf(currentCode)}
                    value={answer?.textAnswer ?? null}
                    saved={Boolean(answer?.saved)}
                    isSaving={isSaving}
                    hasSaveError={hasSaveError}
                    timerBox={timerBox}
                    notice={<ExamIntegrityNotice config={attempt.integrity} state={integrity} />}
                    onChange={(code) => updateAnswer(currentCode.id, { textAnswer: code })}
                    onSave={() => void saveEssay(currentCode.id)}
                    onBack={() => setCodeId(null)}
                    onRetry={() => void flushPendingAnswers(attempt.id)}
                    onRun={(request) => runAnonymousCode(attempt.id, sessionToken, request)}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link to="/anonymous-exam">
                            <ArrowLeft className="size-5 text-muted-foreground" />
                        </Link>
                        <div>
                            <p className="font-semibold leading-tight">{attempt.title}</p>
                            <p className="text-xs text-muted-foreground">
                                {studentName || 'Học sinh'} · {attempt.durationMinutes} phút ·{' '}
                                {formatScore(attempt.maxScore ?? 10)} điểm
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isSaving && <span className="text-xs text-muted-foreground">Đang lưu...</span>}
                        {timerBox}
                    </div>
                </div>
            </header>

            <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-6">
                {!isFinished && <ExamIntegrityNotice config={attempt.integrity} state={integrity} />}
                {hasSaveError && (
                    <div role="alert" className="flex items-center justify-between rounded-lg border border-destructive bg-red-50 p-3 text-sm text-destructive">
                        <span>Một số câu trả lời chưa được lưu.</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void flushPendingAnswers(attempt.id)}
                        >
                            Thử lại
                        </Button>
                    </div>
                )}

                {isFinished ? (
                    <section className="rounded-xl border bg-white p-6">
                        <h2 className="text-xl font-semibold">
                            {attempt.status === 'EXPIRED' && 'Hết giờ — bài thi đã được nộp tự động'}
                            {attempt.status === 'PENDING_REVIEW' && 'Đã nộp bài — đang chờ chấm tự luận'}
                            {attempt.status === 'SUBMITTED' && 'Hoàn thành bài thi'}
                        </h2>
                        <p className="mt-3 text-lg">
                            {attempt.finalScore === null
                                ? `Điểm tạm thời: ${formatScore(attempt.provisionalScore ?? attempt.objectiveScore ?? 0)}/${formatScore(attempt.maxScore ?? 10)} (câu tự luận chưa chấm tính 0 điểm)`
                                : `Điểm: ${formatScore(attempt.finalScore)}/${formatScore(attempt.maxScore ?? 10)}`}
                        </p>
                        {attempt.finalScore === null && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Điểm câu tự luận sẽ được gửi bổ sung qua email sau khi giáo viên chấm xong.
                            </p>
                        )}
                        <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                            Kết quả đã được gửi về email{' '}
                            <span className="font-medium">{studentEmail || 'của bạn'}</span>.
                        </p>
                        <Button className="mt-5" asChild variant="outline">
                            <Link to="/anonymous-exam">Về trang truy cập</Link>
                        </Button>
                    </section>
                ) : (
                    <>
                        {currentEssay && (
                            <EssayPopup
                                question={currentEssay}
                                index={attempt.questions.indexOf(currentEssay)}
                                value={answers[currentEssay.id]?.textAnswer ?? ''}
                                saved={Boolean(answers[currentEssay.id]?.saved)}
                                isSaving={isSaving}
                                onChange={(value) => updateAnswer(currentEssay.id, { textAnswer: value })}
                                onSave={() => void saveEssay(currentEssay.id)}
                                onClose={() => setEssayId(null)}
                            />
                        )}
                        <div className="flex justify-end">{navigationPanel}</div>

                        {codingQuestions.length > 0 && (
                            <section className="rounded-xl border bg-white p-4">
                                <h2 className="mb-3 font-semibold">Câu hỏi lập trình (Coding)</h2>
                                <div className="grid gap-2">
                                    {codingQuestions.map((question) => {
                                        const saved = Boolean(answers[question.id]?.saved);
                                        return (
                                            <div key={question.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium">
                                                        Câu {attempt.questions.indexOf(question) + 1}
                                                        <span className="ml-2 font-normal text-muted-foreground">
                                                            {formatScore(questionScore(attempt.maxScore, question.points, attempt.totalPoints))} điểm
                                                        </span>
                                                    </p>
                                                    <p className="truncate text-sm text-muted-foreground">{question.content}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-3">
                                                    {starButton(question.id, attempt.questions.indexOf(question) + 1)}
                                                    {saved && <span className="text-sm font-medium text-green-600">Đã lưu</span>}
                                                    {!saved && hasText(question.id) && <span className="text-sm text-muted-foreground">Đang làm</span>}
                                                    <Button
                                                        size="sm"
                                                        className={saved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                                                        onClick={() => openQuestion(question)}
                                                    >
                                                        {saved ? 'Sửa bài' : hasText(question.id) ? 'Tiếp tục' : 'Làm bài'}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {attempt.questions.map((question, index) => {
                            if (question.type === 'CODING') return null;
                            const answer = answers[question.id] ?? {
                                questionId: question.id,
                                selectedOptionIds: [],
                                textAnswer: null,
                            };

                            return (
                                <section
                                    key={question.id}
                                    id={`question-card-${question.id}`}
                                    className="rounded-xl border bg-white p-5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="font-semibold">
                                            Câu {index + 1}
                                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                {formatScore(questionScore(attempt.maxScore, question.points, attempt.totalPoints))} điểm
                                            </span>
                                        </h2>
                                        {starButton(question.id, index + 1)}
                                    </div>

                                    <p className="mt-3 whitespace-pre-wrap">{question.content}</p>

                                    {question.imageUrl?.trim() && (
                                        <div className="mt-3">
                                            <img
                                                src={question.imageUrl}
                                                alt={`Hình ảnh câu ${index + 1}`}
                                                className="max-h-64 rounded-md border object-contain shadow-sm"
                                            />
                                        </div>
                                    )}

                                    {question.type === 'ESSAY' ? (
                                        <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                                            <span className="text-sm text-muted-foreground">
                                                {hasText(question.id) ? 'Đã có nội dung trả lời' : 'Chưa có câu trả lời'}
                                            </span>
                                            <Button
                                                size="sm"
                                                className={
                                                    answer.saved
                                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }
                                                onClick={() => openQuestion(question)}
                                            >
                                                {answer.saved ? 'Sửa bài tự luận' : hasText(question.id) ? 'Tiếp tục' : 'Mở bài tự luận'}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="mt-4 grid gap-3">
                                            {question.options.map((option) => {
                                                const checked =
                                                    answer.selectedOptionIds.includes(option.id);
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
                                                                        ? answer.selectedOptionIds.filter(
                                                                            (id) =>
                                                                                id !== option.id,
                                                                        )
                                                                        : [
                                                                            ...answer.selectedOptionIds,
                                                                            option.id,
                                                                        ];
                                                                updateAnswer(question.id, {
                                                                    selectedOptionIds,
                                                                });
                                                            }}
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

                        <footer className="flex items-center justify-between gap-3 border-t pt-4">
                            <p className="text-sm text-muted-foreground">
                                Câu trả lời được tự động lưu khi bạn chọn.
                            </p>
                            <Button
                                onClick={() => void submitCurrentAnswers(true)}
                                disabled={submitMutation.isPending}
                            >
                                {submitMutation.isPending ? 'Đang nộp...' : 'Nộp bài'}
                            </Button>
                        </footer>
                    </>
                )}
            </main>
        </div>
    );
}
