import {
    saveExamAnswers,
    startOrResumeExam,
    submitExamAttempt,
    type ExamAttemptAnswer,
    type SaveExamAnswerRequest,
} from '@/api/exam.api';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    const [answers, setAnswers] = useState<Record<number, ExamAttemptAnswer>>({});
    const [now, setNow] = useState(() => Date.now());

    const attemptQuery = useQuery({
        queryKey: validExamId ? attemptQueryKey(examId) : ['student-exam-attempt', 'invalid'],
        queryFn: () => startOrResumeExam(examId),
        enabled: validExamId,
        retry: false,
    });

    const saveMutation = useMutation({
        mutationFn: ({ attemptId, answer }: { attemptId: number; answer: SaveExamAnswerRequest }) =>
            saveExamAnswers(attemptId, [answer]),
        onError: () => toast.error('Không thể lưu câu trả lời. Hãy thử lại trước khi nộp bài.'),
    });

    const submitMutation = useMutation({
        mutationFn: ({ attemptId, submittedAnswers }: { attemptId: number; submittedAnswers: SaveExamAnswerRequest[] }) =>
            submitExamAttempt(attemptId, submittedAnswers),
        onSuccess: (attempt) => {
            queryClient.setQueryData(attemptQueryKey(examId), attempt);
            toast.success(attempt.status === 'PENDING_REVIEW' ? 'Đã nộp bài, phần tự luận đang chờ chấm.' : 'Đã nộp bài.');
        },
        onError: () => toast.error('Không thể nộp bài. Vui lòng thử lại.'),
    });

    const attempt = attemptQuery.data;

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

    useEffect(() => () => {
        timerRefs.current.forEach((timer) => window.clearTimeout(timer));
        timerRefs.current.clear();
    }, []);

    const submitCurrentAnswers = () => {
        if (!attempt || attempt.status !== 'IN_PROGRESS' || submitMutation.isPending) return;
        timerRefs.current.forEach((timer) => window.clearTimeout(timer));
        timerRefs.current.clear();
        submitMutation.mutate({
            attemptId: attempt.id,
            submittedAnswers: toAnswerRequests(answers),
        });
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

    const scheduleAnswerSave = (questionId: number, answer: ExamAttemptAnswer) => {
        if (!attempt || attempt.status !== 'IN_PROGRESS') return;
        const existingTimer = timerRefs.current.get(questionId);
        if (existingTimer !== undefined) window.clearTimeout(existingTimer);
        const timer = window.setTimeout(() => {
            saveMutation.mutate({
                attemptId: attempt.id,
                answer: {
                    questionId,
                    selectedOptionIds: answer.selectedOptionIds,
                    textAnswer: answer.textAnswer,
                },
            });
            timerRefs.current.delete(questionId);
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
                    <p>Không thể mở đề thi. Đề có thể không còn hoạt động hoặc bạn không có quyền làm bài.</p>
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
                            {attempt.status === 'PENDING_REVIEW' ? 'Đã nộp bài — chờ chấm tự luận' : 'Đã hoàn thành bài thi'}
                        </h2>
                        <p className="mt-3 text-lg">
                            {attempt.status === 'PENDING_REVIEW'
                                ? `Điểm trắc nghiệm tạm thời: ${attempt.objectiveScore ?? 0}/${attempt.totalPoints}`
                                : `Điểm: ${attempt.finalScore ?? 0}/${attempt.totalPoints}`}
                        </p>
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
                        {attempt.status === 'PENDING_REVIEW' && (
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
                            {saveMutation.isPending && <span>Đang lưu...</span>}
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

                                    {question.type === 'ESSAY' ? (
                                        <textarea
                                            aria-label={`Câu trả lời câu ${index + 1}`}
                                            className="mt-4 min-h-40 w-full rounded-md border bg-background p-3"
                                            value={answer.textAnswer ?? ''}
                                            onChange={(event) => updateAnswer(question.id, { textAnswer: event.target.value })}
                                            disabled={isFinished}
                                        />
                                    ) : (
                                        <div className="mt-4 grid gap-3">
                                            {question.options.map((option) => {
                                                const checked = answer.selectedOptionIds.includes(option.id);
                                                const inputType = question.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox';
                                                return (
                                                    <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                                                        <input
                                                            type={inputType}
                                                            name={`question-${question.id}`}
                                                            checked={checked}
                                                            onChange={() => {
                                                                const selectedOptionIds = question.type === 'SINGLE_CHOICE'
                                                                    ? [option.id]
                                                                    : checked
                                                                        ? answer.selectedOptionIds.filter((id) => id !== option.id)
                                                                        : [...answer.selectedOptionIds, option.id];
                                                                updateAnswer(question.id, { selectedOptionIds });
                                                            }}
                                                            disabled={isFinished}
                                                        />
                                                        <span>{option.content}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            );
                        })}

                        <footer className="flex flex-wrap justify-between gap-3 border-t pt-4">
                            <Button variant="outline" onClick={() => navigate('/student/exams')}>
                                Rời bài thi
                            </Button>
                            <Button onClick={submitCurrentAnswers} disabled={submitMutation.isPending}>
                                {submitMutation.isPending ? 'Đang nộp...' : 'Nộp bài'}
                            </Button>
                        </footer>
                    </>
                )}
            </main>
        </MainLayout>
    );
}
