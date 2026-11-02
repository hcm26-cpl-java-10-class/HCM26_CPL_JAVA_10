import { examApi } from "@/api";
import { formatScore } from '@/utils/examScore';
import { MainLayout } from "@/components/layout/MainLayout";
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
import { Textarea } from "@/components/ui/textarea";
import type { AiGradingRequest, AiQuestionProposal, GradeSubmissionRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    Bot,
    Check,
    CheckCheck,
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    Info,
    Loader2,
    Save,
    Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CodingGradingPanel } from "./CodingGradingPanel";
import { ESSAY_STATUS_LABEL, formatDateTime } from "./EssayAttemptListPage";

interface DraftGrade {
    score: string;
    feedback: string;
}

interface QuestionGuidelines {
    referenceAnswer: string;
    rubric: string;
    isOpen: boolean;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
    const data = err?.response?.data;
    const fieldError = data?.errors ? (Object.values(data.errors).flat()[0]) : undefined;    return fieldError || data?.message || fallback;
};

export default function EssayAttemptDetailPage() {
    const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
    const numericExamId = Number(examId);
    const numericAttemptId = Number(attemptId);
    const validIds = Number.isInteger(numericExamId) && numericExamId > 0
        && Number.isInteger(numericAttemptId) && numericAttemptId > 0;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [draftGrades, setDraftGrades] = useState<Record<number, DraftGrade>>({});
    const [aiProposals, setAiProposals] = useState<Record<number, AiQuestionProposal>>({});
    const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
    const [guidelines, setGuidelines] = useState<Record<number, QuestionGuidelines>>({});
    const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<"essay" | "coding" | null>(null);

    const detailQuery = useQuery({
        queryKey: ["essay-attempt", numericExamId, numericAttemptId],
        queryFn: () => examApi.getEssayAttempt(numericExamId, numericAttemptId),
        enabled: validIds,
        // Câu coding đang được chấm nền: tự làm mới để thấy điểm khi xong.
        refetchInterval: (query) =>
            query.state.data?.codings?.some(
                (c) => c.autoGradeState === "PENDING" || c.autoGradeState === "RETRYING",
            )
                ? 10000
                : false,
    });
    const detail = detailQuery.data;

    useEffect(() => {
        if (!detail?.essays) return;
        const initial: Record<number, DraftGrade> = {};
        for (const essay of detail.essays) {
            initial[essay.questionId] = {
                score: essay.score != null ? String(essay.score) : "",
                feedback: essay.feedback ?? "",
            };
        }
        setDraftGrades(initial);
    }, [detail]);

    const backToList = () => navigate(`/exams/${numericExamId}/grading`);

    const aiSuggestMutation = useMutation({
        mutationFn: () => {
            if (!detail?.essays) return examApi.requestAiEssayGrading(numericExamId, numericAttemptId);

            const questionMap: Record<number, { referenceAnswer?: string; rubric?: string }> = {};
            let hasCustomContext = false;
            for (const essay of detail.essays) {
                const guide = guidelines[essay.questionId];
                const ref = guide?.referenceAnswer?.trim();
                const rub = guide?.rubric?.trim();
                if (ref || rub) {
                    questionMap[essay.questionId] = {
                        referenceAnswer: ref || undefined,
                        rubric: rub || undefined,
                    };
                    hasCustomContext = true;
                }
            }

            const payload: AiGradingRequest | undefined = hasCustomContext
                ? { questions: questionMap }
                : undefined;

            return examApi.requestAiEssayGrading(numericExamId, numericAttemptId, payload);
        },
        onSuccess: (data) => {
            const map: Record<number, AiQuestionProposal> = {};
            for (const proposal of data.proposals) {
                map[proposal.questionId] = proposal;
            }
            setAiProposals(map);
            if (data.model) {
                setAiModelUsed(data.model);
            }
            toast.success("AI score suggestions received. You can review and apply them below.");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, "AI grading request failed. You can continue grading manually."));
        },
    });

    const saveGradeMutation = useMutation({
        mutationFn: (request: GradeSubmissionRequest) =>
            examApi.submitEssayGrade(numericExamId, numericAttemptId, request),
        onSuccess: () => {
            setIsOverwriteModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: ["essay-attempt", numericExamId, numericAttemptId] });
            void queryClient.invalidateQueries({ queryKey: ["essay-attempts", numericExamId] });
            toast.success("Official grades saved successfully.");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, "Failed to save official grades."));
        },
    });

    const handleApplyAiProposal = (questionId: number) => {
        const proposal = aiProposals[questionId];
        if (!proposal) return;
        setDraftGrades((prev) => ({
            ...prev,
            [questionId]: {
                score: String(proposal.proposedScore),
                feedback: proposal.feedback,
            },
        }));
        toast.info("AI proposal applied to draft. You may edit before saving.");
    };

    const handleApplyAllProposals = () => {
        if (!detail?.essays) return;
        setDraftGrades((prev) => {
            const updated = { ...prev };
            let count = 0;
            for (const essay of detail.essays) {
                const proposal = aiProposals[essay.questionId];
                if (proposal) {
                    updated[essay.questionId] = {
                        score: String(proposal.proposedScore),
                        feedback: proposal.feedback,
                    };
                    count++;
                }
            }
            toast.info(`Applied ${count} AI suggestion(s) to draft grades.`);
            return updated;
        });
    };

    const toggleGuidelines = (questionId: number) => {
        setGuidelines((prev) => ({
            ...prev,
            [questionId]: {
                referenceAnswer: prev[questionId]?.referenceAnswer || "",
                rubric: prev[questionId]?.rubric || "",
                isOpen: !prev[questionId]?.isOpen,
            },
        }));
    };

    const updateGuideline = (questionId: number, field: "referenceAnswer" | "rubric", value: string) => {
        setGuidelines((prev) => ({
            ...prev,
            [questionId]: {
                referenceAnswer: field === "referenceAnswer" ? value : (prev[questionId]?.referenceAnswer || ""),
                rubric: field === "rubric" ? value : (prev[questionId]?.rubric || ""),
                isOpen: prev[questionId]?.isOpen ?? true,
            },
        }));
    };

    const validateGrades = (): GradeSubmissionRequest | null => {
        if (!detail?.essays?.length) return null;

        const gradesList = [];
        for (const essay of detail.essays) {
            const draft = draftGrades[essay.questionId];
            if (!draft || draft.score.trim() === "") {
                toast.error(`Please assign a score for Essay Question ${essay.displayOrder}.`);
                return null;
            }
            const scoreNum = Number(draft.score);
            if (isNaN(scoreNum) || scoreNum < 0) {
                toast.error(`Score for Essay Question ${essay.displayOrder} must be a non-negative number.`);
                return null;
            }
            if (scoreNum > (essay.maxScore ?? essay.points)) {
                toast.error(`Score for Essay Question ${essay.displayOrder} cannot exceed maximum points (${formatScore(essay.maxScore ?? essay.points)}).`);
                return null;
            }
            gradesList.push({
                questionId: essay.questionId,
                score: Math.round(scoreNum * 100) / 100,
                feedback: draft.feedback.trim(),
            });
        }

        return { grades: gradesList };
    };

    const handleInitiateSave = () => {
        const validated = validateGrades();
        if (!validated) return;

        if (detail?.alreadyGraded) {
            setIsOverwriteModalOpen(true);
            return;
        }

        saveGradeMutation.mutate({ ...validated, confirmOverwrite: false });
    };

    const handleConfirmOverwrite = () => {
        const validated = validateGrades();
        if (!validated) return;
        saveGradeMutation.mutate({ ...validated, confirmOverwrite: true });
    };

    const hasAiProposals = Object.keys(aiProposals).length > 0;
    const codings = detail?.codings ?? [];
    const tab: "essay" | "coding" =
        selectedTab ?? (detail && detail.essays.length === 0 && codings.length > 0 ? "coding" : "essay");

    return (
        <MainLayout pathName={{ exams: "Exam Management", grading: "Essay Grading", detail: "Submission Review" }}>
            <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={backToList}>
                        <ChevronLeft className="size-4" />
                        Back to submissions
                    </Button>

                    <div className={`flex flex-wrap items-center gap-2 ${tab === "essay" ? "" : "hidden"}`}>
                        {hasAiProposals && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleApplyAllProposals}
                                className="border border-purple-300 text-purple-900 hover:bg-purple-100 dark:border-purple-800 dark:text-purple-200"
                            >
                                <CheckCheck className="mr-1.5 size-4" />
                                Apply All AI Suggestions
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => aiSuggestMutation.mutate()}
                            disabled={aiSuggestMutation.isPending || saveGradeMutation.isPending}
                        >
                            {aiSuggestMutation.isPending ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 size-4 text-purple-600" />
                            )}
                            {aiSuggestMutation.isPending ? "Generating Suggestions..." : "Request AI Suggestions"}
                        </Button>
                        <Button
                            onClick={handleInitiateSave}
                            disabled={saveGradeMutation.isPending || aiSuggestMutation.isPending}
                        >
                            {saveGradeMutation.isPending ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 size-4" />
                            )}
                            {saveGradeMutation.isPending ? "Saving..." : "Confirm & Save Official Grade"}
                        </Button>
                    </div>
                </div>

                {detailQuery.isLoading && <p className="text-muted-foreground">Loading submission...</p>}
                {(detailQuery.isError || !validIds) && (
                    <p role="alert" className="rounded-md border border-destructive p-4 text-destructive">
                        Failed to load submission. It may not have been submitted or does not belong to this exam.
                    </p>
                )}

                {detail && (
                    <>
                        <header className="rounded-xl border bg-card p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-semibold">{detail.examTitle}</h1>
                                    <p className="mt-2 text-sm">
                                        <span className="font-medium text-foreground">{detail.studentName || `Student #${detail.studentId}`}</span>
                                        <span className="text-muted-foreground"> · {detail.studentEmail}</span>
                                    </p>
                                </div>
                                <Badge variant={detail.status === "EXPIRED" ? "destructive" : detail.status === "SUBMITTED" ? "default" : "secondary"}>
                                    {ESSAY_STATUS_LABEL[detail.status] || detail.status}
                                </Badge>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4 text-sm">
                                <div>
                                    <span className="block text-xs text-muted-foreground">Attempt</span>
                                    <span className="font-medium">#{detail.attemptNumber}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground">Objective Score</span>
                                    <span className="font-medium">{formatScore(detail.objectiveScore ?? 0)} / {formatScore(detail.maxScore ?? 10)} pts</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground">Final Score</span>
                                    <span className="font-medium">
                                        {detail.finalScore != null ? `${formatScore(detail.finalScore)} / ${formatScore(detail.maxScore ?? 10)} pts` : "Pending Grading"}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground">Submitted At</span>
                                    <span className="font-medium">{formatDateTime(detail.submittedAt)}</span>
                                </div>
                            </div>
                        </header>

                        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1" role="tablist">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === "essay"}
                                onClick={() => setSelectedTab("essay")}
                                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${tab === "essay" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Câu hỏi tự luận ({detail.essays.length})
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === "coding"}
                                onClick={() => setSelectedTab("coding")}
                                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${tab === "coding" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Câu hỏi coding ({codings.length})
                                {codings.some((c) => c.score == null && c.autoGradeState) && (
                                    <span className="ml-1 text-xs text-amber-600">
                                        · {codings.filter((c) => c.score == null && c.autoGradeState).length} grading
                                    </span>
                                )}
                            </button>
                        </div>

                        {tab === "coding" && (
                            <CodingGradingPanel
                                examId={numericExamId}
                                attemptId={numericAttemptId}
                                codings={codings}
                                scoreAdjusted={detail?.scoreAdjusted === true}
                            />
                        )}

                        {tab === "essay" && detail.essays.length > 0 && (() => {
                            const total = detail.essays.length;
                            const scored = detail.essays.filter(
                                (e) => String(draftGrades[e.questionId]?.score ?? "").trim() !== "",
                            ).length;
                            return (
                                <nav
                                    aria-label="Question navigation"
                                    className="sticky top-0 z-20 flex flex-col gap-2 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur"
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">Scored {scored}/{total} questions</span>
                                        <span className="text-xs text-muted-foreground">Based on the scores entered below</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-green-600 transition-all"
                                            style={{ width: `${(scored / total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {detail.essays.map((e, i) => {
                                            const done = String(draftGrades[e.questionId]?.score ?? "").trim() !== "";
                                            return (
                                                <button
                                                    key={e.questionId}
                                                    type="button"
                                                    title={`Question ${i + 1}${done ? " (scored)" : " (not scored)"}`}
                                                    onClick={() =>
                                                        document
                                                            .getElementById(`essay-card-${e.questionId}`)
                                                            ?.scrollIntoView({ behavior: "smooth", block: "start" })
                                                    }
                                                    className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition ${
                                                        done
                                                            ? "border-green-600 bg-green-600 text-white"
                                                            : "bg-background text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {i + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </nav>
                            );
                        })()}

                        {tab === "essay" && detail.essays.length === 0 && (
                            <p className="rounded-md border p-6 text-center text-muted-foreground">
                                This exam attempt contains no essay questions.
                            </p>
                        )}

                        {tab === "essay" && detail.essays.map((essay, index) => {
                            const draft = draftGrades[essay.questionId] || { score: "", feedback: "" };
                            const proposal = aiProposals[essay.questionId];
                            const guide = guidelines[essay.questionId] || { referenceAnswer: "", rubric: "", isOpen: false };

                            return (
                                <article
                                    key={essay.questionId}
                                    id={`essay-card-${essay.questionId}`}
                                    className="flex scroll-mt-24 flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
                                >
                                    <div className="flex items-center justify-between border-b pb-3">
                                        <h2 className="font-semibold text-lg">
                                            Question {index + 1}
                                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                (Max: {formatScore(essay.maxScore ?? essay.points)} points · weight {essay.points})
                                            </span>
                                        </h2>
                                    </div>

                                    <div>
                                        <span className="text-xs font-medium uppercase text-muted-foreground">Question Prompt</span>
                                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                            {essay.content}
                                        </p>
                                    </div>

                                    <div className="rounded-lg border bg-muted/40 p-4">
                                        <span className="text-xs font-medium uppercase text-muted-foreground">Student Answer</span>
                                        {essay.answerText?.trim() ? (
                                            <p className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground">
                                                {essay.answerText}
                                            </p>
                                        ) : (
                                            <p className="mt-2 text-sm italic text-muted-foreground">
                                                [No answer submitted by student]
                                            </p>
                                        )}
                                    </div>

                                    {essay.gradingCriteria && essay.gradingCriteria.length > 0 && (
                                        <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/20">
                                            <span className="text-xs font-medium uppercase text-sky-800 dark:text-sky-300">
                                                Saved Grading Criteria
                                            </span>
                                            <ul className="mt-2 grid gap-2">
                                                {essay.gradingCriteria.map((criterion, criterionIndex) => (
                                                    <li key={`${criterion.name}-${criterionIndex}`} className="text-sm">
                                                        <span className="font-medium">{criterion.name}</span>
                                                        <span className="ml-2 text-muted-foreground">{criterion.weightPercentage}%</span>
                                                        {criterion.description && (
                                                            <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                                                                {criterion.description}
                                                            </p>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                These saved criteria are included as the default rubric when requesting AI suggestions.
                                            </p>
                                        </div>
                                    )}

                                    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-3">
                                        <button
                                            type="button"
                                            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                                            onClick={() => toggleGuidelines(essay.questionId)}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Info className="size-3.5" />
                                                Optional Grading Guidelines & Rubric for AI
                                                {(guide.referenceAnswer || guide.rubric) && (
                                                    <Badge variant="outline" className="ml-1 text-[10px] py-0">Customized</Badge>
                                                )}
                                            </span>
                                            {guide.isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                        </button>
                                        {guide.isOpen && (
                                            <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 text-xs">
                                                <div>
                                                    <label className="font-medium text-muted-foreground">
                                                        Reference / Model Answer (Optional)
                                                    </label>
                                                    <Textarea
                                                        rows={3}
                                                        className="mt-1 text-xs"
                                                        placeholder="Provide the expected solution, formula steps, or standard answer..."
                                                        value={guide.referenceAnswer}
                                                        onChange={(e) => updateGuideline(essay.questionId, "referenceAnswer", e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="font-medium text-muted-foreground">
                                                        Grading Rubric & Criteria (Optional)
                                                    </label>
                                                    <Textarea
                                                        rows={3}
                                                        className="mt-1 text-xs"
                                                        placeholder="e.g. Method: 2 pts, Correct calculations: 2 pts, Final conclusion: 1 pt..."
                                                        value={guide.rubric}
                                                        onChange={(e) => updateGuideline(essay.questionId, "rubric", e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {}                                    {proposal && (
                                        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200/60 pb-3 dark:border-purple-900/60">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Bot className="size-4 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                                                        AI Evaluation Proposal
                                                    </span>
                                                    <Badge variant="outline" className="border-purple-300 bg-purple-100/60 text-purple-800 text-[11px] dark:border-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                                        Google Gemini ({aiModelUsed || "gemini-3.5-flash-lite"})
                                                    </Badge>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-1 border border-purple-300 text-purple-900 hover:bg-purple-100 dark:border-purple-800 dark:text-purple-200"
                                                    onClick={() => handleApplyAiProposal(essay.questionId)}
                                                >
                                                    <Check className="size-3.5" />
                                                    Apply to Draft Grade
                                                </Button>
                                            </div>

                                            {proposal.flagAmbiguous && (
                                                <div className="mt-3 flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50/90 p-3 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 text-xs leading-relaxed">
                                                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-semibold">Teacher Review Recommended: </span>
                                                        {proposal.flagReason || "The submission has ambiguous reasoning or missing grading criteria. Teacher verification advised."}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-3 flex items-baseline gap-2">
                                                <span className="text-xs font-medium uppercase text-purple-800 dark:text-purple-400">
                                                    Suggested Score:
                                                </span>
                                                <span className="text-lg font-bold text-purple-950 dark:text-purple-100">
                                                    {formatScore(proposal.proposedScore)} / {formatScore(essay.maxScore ?? essay.points)} pts                                                </span>
                                            </div>

                                            {(proposal.analysis || proposal.reasoning) && (
                                                <div className="mt-3 text-xs text-purple-950 dark:text-purple-200">
                                                    <span className="block font-semibold uppercase text-purple-800 dark:text-purple-400">
                                                        AI Solution Analysis & Reasoning:
                                                    </span>
                                                    <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                                                        {proposal.analysis || proposal.reasoning}
                                                    </p>
                                                </div>
                                            )}

                                            {proposal.criterionScores && proposal.criterionScores.length > 0 && (
                                                <div className="mt-3">
                                                    <span className="block text-xs font-semibold uppercase text-purple-800 dark:text-purple-400 mb-1.5">
                                                        Rubric Criterion Breakdown:
                                                    </span>
                                                    <div className="overflow-x-auto rounded-md border border-purple-200 bg-white dark:border-purple-800 dark:bg-card">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-purple-100/70 text-purple-900 font-semibold border-b border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800">
                                                                <tr>
                                                                    <th className="py-2 px-3">Criterion</th>
                                                                    <th className="py-2 px-3 w-28 text-center">Score</th>
                                                                    <th className="py-2 px-3">Evaluation / Justification</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-purple-100 dark:divide-purple-900/40">
                                                                {proposal.criterionScores.map((c, i) => (
                                                                    <tr key={i} className="hover:bg-purple-50/50 dark:hover:bg-purple-950/30">
                                                                        <td className="py-2 px-3 font-medium text-foreground">{c.criterion}</td>
                                                                        <td className="py-2 px-3 text-center font-semibold text-purple-900 dark:text-purple-300">
                                                                            {c.awardedPoints} / {c.maxPoints}
                                                                        </td>
<td className="py-2 px-3 text-muted-foreground">{c.explanation || c.comment}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-3 text-xs text-purple-950 dark:text-purple-200">
                                                <span className="block font-semibold uppercase text-purple-800 dark:text-purple-400">
                                                    Constructive Student Feedback:
                                                </span>
                                                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{proposal.feedback}</p>
                                            </div>
                                        </div>
                                    )}

                                    {}                                    <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-4">
                                        <div className="sm:col-span-1">
                                            <label className="text-xs font-medium uppercase text-muted-foreground">
                                                Official Score (0 - {formatScore(essay.maxScore ?? essay.points)})
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={essay.maxScore ?? essay.points}
                                                step="0.01"
                                                className="mt-1 font-semibold"
                                                placeholder={`0 - ${formatScore(essay.maxScore ?? essay.points)}`}
                                                value={draft.score}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setDraftGrades((prev) => ({
                                                        ...prev,
                                                        [essay.questionId]: { ...draft, score: val },
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="text-xs font-medium uppercase text-muted-foreground">
                                                Grader Feedback & Comments
                                            </label>
                                            <Textarea
                                                rows={2}
                                                className="mt-1 resize-y text-sm"
                                                placeholder="Enter feedback for the student..."
                                                value={draft.feedback}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setDraftGrades((prev) => ({
                                                        ...prev,
                                                        [essay.questionId]: { ...draft, feedback: val },
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </>
                )}

                {}                <Dialog open={isOverwriteModalOpen} onOpenChange={setIsOverwriteModalOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="size-5" />
                                Overwrite Confirmed Grade?
                            </DialogTitle>
                            <DialogDescription>
                                This exam attempt has already been graded with an official final score of{" "}
                                <span className="font-semibold text-foreground">
                                    {detail?.finalScore != null ? `${formatScore(detail.finalScore)} pts` : "Graded"}
                                </span>
                                . Are you sure you want to overwrite the confirmed official grade?
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                disabled={saveGradeMutation.isPending}
                                onClick={() => setIsOverwriteModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={saveGradeMutation.isPending}
                                onClick={handleConfirmOverwrite}
                            >
                                {saveGradeMutation.isPending ? "Overwriting..." : "Overwrite & Save Grade"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </section>
        </MainLayout>
    );
}
