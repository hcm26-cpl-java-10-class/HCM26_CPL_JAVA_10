import { getAttemptReview } from '@/api/exam.api';
import { scoreAppealApi } from '@/api/features/score-appeal.api';
import StudentSubmissionView from '@/components/features/exam/StudentSubmissionView';
import { formatScore } from '@/utils/examScore';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Lock, MessageSquareWarning } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ExamReviewPage() {
    const { attemptId } = useParams();
    const navigate = useNavigate();
    const id = Number(attemptId);

    const { data, isLoading, error } = useQuery({
        queryKey: ['exam-attempt-review', id],
        queryFn: () => getAttemptReview(id),
        enabled: Number.isFinite(id),
        retry: false,
    });

    const status = isAxiosError(error) ? error.response?.status : undefined;

    const myAppealsQuery = useQuery({
        queryKey: ['my-appeals-for-review'],
        queryFn: scoreAppealApi.getMyAppeals,
    });

    const alreadyAppealed = (myAppealsQuery.data ?? []).some((a) => a.attemptId === id);

    // Diem + dap an dung/sai chi duoc cong bo khi giao vien da Publish Results.
    const revealAnswers = data?.revealAnswers ?? false;
    const score = data ? (data.finalScore ?? data.objectiveScore) : null;

    return (
        <MainLayout pathName={{ exams: 'Exam Schedule', review: 'Review Answers' }}>
            <div className="mx-auto w-full max-w-3xl space-y-4">
                <Button variant="outline" onClick={() => navigate('/student/exams')}>
                    <ArrowLeft className="size-4" />
                    Back to exams
                </Button>

                {isLoading && <p className="text-slate-500">Loading...</p>}

                {error && (
                    <Card className="items-center border-dashed border-slate-300 bg-white py-10 text-center">
                        <CardContent className="space-y-2">
                            <Lock className="mx-auto size-8 text-slate-400" />
                            <CardTitle>
                                {status === 403
                                    ? 'Answers are not available yet'
                                    : status === 404
                                        ? 'Attempt not found'
                                        : 'Could not load answers'}
                            </CardTitle>
                            {status === 403 && (
                                <p className="text-sm text-slate-600">
                                    Answers are shown after your score is published and you have no attempts left
                                    (or the exam has closed).
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {data && (
                    <>
                        <header className="space-y-1">
                            <h1 className="text-2xl font-bold text-slate-900">{data.title}</h1>
                            <p className="text-sm text-slate-600">
                                Attempt #{data.attemptNumber} · Score:{' '}
                                {revealAnswers
                                    ? `${formatScore(score ?? 0)}/${formatScore(data.maxScore ?? 10)}`
                                    : 'Awaiting publication'}
                            </p>
                            {revealAnswers && data.finalScore != null && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-2"
                                    disabled={alreadyAppealed}
                                    onClick={() => navigate(`/my-appeals?attemptId=${id}`)}
                                >
                                    <MessageSquareWarning className="size-4" />
                                    {alreadyAppealed ? 'Appeal submitted' : 'Appeal this score'}
                                </Button>
                            )}
                        </header>

                        {!revealAnswers && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                Your answers are shown for review. Scores and correct answers will be available once
                                your teacher publishes the results.
                            </div>
                        )}

                        <StudentSubmissionView review={data} revealAnswers={revealAnswers} />
                    </>
                )}
            </div>
        </MainLayout>
    );
}
