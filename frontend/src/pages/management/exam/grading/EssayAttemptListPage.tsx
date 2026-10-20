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
    IN_PROGRESS: "In Progress",
    PENDING_REVIEW: "Pending Review",
    EXPIRED: "Expired — Pending Review",
    SUBMITTED: "Graded / Completed",
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
        <MainLayout pathName={{ exams: "Quản lý đề thi", grading: "Essay Grading" }}>
            <section className="flex flex-col gap-5">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("/exams")}>
                            <ChevronLeft className="size-4" />
                            Back to Exam Management
                        </Button>
                        <h1 className="text-2xl font-semibold">Essay Submissions Grading</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Exam #{examId} · {rows.length} submission(s)
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => void attemptsQuery.refetch()} disabled={attemptsQuery.isFetching}>
                        <RefreshCw className="size-4" />
                        Reload
                    </Button>
                </header>

                <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead className="w-24">Attempt</TableHead>
                                <TableHead className="w-48">Submitted At</TableHead>
                                <TableHead className="w-44">Answered Essays</TableHead>
                                <TableHead className="w-48">Status</TableHead>
                                <TableHead className="w-32 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!validId && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">Invalid exam ID.</TableCell></TableRow>
                            )}
                            {attemptsQuery.isLoading && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading submissions...</TableCell></TableRow>
                            )}
                            {attemptsQuery.isError && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">Failed to load submissions requiring review.</TableCell></TableRow>
                            )}
                            {validId && !attemptsQuery.isLoading && !attemptsQuery.isError && rows.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No essay submissions currently need review.</TableCell></TableRow>
                            )}
                            {rows.map((row) => (
                                <TableRow
                                    key={row.attemptId}
                                    className="cursor-pointer"
                                    onClick={() => navigate(`/exams/${numericExamId}/grading/${row.attemptId}`)}
                                >
                                    <TableCell className="font-medium">
                                        {row.studentName || `Student #${row.studentId}`}
                                        <p className="mt-0.5 text-xs font-normal text-muted-foreground">{row.studentEmail}</p>
                                    </TableCell>
                                    <TableCell>{row.attemptNumber}</TableCell>
                                    <TableCell>{formatDateTime(row.submittedAt)}</TableCell>
                                    <TableCell>{row.essayAnswered} / {row.essayCount}</TableCell>
                                    <TableCell>
                                        <Badge variant={row.status === "EXPIRED" ? "destructive" : "secondary"}>
                                            {ESSAY_STATUS_LABEL[row.status] || row.status}
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
                                            Grade
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
