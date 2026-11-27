import { examApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AiEssayGradingState, BatchAiScope, EssayGradingSummary } from "@/types";
import { formatScore } from "@/utils/examScore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    Bot,
    CheckCheck,
    CheckCircle2,
    Clock,
    Eye,
    FileText,
    Flag,
    ListChecks,
    Loader2,
    Play,
    RefreshCw,
    Search,
    ShieldAlert,
    Sparkles,
    XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export const AI_STATE_LABEL: Record<AiEssayGradingState, string> = {
    PENDING: "Chờ AI xử lý",
    PROCESSING: "Đang chấm AI...",
    AI_COMPLETED: "Chờ xác nhận AI",
    FAILED: "Chấm AI thất bại",
    CONFIRMED: "Đã xác nhận chính thức",
    SKIPPED: "Bỏ qua (Không có bài tự luận)",
};

export function AiGradingStateBadge({
    state,
    lowScoreFlagged,
    lowScoreReason,
}: {
    state?: AiEssayGradingState | string | null;
    lowScoreFlagged?: boolean;
    lowScoreReason?: string | null;
}) {
    if (!state) {
        return (
            <Badge variant="outline" className="text-muted-foreground">
                Chưa chấm AI
            </Badge>
        );
    }
    switch (state) {
        case "AI_COMPLETED":
            return (
                <div className="flex flex-col items-start gap-1">
                    <Badge className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <Sparkles className="mr-1 size-3" />
                        Chờ xác nhận AI
                    </Badge>
                    {lowScoreFlagged && (
                        <Badge
                            variant="destructive"
                            className="border-rose-300 bg-rose-100 text-[10px] font-semibold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200"
                            title={lowScoreReason || "Điểm quá thấp / Fail — Bắt buộc giáo viên kiểm tra trực tiếp"}
                            data-testid="badge-low-score-flag"
                        >
                            <Flag className="mr-1 size-2.5 text-rose-600" />
                            Điểm thấp / Fail (GV bắt buộc check)
                        </Badge>
                    )}
                </div>
            );
        case "CONFIRMED":
            return (
                <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <CheckCircle2 className="mr-1 size-3" />
                    Đã xác nhận
                </Badge>
            );
        case "PROCESSING":
            return (
                <Badge className="border-purple-300 bg-purple-100 text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                    <Loader2 className="mr-1 size-3 animate-spin" />
                    Đang chấm AI
                </Badge>
            );
        case "PENDING":
            return (
                <Badge variant="secondary">
                    <Clock className="mr-1 size-3" />
                    Chờ xử lý
                </Badge>
            );
        case "FAILED":
            return (
                <div className="flex flex-col items-start gap-1">
                    <Badge variant="destructive">
                        <XCircle className="mr-1 size-3" />
                        Chấm AI lỗi
                    </Badge>
                    <Badge
                        variant="outline"
                        className="border-rose-300 bg-rose-50 text-[10px] text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                    >
                        <Flag className="mr-1 size-2.5" />
                        GV bắt buộc check
                    </Badge>
                </div>
            );
        case "SKIPPED":
            return (
                <Badge variant="outline" className="text-muted-foreground">
                    Bỏ qua
                </Badge>
            );
        default:
            return <Badge variant="outline">{state}</Badge>;
    }
}

interface BatchAiGradingPanelProps {
    examId: number;
    onBatchCompleted?: () => void;
}

export function BatchAiGradingPanel({ examId, onBatchCompleted }: BatchAiGradingPanelProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const validId = Number.isInteger(examId) && examId > 0;

    const initialFilter = new URLSearchParams(location.search).get("filter") || "ALL";
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [selectedScope, setSelectedScope] = useState<BatchAiScope>("UNGRADED_ONLY");
    const [customRubric, setCustomRubric] = useState("");
    const [customReferenceAnswer, setCustomReferenceAnswer] = useState("");
    const [stateFilter, setStateFilter] = useState<string>(initialFilter);
    const [searchText, setSearchText] = useState("");
    const [page, setPage] = useState(0);
    const pageSize = 10;

    // Trạng thái cho hộp thoại Xác nhận tất cả điểm (Apply All)
    const [isBulkConfirmModalOpen, setIsBulkConfirmModalOpen] = useState(false);
    const [applyAllInputText, setApplyAllInputText] = useState("");

    // Trạng thái bấm nút "Làm mới" thủ công — tách riêng khỏi background refetch để nút không bị nhấp nháy
    const [isManualRefreshing, setIsManualRefreshing] = useState(false);

    // Ghi nhớ batchId đã hoàn tất để chỉ gọi invalidateQueries đúng 1 lần khi một batch chuyển sang hoàn thành,
    // tuyệt đối tránh vòng lặp vô hạn gây nhấp nháy nút Reload.
    const notifiedCompletedBatchKeyRef = useRef<string | null>(null);
    const onBatchCompletedRef = useRef(onBatchCompleted);
    onBatchCompletedRef.current = onBatchCompleted;

    useEffect(() => {
        const paramFilter = new URLSearchParams(location.search).get("filter");
        if (paramFilter) {
            setStateFilter(paramFilter);
        }
    }, [location.search]);

    const previewQuery = useQuery({
        queryKey: ["batch-ai-preview", examId],
        queryFn: () => examApi.previewBatchAiGrading(examId),
        enabled: validId,
    });

    const latestBatchQuery = useQuery({
        queryKey: ["batch-ai-latest", examId],
        queryFn: () => examApi.getLatestBatchAiStatus(examId),
        enabled: validId,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === "PENDING" || status === "PROCESSING" ? 1500 : false;
        },
    });

    const latestBatch = latestBatchQuery.data;
    const isBatchActive = latestBatch?.status === "PENDING" || latestBatch?.status === "PROCESSING";

    const reviewQueueQuery = useQuery({
        queryKey: ["ai-review-queue", examId, stateFilter, searchText, page, latestBatch?.completedCount, latestBatch?.status],
        queryFn: () =>
            examApi.listAiReviewQueue(examId, {
                state: stateFilter === "ALL" ? undefined : stateFilter,
                search: searchText.trim() || undefined,
                page,
                size: pageSize,
            }),
        enabled: validId,
    });

    useEffect(() => {
        if (
            latestBatch &&
            (latestBatch.status === "COMPLETED" ||
                latestBatch.status === "PARTIAL_FAILED" ||
                latestBatch.status === "FAILED")
        ) {
            const completionKey = `${latestBatch.batchId}:${latestBatch.status}:${latestBatch.completedCount}:${latestBatch.failedCount}`;
            if (notifiedCompletedBatchKeyRef.current !== completionKey) {
                notifiedCompletedBatchKeyRef.current = completionKey;
                void queryClient.invalidateQueries({ queryKey: ["batch-ai-preview", examId] });
                void queryClient.invalidateQueries({ queryKey: ["essay-attempts", examId] });
                void queryClient.invalidateQueries({ queryKey: ["exam-attempt-statistics", examId] });
                onBatchCompletedRef.current?.();
            }
        }
    }, [latestBatch?.batchId, latestBatch?.status, latestBatch?.completedCount, latestBatch?.failedCount, examId, queryClient]);

    const handleManualRefresh = async () => {
        if (isManualRefreshing) return;
        setIsManualRefreshing(true);
        try {
            await Promise.all([
                previewQuery.refetch(),
                latestBatchQuery.refetch(),
                reviewQueueQuery.refetch(),
            ]);
        } finally {
            setIsManualRefreshing(false);
        }
    };

    const startBatchMutation = useMutation({
        mutationFn: (params: { scope: BatchAiScope; rubric: string; referenceAnswer: string }) =>
            examApi.startBatchAiGrading(examId, {
                scope: params.scope,
                rubric: params.rubric.trim() || undefined,
                referenceAnswer: params.referenceAnswer.trim() || undefined,
                autoGenerateGuidelines: true,
            }),
        onSuccess: (batch) => {
            setIsConfirmModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: ["batch-ai-latest", examId] });
            void queryClient.invalidateQueries({ queryKey: ["batch-ai-preview", examId] });
            void queryClient.invalidateQueries({ queryKey: ["ai-review-queue", examId] });
            void queryClient.invalidateQueries({ queryKey: ["essay-attempts", examId] });
            if (batch.totalAttempts === 0) {
                toast.info("Không có bài thi tự luận nào thuộc phạm vi cần chấm AI.");
            } else {
                const usedAuto = !customRubric.trim() || !customReferenceAnswer.trim();
                toast.success(
                    `Đã khởi chạy AI chấm hàng loạt (${batch.totalAttempts} bài thi).` +
                        (usedAuto ? " AI đã tự động bổ sung tiêu chí & câu trả lời mẫu cho phần để trống." : "")
                );
            }
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Không thể khởi chạy AI chấm hàng loạt.";
            toast.error(msg);
        },
    });

    const bulkConfirmMutation = useMutation({
        mutationFn: (confirmationText: string) =>
            examApi.bulkConfirmBatchAiGrades(examId, { confirmationText }),
        onSuccess: (result) => {
            setIsBulkConfirmModalOpen(false);
            setApplyAllInputText("");
            void queryClient.invalidateQueries({ queryKey: ["batch-ai-preview", examId] });
            void queryClient.invalidateQueries({ queryKey: ["ai-review-queue", examId] });
            void queryClient.invalidateQueries({ queryKey: ["essay-attempts", examId] });
            void queryClient.invalidateQueries({ queryKey: ["exam-attempt-statistics", examId] });
            onBatchCompletedRef.current?.();
            if (result.skippedLowScoreCount > 0) {
                toast.warning(result.message);
            } else {
                toast.success(result.message);
            }
        },
        onError: (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Không thể xác nhận hàng loạt kết quả AI.";
            toast.error(msg);
        },
    });

    const handleOpenTriggerModal = async () => {
        const res = await previewQuery.refetch();
        const latestPreview = res.data ?? previewQuery.data;
        if ((latestPreview?.ungradedCount ?? 0) === 0 && (latestPreview?.failedCount ?? 0) > 0) {
            setSelectedScope("FAILED_ONLY");
        } else if ((latestPreview?.ungradedCount ?? 0) === 0 && (latestPreview?.alreadyAiGradedCount ?? 0) > 0) {
            setSelectedScope("ALL_ELIGIBLE");
        } else {
            setSelectedScope("UNGRADED_ONLY");
        }
        setCustomReferenceAnswer(latestPreview?.savedReferenceAnswer ?? "");
        setCustomRubric(latestPreview?.savedRubric ?? "");
        setIsConfirmModalOpen(true);
    };

    const preview = previewQuery.data;
    const queuePage = reviewQueueQuery.data;
    const rows: EssayGradingSummary[] = queuePage?.content ?? [];
    const autoConfirmableCount = preview?.autoConfirmableCount ?? 0;
    const lowScoreFlaggedCount = preview?.lowScoreFlaggedCount ?? 0;

    return (
        <div className="space-y-4 rounded-xl border border-purple-200/80 bg-gradient-to-br from-purple-50/40 via-background to-background p-5 shadow-xs dark:border-purple-900/50 dark:from-purple-950/20">
            {/* Header & Trigger Button */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                        <Bot className="size-5" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold">
                                AI Chấm Tự Luận Hàng Loạt &amp; Duyệt Điểm (Human-in-the-Loop)
                            </h3>
                            {(preview?.alreadyAiGradedCount ?? 0) > 0 && (
                                <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                    {preview?.alreadyAiGradedCount} bài chờ xác nhận
                                </Badge>
                            )}
                            {lowScoreFlaggedCount > 0 && (
                                <Badge
                                    variant="destructive"
                                    className="border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"
                                    data-testid="header-low-score-badge"
                                >
                                    <Flag className="mr-1 size-3" />
                                    {lowScoreFlaggedCount} bài điểm thấp/Fail cần GV check
                                </Badge>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            AI chấm nháp từng câu trả lời tự luận và đề xuất điểm + nhận xét. Các bài điểm quá thấp hoặc Fail sẽ bị gắn cờ để giáo viên trực tiếp kiểm tra, không cho phép AI/hệ thống xác nhận tự động.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleManualRefresh()}
                        disabled={isManualRefreshing}
                        data-testid="btn-refresh-batch-ai"
                    >
                        <RefreshCw className={`mr-1.5 size-3.5 ${isManualRefreshing ? "animate-spin" : ""}`} />
                        Làm mới
                    </Button>

                    {(preview?.alreadyAiGradedCount ?? 0) > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                            onClick={() => {
                                setApplyAllInputText("");
                                setIsBulkConfirmModalOpen(true);
                            }}
                            disabled={isBatchActive || bulkConfirmMutation.isPending}
                            data-testid="btn-open-bulk-confirm-all"
                        >
                            <CheckCheck className="size-4 text-emerald-600" />
                            Xác nhận tất cả điểm ({autoConfirmableCount} bài hợp lệ)
                        </Button>
                    )}

                    <Button
                        size="sm"
                        className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500"
                        onClick={() => void handleOpenTriggerModal()}
                        disabled={!validId || isBatchActive || startBatchMutation.isPending}
                        data-testid="btn-open-batch-ai"
                    >
                        {isBatchActive ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Sparkles className="size-4" />
                        )}
                        {isBatchActive ? "Đang chạy AI chấm hàng loạt..." : "AI chấm hàng loạt"}
                    </Button>
                </div>
            </div>

            {/* Quick Summary Cards */}
            {preview && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                    <div className="rounded-lg border bg-background/80 p-3">
                        <p className="text-xs text-muted-foreground">Tổng bài đủ điều kiện</p>
                        <p className="mt-1 text-lg font-bold">{preview.eligibleCount}</p>
                    </div>
                    <div className="rounded-lg border bg-background/80 p-3">
                        <p className="text-xs text-muted-foreground">Chưa chấm AI</p>
                        <p className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-200">{preview.ungradedCount}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Chờ xác nhận AI</p>
                        <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{preview.alreadyAiGradedCount}</p>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                        <p className="text-xs font-medium text-rose-800 dark:text-rose-300">Flag điểm thấp / Fail</p>
                        <p className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
                            {preview.lowScoreFlaggedCount ?? 0}
                        </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Đã xác nhận chính thức</p>
                        <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{preview.confirmedCount}</p>
                    </div>
                    <div className="rounded-lg border bg-background/80 p-3">
                        <p className="text-xs text-muted-foreground">Lỗi AI / Không đủ ĐK</p>
                        <p className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
                            {preview.failedCount} / {preview.ineligibleCount}
                        </p>
                    </div>
                </div>
            )}

            {/* Batch Progress Tracker Banner */}
            {latestBatch && latestBatch.totalAttempts > 0 && (
                <div
                    className="rounded-lg border border-purple-200 bg-background p-4 shadow-2xs dark:border-purple-900/60"
                    data-testid="batch-ai-progress-card"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                            {isBatchActive ? (
                                <Loader2 className="size-4 animate-spin text-purple-600" />
                            ) : latestBatch.status === "FAILED" ? (
                                <AlertTriangle className="size-4 text-destructive" />
                            ) : (
                                <CheckCircle2 className="size-4 text-emerald-600" />
                            )}
                            <span>
                                Tiến độ Batch #{latestBatch.batchId} ({latestBatch.status})
                            </span>
                        </div>
                        <span className="font-semibold text-purple-700 dark:text-purple-300">
                            {latestBatch.progressPercent.toFixed(1)}% hoàn tất
                        </span>
                    </div>

                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full bg-purple-600 transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, latestBatch.progressPercent))}%` }}
                        />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>Tổng số bài: <strong className="text-foreground">{latestBatch.totalAttempts}</strong></span>
                        <span>Đã hoàn thành AI: <strong className="text-emerald-600">{latestBatch.completedCount}</strong></span>
                        <span>Đang xử lý: <strong className="text-purple-600">{latestBatch.processingCount}</strong></span>
                        <span>Chờ xử lý: <strong className="text-foreground">{latestBatch.pendingCount}</strong></span>
                        <span>Thất bại: <strong className="text-rose-600">{latestBatch.failedCount}</strong></span>
                        {latestBatch.skippedCount > 0 && (
                            <span>Bỏ qua: <strong className="text-foreground">{latestBatch.skippedCount}</strong></span>
                        )}
                    </div>

                    {latestBatch.lastError && latestBatch.failedCount > 0 && (
                        <p className="mt-2 rounded bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                            Lỗi gần nhất: {latestBatch.lastError}
                        </p>
                    )}
                </div>
            )}

            {/* Filter Tabs & Search for Review Queue */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Bộ lọc trạng thái chấm AI">
                    {([
                        ["ALL", "Tất cả bài nộp"],
                        ["AI_COMPLETED", `Chờ xác nhận AI (${preview?.alreadyAiGradedCount ?? 0})`],
                        ["LOW_SCORE_FLAGGED", `Flag điểm thấp / Fail (${preview?.lowScoreFlaggedCount ?? 0})`],
                        ["UNGRADED", `Chưa chấm AI (${preview?.ungradedCount ?? 0})`],
                        ["FAILED", `Chấm AI lỗi (${preview?.failedCount ?? 0})`],
                        ["CONFIRMED", `Đã xác nhận (${preview?.confirmedCount ?? 0})`],
                    ] as const).map(([key, label]) => (
                        <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant={stateFilter === key ? "default" : "outline"}
                            className={`h-8 text-xs ${
                                key === "LOW_SCORE_FLAGGED" && stateFilter !== key && (preview?.lowScoreFlaggedCount ?? 0) > 0
                                    ? "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
                                    : ""
                            }`}
                            onClick={() => {
                                setStateFilter(key);
                                setPage(0);
                            }}
                            data-testid={`filter-tab-${key}`}
                        >
                            {key === "LOW_SCORE_FLAGGED" && <Flag className="mr-1 size-3 text-rose-600" />}
                            {label}
                        </Button>
                    ))}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Tìm theo học sinh, email..."
                        value={searchText}
                        onChange={(e) => {
                            setSearchText(e.target.value);
                            setPage(0);
                        }}
                        className="h-8 pl-8 text-xs"
                    />
                </div>
            </div>

            {/* Review Queue Table */}
            <div className="overflow-hidden rounded-lg border bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Học sinh</TableHead>
                            <TableHead className="w-40">Thời gian nộp</TableHead>
                            <TableHead className="w-36">Câu tự luận AI chấm</TableHead>
                            <TableHead className="w-44">Điểm AI đề xuất</TableHead>
                            <TableHead className="w-36">Điểm chính thức</TableHead>
                            <TableHead className="w-52">Trạng thái &amp; Cảnh báo</TableHead>
                            <TableHead className="w-36 text-right">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reviewQueueQuery.isLoading && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                    Đang tải danh sách bài thi...
                                </TableCell>
                            </TableRow>
                        )}
                        {!reviewQueueQuery.isLoading && rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                                    Không có bài thi nào khớp với bộ lọc hiện tại.
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => (
                            <TableRow
                                key={row.attemptId}
                                className={`cursor-pointer hover:bg-muted/50 ${
                                    row.lowScoreFlagged && row.aiGradingState !== "CONFIRMED"
                                        ? "bg-rose-50/40 dark:bg-rose-950/15"
                                        : ""
                                }`}
                                onClick={() => navigate(`/exams/${examId}/grading/${row.attemptId}`)}
                            >
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <span>{row.studentName || `Học sinh #${row.studentId}`}</span>
                                        {row.lowScoreFlagged && row.aiGradingState !== "CONFIRMED" && (
                                            <span title={row.lowScoreReason || "Điểm thấp / Fail"}>
                                                <Flag className="size-3.5 shrink-0 text-rose-600" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs font-normal text-muted-foreground">
                                        {row.studentEmail} · Lần #{row.attemptNumber}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                    {row.essayCount > 0
                                        ? `${row.aiGradedEssayCount ?? 0} / ${row.essayCount} câu`
                                        : "Không có tự luận"}
                                </TableCell>
                                <TableCell>
                                    {row.aiProposedScore != null ? (
                                        <div>
                                            <span
                                                className={`font-semibold ${
                                                    row.lowScoreFlagged
                                                        ? "text-rose-600 dark:text-rose-400"
                                                        : "text-purple-700 dark:text-purple-300"
                                                }`}
                                            >
                                                {formatScore(row.aiProposedScore)}
                                                {row.maxEssayScore != null ? ` / ${formatScore(row.maxEssayScore)}` : ""} đ (nháp)
                                            </span>
                                            {row.lowScoreFlagged && row.aiGradingState !== "CONFIRMED" && (
                                                <p className="mt-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                                                    Không cho AI tự duyệt
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {row.finalScore != null ? (
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                            {formatScore(row.finalScore)} đ
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Chưa xác nhận</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <AiGradingStateBadge
                                        state={row.aiGradingState}
                                        lowScoreFlagged={row.lowScoreFlagged}
                                        lowScoreReason={row.lowScoreReason}
                                    />
                                    {row.lowScoreFlagged && row.lowScoreReason && row.aiGradingState !== "CONFIRMED" && (
                                        <p
                                            className="mt-1 line-clamp-2 text-[11px] text-rose-600 dark:text-rose-400"
                                            title={row.lowScoreReason}
                                        >
                                            {row.lowScoreReason}
                                        </p>
                                    )}
                                    {row.aiGradingError && row.aiGradingState === "FAILED" && (
                                        <p className="mt-1 line-clamp-1 text-[11px] text-destructive" title={row.aiGradingError}>
                                            {row.aiGradingError}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant={
                                            row.lowScoreFlagged && row.aiGradingState !== "CONFIRMED"
                                                ? "destructive"
                                                : row.aiGradingState === "AI_COMPLETED"
                                                    ? "default"
                                                    : "outline"
                                        }
                                        className="h-8 gap-1 text-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/exams/${examId}/grading/${row.attemptId}`);
                                        }}
                                        data-testid={`btn-review-attempt-${row.attemptId}`}
                                    >
                                        <Eye className="size-3.5" />
                                        {row.lowScoreFlagged && row.aiGradingState !== "CONFIRMED" ? "GV Kiểm tra" : "Kiểm tra"}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Footer */}
            {queuePage && queuePage.totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                        Trang {queuePage.number + 1} / {queuePage.totalPages} ({queuePage.totalElements} bài thi)
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            disabled={page <= 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                            Trước
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            disabled={page + 1 >= queuePage.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Tiếp
                        </Button>
                    </div>
                </div>
            )}

            {/* Pre-flight Confirmation Modal (Start Batch AI Grading + Rubric & Reference Answer inputs) */}
            <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="batch-ai-confirm-modal">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="size-5 text-purple-600" />
                            Xác nhận khởi chạy AI chấm bài tự luận hàng loạt
                        </DialogTitle>
                        <DialogDescription>
                            Hệ thống sẽ chạy ngầm AI để chấm từng câu trả lời tự luận và lưu dưới dạng{" "}
                            <strong className="text-foreground">kết quả chấm nháp</strong>. Điểm chính thức sẽ không thay đổi cho đến khi giáo viên kiểm tra và xác nhận.
                        </DialogDescription>
                    </DialogHeader>

                    {preview && (
                        <div className="space-y-4 py-1 text-sm">
                            <div className="grid grid-cols-2 gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-3">
                                <div>
                                    <span className="text-muted-foreground">Kỳ thi:</span>
                                    <p className="font-semibold text-foreground">{preview.examTitle}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Tổng số bài đủ điều kiện:</span>
                                    <p className="font-semibold text-foreground">{preview.eligibleCount} bài</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Số bài chưa được chấm AI:</span>
                                    <p className="font-semibold text-purple-700 dark:text-purple-300">{preview.ungradedCount} bài</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Số bài đã được AI chấm (nháp):</span>
                                    <p className="font-semibold text-amber-700 dark:text-amber-300">{preview.alreadyAiGradedCount} bài</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Số bài chấm AI lỗi (cần chạy lại):</span>
                                    <p className="font-semibold text-rose-600">{preview.failedCount} bài</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Không đủ điều kiện / Đã xác nhận:</span>
                                    <p className="font-semibold text-muted-foreground">
                                        {preview.ineligibleCount} bài (Bỏ qua)
                                    </p>
                                </div>
                            </div>

                            {/* Rubric / Grading Criteria & Reference Answer Input Boxes */}
                            <div className="space-y-3 rounded-lg border border-purple-200/80 bg-purple-50/30 p-3.5 dark:border-purple-900/50 dark:bg-purple-950/20">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-purple-900 dark:text-purple-200">
                                            Tiêu chí chấm (Rubric) &amp; Câu trả lời mẫu cho AI
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                            Nhập tiêu chí phân bổ điểm và đáp án mẫu để AI chấm sát ý nhất.{" "}
                                            <strong className="text-purple-700 dark:text-purple-300">
                                                Nếu bạn để trống và bấm Xác nhận, AI sẽ tự động phân tích đề bài để tạo tiêu chí &amp; đáp án mẫu chuẩn trước khi chấm.
                                            </strong>
                                        </p>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="shrink-0 border-purple-300 bg-purple-100/80 text-[10px] text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200"
                                    >
                                        <Bot className="mr-1 size-3" />
                                        {customRubric.trim() || customReferenceAnswer.trim()
                                            ? "Giáo viên tùy chỉnh"
                                            : "AI tự động thêm nếu để trống"}
                                    </Badge>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="batch-ai-rubric-input"
                                            className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
                                        >
                                            <ListChecks className="size-3.5 text-purple-600" />
                                            Tiêu chí chấm điểm (Rubric)
                                        </label>
                                        <Textarea
                                            id="batch-ai-rubric-input"
                                            rows={4}
                                            value={customRubric}
                                            onChange={(e) => setCustomRubric(e.target.value)}
                                            placeholder="VD:&#10;- Nêu đúng định nghĩa & nguyên lý: 40%&#10;- Phân tích ưu/nhược điểm & quy trình: 40%&#10;- Ví dụ minh họa thực tế rõ ràng: 20%&#10;(Để trống nếu muốn AI tự động thiết lập tiêu chí từ đề bài)"
                                            className="resize-y bg-background font-mono text-xs"
                                            data-testid="input-batch-ai-rubric"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label
                                            htmlFor="batch-ai-reference-input"
                                            className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
                                        >
                                            <FileText className="size-3.5 text-purple-600" />
                                            Câu trả lời mẫu / Đáp án chuẩn
                                        </label>
                                        <Textarea
                                            id="batch-ai-reference-input"
                                            rows={4}
                                            value={customReferenceAnswer}
                                            onChange={(e) => setCustomReferenceAnswer(e.target.value)}
                                            placeholder="VD: Trình bày khái niệm cốt lõi, các bước giải quyết vấn đề và kết luận...&#10;(Để trống nếu muốn AI tự động trích xuất đáp án mẫu từ nội dung câu hỏi)"
                                            className="resize-y bg-background font-mono text-xs"
                                            data-testid="input-batch-ai-reference"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-muted-foreground">
                                    Phạm vi bài thi sẽ được xử lý
                                </label>
                                <div className="space-y-2">
                                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 hover:bg-muted/40">
                                        <input
                                            type="radio"
                                            name="batch-ai-scope"
                                            checked={selectedScope === "UNGRADED_ONLY"}
                                            onChange={() => setSelectedScope("UNGRADED_ONLY")}
                                            className="mt-0.5"
                                        />
                                        <div className="text-xs">
                                            <p className="font-semibold">Các bài chưa có kết quả AI &amp; các bài bị lỗi ({preview.ungradedCount + preview.failedCount} bài)</p>
                                            <p className="text-muted-foreground">Tiết kiệm quota AI, giữ nguyên các bài đã có bản nháp AI hoàn tất.</p>
                                        </div>
                                    </label>

                                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 hover:bg-muted/40">
                                        <input
                                            type="radio"
                                            name="batch-ai-scope"
                                            checked={selectedScope === "FAILED_ONLY"}
                                            onChange={() => setSelectedScope("FAILED_ONLY")}
                                            className="mt-0.5"
                                        />
                                        <div className="text-xs">
                                            <p className="font-semibold">Chỉ chạy lại các bài chấm AI thất bại ({preview.failedCount} bài)</p>
                                            <p className="text-muted-foreground">Chỉ thử lại những bài gặp lỗi kết nối hoặc timeout ở lần chạy trước.</p>
                                        </div>
                                    </label>

                                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 hover:bg-muted/40">
                                        <input
                                            type="radio"
                                            name="batch-ai-scope"
                                            checked={selectedScope === "ALL_ELIGIBLE"}
                                            onChange={() => setSelectedScope("ALL_ELIGIBLE")}
                                            className="mt-0.5"
                                        />
                                        <div className="text-xs">
                                            <p className="font-semibold">Chấm lại toàn bộ bài đủ điều kiện chưa xác nhận ({preview.eligibleCount} bài)</p>
                                            <p className="text-muted-foreground">Cập nhật lại bản nháp AI mới theo tiêu chí/câu trả lời mẫu ở trên (không chạm vào bài đã xác nhận chính thức).</p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsConfirmModalOpen(false)}
                            disabled={startBatchMutation.isPending}
                        >
                            Hủy
                        </Button>
                        <Button
                            className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
                            onClick={() =>
                                startBatchMutation.mutate({
                                    scope: selectedScope,
                                    rubric: customRubric,
                                    referenceAnswer: customReferenceAnswer,
                                })
                            }
                            disabled={startBatchMutation.isPending}
                            data-testid="btn-confirm-start-batch-ai"
                        >
                            {startBatchMutation.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Play className="size-4" />
                            )}
                            {startBatchMutation.isPending ? "Đang khởi chạy..." : "Xác nhận & Bắt đầu chấm AI"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Confirm All Dialog (Requires typing 'apply all' and excludes Low Score / Fail flagged attempts) */}
            <Dialog open={isBulkConfirmModalOpen} onOpenChange={setIsBulkConfirmModalOpen}>
                <DialogContent className="sm:max-w-lg" data-testid="bulk-confirm-apply-all-modal">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                            <CheckCheck className="size-5" />
                            Xác nhận tất cả điểm AI đề xuất (Apply All)
                        </DialogTitle>
                        <DialogDescription>
                            Chuyển điểm và nhận xét nháp của AI thành <strong>điểm chính thức</strong> cho các bài thi đạt ngưỡng an toàn.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-sm">
                        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-xs">
                            <div>
                                <span className="text-muted-foreground">Bài đủ điều kiện xác nhận ngay:</span>
                                <p className="mt-0.5 text-base font-bold text-emerald-700 dark:text-emerald-400">
                                    {autoConfirmableCount} bài
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Bài giữ lại bắt buộc GV kiểm tra:</span>
                                <p className="mt-0.5 text-base font-bold text-rose-600 dark:text-rose-400">
                                    {lowScoreFlaggedCount} bài (Điểm thấp / Fail)
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50/80 p-3 text-xs text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-600" />
                            <div className="space-y-1">
                                <p className="font-semibold">
                                    Nguyên tắc bảo vệ bài điểm thấp / Fail:
                                </p>
                                <p>
                                    Các bài có <strong>điểm tự luận dưới 50%</strong>, <strong>0 điểm</strong>, <strong>dưới điểm đạt (Fail)</strong> hoặc <strong>chấm AI lỗi</strong> đã bị gắn cờ và{" "}
                                    <strong>tuyệt đối không được xác nhận tự động</strong>. Giáo viên bắt buộc phải bấm vào từng bài đó để kiểm tra và xác nhận thủ công.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="confirm-apply-all-input" className="block text-xs font-semibold text-foreground">
                                Để tránh bấm nhầm, vui lòng nhập chính xác cụm từ{" "}
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold text-purple-700 dark:text-purple-300">
                                    apply all
                                </code>{" "}
                                vào ô bên dưới:
                            </label>
                            <Input
                                id="confirm-apply-all-input"
                                value={applyAllInputText}
                                onChange={(e) => setApplyAllInputText(e.target.value)}
                                placeholder="Nhập apply all để mở khóa nút xác nhận..."
                                className="font-mono text-sm"
                                autoComplete="off"
                                data-testid="input-confirm-apply-all"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsBulkConfirmModalOpen(false);
                                setApplyAllInputText("");
                            }}
                            disabled={bulkConfirmMutation.isPending}
                        >
                            Hủy
                        </Button>
                        <Button
                            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={
                                bulkConfirmMutation.isPending ||
                                applyAllInputText.trim().toLowerCase() !== "apply all" ||
                                autoConfirmableCount === 0
                            }
                            onClick={() => bulkConfirmMutation.mutate(applyAllInputText.trim())}
                            data-testid="btn-submit-bulk-confirm-all"
                        >
                            {bulkConfirmMutation.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <CheckCheck className="size-4" />
                            )}
                            {bulkConfirmMutation.isPending
                                ? "Đang xác nhận..."
                                : `Xác nhận ${autoConfirmableCount} bài hợp lệ`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
