import {
    saveAnonymousAnswers,
    startAnonymousExam,
    submitAnonymousExam,
    SESSION_EMAIL_KEY,
    SESSION_TOKEN_KEY,
    type ExamAttemptAnswer,
    type SaveExamAnswerRequest,
} from "@/api/exam.api";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save, Star } from "lucide-react";
import { toast } from "sonner";

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

/**
 * Trang làm bài dành cho học sinh không có tài khoản RBAC.
 * Xác thực bằng sessionToken lưu ở sessionStorage (do AnonymousAccessPage cấp).
 */
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
                    // Ignore if localStorage is blocked
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
            // handled in mutation
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

    // ----- Render helpers -----

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
                            onClick={() =>
                                document
                                    .getElementById(`question-card-${question.id}`)
                                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }
                        >
                            {index + 1}
                        </button>
                    );
                })}
            </div>
        </div>
    );

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
                                {attempt.totalPoints} điểm
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
                                ? `Điểm phần trắc nghiệm: ${attempt.objectiveScore ?? 0}/${attempt.totalPoints}`
                                : `Điểm: ${attempt.finalScore}/${attempt.totalPoints}`}
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
                        <div className="flex justify-end">{navigationPanel}</div>

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
                                    className="rounded-xl border bg-white p-5"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <h2 className="font-semibold">
                                            Câu {index + 1}
                                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                {question.points} điểm
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
                                        <div className="mt-4 space-y-2">
                                            <textarea
                                                aria-label={`Câu trả lời tự luận câu ${index + 1}`}
                                                className="min-h-40 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                placeholder="Nhập câu trả lời tự luận của bạn..."
                                                value={answer.textAnswer ?? ''}
                                                onChange={(event) =>
                                                    updateAnswer(question.id, {
                                                        textAnswer: event.target.value,
                                                    })
                                                }
                                            />
                                            <Button
                                                size="sm"
                                                className={
                                                    answer.saved
                                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }
                                                onClick={() => void saveEssay(question.id)}
                                            >
                                                <Save className="mr-1 h-4 w-4" />
                                                {answer.saved ? 'Đã lưu' : 'Lưu câu trả lời'}
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