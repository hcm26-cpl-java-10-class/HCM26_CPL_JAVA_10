import { PassBadge } from "@/components/exam/PassBadge";
import { useContext } from "react";
import { EmbeddedLayoutContext } from "@/components/layout/embedded-layout";
import axiosInstance from "@/api/axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    AlertCircle,
    CheckCircle2,
    ChevronLeft,
    Download,
    FileSpreadsheet,
    FileText,
    Lock,
    Pencil,
    Search,
    X,
    XCircle,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IntegrityReportSection } from "./IntegrityReportSection"; // NEW (anti-cheat)
import { ItemAnalysisSection } from "./ItemAnalysisSection";
import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";


type ScoreBand = {
    range: string;
    count: number;
};

export type GradeDistributionItem = {
    gradeLetter: string;
    label: string;
    minScore: number;
    maxScore: number;
    color: string;
    count: number;
    percentage: number;
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
    passedAttempts?: number;
    passRate?: number | null;
    failedAttempts?: number;
    failRate?: number | null;
    passScore?: number | null;
    gradeDistribution?: GradeDistributionItem[];
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
    passed?: boolean | null;
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
    accent,
    badge,
}: {
    label: string;
    value: string | number;
    detail?: string;
    accent?: "default" | "success" | "danger" | "warning";
    badge?: string;
}) {
    const accentClass =
        accent === "success"
            ? "border-emerald-200 bg-emerald-50/40 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100"
            : accent === "danger"
            ? "border-rose-200 bg-rose-50/40 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-100"
            : "border-border bg-card text-card-foreground";

    const valueColor =
        accent === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : accent === "danger"
            ? "text-rose-600 dark:text-rose-400"
            : "text-foreground";

    return (
        <div className={`rounded-xl border p-5 shadow-sm transition-all ${accentClass}`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                {badge && (
                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold shadow-xs">
                        {badge}
                    </span>
                )}
            </div>
            <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
            {detail && (
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            )}
        </div>
    );
}

function GradeDistributionChart({ items }: { items: GradeDistributionItem[] }) {
    const width = 720;
    const height = 300;
    const left = 44;
    const right = 18;
    const top = 24;
    const bottom = 52;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const maxCount = Math.max(1, ...items.map((item) => item.count));
    const slotWidth = chartWidth / Math.max(1, items.length);
    const barWidth = Math.min(56, slotWidth * 0.58);

    if (items.length === 0) {
        return (
            <p className="py-12 text-center text-sm text-muted-foreground">
                No grade distribution data available.
            </p>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full min-w-[460px]"
                role="img"
                aria-label="Grade distribution bar chart"
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

                {items.map((item, index) => {
                    const barHeight = (item.count / maxCount) * chartHeight;
                    const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
                    const y = top + chartHeight - barHeight;
                    const fillColor = item.color || "#3b82f6";

                    return (
                        <g key={`${item.gradeLetter}-${index}`}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(0, barHeight)}
                                rx="6"
                                fill={fillColor}
                                opacity="0.9"
                                className="transition-all hover:opacity-100"
                            />
                            <text
                                x={x + barWidth / 2}
                                y={Math.max(top - 4, y - 7)}
                                textAnchor="middle"
                                fontSize="12"
                                fontWeight="700"
                                fill="currentColor"
                                className="text-foreground"
                            >
                                {item.count}
                            </text>
                            {/* Grade Letter */}
                            <text
                                x={x + barWidth / 2}
                                y={height - 30}
                                textAnchor="middle"
                                fontSize="13"
                                fontWeight="700"
                                fill={fillColor}
                            >
                                Grade {item.gradeLetter}
                            </text>
                            {/* Range / Label */}
                            <text
                                x={x + barWidth / 2}
                                y={height - 14}
                                textAnchor="middle"
                                fontSize="10"
                                fill="currentColor"
                                className="text-muted-foreground"
                            >
                                {item.minScore} - {item.maxScore} pts
                            </text>
                        </g>
                    );
                })}
            </svg>
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
                            <circle
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="none"
                                stroke="#eab308"
                                strokeWidth="22"
                                strokeDasharray={`${pendingLength} ${circumference}`}
                                strokeDashoffset={-completedLength}
                                transform="rotate(-90 80 80)"
                            />
                        </>
                    )}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-3xl font-bold">{total}</p>
                    <p className="text-xs text-muted-foreground">Total Attempts</p>
                </div>
            </div>

            <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                    <span className="inline-block size-3.5 rounded-full bg-green-600" />
                    <div>
                        <p className="font-medium">{completed}</p>
                        <p className="text-muted-foreground">Fully Graded</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="inline-block size-3.5 rounded-full bg-yellow-500" />
                    <div>
                        <p className="font-medium">{pending}</p>
                        <p className="text-muted-foreground">Pending Grading</p>
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
        "response" in error &&
        typeof error.response === "object" &&
        error.response !== null &&
        "data" in error.response
    ) {
        const data = error.response.data;

        if (
            typeof data === "object" &&
            data !== null &&
            "message" in data &&
            typeof data.message === "string"
        ) {
            return data.message;
        }

        if (
            typeof data === "object" &&
            data !== null &&
            "detail" in data &&
            typeof data.detail === "string"
        ) {
            return data.detail;
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "An unknown error occurred.";
}

export default function ResultStatisticsPage() {
    const embedded = useContext(EmbeddedLayoutContext);
    const { examId: examIdParam } = useParams();
    const navigate = useNavigate();
    const examId = Number(examIdParam);
    const queryClient = useQueryClient();
    const [releasePolicy, setReleasePolicy] =
        useState<ReleasePolicy>("MY_SCORES_ONLY");
    const [tab, setTab] = useState<"overview" | "questions" | "attempts" | "integrity">("overview");

    const [exportingFormat, setExportingFormat] =
        useState<"xlsx" | "csv" | "pdf" | null>(null);

    const [attemptPage, setAttemptPage] = useState(1);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [publishPreviewOpen, setPublishPreviewOpen] = useState(false);
    const [previewSearch, setPreviewSearch] = useState("");
    const [attemptSearch, setAttemptSearch] = useState("");
    const [selectedAttempt, setSelectedAttempt] =
        useState<ExamAttemptStatistics | null>(null);
    const [editedScore, setEditedScore] = useState("");
    const [editReason, setEditReason] = useState("");
    const [chartMode, setChartMode] = useState<"grades" | "percentages">("grades");
    const [scaleModalOpen, setScaleModalOpen] = useState(false);
    const [editableScales, setEditableScales] = useState<Array<{
        gradeLetter: string;
        minScore: number;
        maxScore: number;
        label: string;
        color: string;
    }>>([]);

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
            setPublishPreviewOpen(false);
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

    // Eligible attempts for grade push preview (fully graded submissions)
    const eligibleAttempts = useMemo(() => {
        return attempts.filter(
            (a) => a.finalScore != null && (a.status === "SUBMITTED" || a.status === "EXPIRED")
        );
    }, [attempts]);

    const eligiblePassedAttempts = useMemo(() => {
        return eligibleAttempts.filter((a) => a.passed === true);
    }, [eligibleAttempts]);

    const eligibleFailedAttempts = useMemo(() => {
        return eligibleAttempts.filter((a) => a.passed === false);
    }, [eligibleAttempts]);

    const eligiblePassRate = useMemo(() => {
        if (eligibleAttempts.length === 0) return 0;
        return (eligiblePassedAttempts.length * 100) / eligibleAttempts.length;
    }, [eligibleAttempts.length, eligiblePassedAttempts.length]);

    const eligibleFailRate = useMemo(() => {
        if (eligibleAttempts.length === 0) return 0;
        return (eligibleFailedAttempts.length * 100) / eligibleAttempts.length;
    }, [eligibleAttempts.length, eligibleFailedAttempts.length]);

    const filteredPreviewAttempts = useMemo(() => {
        const keyword = previewSearch.trim().toLowerCase();
        if (!keyword) return eligibleAttempts;
        return eligibleAttempts.filter(
            (attempt) =>
                attempt.studentName.toLowerCase().includes(keyword) ||
                attempt.studentEmail.toLowerCase().includes(keyword)
        );
    }, [eligibleAttempts, previewSearch]);

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
                {!embedded && (
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 mb-2"
                        onClick={() => navigate("/exams")}
                    >
                        <ChevronLeft className="size-4" />
                        Back to Assessment Management
                    </Button>

                    <p className="text-sm text-muted-foreground">
                        Assessment Management / Result Statistics
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-foreground">
                        Assessment Result Statistics
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Exam ID: {validExamId ? examId : "Invalid"}
                    </p>
                </div>
                )}

                {!validExamId && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        Invalid assessment ID. Please open this page using the URL
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
                <div className="flex flex-col gap-6 lg:flex-row">
                {validExamId && (
                    <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1 lg:w-52 lg:flex-col lg:overflow-visible" role="tablist" aria-orientation="vertical" aria-label="Statistics sections">
                        {([
                            ["overview", "Overview"],
                            ["questions", "Questions"],
                            ["attempts", "Attempts"],
                            ["integrity", "Integrity"],
                        ] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={tab === key}
                                onClick={() => setTab(key)}
                                className={`whitespace-nowrap rounded-md px-4 py-2 text-left text-sm font-medium transition ${
                                    tab === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </nav>
                )}
                <div className="min-w-0 flex-1 space-y-6">

                {tab === "overview" && statistics && (
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

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <StatCard
                                    label="Total Attempts"
                                    value={statistics.totalAttempts}
                                    detail={`${statistics.uniqueStudents} participating student(s)`}
                                />
                                <StatCard
                                    label="Graded Attempts"
                                    value={statistics.fullyGradedAttempts}
                                    detail={
                                        statistics.pendingGradingAttempts > 0
                                            ? `${statistics.pendingGradingAttempts} pending review`
                                            : "All attempts graded"
                                    }
                                />
                                <StatCard
                                    label="Pass Rate"
                                    value={
                                        statistics.fullyGradedAttempts > 0 && statistics.passRate != null
                                            ? `${statistics.passRate.toFixed(1)}%`
                                            : "—"
                                    }
                                    detail={`${statistics.passedAttempts ?? 0} passed attempt(s)${statistics.passScore != null ? ` (≥ ${statistics.passScore})` : ""}`}
                                    accent="success"
                                    badge={`${statistics.passedAttempts ?? 0} Đạt`}
                                />
                                <StatCard
                                    label="Fail Rate"
                                    value={
                                        statistics.fullyGradedAttempts > 0 && statistics.failRate != null
                                            ? `${statistics.failRate.toFixed(1)}%`
                                            : "—"
                                    }
                                    detail={`${statistics.failedAttempts ?? 0} failed attempt(s)${statistics.passScore != null ? ` (< ${statistics.passScore})` : ""}`}
                                    accent="danger"
                                    badge={`${statistics.failedAttempts ?? 0} Rớt`}
                                />
                                <StatCard
                                    label="Average Score"
                                    value={formatScore(statistics.averageFinalScore)}
                                />
                                <StatCard
                                    label="Highest Score"
                                    value={formatScore(statistics.highestFinalScore)}
                                />
                                <StatCard
                                    label="Lowest Score"
                                    value={formatScore(statistics.lowestFinalScore)}
                                />
                                <StatCard
                                    label="Passing Threshold"
                                    value={statistics.passScore != null ? formatScore(statistics.passScore) : "5.00"}
                                    detail={statistics.passScore != null ? "Configured pass score" : "Default 50% max score"}
                                />
                            </div>

                            {statistics.fullyGradedAttempts > 0 && (
                                <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                                                <span className="size-2.5 rounded-full bg-emerald-500" />
                                                Passed: {statistics.passedAttempts ?? 0} ({((statistics.passRate ?? 0)).toFixed(1)}%)
                                            </span>
                                            <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
                                                <span className="size-2.5 rounded-full bg-rose-500" />
                                                Failed: {statistics.failedAttempts ?? 0} ({((statistics.failRate ?? 0)).toFixed(1)}%)
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            Passing Criterion: Score ≥ {statistics.passScore != null ? statistics.passScore : 5.0}
                                        </span>
                                    </div>
                                    <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="bg-emerald-500 transition-all duration-300"
                                            style={{ width: `${Math.max(0, Math.min(100, statistics.passRate ?? 0))}%` }}
                                            title={`Passed: ${statistics.passedAttempts} (${statistics.passRate?.toFixed(1)}%)`}
                                        />
                                        <div
                                            className="bg-rose-500 transition-all duration-300"
                                            style={{ width: `${Math.max(0, Math.min(100, statistics.failRate ?? 0))}%` }}
                                            title={`Failed: ${statistics.failedAttempts} (${statistics.failRate?.toFixed(1)}%)`}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-lg font-semibold">
                                            Score Distribution ({chartMode === "grades" ? "By Letter Grade A-F" : "By Percentage Range"})
                                        </h2>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {chartMode === "grades" 
                                                ? "Classified by academic grading scale (Excellent ≥ 8.0)"
                                                : "Number of attempts in each percentage band"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex rounded-lg border bg-muted p-0.5 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setChartMode("grades")}
                                                className={`rounded px-2.5 py-1 font-medium transition ${
                                                    chartMode === "grades" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                Grade A-F
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setChartMode("percentages")}
                                                className={`rounded px-2.5 py-1 font-medium transition ${
                                                    chartMode === "percentages" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                Percentage %
                                            </button>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={async () => {
                                                try {
                                                    const typeParam = chartMode === "percentages" ? "PERCENTAGE" : "GRADE";
                                                    const res = await axiosInstance.get(`/exams/${examId}/grade-scales`, {
                                                        params: { type: typeParam },
                                                    });
                                                    setEditableScales(res.data);
                                                    setScaleModalOpen(true);
                                                } catch (e) {
                                                    toast.error("Failed to load grade scales");
                                                }
                                            }}
                                        >
                                            <Pencil className="mr-1 size-3" />
                                            {chartMode === "percentages" ? "Configure % Bands" : "Configure Grade Scales"}
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    {chartMode === "grades" && statistics.gradeDistribution && statistics.gradeDistribution.length > 0 ? (
                                        <GradeDistributionChart items={statistics.gradeDistribution} />
                                    ) : (
                                        <ScoreDistributionChart
                                            bands={statistics.scoreDistribution ?? []}
                                        />
                                    )}
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

                {tab === "attempts" && (
                <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Student Attempt Results
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Each row represents one assessment attempt with final score and pass/fail result.
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
                                        <th className="p-3">Result</th>
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
                                                {attempt.passed != null && <PassBadge passed={attempt.passed} className="ml-2" />}
                                            </td>
                                            <td className="p-3 font-semibold">
                                                {attempt.secondScore == null
                                                    ? "--"
                                                    : formatScore(attempt.secondScore)}
                                            </td>
                                            <td className="p-3 font-semibold">
                                                {attempt.passed === true ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                        <CheckCircle2 className="size-3" />
                                                        Đạt (Passed)
                                                    </span>
                                                ) : attempt.passed === false ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                        <XCircle className="size-3" />
                                                        Rớt (Failed)
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                                        Pending
                                                    </span>
                                                )}
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
                                                colSpan={10}
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
                )}

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
                                    <table className="w-full min-w-[950px] text-left text-sm">
                                        <thead className="bg-muted">
                                        <tr>
                                            <th className="p-3">No.</th>
                                            <th className="p-3">Student</th>
                                            <th className="p-3">Email</th>
                                            <th className="p-3">Attempt</th>
                                            <th className="p-3">1st Score</th>
                                            <th className="p-3">2nd Score</th>
                                            <th className="p-3">Result</th>
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
                                                <td className="p-3 font-semibold">
                                                    {formatScore(attempt.firstScore ?? attempt.finalScore)}
                                                    {attempt.passed != null && <PassBadge passed={attempt.passed} className="ml-2" />}
                                                </td>
                                                <td className="p-3 font-semibold">
                                                    {formatScore(attempt.secondScore)}
                                                </td>
                                                <td className="p-3">
                                                    {attempt.passed === true ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                            <CheckCircle2 className="size-3" />
                                                            Đạt
                                                        </span>
                                                    ) : attempt.passed === false ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                            <XCircle className="size-3" />
                                                            Rớt
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">--</span>
                                                    )}
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
                                                    colSpan={9}
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

                {/* Grade Push Preview Modal (Bảng xem trước đẩy điểm) */}
                {publishPreviewOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
                        onClick={() => setPublishPreviewOpen(false)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="push-preview-title"
                            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-border p-5">
                                <div>
                                    <h2
                                        id="push-preview-title"
                                        className="text-xl font-bold text-foreground"
                                    >
                                        Grade Push Preview (Bảng xem trước đẩy điểm)
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Review eligible attempts, pass/fail status, and student results before confirming score publication.
                                    </p>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setPublishPreviewOpen(false)}
                                    aria-label="Close preview"
                                >
                                    <X className="size-5" />
                                </Button>
                            </div>

                            {/* Modal Body */}
                            <div className="space-y-5 overflow-y-auto p-5">
                                {/* Top Overview Section (Khu vực tổng quan phía trên bảng) */}
                                <div>
                                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                        Summary Overview (Tổng quan điều kiện đẩy điểm)
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div className="rounded-lg border border-border bg-muted/30 p-4">
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Eligible Attempts (Đủ điều kiện)
                                            </p>
                                            <p className="mt-1 text-2xl font-bold text-foreground">
                                                {eligibleAttempts.length}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                of {attempts.length} total attempts
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                                    Passed (Đạt)
                                                </p>
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                                    {eligiblePassRate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                                {eligiblePassedAttempts.length}
                                            </p>
                                            <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                                                Score ≥ {statistics?.passScore != null ? statistics.passScore : 5.0}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-medium text-rose-800 dark:text-rose-300">
                                                    Failed (Rớt)
                                                </p>
                                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                                                    {eligibleFailRate.toFixed(1)}%
                                                </span>
                                            </div>
                                            <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                                                {eligibleFailedAttempts.length}
                                            </p>
                                            <p className="mt-0.5 text-xs text-rose-700/80 dark:text-rose-400/80">
                                                Score &lt; {statistics?.passScore != null ? statistics.passScore : 5.0}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-border bg-muted/30 p-4">
                                            <p className="text-xs font-medium text-muted-foreground">
                                                Target Release Policy
                                            </p>
                                            <p className="mt-1 truncate text-sm font-semibold text-foreground">
                                                {policies.find((p) => p.value === releasePolicy)?.label ?? releasePolicy}
                                            </p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                Passing threshold: {statistics?.passScore != null ? statistics.passScore : 5.0}
                                            </p>
                                        </div>
                                    </div>

                                    {(statistics?.pendingGradingAttempts ?? 0) > 0 && (
                                        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                                            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                            <div>
                                                <strong>Notice:</strong> There are {statistics?.pendingGradingAttempts} submission(s) pending grading.
                                                All submissions must be graded before results can be successfully published.
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Detail Table Filter */}
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                            Detailed Student Results ({filteredPreviewAttempts.length} records)
                                        </h3>

                                        <div className="relative w-full sm:w-72">
                                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={previewSearch}
                                                onChange={(e) => setPreviewSearch(e.target.value)}
                                                placeholder="Filter student or email..."
                                                className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Detailed Preview Table with Result column */}
                                    <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
                                        <table className="w-full min-w-[700px] text-left text-sm">
                                            <thead className="sticky top-0 border-b border-border bg-muted">
                                                <tr>
                                                    <th className="p-2.5">No.</th>
                                                    <th className="p-2.5">Student</th>
                                                    <th className="p-2.5">Email</th>
                                                    <th className="p-2.5">Attempt</th>
                                                    <th className="p-2.5">Score</th>
                                                    <th className="p-2.5">Result (Kết quả)</th>
                                                    <th className="p-2.5">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredPreviewAttempts.map((attempt, index) => (
                                                    <tr
                                                        key={attempt.attemptId}
                                                        className="border-b border-border last:border-0 hover:bg-muted/40"
                                                    >
                                                        <td className="p-2.5 text-xs text-muted-foreground">
                                                            {index + 1}
                                                        </td>
                                                        <td className="p-2.5 font-medium">
                                                            {attempt.studentName || "--"}
                                                        </td>
                                                        <td className="p-2.5 text-xs text-muted-foreground">
                                                            {attempt.studentEmail || "--"}
                                                        </td>
                                                        <td className="p-2.5 text-xs">
                                                            #{attempt.attemptNumber ?? "--"}
                                                        </td>
                                                        <td className="p-2.5 font-bold">
                                                            {formatScore(attempt.finalScore)}
                                                        </td>
                                                        <td className="p-2.5">
                                                            {attempt.passed === true ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                    <CheckCircle2 className="size-3" />
                                                                    Đạt (Passed)
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                                    <XCircle className="size-3" />
                                                                    Rớt (Failed)
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-2.5 text-xs text-muted-foreground">
                                                            {attempt.status}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {filteredPreviewAttempts.length === 0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={7}
                                                            className="p-8 text-center text-muted-foreground"
                                                        >
                                                            {eligibleAttempts.length === 0
                                                                ? "No eligible attempts ready to push."
                                                                : "No matching students found."}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer with Confirmation */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                                <p className="text-xs text-muted-foreground">
                                    Students will be notified according to policy:{" "}
                                    <strong>{policies.find((p) => p.value === releasePolicy)?.label}</strong>
                                </p>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setPublishPreviewOpen(false)}
                                    >
                                        Cancel (Hủy)
                                    </Button>

                                    <Button
                                        disabled={
                                            publishMutation.isPending ||
                                            eligibleAttempts.length === 0 ||
                                            (statistics?.pendingGradingAttempts ?? 0) > 0
                                        }
                                        onClick={() => publishMutation.mutate(releasePolicy)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    >
                                        {publishMutation.isPending
                                            ? "Publishing..."
                                            : "Confirm & Publish Results (Xác nhận đẩy điểm)"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === "overview" && (
                <section className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                    <h2 className="text-lg font-semibold">
                        Result Publication
                    </h2>

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
                                            ? "text-green-700 dark:text-green-400"
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
                                onClick={() => setPublishPreviewOpen(true)}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {publishMutation.isPending
                                    ? "Processing..."
                                    : "Preview & Publish Results (Xem trước & Đẩy điểm)"}
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
                )}

                {validExamId && tab === "questions" && <ItemAnalysisSection examId={examId} />}

                {/* NEW (anti-cheat): bao cao vi pham tung luot thi */}
                {validExamId && tab === "integrity" && <IntegrityReportSection examId={examId} />}
                </div>
                </div>

                {/* MODAL CẤU HÌNH THANG ĐIỂM HỌC THUẬT (A, B, C, D, F) */}
                {scaleModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
                        <div className="w-full max-w-2xl rounded-2xl border bg-background p-6 shadow-xl">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <h3 className="text-lg font-bold">
                                        {chartMode === "percentages" ? "Configure Percentage Bands (%)" : "Configure Grade Scales (A-F)"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        {chartMode === "percentages"
                                            ? "Customize percentage ranges and classification labels for this exam"
                                            : "Customize score ranges and academic performance labels for this exam"}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setScaleModalOpen(false)}
                                >
                                    <X className="size-4" />
                                </Button>
                            </div>

                            <div className="my-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground">
                                    <span className="col-span-2">{chartMode === "percentages" ? "Band" : "Grade"}</span>
                                    <span className="col-span-3">Min {chartMode === "percentages" ? "(%)" : "Score"}</span>
                                    <span className="col-span-3">Max {chartMode === "percentages" ? "(%)" : "Score"}</span>
                                    <span className="col-span-3">Label</span>
                                    <span className="col-span-1 text-center">Delete</span>
                                </div>

                                {editableScales.map((scale, idx) => (
                                    <div key={idx} className="grid grid-cols-12 items-center gap-2">
                                        <input
                                            type="text"
                                            value={scale.gradeLetter}
                                            onChange={(e) => {
                                                const copy = [...editableScales];
                                                copy[idx].gradeLetter = e.target.value.toUpperCase();
                                                setEditableScales(copy);
                                            }}
                                            className="col-span-2 rounded border bg-background px-2 py-1.5 text-center text-sm font-bold"
                                            placeholder={chartMode === "percentages" ? "90-100%" : "A"}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={scale.minScore}
                                            onChange={(e) => {
                                                const copy = [...editableScales];
                                                copy[idx].minScore = Number(e.target.value);
                                                setEditableScales(copy);
                                            }}
                                            className="col-span-3 rounded border bg-background px-2 py-1.5 text-sm"
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={scale.maxScore}
                                            onChange={(e) => {
                                                const copy = [...editableScales];
                                                copy[idx].maxScore = Number(e.target.value);
                                                setEditableScales(copy);
                                            }}
                                            className="col-span-3 rounded border bg-background px-2 py-1.5 text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={scale.label}
                                            onChange={(e) => {
                                                const copy = [...editableScales];
                                                copy[idx].label = e.target.value;
                                                setEditableScales(copy);
                                            }}
                                            className="col-span-3 rounded border bg-background px-2 py-1.5 text-sm"
                                            placeholder={chartMode === "percentages" ? "Excellent" : "Excellent"}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditableScales(editableScales.filter((_, i) => i !== idx));
                                            }}
                                            className="col-span-1 text-center text-rose-500 hover:text-rose-700"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => {
                                        setEditableScales([
                                            ...editableScales,
                                            { gradeLetter: "NEW", minScore: 0, maxScore: 10, label: "", color: "#3b82f6" },
                                        ]);
                                    }}
                                >
                                    + Add New Range
                                </Button>
                            </div>

                            <div className="flex items-center justify-between border-t pt-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-muted-foreground"
                                    onClick={async () => {
                                        try {
                                            const typeParam = chartMode === "percentages" ? "PERCENTAGE" : "GRADE";
                                            await axiosInstance.delete(`/exams/${examId}/grade-scales/reset`, {
                                                params: { type: typeParam },
                                            });
                                            const res = await axiosInstance.get(`/exams/${examId}/grade-scales`, {
                                                params: { type: typeParam },
                                            });
                                            setEditableScales(res.data);
                                            toast.success("Reset to default configuration");
                                            await queryClient.invalidateQueries({ queryKey: ["exam-result-statistics", examId] });
                                        } catch {
                                            toast.error("Failed to reset defaults");
                                        }
                                    }}
                                >
                                    Reset to Defaults
                                </Button>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setScaleModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                const typeParam = chartMode === "percentages" ? "PERCENTAGE" : "GRADE";
                                                await axiosInstance.put(`/exams/${examId}/grade-scales`, editableScales, {
                                                    params: { type: typeParam },
                                                });
                                                toast.success("Saved configuration successfully!");
                                                setScaleModalOpen(false);
                                                await queryClient.invalidateQueries({ queryKey: ["exam-result-statistics", examId] });
                                            } catch (err: unknown) {
                                                toast.error(getErrorMessage(err));
                                            }
                                        }}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
