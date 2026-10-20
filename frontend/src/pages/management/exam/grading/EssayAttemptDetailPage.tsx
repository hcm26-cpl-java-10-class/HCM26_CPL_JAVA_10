// ===== NEW FILE: giáo viên xem chi tiết một bài tự luận (/exams/:examId/grading/:attemptId) — chỉ xem, chưa chấm điểm =====
import { examApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ESSAY_STATUS_LABEL, formatDateTime } from "./EssayAttemptListPage";

export default function EssayAttemptDetailPage() {
    const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
    const numericExamId = Number(examId);
    const numericAttemptId = Number(attemptId);
    const validIds = Number.isInteger(numericExamId) && numericExamId > 0
        && Number.isInteger(numericAttemptId) && numericAttemptId > 0;
    const navigate = useNavigate();

    const detailQuery = useQuery({
        queryKey: ["essay-attempt", numericExamId, numericAttemptId],
        queryFn: () => examApi.getEssayAttempt(numericExamId, numericAttemptId),
        enabled: validIds,
    });
    const detail = detailQuery.data;
    const backToList = () => navigate(`/exams/${numericExamId}/grading`);

    return (
        <MainLayout pathName={{ exams: "Quản lý đề thi", grading: "Bài tự luận", detail: "Chi tiết" }}>
            <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={backToList}>
                    <ChevronLeft className="size-4" />
                    Quay lại danh sách
                </Button>

                {detailQuery.isLoading && <p className="text-muted-foreground">Đang tải bài làm...</p>}
                {(detailQuery.isError || !validIds) && (
                    <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
                        Không tải được bài làm. Bài có thể chưa được nộp hoặc không thuộc đề thi này.
                    </p>
                )}

                {detail && (
                    <>
                        <header className="border-b pb-4">
                            <h1 className="text-2xl font-semibold">{detail.examTitle}</h1>
                            <p className="mt-2 text-sm">
                                <span className="font-medium">{detail.studentName || `Sinh viên #${detail.studentId}`}</span>
                                <span className="text-muted-foreground"> · {detail.studentEmail}</span>
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>Lượt làm {detail.attemptNumber}</span>
                                <span>Bắt đầu: {formatDateTime(detail.startedAt)}</span>
                                <span>Nộp: {formatDateTime(detail.submittedAt)}</span>
                                <span>Điểm trắc nghiệm: {detail.objectiveScore ?? 0}/{detail.totalPoints}</span>
                                <Badge variant={detail.status === "EXPIRED" ? "destructive" : "secondary"}>
                                    {ESSAY_STATUS_LABEL[detail.status]}
                                </Badge>
                            </div>
                        </header>

                        {detail.essays.length === 0 && (
                            <p className="text-muted-foreground">Bài này không có câu tự luận.</p>
                        )}

                        {detail.essays.map((essay, index) => (
                            <article key={essay.questionId} className="rounded-xl border p-5">
                                <h2 className="font-semibold">
                                    Câu tự luận {index + 1}
                                    <span className="ml-2 text-sm font-normal text-muted-foreground">{essay.points} điểm</span>
                                </h2>
                                <p className="mt-3 whitespace-pre-wrap">{essay.content}</p>
                                <div className="mt-4 rounded-md border bg-muted/30 p-4">
                                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Câu trả lời của sinh viên</p>
                                    {essay.answerText.trim() ? (
                                        <p className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">{essay.answerText}</p>
                                    ) : (
                                        <p className="text-sm italic text-muted-foreground">Sinh viên bỏ trống câu này.</p>
                                    )}
                                </div>
                            </article>
                        ))}
                    </>
                )}
            </section>
        </MainLayout>
    );
}
