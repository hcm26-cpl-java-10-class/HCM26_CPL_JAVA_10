// ===== NEW FILE: giáo viên xem danh sách bài tự luận cần chấm của một đề (/exams/:examId/grading) =====
import { examApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { EssayAttemptStatus } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Eye, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export const ESSAY_STATUS_LABEL: Record<EssayAttemptStatus, string> = {
    IN_PROGRESS: "Đang làm",
    PENDING_REVIEW: "Chờ chấm",
    EXPIRED: "Hết giờ — chờ chấm",
    SUBMITTED: "Đã hoàn thành",
};

export function formatDateTime(value: string | null | undefined) {
    return value ? new Date(value).toLocaleString() : "—";
}

export default function EssayAttemptListPage() {
    const { examId } = useParams<{ examId: string }>();
    const numericExamId = Number(examId);
    const validId = Number.isInteger(numericExamId) && numericExamId > 0;
    const navigate = useNavigate();

    const attemptsQuery = useQuery({
        queryKey: ["essay-attempts", numericExamId],
        queryFn: () => examApi.listEssayAttempts(numericExamId),
        enabled: validId,
    });
    const rows = attemptsQuery.data ?? [];

    return (
        <MainLayout pathName={{ exams: "Quản lý đề thi", grading: "Bài tự luận" }}>
            <section className="flex flex-col gap-5">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/exams")}>
                            <ChevronLeft className="size-4" />
                            Quay lại quản lý đề thi
                        </Button>
                        <h1 className="text-2xl font-semibold">Bài tự luận cần chấm</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Đề thi #{examId} · {rows.length} bài
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => void attemptsQuery.refetch()} disabled={attemptsQuery.isFetching}>
                        <RefreshCw className="size-4" />
                        Tải lại
                    </Button>
                </header>

                <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sinh viên</TableHead>
                                <TableHead className="w-24">Lượt</TableHead>
                                <TableHead className="w-48">Nộp lúc</TableHead>
                                <TableHead className="w-40">Câu tự luận đã trả lời</TableHead>
                                <TableHead className="w-44">Trạng thái</TableHead>
                                <TableHead className="w-28 text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!validId && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">Mã đề thi không hợp lệ.</TableCell></TableRow>
                            )}
                            {attemptsQuery.isLoading && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
                            )}
                            {attemptsQuery.isError && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">Không tải được danh sách bài cần chấm.</TableCell></TableRow>
                            )}
                            {validId && !attemptsQuery.isLoading && !attemptsQuery.isError && rows.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Chưa có bài tự luận nào cần chấm.</TableCell></TableRow>
                            )}
                            {rows.map((row) => (
                                <TableRow
                                    key={row.attemptId}
                                    className="cursor-pointer"
                                    onClick={() => navigate(`/exams/${numericExamId}/grading/${row.attemptId}`)}
                                >
                                    <TableCell className="font-medium">
                                        {row.studentName || `Sinh viên #${row.studentId}`}
                                        <p className="mt-0.5 text-xs font-normal text-muted-foreground">{row.studentEmail}</p>
                                    </TableCell>
                                    <TableCell>{row.attemptNumber}</TableCell>
                                    <TableCell>{formatDateTime(row.submittedAt)}</TableCell>
                                    <TableCell>{row.essayAnswered}/{row.essayCount}</TableCell>
                                    <TableCell>
                                        <Badge variant={row.status === "EXPIRED" ? "destructive" : "secondary"}>
                                            {ESSAY_STATUS_LABEL[row.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                navigate(`/exams/${numericExamId}/grading/${row.attemptId}`);
                                            }}
                                        >
                                            <Eye className="size-4" />
                                            Xem
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </MainLayout>
    );
}
