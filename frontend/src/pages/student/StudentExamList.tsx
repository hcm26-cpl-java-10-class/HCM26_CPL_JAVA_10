import {
    getMyExamAttempts,
    type Exam,
    type ExamAttemptSummary,
} from '@/api/exam.api';
import { invitationApi } from '@/api';
import type { StudentInvitationDTO } from '@/types';
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
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, CalendarDays, Clock3, Mail, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const attemptsQueryKey = ['student-exam-attempts'] as const;

function isOverdue(attempt: ExamAttemptSummary | undefined, now: number) {
    return attempt?.status === 'IN_PROGRESS'
        && attempt.deadlineAt != null
        && new Date(attempt.deadlineAt).getTime() <= now;
}

function getAttemptStatus(attempt: ExamAttemptSummary | undefined, now: number) {
    if (!attempt) return null;
    // Đã quá hạn nhưng server chưa chốt: hiển thị là hết giờ ngay.
    if (isOverdue(attempt, now)) {
        return { label: 'Hết giờ', variant: 'destructive' as const };
    }

    switch (attempt.status) {
        case 'IN_PROGRESS':
            return { label: 'Đang làm', variant: 'secondary' as const };
        case 'EXPIRED':
            return { label: 'Hết giờ — đã tự động nộp', variant: 'destructive' as const };
        case 'PENDING_REVIEW':
            return { label: 'Chờ chấm tự luận', variant: 'outline' as const };
        case 'SUBMITTED':
            return { label: 'Đã hoàn thành', variant: 'default' as const };
    }
}

function ExamCard({
                      exam,
                      attempt,
                      invitation,
                      onOpen,
                      disabled: externallyDisabled,
                  }: {
    exam: Exam;
    attempt?: ExamAttemptSummary;
    invitation: StudentInvitationDTO;
    onOpen: (examId: number) => void;
    disabled: boolean;
}) {
    const now = Date.now();
    const status = getAttemptStatus(attempt, now);
    const overdue = isOverdue(attempt, now);
    const beforeOpen = exam.startTime != null && now < new Date(exam.startTime).getTime();
    const afterClose = exam.endTime != null && now >= new Date(exam.endTime).getTime();
    const isInProgress = attempt?.status === 'IN_PROGRESS' && !overdue;
    const hasAttempts = (attempt?.attemptsUsed ?? 0) > 0;
    const outOfAttempts = hasAttempts && (attempt?.attemptsRemaining ?? 0) <= 0 && !isInProgress;
    const disabledBySchedule = (beforeOpen || afterClose) && !isInProgress && !overdue;
    const isDisabled = externallyDisabled || outOfAttempts || disabledBySchedule;
    const buttonLabel = overdue
        ? 'Xem kết quả'
        : isInProgress
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
                {overdue && (
                    <p className="text-sm text-red-700">
                        Đã hết thời gian làm bài, hệ thống đang tự động nộp bài của bạn.
                    </p>
                )}
                {attempt?.status === 'EXPIRED' && (
                    <p className="text-sm text-red-700">
                        {attempt.finalScore != null
                            ? `Hết giờ, bài được tự động nộp. Điểm: ${attempt.finalScore}/${attempt.totalPoints}.`
                            : `Hết giờ, bài được tự động nộp. Điểm trắc nghiệm tạm thời: ${attempt.objectiveScore ?? 0}/${attempt.totalPoints}; chờ chấm tự luận.`}
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
                {invitation.endTime && (
                    <p className="mt-2 text-xs text-slate-500">Đóng lúc: {new Date(invitation.endTime).toLocaleString()}</p>
                )}
                {isInProgress && (
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
    const attemptsQuery = useQuery({
        queryKey: attemptsQueryKey,
        queryFn: getMyExamAttempts,
        // Có bài đang làm thì hỏi lại 15 giây/lần để thấy "hết giờ / đã nộp" (kể cả nộp từ tab khác).
        refetchInterval: (query) =>
            query.state.data?.some((item) => item.status === 'IN_PROGRESS') ? 15_000 : false,
    });
    const invitationsQuery = useQuery({
        queryKey: ['student-invitations'],
        queryFn: invitationApi.getMyInvitations,
    });

    const retry = () => {
        void attemptsQuery.refetch();
        void invitationsQuery.refetch();
    };

    const hasError = invitationsQuery.isError || attemptsQuery.isError;
    const isLoading = invitationsQuery.isLoading || attemptsQuery.isLoading;
    const invitations = invitationsQuery.data ?? [];
    const exams = invitations
        .filter((invitation) => invitation.status === 'ACCEPTED' && invitation.isActive !== false)
        .map((invitation): { exam: Exam; invitation: StudentInvitationDTO } => ({
            invitation,
            exam: {
                id: invitation.examId,
                title: invitation.examTitle,
                durationMinutes: invitation.durationMinutes ?? 0,
                totalPoints: invitation.totalPoints,
                startTime: invitation.startTime,
                endTime: invitation.endTime,
                maxAttempts: invitation.maxAttempts,
                isActive: true,
            },
        }));
    const attempts = attemptsQuery.data ?? [];

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
                    <Button variant="outline" onClick={() => navigate('/student/invitations')}>
                        <Mail className="size-4" /> Lời mời
                    </Button>
                </header>

                {hasError && (
                    <div
                        role="alert"
                        className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                    >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <p>
                            {invitationsQuery.isError && attemptsQuery.isError
                                ? 'Không thể tải lịch thi và trạng thái bài làm.'
                                : invitationsQuery.isError
                                    ? 'Không thể tải lời mời đã chấp nhận.'
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
                ) : invitationsQuery.isError ? null : exams.length === 0 ? (
                    <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center">
                        <CardContent className="space-y-2">
                            <Mail className="mx-auto size-8 text-slate-400" />
                            <CardTitle className="text-slate-900">Chưa có kỳ thi được chấp nhận</CardTitle>
                            <CardDescription>
                                Chấp nhận lời mời để xem kỳ thi tại đây.
                            </CardDescription>
                            <Button variant="outline" onClick={() => navigate('/student/invitations')}>Xem lời mời</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {exams.map(({ exam, invitation }) => {
                            const examAttempts = attempts.filter((item) => item.examId === exam.id);
                            const attempt = examAttempts.find((item) => item.status === 'IN_PROGRESS')
                                ?? examAttempts.reduce<ExamAttemptSummary | undefined>((latest, item) =>
                                    !latest || item.attemptNumber > latest.attemptNumber ? item : latest, undefined);
                            return (
                                <ExamCard
                                    key={invitation.id}
                                    exam={exam}
                                    invitation={invitation}
                                    attempt={attempt}
                                    disabled={attemptsQuery.isError}
                                    onOpen={(id) => navigate(`/student/exams/${id}/take`)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
