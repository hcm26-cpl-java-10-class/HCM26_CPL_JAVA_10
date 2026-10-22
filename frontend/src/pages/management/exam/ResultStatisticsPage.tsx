import axiosInstance from "@/api/axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

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

const policies: { value: ReleasePolicy; label: string }[] = [
    {
        value: "MY_SCORES_ONLY",
        label: "Chỉ hiển thị điểm trong My Scores",
    },
    {
        value: "MY_SCORES_AND_EMAIL",
        label: "Hiển thị điểm và gửi email",
    },
    {
        value: "HIDDEN",
        label: "Không công bố điểm cho học viên",
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
                Chưa có dữ liệu phân bố điểm.
            </p>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full min-w-[460px]"
                role="img"
                aria-label="Biểu đồ cột phân bố điểm"
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
                <svg
                    viewBox="0 0 160 160"
                    className="h-auto w-full"
                >
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
                        lượt thi
                    </text>
                </svg>
            </div>

            <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm bg-green-600" />
                    <div>
                        <p className="text-muted-foreground">Đã chấm hoàn tất</p>
                        <p className="font-semibold">{completed} lượt</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm bg-amber-500" />
                    <div>
                        <p className="text-muted-foreground">Chưa chấm hoàn tất</p>
                        <p className="font-semibold">{pending} lượt</p>
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

    return "Đã xảy ra lỗi khi gọi API. Hãy kiểm tra backend và quyền truy cập.";
}

export default function ResultStatisticsPage() {
    const { examId: examIdParam } = useParams();
    const examId = Number(examIdParam);
    const queryClient = useQueryClient();
    const [releasePolicy, setReleasePolicy] =
        useState<ReleasePolicy>("MY_SCORES_ONLY");

    const validExamId =
        Number.isInteger(examId) && examId > 0;

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
            toast.success("Đã cập nhật công bố kết quả.");
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
            toast.success("Đã hủy công bố kết quả.");
            await queryClient.invalidateQueries({
                queryKey: ["exam-result-publication", examId],
            });
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error));
        },
    });

    const statistics = statisticsQuery.data;
    const publication = publicationQuery.data;

    return (
        <MainLayout>
            <div className="space-y-6 p-4 md:p-6">
                <div>
                    <p className="text-sm text-muted-foreground">
                        Quản lý kỳ thi / Thống kê kết quả
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-foreground">
                        Thống kê kết quả kỳ thi
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        ID kỳ thi: {validExamId ? examId : "Không hợp lệ"}
                    </p>
                </div>

                {!validExamId && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        ID kỳ thi không hợp lệ. Hãy mở trang bằng URL
                        /exams/ID/result-statistics.
                    </div>
                )}

                {statisticsQuery.isLoading && (
                    <p className="rounded-lg border border-border bg-card p-6 text-muted-foreground">
                        Đang tải dữ liệu thống kê...
                    </p>
                )}

                {statisticsQuery.isError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        Không tải được thống kê:{" "}
                        {getErrorMessage(statisticsQuery.error)}
                    </div>
                )}

                {statistics && (
                    <>
                        <div>
                            <h2 className="mb-3 text-lg font-semibold">
                                {statistics.examTitle}
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <StatCard
                                    label="Tổng lượt thi"
                                    value={statistics.totalAttempts}
                                />
                                <StatCard
                                    label="Học viên tham gia"
                                    value={statistics.uniqueStudents}
                                />
                                <StatCard
                                    label="Điểm trung bình"
                                    value={formatScore(statistics.averageFinalScore)}
                                />
                                <StatCard
                                    label="Lượt chờ chấm"
                                    value={statistics.pendingGradingAttempts}
                                    detail={`${statistics.fullyGradedAttempts} lượt đã chấm hoàn tất`}
                                />
                                <StatCard
                                    label="Điểm cao nhất"
                                    value={formatScore(statistics.highestFinalScore)}
                                />
                                <StatCard
                                    label="Điểm thấp nhất"
                                    value={formatScore(statistics.lowestFinalScore)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                            <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                                <h2 className="text-lg font-semibold">
                                    Phân bố điểm
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Số lượt thi trong từng khoảng điểm.
                                </p>
                                <div className="mt-4">
                                    <ScoreDistributionChart
                                        bands={statistics.scoreDistribution ?? []}
                                    />
                                </div>
                            </section>

                            <section className="min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
                                <h2 className="text-lg font-semibold">
                                    Trạng thái chấm điểm
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Tình trạng hoàn tất chấm của các lượt thi.
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
                    <h2 className="text-lg font-semibold">
                        Công bố kết quả
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Chỉ người có quyền EXAM_UPDATE mới sử dụng được chức năng này.
                    </p>

                    {publicationQuery.isLoading && (
                        <p className="mt-4 text-sm text-muted-foreground">
                            Đang tải trạng thái công bố...
                        </p>
                    )}

                    {publicationQuery.isError && (
                        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                            Không tải được trạng thái công bố:{" "}
                            {getErrorMessage(publicationQuery.error)}
                        </p>
                    )}

                    {publication && (
                        <div className="mt-4 rounded-lg bg-muted p-4 text-sm text-foreground">
                            <p>
                                Trạng thái:{" "}
                                <strong
                                    className={
                                        publication.published
                                            ? "text-green-700"
                                            : "text-foreground"
                                    }
                                >
                                    {publication.published
                                        ? "Đã công bố"
                                        : "Chưa công bố"}
                                </strong>
                            </p>
                            <p className="mt-1">
                                Chính sách hiện tại:{" "}
                                {policies.find(
                                    (policy) =>
                                        policy.value === publication.releasePolicy,
                                )?.label ?? "Chưa thiết lập"}
                            </p>
                            {publication.publishedAt && (
                                <p className="mt-1">
                                    Thời điểm công bố:{" "}
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
                            Chính sách công bố
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
                                    ? "Đang xử lý..."
                                    : "Công bố kết quả"}
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
                                    ? "Đang xử lý..."
                                    : "Hủy công bố"}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </MainLayout>
    );
}