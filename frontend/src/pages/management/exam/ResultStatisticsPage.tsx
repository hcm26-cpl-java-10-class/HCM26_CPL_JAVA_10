import axiosInstance from "@/api/axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, FileSpreadsheet, FileText, Download, Lock, Pencil, Search, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IntegrityReportSection } from "./IntegrityReportSection"; // NEW (anti-cheat)
import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";


type ScoreBand = {
    range: string;
    count: number;
};

type ExamStatistics = {
    examId: number;
    examTitle: string;
    totalAttempts: number;
    fullyGradedAttempts: number;
    pendingGradingAttempts: number;
    uniqueStudents: number;
    averageFinalScore: number | null;
    highestFinalScore: number | null;
    lowestFinalScore: number | null;
    scoreDistribution: ScoreBand[];
};

type ReleasePolicy =
    | "MY_SCORES_ONLY"
    | "MY_SCORES_AND_EMAIL"
    | "HIDDEN";

type PublicationStatus = {
    examId: number;
    releasePolicy: ReleasePolicy | null;
    published: boolean;
    publishedAt: string | null;
    publishedBy: number | null;
    unpublishedAt: string | null;
    unpublishedBy: number | null;
};

type ExamAttemptStatistics = {
    attemptId: number;
    studentId: number | null;
    studentName: string;
    studentEmail: string;
    attemptNumber: number | null;
    startedAt: string | null;
    submittedAt: string | null;
    finalScore: number | null;
    status: string;
    maxScore: number | null;
    flagged: boolean;
    violationCount: number;
    firstScore: number | null;
    secondScore: number | null;
    editable: boolean;
    lockReason: string | null;
};


const policies: { value: ReleasePolicy; label: string }[] = [
    {
        value: "MY_SCORES_ONLY",
        label: "Show scores on My Scores only",
    },
    {
        value: "MY_SCORES_AND_EMAIL",
        label: "Show scores on My Scores and send email",
    },
    {
        value: "HIDDEN",
        label: "Do not disclose scores to students",
    },
];

function formatScore(value: number | null | undefined): string {
    return value == null ? "—" : Number(value).toFixed(2);
}

function StatCard({
                      label,
                      value,
                      detail,
                  }: {
    label: string;
    value: string | number;
    detail?: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            {detail && (
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            )}
        </div>
    );
}

function ScoreDistributionChart({ bands }: { bands: ScoreBand[] }) {
    const width = 720;
    const height = 300;
    const left = 44;
    const right = 18;
    const top = 24;
    const bottom = 52;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const maxCount = Math.max(1, ...bands.map((band) => band.count));
    const slotWidth = chartWidth / Math.max(1, bands.length);
    const barWidth = Math.min(52, slotWidth * 0.56);

    if (bands.length === 0) {
        return (
            <p className="py-12 text-center text-sm text-muted-foreground">
                No score distribution data available.
            </p>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full min-w-[460px]"
                role="img"
                aria-label="Score distribution bar chart"
            >
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = top + chartHeight * (1 - fraction);
                    const value = Math.round(maxCount * fraction);

                    return (
                        <g key={fraction}>
                            <line
                                x1={left}
                                y1={y}
                                x2={width - right}
                                y2={y}
                                stroke="currentColor"
                                className="text-border"
                                strokeDasharray="4 4"
                            />
                            <text
                                x={left - 9}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="11"
                                fill="currentColor"
                                className="text-muted-foreground"
                            >
                                {value}
                            </text>
                        </g>
                    );
                })}

                {bands.map((band, index) => {
                    const barHeight = (band.count / maxCount) * chartHeight;
                    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
                    const y = top + chartHeight - barHeight;

                    return (
                        <g key={`${band.range}-${index}`}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(0, barHeight)}
                                rx="5"
                                fill="#4f46e5"
                            />
                            <text
                                x={x + barWidth / 2}
                                y={Math.max(top - 4, y - 7)}
                                textAnchor="middle"
                                fontSize="12"
                                fontWeight="600"
                                fill="currentColor"
                                className="text-foreground"
                            >
                                {band.count}
                            </text>
                            <text
                                x={x + barWidth / 2}
                                y={height - 24}
                                textAnchor="middle"
                                fontSize="11"
                                fill="currentColor"
                                className="text-muted-foreground"
                            >
                                {band.range}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function AttemptStatusChart({
                                completed,
                                pending,
                            }: {
    completed: number;
    pending: number;
}) {
    const total = completed + pending;
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    const completedLength =
        total > 0 ? (completed / total) * circumference : 0;
    const pendingLength =
        total > 0 ? (pending / total) * circumference : 0;

    return (
        <div className="flex flex-col items-center justify-center gap-6 py-4 sm:flex-row sm:gap-8">
            <div className="relative w-full max-w-[280px] shrink-0">
                <svg viewBox="0 0 160 160" className="h-auto w-full">
                    <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        className="text-border"
                        strokeWidth="22"
                    />
                    {total > 0 && (
                        <>
                            <circle
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="none"
                                stroke="#16a34a"
                                strokeWidth="22"
                                strokeDasharray={`${completedLength} ${circumference}`}
                                transform="rotate(-90 80 80)"
                            />
                            {pending > 0 && (
                                <circle
                                    cx="80"
                                    cy="80"
                                    r={radius}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth="22"
                                    strokeDasharray={`${pendingLength} ${circumference}`}
                                    strokeDashoffset={-completedLength}
                                    transform="rotate(-90 80 80)"
                                />
                            )}
                        </>
                    )}
                    <text
                        x="80"
                        y="76"
                        textAnchor="middle"
                        fontSize="20"
                        fontWeight="700"
                        fill="currentColor"
                        className="text-foreground"
                    >
                        {total}
                    </text>

                    <text
                        x="80"
                        y="96"
                        textAnchor="middle"
                        fontSize="11"
                        fill="currentColor"
                        className="text-muted-foreground"
                    >
                        attempts
                    </text>
                </svg>
            </div>

            <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm bg-green-600" />
                    <div>
                        <p className="text-muted-foreground">Fully Graded</p>
                        <p className="font-semibold">{completed} attempts</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm bg-amber-500" />
                    <div>
                        <p className="text-muted-foreground">Pending Grading</p>
                        <p className="font-semibold">{pending} attempts</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getErrorMessage(error: unknown): string {
    if (
        typeof error === "object" &&
        error !== null &&
        "response" in error
    ) {
        const response = (
            error as {
                response?: {
                    data?: { message?: string; error?: string };
                };
            }
        ).response;

        const message = response?.data?.message ?? response?.data?.error;
        if (message) return message;
    }

    return "An error occurred while calling the API. Please check the backend and your access permissions.";
}

export default function ResultStatisticsPage() {
    const { examId: examIdParam } = useParams();
    const navigate = useNavigate();
    const examId = Number(examIdParam);
    const queryClient = useQueryClient();
    const [releasePolicy, setReleasePolicy] =
        useState<ReleasePolicy>("MY_SCORES_ONLY");

    const [exportingFormat, setExportingFormat] =
        useState<"xlsx" | "csv" | "pdf" | null>(null);

    const [attemptPage, setAttemptPage] = useState(1);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [attemptSearch, setAttemptSearch] = useState("");
    const [selectedAttempt, setSelectedAttempt] =
        useState<ExamAttemptStatistics | null>(null);
    const [editedScore, setEditedScore] = useState("");
    const [editReason, setEditReason] = useState("");

    const validExamId =
        Number.isInteger(examId) && examId > 0;


    const handleExport = async (format: "xlsx" | "csv" | "pdf") => {
        if (!validExamId || exportingFormat !== null) return;

        setExportingFormat(format);

        try {
            const response = await axiosInstance.get(
                `/exams/${examId}/result-statistics/export`,
                {
                    params: { format },
                    responseType: "blob",
                },
            );

            const filename =
                getFilenameFromHeader(
                    response.headers["content-disposition"],
                ) || `exam-${examId}-results.${format}`;

            const contentType =
                format === "xlsx"
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : format === "pdf"
                        ? "application/pdf"
                        : "text/csv;charset=utf-8";

            const blob = new Blob([response.data], {
                type: contentType,
            });

            downloadBlob(blob, filename);
            toast.success(`Export ${format.toUpperCase()} successfully.`);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setExportingFormat(null);
        }
    };

    const statisticsQuery = useQuery({
        queryKey: ["exam-result-statistics", examId],
        queryFn: async () => {
            const response = await axiosInstance.get<ExamStatistics>(
                `/exams/${examId}/result-statistics`,
            );
            return response.data;
        },
        enabled: validExamId,
    });

    const publicationQuery = useQuery({
        queryKey: ["exam-result-publication", examId],
        queryFn: async () => {
            const response = await axiosInstance.get<PublicationStatus>(
                `/exams/${examId}/result-publication`,
            );
            return response.data;
        },
        enabled: validExamId,
    });

    const publishMutation = useMutation({
        mutationFn: async (policy: ReleasePolicy) => {
            const response = await axiosInstance.post<PublicationStatus>(
                `/exams/${examId}/result-publication/publish`,
                { releasePolicy: policy },
            );
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Result publication settings updated successfully.");
            await queryClient.invalidateQueries({
                queryKey: ["exam-result-publication", examId],
            });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error));
        },
    });

    const unpublishMutation = useMutation({
        mutationFn: async () => {
            const response = await axiosInstance.post<PublicationStatus>(
                `/exams/${examId}/result-publication/unpublish`,
            );
            return response.data;
        },
        onSuccess: async () => {
            toast.success("Results have been unpublished successfully.");
            await queryClient.invalidateQueries({
                queryKey: ["exam-result-publication", examId],
            });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error));
        },
    });

    const adjustScoreMutation = useMutation({
        mutationFn: async (vars: {
            attemptId: number;
            score: number;
            reason: string;
        }) => {
            const response = await axiosInstance.put<ExamAttemptStatistics>(
                `/exams/${examId}/result-statistics/attempts/${vars.attemptId}/score`,
                { score: vars.score, reason: vars.reason },
            );
            return response.data;
        },
        onSuccess: async (updated) => {
            toast.success("2nd grading score saved.");
            setSelectedAttempt(updated);
            setEditedScore(String(updated.finalScore ?? ""));
            setEditReason("");
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["exam-attempt-statistics", examId] }),
                queryClient.invalidateQueries({ queryKey: ["exam-result-statistics", examId] }),
                queryClient.invalidateQueries({ queryKey: ["exam-integrity-report", examId] }),
            ]);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error));
        },
    });

    const statistics = statisticsQuery.data;
    const publication = publicationQuery.data;

    const attemptsQuery = useQuery({
        queryKey: ["exam-attempt-statistics", examId],
        queryFn: async () => {
            const response = await axiosInstance.get<ExamAttemptStatistics[]>(
                `/exams/${examId}/result-statistics/attempts`,
            );
            return response.data;
        },
        enabled: validExamId,
    });

    const attempts = attemptsQuery.data ?? [];
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(attempts.length / pageSize));

    const filteredAttempts = useMemo(() => {
        const keyword = attemptSearch.trim().toLowerCase();

        if (!keyword) return attempts;

        return attempts.filter((attempt) =>
            attempt.studentName.toLowerCase().includes(keyword) ||
            attempt.studentEmail.toLowerCase().includes(keyword)
        );
    }, [attempts, attemptSearch]);

    const paginatedAttempts = useMemo(() => {
        const start = (attemptPage - 1) * pageSize;
        return attempts.slice(start, start + pageSize);
    }, [attempts, attemptPage]);

    const selectEditAttempt = (attempt: ExamAttemptStatistics) => {
        setSelectedAttempt(attempt);
        setEditedScore(attempt.finalScore == null ? "" : String(attempt.finalScore));
        setEditReason("");
    };

    const scoreNumber = Number(editedScore);
    const scoreError =
        editedScore.trim() === "" || Number.isNaN(scoreNumber)
            ? "Enter a valid score."
            : scoreNumber < 0
                ? "Score cannot be negative."
                : selectedAttempt?.maxScore != null && scoreNumber > selectedAttempt.maxScore
                    ? `Score cannot exceed ${selectedAttempt.maxScore}.`
                    : null;
    const canSave =
        !!selectedAttempt?.editable &&
        !scoreError &&
        editReason.trim().length > 0 &&
        !adjustScoreMutation.isPending;

    const formatDateTime = (value: string | null) =>
        value ? new Date(value).toLocaleString() : "--";

    return (
        <MainLayout>
            <div className="space-y-6 p-4 md:p-6">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 mb-2"
                        onClick={() => navigate("/exams")}
                    >
                        <ChevronLeft className="size-4" />
                        Back to Exam Management
                    </Button>

                    <p className="text-sm text-muted-foreground">
                        Exam Management / Result Statistics
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-foreground">
                        Exam Result Statistics
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Exam ID: {validExamId ? examId : "Invalid"}
                    </p>
                </div>

                {!validExamId && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        Invalid exam ID. Please open this page using the URL
                        /exams/ID/result-statistics.
                    </div>
                )}

                {statisticsQuery.isLoading && (
                    <p className="rounded-lg border border-border bg-card p-6 text-muted-foreground">
                        Loading statistics...
                    </p>
                )}

                {statisticsQuery.isError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        Failed to load statistics:{" "}
                        {getErrorMessage(statisticsQuery.error)}
                    </div>
                )}

                {statistics && (
                    <>
                        <div>
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <h2 className="text-lg font-semibold">
                                    {statistics.examTitle}
                                </h2>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            disabled={!validExamId || exportingFormat !== null}
                                        >
                                            <Download className="mr-2 size-4" />
                                            {exportingFormat ? "Exporting..." : "Export"}
                                        </Button>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                            disabled={exportingFormat !== null}
                                            onSelect={() => void handleExport("xlsx")}
                                        >
                                            <FileSpreadsheet className="mr-2 size-4" />
                                            Export Excel (.xlsx)
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            disabled={exportingFormat !== null}
                                            onSelect={() => void handleExport("csv")}
                                        >
                                            <FileText className="mr-2 size-4" />
                                            Export CSV (.csv)
                                        </DropdownMenuItem>

                                        <DropdownMenuItem
                                            disabled={exportingFormat !== null}
                                            onSelect={() => void handleExport("pdf")}
                                        >
                                            <FileText className="mr-2 size-4" />
                                            Export PDF (.pdf)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <StatCard
                                    label="Total Attempts"
                                    value={statistics.totalAttempts}
                                />
                                <StatCard
                                    label="Participating Students"
                                    value={statistics.uniqueStudents}
                                />
                                <StatCard
                                    label="Average Score"
                                    value={formatScore(statistics.averageFinalScore)}
                                />
                                <StatCard
                                    label="Pending Grading"
                                    value={statistics.pendingGradingAttempts}
                                    detail={`${statistics.fullyGradedAttempts} fully graded attempts`}
                                />
                                <StatCard
                                    label="Highest Score"
                                    value={formatScore(statistics.highestFinalScore)}
                                />
                                <StatCard
                                    label="Lowest Score"
                                    value={formatScore(statistics.lowestFinalScore)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                                <h2 className="text-lg font-semibold">
                                    Score Distribution
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Number of attempts in each score range.
                                </p>
                                <div className="mt-4">
                                    <ScoreDistributionChart
                                        bands={statistics.scoreDistribution ?? []}
                                    />
                                </div>
                            </section>

                            <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                                <h2 className="text-lg font-semibold">
                                    Grading Status
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Grading completion status for all attempts.
                                </p>
                                <AttemptStatusChart
                                    completed={statistics.fullyGradedAttempts}
                                    pending={statistics.pendingGradingAttempts}
                                />
                            </section>
                        </div>
                    </>
                )}

                <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Student Attempt Results
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Each row represents one exam attempt.
                            </p>
                        </div>

                        <Button
                            onClick={() => {
                                setAttemptSearch("");
                                setSelectedAttempt(null);
                                setEditedScore("");
                                setEditReason("");
                                setEditDialogOpen(true);
                            }}
                            disabled={attempts.length === 0}
                        >
                            <Pencil className="mr-2 size-4" />
                            Edit
                        </Button>
                    </div>

                    {attemptsQuery.isLoading && (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            Loading student attempts...
                        </p>
                    )}

                    {attemptsQuery.isError && (
                        <p className="py-4 text-sm text-red-600">
                            Failed to load student attempts:{" "}
                            {getErrorMessage(attemptsQuery.error)}
                        </p>
                    )}

                    {!attemptsQuery.isLoading && !attemptsQuery.isError && (
                        <>
                            <div className="w-full overflow-x-auto">
                                <table className="w-full min-w-[1100px] text-left text-sm">
                                    <thead className="border-b border-border bg-muted">
                                    <tr>
                                        <th className="p-3">No.</th>
                                        <th className="p-3">Student</th>
                                        <th className="p-3">Email</th>
                                        <th className="p-3">Started At</th>
                                        <th className="p-3">Submitted At</th>
                                        <th className="p-3">1st Score</th>
                                        <th className="p-3">2nd Score</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Action</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {paginatedAttempts.map((attempt, index) => (
                                        <tr
                                            key={attempt.attemptId}
                                            className="border-b border-border last:border-0"
                                        >
                                            <td className="p-3">
                                                {(attemptPage - 1) * pageSize + index + 1}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-medium">
                                                    {attempt.studentName || "--"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Attempt #{attempt.attemptNumber ?? "--"}
                                                </div>
                                                {attempt.flagged && (
                                                    <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
                                                        Flagged · {attempt.violationCount}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3">{attempt.studentEmail || "--"}</td>
                                            <td className="p-3">
                                                {formatDateTime(attempt.startedAt)}
                                            </td>
                                            <td className="p-3">
                                                {formatDateTime(attempt.submittedAt)}
                                            </td>
                                            <td className="p-3 font-semibold">
                                                {formatScore(attempt.firstScore ?? attempt.finalScore)}
                                            </td>
                                            <td className="p-3 font-semibold">
                                                {attempt.secondScore == null
                                                    ? "--"
                                                    : formatScore(attempt.secondScore)}
                                            </td>
                                            <td className="p-3">
                                                {attempt.status}
                                            </td>
                                            <td className="p-3">
                                                {attempt.editable ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setAttemptSearch("");
                                                            selectEditAttempt(attempt);
                                                            setEditDialogOpen(true);
                                                        }}
                                                    >
                                                        <Pencil className="mr-1 size-3" />
                                                        Edit
                                                    </Button>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                                        title={attempt.lockReason ?? "Locked"}
                                                    >
                                                        <Lock className="size-3" />
                                                        Locked
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}

                                    {attempts.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="p-8 text-center text-muted-foreground"
                                            >
                                                No student attempts found.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {attempts.length === 0
                                        ? "0 attempts"
                                        : `Showing ${(attemptPage - 1) * pageSize + 1}–${Math.min(
                                            attemptPage * pageSize,
                                            attempts.length,
                                        )} of ${attempts.length} attempts`}
                                </p>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={attemptPage <= 1}
                                        onClick={() => setAttemptPage((page) => page - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm">
                                        Page {attemptPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={attemptPage >= totalPages}
                                        onClick={() => setAttemptPage((page) => page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {editDialogOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
                        onClick={() => setEditDialogOpen(false)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="edit-attempts-title"
                            className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-border p-5">
                                <div>
                                    <h2
                                        id="edit-attempts-title"
                                        className="text-xl font-semibold"
                                    >
                                        Edit Student Results
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Only attempts flagged for cheating and fully graded can be edited. Others are locked.
                                    </p>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditDialogOpen(false)}
                                    aria-label="Close popup"
                                >
                                    <X className="size-5" />
                                </Button>
                            </div>

                            <div className="overflow-y-auto p-5">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={attemptSearch}
                                        onChange={(event) => {
                                            setAttemptSearch(event.target.value);
                                            setSelectedAttempt(null);
                                            setEditedScore("");
                                            setEditReason("");
                                        }}
                                        placeholder="Search by student name or email..."
                                        className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-border">
                                    <table className="w-full min-w-[850px] text-left text-sm">
                                        <thead className="bg-muted">
                                        <tr>
                                            <th className="p-3">No.</th>
                                            <th className="p-3">Student</th>
                                            <th className="p-3">Email</th>
                                            <th className="p-3">Attempt</th>
                                            <th className="p-3">1st Score</th>
                                            <th className="p-3">2nd Score</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3">Action</th>
                                        </tr>
                                        </thead>

                                        <tbody>
                                        {filteredAttempts.map((attempt, index) => (
                                            <tr
                                                key={attempt.attemptId}
                                                className={`border-t border-border ${
                                                    selectedAttempt?.attemptId === attempt.attemptId
                                                        ? "bg-muted"
                                                        : ""
                                                }`}
                                            >
                                                <td className="p-3">{index + 1}</td>
                                                <td className="p-3 font-medium">
                                                    {attempt.studentName || "--"}
                                                    {attempt.flagged && (
                                                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-200">
                                                            Flagged · {attempt.violationCount}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    {attempt.studentEmail || "--"}
                                                </td>
                                                <td className="p-3">
                                                    #{attempt.attemptNumber ?? "--"}
                                                </td>
                                                <td className="p-3">
                                                    {formatScore(attempt.firstScore ?? attempt.finalScore)}
                                                </td>
                                                <td className="p-3">
                                                    {formatScore(attempt.secondScore)}
                                                </td>
                                                <td className="p-3">{attempt.status}</td>
                                                <td className="p-3">
                                                    {attempt.editable ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => selectEditAttempt(attempt)}
                                                        >
                                                            <Pencil className="mr-1 size-3" />
                                                            Edit
                                                        </Button>
                                                    ) : (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                                            title={attempt.lockReason ?? "Locked"}
                                                        >
                                                            <Lock className="size-3" />
                                                            {attempt.lockReason ?? "Locked"}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}

                                        {filteredAttempts.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="p-8 text-center text-muted-foreground"
                                                >
                                                    No matching students found.
                                                </td>
                                            </tr>
                                        )}
                                        </tbody>
                                    </table>
                                </div>

                                <p className="mt-3 text-sm text-muted-foreground">
                                    Showing {filteredAttempts.length} of {attempts.length} attempts.
                                </p>

                                {selectedAttempt && (
                                    <div className="mt-6 rounded-xl border border-border p-4">
                                        <h3 className="font-semibold">
                                            Edit Score — {selectedAttempt.studentName || "Student"}
                                        </h3>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Attempt #{selectedAttempt.attemptNumber ?? "--"}
                                            {" · "}Attempt ID: {selectedAttempt.attemptId}
                                        </p>

                                        <div className="mt-4 max-w-sm space-y-2">
                                            <label
                                                htmlFor="edited-score"
                                                className="text-sm font-medium"
                                            >
                                                2nd grading score
                                            </label>

                                            <input
                                                id="edited-score"
                                                type="number"
                                                min={0}
                                                max={selectedAttempt.maxScore ?? undefined}
                                                step="0.01"
                                                value={editedScore}
                                                disabled={!selectedAttempt.editable}
                                                onChange={(event) =>
                                                    setEditedScore(event.target.value)
                                                }
                                                placeholder="Enter score"
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                1st grading: {formatScore(selectedAttempt.firstScore ?? selectedAttempt.finalScore)}
                                                {selectedAttempt.secondScore != null &&
                                                    ` · Current 2nd: ${formatScore(selectedAttempt.secondScore)}`}
                                                {selectedAttempt.maxScore != null &&
                                                    ` · Max: ${selectedAttempt.maxScore}`}
                                            </p>
                                            {scoreError && editedScore !== "" && (
                                                <p className="text-xs text-red-600">{scoreError}</p>
                                            )}
                                        </div>

                                        <div className="mt-4 max-w-xl space-y-2">
                                            <label
                                                htmlFor="edited-score-reason"
                                                className="text-sm font-medium"
                                            >
                                                Reason <span className="text-red-600">*</span>
                                            </label>
                                            <textarea
                                                id="edited-score-reason"
                                                rows={3}
                                                maxLength={1000}
                                                value={editReason}
                                                disabled={!selectedAttempt.editable}
                                                onChange={(event) => setEditReason(event.target.value)}
                                                placeholder="Why is this score being changed? (required)"
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                                            />
                                        </div>

                                        {!selectedAttempt.editable && (
                                            <p className="mt-3 text-sm text-amber-600">
                                                Locked: {selectedAttempt.lockReason}
                                            </p>
                                        )}

                                        <div className="mt-4">
                                            <Button
                                                disabled={!canSave}
                                                onClick={() =>
                                                    adjustScoreMutation.mutate({
                                                        attemptId: selectedAttempt.attemptId,
                                                        score: scoreNumber,
                                                        reason: editReason.trim(),
                                                    })
                                                }
                                            >
                                                {adjustScoreMutation.isPending ? "Saving..." : "Save 2nd score"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 border-t border-border p-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditDialogOpen(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                    <h2 className="text-lg font-semibold">
                        Result Publication
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Only users with the EXAM_UPDATE permission can manage result publication.
                    </p>

                    {publicationQuery.isLoading && (
                        <p className="mt-4 text-sm text-muted-foreground">
                            Loading publication status...
                        </p>
                    )}

                    {publicationQuery.isError && (
                        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                            Failed to load publication status:{" "}
                            {getErrorMessage(publicationQuery.error)}
                        </p>
                    )}

                    {publication && (
                        <div className="mt-4 rounded-lg bg-muted p-4 text-sm text-foreground">
                            <p>
                                Status:{" "}
                                <strong
                                    className={
                                        publication.published
                                            ? "text-green-700"
                                            : "text-foreground"
                                    }
                                >
                                    {publication.published
                                        ? "Published"
                                        : "Not Published"}
                                </strong>
                            </p>
                            <p className="mt-1">
                                Current Policy:{" "}
                                {policies.find(
                                    (policy) =>
                                        policy.value === publication.releasePolicy,
                                )?.label ?? "Not configured"}
                            </p>
                            {publication.publishedAt && (
                                <p className="mt-1">
                                    Published At:{" "}
                                    {new Date(publication.publishedAt).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-5 space-y-3">
                        <label
                            htmlFor="release-policy"
                            className="block text-sm font-medium text-foreground"
                        >
                            Result Release Policy
                        </label>
                        <select
                            id="release-policy"
                            value={releasePolicy}
                            onChange={(event) =>
                                setReleasePolicy(event.target.value as ReleasePolicy)
                            }
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500 sm:max-w-xl"
                        >
                            {policies.map((policy) => (
                                <option key={policy.value} value={policy.value}>
                                    {policy.label}
                                </option>
                            ))}
                        </select>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                disabled={
                                    publishMutation.isPending ||
                                    unpublishMutation.isPending ||
                                    !validExamId
                                }
                                onClick={() => publishMutation.mutate(releasePolicy)}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {publishMutation.isPending
                                    ? "Processing..."
                                    : "Publish Results"}
                            </button>

                            <button
                                type="button"
                                disabled={
                                    publishMutation.isPending ||
                                    unpublishMutation.isPending ||
                                    !validExamId ||
                                    !publication?.published
                                }
                                onClick={() => unpublishMutation.mutate()}
                                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {unpublishMutation.isPending
                                    ? "Processing..."
                                    : "Unpublish Results"}
                            </button>
                        </div>
                    </div>
                </section>

                {/* NEW (anti-cheat): bao cao vi pham tung luot thi */}
                {validExamId && <IntegrityReportSection examId={examId} />}
            </div>
        </MainLayout>
    );
}
