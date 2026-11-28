import axiosInstance from "@/api/axios";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

type ScoreAdjustmentHistory = {
    id: number;
    attemptId: number;
    attemptNumber: number | null;
    studentName: string | null;
    oldScore: number | null;
    newScore: number;
    reason: string;
    adjustedById: number | null;
    adjustedByName: string | null;
    adjustedAt: string;
};

const fmt = (n: number | null) => (n == null ? "—" : Number(n).toFixed(2).replace(/\.?0+$/, ""));

export function ScoreHistorySection({ examId }: { examId: number }) {
    const query = useQuery({
        queryKey: ["exam-score-history", examId],
        queryFn: async () => (await axiosInstance.get<ScoreAdjustmentHistory[]>(`/exams/${examId}/result-statistics/score-history`)).data,
    });

    if (query.isError) return <ApiErrorState error={query.error} onRetry={() => query.refetch()} />;
    if (query.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
    const rows = query.data ?? [];

    return (
        <section className="min-w-0 flex-1 rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Score edit history</h2>
                <p className="text-xs text-muted-foreground">Every manual score change on this exam: who, when, old to new score, and why.</p>
            </div>
            {rows.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">No score has been edited on this exam.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2">When</th>
                                <th className="px-4 py-2">Student</th>
                                <th className="px-4 py-2">Score</th>
                                <th className="px-4 py-2">Edited by</th>
                                <th className="px-4 py-2">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td className="whitespace-nowrap px-4 py-2">{new Date(r.adjustedAt).toLocaleString()}</td>
                                    <td className="px-4 py-2">
                                        {r.studentName || "—"}
                                        {r.attemptNumber != null && <span className="text-muted-foreground"> · attempt {r.attemptNumber}</span>}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-2">
                                        <span className="inline-flex items-center gap-1">
                                            {fmt(r.oldScore)} <ArrowRight className="size-3 text-muted-foreground" /> <b>{fmt(r.newScore)}</b>
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">{r.adjustedByName || (r.adjustedById ? `User #${r.adjustedById}` : "—")}</td>
                                    <td className="max-w-md px-4 py-2 text-muted-foreground">{r.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
