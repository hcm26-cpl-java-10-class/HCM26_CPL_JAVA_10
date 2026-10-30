import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { examApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SimilarPair } from "@/types";
import { toast } from "sonner";
import {
    AlertTriangle,
    ArrowLeft,
    FileSearch,
    Info,
    RefreshCw,
    Search,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Users,
} from "lucide-react";

export default function ExamSimilarityPage() {
    const { examId } = useParams<{ examId: string }>();
    const numericExamId = Number(examId);
    const validId = Number.isInteger(numericExamId) && numericExamId > 0;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedQuestionId, setSelectedQuestionId] = useState<string>("ALL");
    const [selectedLevel, setSelectedLevel] = useState<string>("ALL");

    const similarityQuery = useQuery({
        queryKey: ["exam-similarity", numericExamId],
        queryFn: () => examApi.getExamSimilarity(numericExamId),
        enabled: validId,
    });

    const scanMutation = useMutation({
        mutationFn: () => examApi.scanExamSimilarity(numericExamId),
        onSuccess: (data) => {
            queryClient.setQueryData(["exam-similarity", numericExamId], data);
            toast.success("Plagiarism scan completed", {
                description: `Scanned ${data.scannedAttemptsCount} submissions, found ${data.flaggedPairsCount} suspicious pair(s).`,
            });
        },
        onError: (err: any) => {
            toast.error("Failed to run plagiarism scan", {
                description: err?.response?.data?.message || err?.message || "An unexpected error occurred",
            });
        },
    });

    const report = similarityQuery.data;
    const allPairs: SimilarPair[] = report?.pairs ?? [];

    // Filter pairs by search and criteria
    const filteredPairs = allPairs.filter((pair) => {
        if (selectedQuestionId !== "ALL" && String(pair.questionId) !== selectedQuestionId) {
            return false;
        }

        if (selectedLevel !== "ALL") {
            if (selectedLevel === "EXACT" && pair.overallSimilarity < 90) return false;
            if (selectedLevel === "HIGH" && (pair.overallSimilarity < 70 || pair.overallSimilarity >= 90)) return false;
            if (selectedLevel === "PARAPHRASE" && (pair.overallSimilarity < 50 || pair.overallSimilarity >= 70)) return false;
            if (selectedLevel === "MODERATE" && pair.overallSimilarity >= 50) return false;
        }

        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            const matchStudent1 = pair.studentName1.toLowerCase().includes(query) || pair.studentEmail1.toLowerCase().includes(query);
            const matchStudent2 = pair.studentName2.toLowerCase().includes(query) || pair.studentEmail2.toLowerCase().includes(query);
            const matchContent = pair.questionContent.toLowerCase().includes(query);
            return matchStudent1 || matchStudent2 || matchContent;
        }

        return true;
    });

    // Unique question IDs for dropdown filter
    const uniqueQuestions = Array.from(
        new Map(allPairs.map((p) => [p.questionId, { id: p.questionId, order: p.questionDisplayOrder, content: p.questionContent }])).values()
    ).sort((a, b) => a.order - b.order);

    const getSimilarityBadge = (score: number, matchType: string) => {
        if (score >= 90 || matchType === "EXACT_MATCH") {
            return <Badge className="bg-red-600 text-white hover:bg-red-700">Trùng khớp cao · {score.toFixed(1)}%</Badge>;
        }
        if (score >= 70 || matchType === "HIGH_SIMILARITY") {
            return <Badge className="bg-orange-600 text-white hover:bg-orange-700">Tương đồng cao · {score.toFixed(1)}%</Badge>;
        }
        if (score >= 50 || matchType === "SUSPICIOUS_PARAPHRASE") {
            return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Diễn đạt tương đồng · {score.toFixed(1)}%</Badge>;
        }
        return <Badge className="bg-yellow-600 text-white hover:bg-yellow-700">Tương đồng mức vừa · {score.toFixed(1)}%</Badge>;
    };

    return (
        <MainLayout pathName={{ exams: "Exam Management", grading: "Essay Grading", similarity: "Plagiarism Detection" }}>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 mb-2 gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => navigate(`/exams/${numericExamId}/grading`)}
                        >
                            <ArrowLeft className="size-4" />
                            Back to Essay Grading
                        </Button>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <ShieldAlert className="size-6 text-red-600" />
                            AI Essay Similarity & Plagiarism Detection
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Exam #{examId} {report?.examTitle ? `· ${report.examTitle}` : ""} · Cross-attempt comparative analysis
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => void similarityQuery.refetch()}
                            disabled={similarityQuery.isFetching || scanMutation.isPending}
                        >
                            <RefreshCw className={`size-4 mr-1.5 ${similarityQuery.isFetching ? "animate-spin" : ""}`} />
                            Reload
                        </Button>
                        <Button
                            className="bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5"
                            onClick={() => scanMutation.mutate()}
                            disabled={scanMutation.isPending || similarityQuery.isFetching}
                        >
                            <Sparkles className="size-4" />
                            {scanMutation.isPending ? "Scanning Submissions..." : "Run AI Plagiarism Scan"}
                        </Button>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                {report && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Submissions Scanned</CardTitle>
                                <Users className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{report.scannedAttemptsCount}</div>
                                <p className="text-xs text-muted-foreground mt-1">Across {report.scannedQuestionsCount} essay question(s)</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Pairs Compared</CardTitle>
                                <FileSearch className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{report.totalPairsCompared}</div>
                                <p className="text-xs text-muted-foreground mt-1">Pairwise combination checks</p>
                            </CardContent>
                        </Card>

                        <Card className={report.flaggedPairsCount > 0 ? "border-amber-300 dark:border-amber-800" : ""}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Suspicious Pairs</CardTitle>
                                <AlertTriangle className={`size-4 ${report.flaggedPairsCount > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${report.flaggedPairsCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                                    {report.flaggedPairsCount}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Over 40% similarity threshold</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">AI Semantic Engine</CardTitle>
                                <Sparkles className="size-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-1.5">
                                    {report.aiEvaluated ? (
                                        <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-xs">
                                            Gemini AI Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-xs">
                                            Lexical Only (Fallback)
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate" title={report.aiMessage ?? undefined}>
                                    {report.aiMessage || "Ready"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Pedagogical Notice Banner */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 flex items-start gap-2.5 shadow-sm">
                    <Info className="size-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold">Lưu ý sư phạm:</span> Hệ thống chỉ làm nổi bật các dấu hiệu tương đồng về mặt từ vựng và cấu trúc diễn đạt giữa các bài thi để hỗ trợ giáo viên đối chiếu. Kết quả này mang tính chất gợi ý tham khảo, không tự động kết luận thí sinh vi phạm quy chế thi. Quyết định cuối cùng thuộc về giáo viên chấm thi.
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-card p-3 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by student name, email, or question content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            className="h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={selectedQuestionId}
                            onChange={(e) => setSelectedQuestionId(e.target.value)}
                        >
                            <option value="ALL">All Questions</option>
                            {uniqueQuestions.map((q) => (
                                <option key={q.id} value={String(q.id)}>
                                    Q#{q.order} — {q.content.slice(0, 35)}...
                                </option>
                            ))}
                        </select>

                        <select
                            className="h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                        >
                            <option value="ALL">All Alert Levels</option>
                            <option value="EXACT">Trùng khớp cao (≥ 90%)</option>
                            <option value="HIGH">Tương đồng cao (70% - 89%)</option>
                            <option value="PARAPHRASE">Diễn đạt tương đồng (50% - 69%)</option>
                            <option value="MODERATE">Tương đồng mức vừa (40% - 49%)</option>
                        </select>
                    </div>
                </div>

                {/* Loading state */}
                {similarityQuery.isLoading && (
                    <div className="rounded-lg border bg-card p-12 text-center">
                        <RefreshCw className="size-8 animate-spin mx-auto text-indigo-600 mb-3" />
                        <h3 className="font-semibold text-lg">Scanning Submissions</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Computing pairwise token overlap and running AI semantic analysis...
                        </p>
                    </div>
                )}

                {/* Error state */}
                {similarityQuery.isError && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center text-destructive">
                        <AlertTriangle className="size-8 mx-auto mb-2" />
                        <h3 className="font-semibold">Failed to load similarity scan results</h3>
                        <p className="text-sm mt-1">
                            {(similarityQuery.error as any)?.response?.data?.message || (similarityQuery.error as any)?.message || "Please check exam ID and permissions."}
                        </p>
                        <Button variant="outline" className="mt-4" onClick={() => void similarityQuery.refetch()}>
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Edge Case: Less than 2 submissions */}
                {!similarityQuery.isLoading && !similarityQuery.isError && report && report.scannedAttemptsCount < 2 && (
                    <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
                        <Users className="size-12 mx-auto text-amber-500 mb-3" />
                        <h3 className="text-lg font-semibold text-foreground">Chưa đủ bài nộp để so sánh tương đồng</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                            {report.aiMessage || "Cần tối thiểu 2 bài nộp tự luận để hệ thống thực hiện đối chiếu tương đồng giữa các thí sinh."}
                        </p>
                    </div>
                )}

                {/* Edge Case: No essay questions in this exam */}
                {!similarityQuery.isLoading && !similarityQuery.isError && report && report.scannedAttemptsCount >= 2 && report.scannedQuestionsCount === 0 && (
                    <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
                        <FileSearch className="size-12 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-lg font-semibold text-foreground">Đề thi không có câu hỏi tự luận</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                            Đề thi này không chứa câu hỏi tự luận để thực hiện đối chiếu tương đồng câu trả lời.
                        </p>
                    </div>
                )}

                {/* Empty State: No suspicious pairs above threshold */}
                {!similarityQuery.isLoading && !similarityQuery.isError && report && report.scannedAttemptsCount >= 2 && report.scannedQuestionsCount > 0 && filteredPairs.length === 0 && (
                    <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
                        <ShieldCheck className="size-12 mx-auto text-emerald-600 mb-3" />
                        <h3 className="text-lg font-semibold text-foreground">Không phát hiện trùng lặp đáng ngờ</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                            {allPairs.length === 0
                                ? "Tất cả câu trả lời tự luận đã nộp đều có độ tương đồng dưới ngưỡng cảnh báo 40% và thể hiện tính độc lập cao."
                                : "Không tìm thấy cặp bài làm nào khớp với bộ lọc tìm kiếm hiện tại."}
                        </p>
                    </div>
                )}

                {/* Flagged Pairs List */}
                {!similarityQuery.isLoading && filteredPairs.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>Showing {filteredPairs.length} flagged pair(s)</span>
                            <span>Sorted by highest overall similarity</span>
                        </div>

                        {filteredPairs.map((pair) => (
                            <Card key={pair.pairId} className="border-l-4 border-l-amber-500 shadow-sm overflow-hidden">
                                <CardHeader className="bg-muted/40 pb-3 pt-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-semibold">
                                                Question #{pair.questionDisplayOrder}
                                            </Badge>
                                            <span className="text-sm font-medium line-clamp-1 text-foreground">
                                                {pair.questionContent}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getSimilarityBadge(pair.overallSimilarity, pair.matchType)}
                                            {pair.semanticSimilarity != null && (
                                                <Badge variant="secondary" className="text-[11px] gap-1">
                                                    <Sparkles className="size-3 text-purple-600" />
                                                    AI Semantic: {pair.semanticSimilarity.toFixed(1)}%
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="text-[11px]">
                                                Lexical: {pair.lexicalSimilarity.toFixed(1)}%
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-4 space-y-4">
                                    {/* Explanation / Reasoning Banner */}
                                    <div className="rounded-md border border-purple-200 bg-purple-50/70 p-3 text-xs dark:border-purple-900/50 dark:bg-purple-950/30">
                                        <div className="flex items-center gap-1.5 font-semibold text-purple-900 dark:text-purple-300 mb-1">
                                            {pair.aiAnalyzed ? (
                                                <>
                                                    <Sparkles className="size-3.5 text-purple-600" />
                                                    Google Gemini AI Plagiarism Assessment:
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldAlert className="size-3.5 text-indigo-600" />
                                                    Phân tích dấu hiệu tương đồng từ vựng:
                                                </>
                                            )}
                                        </div>
                                        <p className="text-purple-950 dark:text-purple-200 leading-relaxed">
                                            {pair.explanation}
                                        </p>
                                    </div>

                                    {/* Side-by-side comparison */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Student A */}
                                        <div className="flex flex-col rounded-lg border bg-background p-3">
                                            <div className="flex items-center justify-between border-b pb-2 mb-2">
                                                <div>
                                                    <span className="text-xs font-semibold text-foreground">
                                                        Student A: {pair.studentName1}
                                                    </span>
                                                    <p className="text-[11px] text-muted-foreground">{pair.studentEmail1}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs text-indigo-600 hover:text-indigo-800 p-1"
                                                    onClick={() => navigate(`/exams/${numericExamId}/grading/${pair.attemptId1}`)}
                                                >
                                                    View Attempt #{pair.attemptId1}
                                                </Button>
                                            </div>
                                            <div className="mt-1 flex-1 overflow-y-auto max-h-60 rounded bg-muted/30 p-2.5 font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground border">
                                                {pair.answerText1 || <span className="text-muted-foreground italic">[No answer text]</span>}
                                            </div>
                                        </div>

                                        {/* Student B */}
                                        <div className="flex flex-col rounded-lg border bg-background p-3">
                                            <div className="flex items-center justify-between border-b pb-2 mb-2">
                                                <div>
                                                    <span className="text-xs font-semibold text-foreground">
                                                        Student B: {pair.studentName2}
                                                    </span>
                                                    <p className="text-[11px] text-muted-foreground">{pair.studentEmail2}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs text-indigo-600 hover:text-indigo-800 p-1"
                                                    onClick={() => navigate(`/exams/${numericExamId}/grading/${pair.attemptId2}`)}
                                                >
                                                    View Attempt #{pair.attemptId2}
                                                </Button>
                                            </div>
                                            <div className="mt-1 flex-1 overflow-y-auto max-h-60 rounded bg-muted/30 p-2.5 font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground border">
                                                {pair.answerText2 || <span className="text-muted-foreground italic">[No answer text]</span>}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
