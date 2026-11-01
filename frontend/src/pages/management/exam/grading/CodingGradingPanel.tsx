import { examApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatScore } from "@/utils/examScore";
import type { CodingGradingItem, CodingRunResult } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Play, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
    OK: "Đạt",
    WRONG_ANSWER: "Sai kết quả",
    COMPILE_ERROR: "Lỗi biên dịch",
    RUNTIME_ERROR: "Lỗi khi chạy",
    TIME_LIMIT: "Quá thời gian",
    INFRA_ERROR: "Máy chấm lỗi",
    NO_CODE: "Chưa nộp code",
};

const messageOf = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

interface Props {
    examId: number;
    attemptId: number;
    codings: CodingGradingItem[];
    scoreAdjusted?: boolean;
}

function CodingCard({
    examId,
    attemptId,
    item,
    index,
    scoreAdjusted,
}: {
    examId: number;
    attemptId: number;
    item: CodingGradingItem;
    index: number;
    scoreAdjusted: boolean;
}) {
    const queryClient = useQueryClient();
    const [result, setResult] = useState<CodingRunResult | null>(null);

    const runMutation = useMutation({
        mutationFn: () => examApi.runCodingTests(examId, attemptId, item.questionId),
        onSuccess: (data) => {
            setResult(data);
            if (data.infraError) toast.warning("Máy chấm code không phản hồi cho một số test.");
        },
        onError: (error) => toast.error(messageOf(error, "Không chạy được test case.")),
    });

    const regradeMutation = useMutation({
        mutationFn: () => examApi.regradeCoding(examId, attemptId, item.questionId),
        onSuccess: () => {
            toast.success("Đã chấm lại và lưu điểm câu lập trình.");
            void queryClient.invalidateQueries({ queryKey: ["essay-attempt", examId, attemptId] });
            void queryClient.invalidateQueries({ queryKey: ["essay-attempts", examId] });
        },
        onError: (error) => toast.error(messageOf(error, "Không chấm lại được.")),
    });

    const spec = item.spec;
    const params = spec?.params ?? [];
    const signature = spec
        ? `public static ${spec.returnType} ${spec.functionName}(${params.map((p) => `${p.type} ${p.name}`).join(", ")})`
        : "";
    const busy = runMutation.isPending || regradeMutation.isPending;

    return (
        <article className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <h2 className="text-lg font-semibold">
                    Coding {index + 1}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (Max: {formatScore(item.maxScore ?? item.points)} points · weight {item.points})
                    </span>
                </h2>
                <div className="flex items-center gap-2 text-sm">
                    {item.score != null ? (
                        <Badge>
                            {formatScore(item.score)} / {formatScore(item.maxScore ?? item.points)}
                        </Badge>
                    ) : item.autoGradeState === "PENDING" ? (
                        <Badge variant="secondary">Đang chấm tự động...</Badge>
                    ) : item.autoGradeState === "RETRYING" ? (
                        <Badge variant="secondary">Máy chấm lỗi, đang tự thử lại</Badge>
                    ) : item.autoGradeState === "FAILED" ? (
                        <Badge variant="destructive">Cần chấm lại thủ công</Badge>
                    ) : (
                        <Badge variant="secondary">Chưa có điểm</Badge>
                    )}
                    {item.feedback && <span className="text-muted-foreground">{item.feedback}</span>}
                </div>
            </div>

            <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Question Prompt</span>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{item.content}</p>
                {signature && (
                    <code className="mt-2 block overflow-x-auto rounded bg-muted px-3 py-2 text-xs">{signature}</code>
                )}
            </div>

            <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Code của sinh viên</span>
                {item.code.trim() ? (
                    <pre className="mt-1 max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                        {item.code}
                    </pre>
                ) : (
                    <p className="mt-1 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Sinh viên chưa nộp code cho câu này.
                    </p>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => runMutation.mutate()} disabled={busy}>
                    {runMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
                    {runMutation.isPending ? "Đang chạy test..." : "Chạy thử test case"}
                </Button>
                <Button type="button" onClick={() => regradeMutation.mutate()} disabled={busy || scoreAdjusted}>
                    {regradeMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                    {regradeMutation.isPending ? "Đang chấm..." : "Chấm lại & lưu điểm"}
                </Button>
                <span className="text-xs text-muted-foreground">
                    {scoreAdjusted
                        ? "Bài này đã được sửa điểm tay (điểm 1/điểm 2) nên không thể chấm lại coding tự động."
                        : '"Chạy thử" chỉ xem kết quả, không đổi điểm. "Chấm lại" chạy đủ 10 test và ghi điểm.'}
                </span>
            </div>

            {result && (
                <div className="grid gap-2">
                    <p className="text-sm font-medium">
                        Kết quả: {result.passed}/{result.total} test đạt
                    </p>
                    {result.tests.map((t) => (
                        <div
                            key={t.index}
                            className={`rounded-md border p-3 text-xs ${
                                t.passed
                                    ? "border-green-300 bg-green-50/60 dark:bg-green-950/20"
                                    : "border-red-300 bg-red-50/60 dark:bg-red-950/20"
                            }`}
                        >
                            <div className="flex items-center gap-2 font-medium">
                                {t.passed ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                ) : (
                                    <XCircle className="size-4 text-red-600" />
                                )}
                                Test {t.index + 1} ({t.visible ? "hiển thị" : "ẩn"}): {STATUS_LABEL[t.status] ?? t.status}
                            </div>
                            <div className="mt-1 font-mono">
                                {params.map((p, k) => (
                                    <div key={k}>{p.name} = {t.inputs[k]}</div>
                                ))}
                                <div>Mong đợi: {t.expected}</div>
                                {t.actual != null && t.actual !== "" && <div>Kết quả: {t.actual}</div>}
                            </div>
                            {t.error && (
                                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-red-700 dark:text-red-400">
                                    {t.error}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </article>
    );
}

export function CodingGradingPanel({ examId, attemptId, codings, scoreAdjusted = false }: Props) {
    if (codings.length === 0) {
        return (
            <p className="rounded-md border p-6 text-center text-muted-foreground">
                Bài làm này không có câu hỏi lập trình.
            </p>
        );
    }
    return (
        <>
            {codings.map((item, index) => (
                <CodingCard
                    key={item.questionId}
                    examId={examId}
                    attemptId={attemptId}
                    item={item}
                    index={index}
                    scoreAdjusted={scoreAdjusted}
                />
            ))}
        </>
    );
}
