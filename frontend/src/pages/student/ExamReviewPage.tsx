import { getAttemptReview, type ExamReviewQuestion } from '@/api/exam.api';
import { formatScore } from '@/utils/examScore';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Lock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

function optionClass(correct: boolean, selected: boolean) {
    if (correct) return 'border-emerald-400 bg-emerald-50 text-emerald-900';
    if (selected) return 'border-red-400 bg-red-50 text-red-900';
    return 'border-slate-200 bg-white text-slate-700';
}

function QuestionReview({ question, index }: { question: ExamReviewQuestion; index: number }) {
    const isEssay = question.type === 'ESSAY';
    return (
        <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
                <CardTitle className="text-base">
                    Question {index + 1}: {question.content}
                </CardTitle>
                {isEssay ? (
                    <Badge variant="outline">Essay</Badge>
                ) : question.correct ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Correct</Badge>
                ) : (
                    <Badge variant="destructive">Incorrect</Badge>
                )}
            </CardHeader>
            <CardContent className="space-y-2">
                {question.imageUrl && (
                    <img src={question.imageUrl} alt="" className="max-h-60 rounded border" />
                )}
                {isEssay ? (
                    <div className="space-y-2 text-sm">
                        <p className="whitespace-pre-wrap rounded border bg-slate-50 p-3">
                            {question.textAnswer || 'No answer'}
                        </p>
                        <p className="text-slate-600">
                            Score: {question.score != null ? formatScore(question.score) : 'Not graded yet (counts as 0)'}/{formatScore(question.maxScore ?? question.points)}
                        </p>
                        {question.feedback && <p className="text-slate-600">Feedback: {question.feedback}</p>}
                    </div>
                ) : (
                    <>
                        {question.options.map((option) => (
                            <div
                                key={option.id}
                                className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm ${optionClass(option.correct, option.selected)}`}
                            >
                                <span>{option.content}</span>
                                <span className="shrink-0 text-xs font-medium">
                                    {option.selected && 'Your answer'}
                                    {option.selected && option.correct && ' · '}
                                    {option.correct && 'Correct answer'}
                                </span>
                            </div>
                        ))}
                        <p className="text-xs text-slate-500">{formatScore(question.maxScore ?? question.points)} point(s)</p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

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
                                Attempt #{data.attemptNumber} · Score: {formatScore(data.finalScore ?? data.objectiveScore)}/
                                {formatScore(data.maxScore ?? 10)}
                            </p>
                        </header>
                        {data.questions.map((question, index) => (
                            <QuestionReview key={question.questionId} question={question} index={index} />
                        ))}
                    </>
                )}
            </div>
        </MainLayout>
    );
}
