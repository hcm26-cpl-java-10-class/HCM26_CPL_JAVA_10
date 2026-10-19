import {
    getMyExamAttempts,
    getStudentExams,
    type Exam,
    type ExamAttemptSummary,
} from '@/api/exam.api';
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
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertCircle, ArrowRight, CalendarDays, Clock3, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const examsQueryKey = ['student-exams'] as const;
const attemptsQueryKey = ['student-exam-attempts'] as const;

function getAttemptStatus(attempt?: ExamAttemptSummary) {
    if (!attempt) return null;

    switch (attempt.status) {
        case 'IN_PROGRESS':
            return { label: 'Đang làm', variant: 'secondary' as const };
        case 'PENDING_REVIEW':
            return { label: 'Chờ chấm tự luận', variant: 'outline' as const };
        case 'SUBMITTED':
            return { label: 'Đã hoàn thành', variant: 'default' as const };
    }
}

function ExamCard({
                      exam,
                      attempt,
                      onOpen,
                      disabled: externallyDisabled,
                  }: {
    exam: Exam;
    attempt?: ExamAttemptSummary;
    onOpen: (examId: number) => void;
    disabled: boolean;
}) {
    const status = getAttemptStatus(attempt);
    const now = Date.now();
    const beforeOpen = exam.startTime != null && now < new Date(exam.startTime).getTime();
    const afterClose = exam.endTime != null && now >= new Date(exam.endTime).getTime();
    const isInProgress = attempt?.status === 'IN_PROGRESS';
    const hasAttempts = (attempt?.attemptsUsed ?? 0) > 0;
    const outOfAttempts = hasAttempts && (attempt?.attemptsRemaining ?? 0) <= 0 && !isInProgress;
    const disabledBySchedule = (beforeOpen || afterClose) && !isInProgress;
    const isDisabled = externallyDisabled || outOfAttempts || disabledBySchedule;
    const buttonLabel = isInProgress
        ? 'Tiếp tục làm bài'
        : outOfAttempts
            ? 'Đã hết lượt'
            : beforeOpen
                ? 'Chưa đến giờ mở'
                : afterClose
                    ? 'Kỳ thi đã đóng'
                    : 'Vào thi';

    return (
        <Card className="flex h-full flex-col border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary" className="gap-1 bg-sky-50 text-sky-700">
                        <Clock3 className="size-3" />
                        {exam.durationMinutes} phút
                    </Badge>
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                </div>
                <CardTitle className="pt-2 text-lg text-slate-900">{exam.title}</CardTitle>
                <CardDescription>
                    Tổng điểm:{' '}
                    <span className="font-medium text-slate-700">
                        {attempt?.totalPoints ?? exam.totalPoints ?? 'Chưa cập nhật'}
                    </span>
                </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
                {attempt?.status === 'PENDING_REVIEW' && (
                    <p className="text-sm text-amber-700">
                        Điểm trắc nghiệm tạm thời: {attempt.objectiveScore ?? 0}/{attempt.totalPoints}.
                    </p>
                )}
                {attempt?.status === 'SUBMITTED' && (
                    <p className="text-sm text-emerald-700">
                        Điểm cao nhất: {attempt.bestScore ?? attempt.finalScore ?? 0}/{attempt.totalPoints}.
                    </p>
                )}
                {hasAttempts && attempt?.status !== 'SUBMITTED' && attempt?.bestScore != null && (
                    <p className="text-sm text-emerald-700">Điểm cao nhất: {attempt.bestScore}/{attempt.totalPoints}.</p>
                )}
                {attempt && (
                    <p className="mt-2 text-sm text-slate-600">
                        Lượt {attempt.attemptNumber} · Đã dùng {attempt.attemptsUsed}/{exam.maxAttempts ?? 1} lượt
                    </p>
                )}

                {attempt?.status === 'IN_PROGRESS' && (
                    <p className="text-sm text-sky-700">
                        Bài làm của bạn đã được lưu. Bạn có thể tiếp tục bài thi.
                    </p>
                )}
                {!attempt && (
                    <p className="text-sm text-slate-500">
                        Bạn chưa bắt đầu bài thi này.
                    </p>
                )}
            </CardContent>

            <CardFooter className="border-t border-slate-100 pt-4">
                <Button className="w-full bg-cyan-600 text-white hover:bg-cyan-500" disabled={isDisabled} onClick={() => onOpen(exam.id)}>
                    {buttonLabel}
                    <ArrowRight className="size-4" />
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function StudentExamList() {
    const navigate = useNavigate();
    const [passwordExam, setPasswordExam] = useState<Exam | null>(null);

    const examsQuery = useQuery({
        queryKey: examsQueryKey,
        queryFn: async () => {
            const data = await getStudentExams();
            return data.content || [];
        },
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

    const exams = examsQuery.data ?? [];
    const attempts = attemptsQuery.data ?? [];

    const openExam = (examId: number) => {
        const exam = exams.find((item) => item.id === examId);
        const isInProgress = attempts.some((item) => item.examId === examId && item.status === 'IN_PROGRESS');
        // Bài đang làm dở thì server cho vào tiếp, không cần nhập lại mật khẩu.
        if (exam?.hasPassword && !isInProgress) {
            setPasswordExam(exam);
            return;
        }
        navigate(`/student/exams/${examId}/take`);
    };

    return (
        <MainLayout pathName={{ exams: 'Lịch thi' }}>
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="mb-2 flex items-center gap-2 text-cyan-700">
                            <CalendarDays className="size-5" />
                            <span className="text-sm font-medium">Khu vực sinh viên</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            Lịch thi của tôi
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Theo dõi các kỳ thi, tiếp tục bài đang làm hoặc xem kết quả.
                        </p>
                    </div>
                    {hasError && (
                        <Button variant="outline" onClick={retry}>
                            <RefreshCw className="size-4" />
                            Tải lại
                        </Button>
                    )}
                </header>

                {hasError && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <p>
                            {examsQuery.isError && attemptsQuery.isError
                                ? 'Không thể tải lịch thi và trạng thái bài làm.'
                                : examsQuery.isError
                                    ? 'Không thể tải danh sách kỳ thi.'
                                    : 'Không thể tải trạng thái các bài thi đã làm. Tải lại để xác nhận trạng thái trước khi vào thi.'}
                        </p>
                    </div>
                )}

                {isLoading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 3 }, (_, index) => (
                            <Card key={index} className="h-56 animate-pulse border-slate-200 bg-white">
                                <CardContent className="space-y-4 pt-6">
                                    <div className="h-5 w-24 rounded bg-slate-100" />
                                    <div className="h-6 w-3/4 rounded bg-slate-100" />
                                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                                    <div className="h-9 rounded bg-slate-100" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : examsQuery.isError ? null : exams.length === 0 ? (
                    <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center">
                        <CardContent className="space-y-2">
                            <CalendarDays className="mx-auto size-8 text-slate-400" />
                            <CardTitle className="text-slate-900">Chưa có kỳ thi nào</CardTitle>
                            <CardDescription>
                                Hiện tại chưa có kỳ thi nào được xếp lịch dành cho bạn.
                            </CardDescription>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {exams.map((exam) => {
                            const examAttempts = attempts.filter((item) => item.examId === exam.id);
                            const attempt = examAttempts.find((item) => item.status === 'IN_PROGRESS')
                                ?? examAttempts.reduce<ExamAttemptSummary | undefined>((latest, item) =>
                                    !latest || item.attemptNumber > latest.attemptNumber ? item : latest, undefined);
                            return (
                                <ExamCard
                                    key={exam.id}
                                    exam={exam}
                                    attempt={attempt}
                                    disabled={attemptsQuery.isError}
                                    onOpen={openExam}
                                />
                            );
                        })}
                    </div>
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
                    // startOrResumeExam đọc mật khẩu này rồi gửi kèm POST /attempt.
                    sessionStorage.setItem(`exam_pass_${examId}`, password);
                    setPasswordExam(null);
                    navigate(`/student/exams/${examId}/take`);
                }}
            />
        </MainLayout>
    );
}