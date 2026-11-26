import { examDashboardApi } from "@/api";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, ClipboardCheck, MessageSquareWarning, RefreshCw, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STAT_CARDS = [
    { key: "pendingGrading", label: "Pending grading", icon: ClipboardCheck, tone: "text-amber-600 bg-amber-500/10" },
    { key: "flaggedAttempts", label: "Flagged attempts", icon: ShieldAlert, tone: "text-red-600 bg-red-500/10" },
    { key: "pendingAppeals", label: "Pending appeals", icon: MessageSquareWarning, tone: "text-violet-600 bg-violet-500/10" },
    { key: "closingSoonInvitations", label: "Closing within 72h", icon: AlarmClock, tone: "text-sky-600 bg-sky-500/10" },
] as const;

function Count({ value, label }: { value: number; label: string }) {
    return (
        <div className="min-w-[88px] text-center">
            <div className={value > 0 ? "text-lg font-semibold" : "text-lg text-muted-foreground"}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
        </div>
    );
}

export default function ExamDashboardPage() {
    const navigate = useNavigate();
    const query = useQuery({ queryKey: ["exam-dashboard"], queryFn: examDashboardApi.get, refetchInterval: 60_000 });
    const data = query.data;

    return (
        <MainLayout pathName={{ exams: "Assessment Management", dashboard: "Dashboard" }}>
            <div className="space-y-6 p-6">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Everything that needs your attention across your exams.</p>
                    </div>
                    <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
                        <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </header>

                {query.isError ? (
                    <ApiErrorState error={query.error} onRetry={() => query.refetch()} onBack={() => navigate("/exams")} />
                ) : query.isLoading || !data ? (
                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                        </div>
                        <Skeleton className="h-64 rounded-xl" />
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {STAT_CARDS.map(({ key, label, icon: Icon, tone }) => (
                                <div key={key} className="flex items-center gap-4 rounded-xl border bg-card p-4">
                                    <div className={`rounded-lg p-3 ${tone}`}><Icon className="size-5" /></div>
                                    <div>
                                        <div className="text-2xl font-semibold">{data.summary[key]}</div>
                                        <div className="text-sm text-muted-foreground">{label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <section className="rounded-xl border bg-card">
                            <div className="border-b px-4 py-3 text-sm text-muted-foreground">
                                {data.summary.examsNeedingAttention} of {data.summary.totalExams} exams need attention
                            </div>
                            {data.items.length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground">All caught up. Nothing needs your attention.</div>
                            ) : (
                                <ul className="divide-y">
                                    {data.items.map((item) => (
                                        <li key={item.examId} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                                            <div className="min-w-0">
                                                <div className="truncate font-medium">{item.title}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.category ?? "Exam"}
                                                    {item.nextClosingAt ? ` · next closing ${new Date(item.nextClosingAt).toLocaleString()}` : ""}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Count value={item.pendingGrading} label="Grading" />
                                                <Count value={item.flaggedAttempts} label="Flagged" />
                                                <Count value={item.pendingAppeals} label="Appeals" />
                                                <Count value={item.closingSoonInvitations} label="Closing" />
                                                <Button size="sm" variant="outline" onClick={() => navigate(`/exams/${item.examId}`)}>Open</Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </div>
        </MainLayout>
    );
}
