import {
    saveExamAnswers,
    startOrResumeExam,
    submitExamAttempt,
    type ExamAttemptAnswer,
    type SaveExamAnswerRequest,
} from '@/api/exam.api';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
// REMOVED: import EssayAnswerDialog (popup cũ) — câu tự luận giờ có trang riêng /take?essay=ID. File EssayAnswerDialog.tsx có thể xóa.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'; // NEW: useSearchParams
import { ArrowLeft, Save, Star } from 'lucide-react'; // NEW: Star = đánh dấu câu
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
    // NEW: trang làm tự luận nằm trong cùng route, chọn bằng ?essay=<questionId>
    const [searchParams, setSearchParams] = useSearchParams();
    const essayParam = Number(searchParams.get('essay'));
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

    // NEW: đánh dấu ngôi sao (lưu localStorage theo từng lượt làm) + câu đang được chọn
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
                    // bỏ qua nếu trình duyệt chặn localStorage
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
                // NEW: cảnh báo số câu tự luận chưa bấm "Lưu bài"
                'Bạn có chắc chắn muốn nộp bài? Hãy kiểm tra lại câu trả lời trước khi tiếp tục.' +
                (() => {
                    const unsaved = attempt.questions.filter((q) => q.type === 'ESSAY' && !answersRef.current[q.id]?.saved).length;
                    return unsaved > 0 ? `\n\nCòn ${unsaved} câu tự luận chưa bấm "Lưu bài" (nội dung đang soạn vẫn được nộp).` : '';
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
        // NEW: sửa nội dung bài tự luận đã lưu -> quay về trạng thái chưa lưu (xanh dương)
        if (update.textAnswer !== undefined && (update.textAnswer ?? '') !== (current.textAnswer ?? '')) {
            next.saved = false;
        }
        setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: next }));
        scheduleAnswerSave(questionId, next);
    };

    // ===== NEW: logic trang làm tự luận =====
    const openEssay = (questionId: number) => setSearchParams({ essay: String(questionId) });
    const closeEssay = () => setSearchParams({});

    const hasText = (questionId: number) => (answers[questionId]?.textAnswer ?? '').trim().length > 0;
    const isAnswered = (question: { id: number; type: string }) =>
        question.type === 'ESSAY'
            ? hasText(question.id)
            : (answers[question.id]?.selectedOptionIds.length ?? 0) > 0;

    // Bấm "Lưu bài": gửi nội dung + markSaved, thành công thì đánh dấu "Đã lưu" và quay về trang chính
    const saveEssay = async (questionId: number) => {
        if (!attempt || attempt.status !== 'IN_PROGRESS') return;
        if (!hasText(questionId)) {
            toast.error('Hãy nhập nội dung bài làm trước khi lưu.');
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
            toast.error('Chưa lưu được bài. Kiểm tra kết nối mạng rồi bấm Lưu bài lại.');
            return;
        }
        setAnswers((all) => ({ ...all, [questionId]: { ...all[questionId], questionId, saved: true } as ExamAttemptAnswer }));
        toast.success('Đã lưu bài tự luận.');
        closeEssay();
    };

    const jumpToQuestion = (question: { id: number; type: string }) => {
        setActiveQuestionId(question.id); // NEW: ô được chọn có viền đỏ
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
    const essayQuestions = attempt.questions.filter((q) => q.type === 'ESSAY');
    const currentEssay = attempt.questions.find((q) => q.id === essayParam && q.type === 'ESSAY');
    const currentEssayIndex = currentEssay ? attempt.questions.indexOf(currentEssay) : -1;
    const currentAnswer = currentEssay ? answers[currentEssay.id] : undefined;
    const currentSaved = Boolean(currentAnswer?.saved);

    const activeId = currentEssay ? currentEssay.id : activeQuestionId;

    const timerBox = (
        <div role="timer" aria-live="polite" className={`shrink-0 rounded-lg border px-4 py-2 font-mono text-xl ${secondsRemaining <= 60 ? 'border-red-500 text-red-500' : ''}`}>
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
                aria-label={isFlagged ? `Bỏ đánh dấu câu ${number}` : `Đánh dấu câu ${number}`}
                title={isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu câu này'}
                className="rounded-md p-1 transition-colors hover:bg-muted"
            >
                <Star className={`h-5 w-5 ${isFlagged ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </button>
        );
    };

    // NEW: thanh ghim cố định trên cùng — đồng hồ bên trái, danh sách câu hỏi bên phải
    // Màu ô: vàng (đánh dấu, luôn ưu tiên) > xanh (đã làm) > đen (chưa làm); viền đỏ = câu đang chọn
    const pinnedBar = (
        <div className="sticky top-0 z-30 flex items-start justify-between gap-4 bg-background/95 py-3 backdrop-blur">
            {timerBox}
            <div className="flex w-[15.5rem] shrink-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="w-full text-sm font-semibold text-foreground">Danh sách câu hỏi</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-black ring-1 ring-border" /> Chưa làm</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-green-600" /> Đã làm</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-yellow-400" /> Đánh dấu</span>
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
                                title={`Câu ${index + 1}${question.type === 'ESSAY' ? ' (tự luận)' : ''}${isFlagged ? ' · đã đánh dấu' : ''}`}
                                aria-label={`Câu ${index + 1}: ${isAnswered(question) ? 'đã làm' : 'chưa làm'}${isFlagged ? ', đã đánh dấu' : ''}`}
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
            {submitMutation.isPending ? 'Đang nộp...' : 'Nộp bài thi'}
        </Button>
    );

    // ===== Trang làm 1 câu tự luận: full màn hình, thanh ghim trên cùng, câu hỏi : bài làm = 1 : 4 =====
    if (!isFinished && currentEssay) {
        return (
            <MainLayout pathName={{ exams: 'Lịch thi', take: 'Làm bài thi' }}>
                <main className="flex min-h-[calc(100vh-10rem)] w-full flex-col gap-4">
                    {pinnedBar}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button variant="outline" onClick={closeEssay}>
                            <ArrowLeft className="mr-1 h-4 w-4" /> Về trang làm bài
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {starButton(currentEssay.id, currentEssayIndex + 1)}
                            <span>Câu {currentEssayIndex + 1} · {currentEssay.points} điểm</span>
                            {currentSaved && <span className="font-medium text-green-600">Đã lưu</span>}
                            {isSaving && <span>Đang lưu...</span>}
                        </div>
                        <Button
                            onClick={() => void saveEssay(currentEssay.id)}
                            className={currentSaved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                        >
                            <Save className="mr-1 h-4 w-4" /> {currentSaved ? 'Đã lưu' : 'Lưu bài'}
                        </Button>
                    </div>

                    {hasSaveError && (
                        <p role="alert" className="text-sm text-destructive">
                            Có thay đổi chưa được lưu lên máy chủ.{' '}
                            <Button variant="outline" size="sm" onClick={() => void flushPendingAnswers(attempt.id)}>Thử lưu lại</Button>
                        </p>
                    )}

                    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-5">
                        <section className="overflow-auto rounded-xl border p-4 md:col-span-1">
                            <h2 className="font-semibold">Câu hỏi</h2>
                            <p className="mt-3 whitespace-pre-wrap text-sm">{currentEssay.content}</p>
                        </section>
                        <section className="flex flex-col rounded-xl border p-4 md:col-span-4">
                            <h2 className="mb-3 font-semibold">Bài làm</h2>
                            <textarea
                                aria-label={`Bài làm câu ${currentEssayIndex + 1}`}
                                className="min-h-[50vh] w-full flex-1 resize-none rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="Nhập bài làm của bạn tại đây..."
                                value={currentAnswer?.textAnswer ?? ''}
                                onChange={(event) => updateAnswer(currentEssay.id, { textAnswer: event.target.value })}
                            />
                        </section>
                    </div>

                    <footer className="flex justify-end border-t pt-4">{submitButton}</footer>
                </main>
            </MainLayout>
        );
    }

    return (
        <MainLayout pathName={{ exams: 'Lịch thi', take: 'Làm bài thi' }}>
            <main className="flex w-full flex-col gap-5">
                {!isFinished && pinnedBar}
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
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
                            {/* NEW: danh sách câu tự luận ở trên cùng; bấm vào để mở trang làm câu đó */}
                            {essayQuestions.length > 0 && (
                                <section className="rounded-xl border p-4">
                                    <h2 className="mb-3 font-semibold">Câu tự luận</h2>
                                    <div className="grid gap-2">
                                        {essayQuestions.map((question) => {
                                            const saved = Boolean(answers[question.id]?.saved);
                                            return (
                                                <div key={question.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium">
                                                            Câu {attempt.questions.indexOf(question) + 1}
                                                            <span className="ml-2 font-normal text-muted-foreground">{question.points} điểm</span>
                                                        </p>
                                                        <p className="truncate text-sm text-muted-foreground">{question.content}</p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-3">
                                                        {starButton(question.id, attempt.questions.indexOf(question) + 1)}
                                                        {saved && <span className="text-sm font-medium text-green-600">Đã lưu</span>}
                                                        {!saved && hasText(question.id) && <span className="text-sm text-muted-foreground">Đang soạn</span>}
                                                        <Button
                                                            size="sm"
                                                            className={saved ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'}
                                                            onClick={() => openEssay(question.id)}
                                                        >
                                                            {saved ? 'Sửa bài' : hasText(question.id) ? 'Làm tiếp' : 'Làm bài'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

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
                                // CHANGED: câu tự luận không hiện ở đây nữa (đã có danh sách tự luận phía trên)
                                if (question.type === 'ESSAY') return null;
                                const answer = answers[question.id] ?? {
                                    questionId: question.id,
                                    selectedOptionIds: [],
                                    textAnswer: null,
                                };

                                return (
                                    <section key={question.id} id={`question-card-${question.id}`} className="scroll-mt-40 rounded-xl border p-5">
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
                                                                setActiveQuestionId(question.id);
                                                                updateAnswer(question.id, { selectedOptionIds });
                                                            }}
                                                            disabled={isFinished}
                                                        />
                                                        <span>{option.content}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })}

                            <footer className="flex flex-wrap justify-between gap-3 border-t pt-4">
                                <Button variant="outline" onClick={handleLeaveExam}>
                                    Rời bài thi
                                </Button>
                                {/* CHANGED: nhãn "Nộp bài" -> "Nộp bài thi" */}
                                {submitButton}
                            </footer>
                        </>
                    )}
                </div>
            </main>
        </MainLayout>
    );
}
