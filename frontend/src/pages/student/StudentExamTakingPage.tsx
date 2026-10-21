import {
    saveExamAnswers,
    startOrResumeExam,
    submitExamAttempt,
    type ExamAttemptAnswer,
    type SaveExamAnswerRequest,
} from '@/api/exam.api';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { EssayAnswerDialog } from './components/EssayAnswerDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const attemptQueryKey = (examId: number) => ['student-exam-attempt', examId] as const;

function toAnswerRequests(answers: Record<number, ExamAttemptAnswer>): SaveExamAnswerRequest[] {
    return Object.values(answers).map((answer) => ({
        questionId: answer.questionId,
        selectedOptionIds: answer.selectedOptionIds,
        textAnswer: answer.textAnswer,
    }));
}

function getStartErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        if (!error.response) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
        const message = (error.response.data as { message?: string } | undefined)?.message;
        if (error.response.status === 403) return 'Bạn không có quyền làm bài thi này.';
        if (error.response.status === 404) return 'Không tìm thấy đề thi hoặc đề thi đã bị tắt.';
        if (message) return message;
    }
    return 'Không thể mở đề thi. Vui lòng thử lại.';
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
    const queryClient = useQueryClient();
    const timerRefs = useRef(new Map<number, number>());
    const autoSubmitStarted = useRef(false);
    const submitStartedRef = useRef(false);

    const pendingAnswersRef = useRef(
        new Map<number, SaveExamAnswerRequest>(),
    );
    const savingRef = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaveError, setHasSaveError] = useState(false);

    const [answers, setAnswers] = useState<Record<number, ExamAttemptAnswer>>({});
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
            if (attempt.status === 'EXPIRED') {
                toast.warning('Đã hết giờ, bài của bạn được tự động nộp.');
            } else {
                toast.success(attempt.status === 'PENDING_REVIEW' ? 'Đã nộp bài, phần tự luận đang chờ chấm.' : 'Đã nộp bài.');
            }
        },
        onError: () => toast.error('Không thể nộp bài. Vui lòng thử lại.'),
    });

    const attempt = attemptQuery.data;

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
                    | [number, SaveExamAnswerRequest]
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
                                ? 'Đã hết giờ, bài của bạn được tự động nộp.'
                                : 'Bài thi này đã được nộp (có thể từ tab khác). Thay đổi mới nhất không được lưu.',
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
                'Bạn đang làm bài thi. Bạn có chắc chắn muốn rời trang không?',
            )
        ) {
            return;
        }

        navigate('/student/exams');
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
                'Bạn có chắc chắn muốn nộp bài? Hãy kiểm tra lại câu trả lời trước khi tiếp tục.',
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
                    'Một số câu trả lời chưa lưu được. Hãy kiểm tra kết nối mạng rồi thử lại.',
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
            // submitMutation đã xử lý thông báo lỗi.
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
            submitCurrentAnswers();
        }
    }, [attempt?.status, secondsRemaining, submitMutation.isPending]);

    const scheduleAnswerSave = (
        questionId: number,
        answer: ExamAttemptAnswer,
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

    const updateAnswer = (questionId: number, update: Partial<ExamAttemptAnswer>) => {
        const current = answers[questionId] ?? {
            questionId,
            selectedOptionIds: [],
            textAnswer: null,
        };
        const next = { ...current, ...update };
        setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: next }));
        scheduleAnswerSave(questionId, next);
    };

    if (!validExamId) {
        return (
            <MainLayout>
                <div role="alert" className="rounded-lg border border-destructive p-6 text-destructive">
                    Mã đề thi không hợp lệ.
                </div>
            </MainLayout>
        );
    }

    if (attemptQuery.isLoading) {
        return <MainLayout><p className="p-6">Đang tải đề thi...</p></MainLayout>;
    }

    if (attemptQuery.isError || !attempt) {
        return (
            <MainLayout>
                <div role="alert" className="space-y-4 rounded-lg border border-destructive p-6 text-destructive">
                    <p>{getStartErrorMessage(attemptQuery.error)}</p>
                    <Button variant="outline" onClick={() => navigate('/student/exams')}>Quay lại lịch thi</Button>
                </div>
            </MainLayout>
        );
    }

    const isFinished = attempt.status !== 'IN_PROGRESS';

    return (
        <MainLayout pathName={{ exams: 'Lịch thi', take: 'Làm bài thi' }}>
            <main className="mx-auto flex max-w-4xl flex-col gap-5">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Bài thi</p>
                        <h1 className="mt-1 text-2xl font-semibold">{attempt.title}</h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Lượt làm {attempt.attemptNumber} · Thời lượng {attempt.durationMinutes} phút · Tổng điểm {attempt.totalPoints}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Hạn chính thức: {attempt.officialDeadlineAt
                            ? new Date(attempt.officialDeadlineAt).toLocaleString()
                            : 'Theo thời lượng bài thi'}
                            {attempt.officialDeadlineAt && attempt.deadlineAt !== attempt.officialDeadlineAt
                                ? ` · Hạn gia hạn: ${new Date(attempt.deadlineAt).toLocaleString()}`
                                : ''}
                        </p>
                    </div>
                    {attempt.status === 'IN_PROGRESS' && (
                        <div role="timer" aria-live="polite" className={`rounded-lg border px-4 py-2 font-mono text-xl ${secondsRemaining <= 60 ? 'border-red-500 text-red-500' : ''}`}>
                            {formatCountdown(secondsRemaining)}
                        </div>
                    )}
                </header>

                {isFinished ? (
                    <section className="rounded-xl border p-6">
                        <h2 className="text-xl font-semibold">
                            {attempt.status === 'EXPIRED' && 'Hết giờ — bài đã được tự động nộp'}
                            {attempt.status === 'PENDING_REVIEW' && 'Đã nộp bài — chờ chấm tự luận'}
                            {attempt.status === 'SUBMITTED' && 'Đã hoàn thành bài thi'}
                        </h2>
                        <p className="mt-3 text-lg">
                            {attempt.finalScore === null
                                ? `Điểm trắc nghiệm tạm thời: ${attempt.objectiveScore ?? 0}/${attempt.totalPoints}`
                                : `Điểm: ${attempt.finalScore}/${attempt.totalPoints}`}
                        </p>
                        {attempt.status === 'EXPIRED' && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Thời gian làm bài đã kết thúc. Hệ thống chỉ chấm những câu bạn đã trả lời trước khi hết giờ.
                            </p>
                        )}
                        {attempt.bestScore != null && (
                            <p className="mt-2 text-sm font-medium text-emerald-700">
                                Điểm cao nhất: {attempt.bestScore}/{attempt.totalPoints}
                            </p>
                        )}
                        {attempt.late && (
                            <p className="mt-2 text-sm text-amber-700">
                                Bài được nộp trong thời gian gia hạn.
                                {attempt.latePenaltyPercentApplied != null
                                    ? ` Đã trừ ${attempt.latePenaltyPercentApplied}% điểm.`
                                    : ''}
                            </p>
                        )}
                        {attempt.finalScore === null && attempt.status !== 'SUBMITTED' && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Điểm cuối cùng sẽ được cập nhật sau khi giáo viên chấm câu tự luận.
                            </p>
                        )}
                        <Button className="mt-5" variant="outline" onClick={() => navigate('/student/exams')}>
                            Quay lại lịch thi
                        </Button>
                    </section>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <span>Câu trả lời được tự động lưu khi bạn thay đổi.</span>

                            {isSaving && <span>Đang lưu...</span>}

                            {hasSaveError && (
                                <span role="alert" className="text-destructive">
                                    Có câu trả lời chưa được lưu.
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void flushPendingAnswers(attempt.id)}
                                    >
                                        Thử lưu lại
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
                                <section key={question.id} className="rounded-xl border p-5">
                                    <h2 className="font-semibold">
                                        Câu {index + 1}
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                                            {question.points} điểm
                                        </span>
                                    </h2>
                                    <p className="mt-3 whitespace-pre-wrap">{question.content}</p>

                                    {/* Hiển thị hình ảnh câu hỏi nếu có */}
                                    {question.imageUrl?.trim() && (
                                        <div className="mt-3">
                                            <img
                                                src={question.imageUrl}
                                                alt={`Hình ảnh câu ${index + 1}`}
                                                className="max-h-64 rounded-md border object-contain"
                                            />
                                        </div>
                                    )}

                                    {question.type === 'ESSAY' ? (
                                        <EssayAnswerDialog
                                            label={`Câu ${index + 1}`}
                                            questionContent={question.content}
                                            value={answer.textAnswer ?? ''}
                                            onChange={(text) => updateAnswer(question.id, { textAnswer: text })}
                                            disabled={isFinished}
                                        />
                                    ) : (
                                        <div className="mt-4 grid gap-3">
                                            {question.options.map((option) => {
                                                const checked = answer.selectedOptionIds.includes(option.id);
                                                const isMulti = question.multiSelect ?? question.type === 'MULTI_CHOICE';
                                                const inputType = isMulti ? 'checkbox' : 'radio';
                                                return (
                                                    <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
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
                                                        />
                                                        <div className="flex flex-col gap-2">
                                                            <span>{option.content}</span>
                                                            {/* Hiển thị hình ảnh của đáp án nếu có */}
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
                                Rời bài thi
                            </Button>
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
        </MainLayout>
    );
}