import { examApi } from "@/api";
import { formatScore } from "@/utils/examScore";
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
import type { AiQuestionProposal, GradeSubmissionRequest } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    Bot,
    Check,
    CheckCheck,
    ChevronLeft,
    Clock,
    FileText,
    HelpCircle,
    Loader2,
    Pencil,
    Save,
    Sparkles,
    User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CodingGradingPanel } from "./CodingGradingPanel";
import { ESSAY_STATUS_LABEL, formatDateTime } from "./EssayAttemptListPage";
import { QuestionGuidelinesEditor } from "./QuestionGuidelinesEditor";

interface DraftGrade {
    score: string;
    feedback: string;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
    const data = err?.response?.data;
    const fieldError = data?.errors ? Object.values(data.errors).flat()[0] : undefined;
    return fieldError || data?.message || fallback;
};

export default function EssayAttemptDetailPage() {
    const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
    const numericExamId = Number(examId);
    const numericAttemptId = Number(attemptId);
    const validIds =
        Number.isInteger(numericExamId) &&
        numericExamId > 0 &&
        Number.isInteger(numericAttemptId) &&
        numericAttemptId > 0;
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [draftGrades, setDraftGrades] = useState<Record<number, DraftGrade>>({});
    const [aiProposals, setAiProposals] = useState<Record<number, AiQuestionProposal>>({});
    const [aiModelUsed, setAiModelUsed] = useState<string | null>(null);
    const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState<"essay" | "coding" | null>(null);

    const detailQuery = useQuery({
        queryKey: ["essay-attempt", numericExamId, numericAttemptId],
        queryFn: () => examApi.getEssayAttempt(numericExamId, numericAttemptId),
        enabled: validIds,
        refetchInterval: (query) =>
            query.state.data?.codings?.some(
                (c) => c.autoGradeState === "PENDING" || c.autoGradeState === "RETRYING"
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
        mutationFn: () => examApi.requestAiEssayGrading(numericExamId, numericAttemptId),
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
            toast.error(
                getErrorMessage(error, "AI grading request failed. You can continue grading manually.")
            );
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
                toast.error(
                    `Score for Essay Question ${essay.displayOrder} cannot exceed maximum points (${formatScore(
                        essay.maxScore ?? essay.points
                    )}).`
                );
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
        <MainLayout pathName={{ exams: "Assessment Management", grading: "Essay Grading", detail: "Submission Review" }}>
            <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
                {/* Top Action & Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Button variant="ghost" size="sm" className="-ml-2 w-fit gap-1 text-muted-foreground hover:text-foreground" onClick={backToList}>
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
                                <CheckCheck className="mr-1.5 size-4 text-purple-600" />
                                Apply All AI Suggestions
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            className="border-purple-300 hover:border-purple-400 hover:bg-purple-50/50 dark:border-purple-800"
                            onClick={() => aiSuggestMutation.mutate()}
                            disabled={aiSuggestMutation.isPending || saveGradeMutation.isPending}
                        >
                            {aiSuggestMutation.isPending ? (
                                <Loader2 className="mr-2 size-4 animate-spin text-purple-600" />
                            ) : (
                                <Sparkles className="mr-2 size-4 text-purple-600" />
                            )}
                            {aiSuggestMutation.isPending ? "Generating Suggestions..." : "Request AI Suggestions"}
                        </Button>

                    </div>
                </div>

                {detailQuery.isLoading && (
                    <div className="flex items-center justify-center p-12 text-muted-foreground">
                        <Loader2 className="mr-2 size-5 animate-spin" />
                        Loading submission details...
                    </div>
                )}

                {(detailQuery.isError || !validIds) && (
                    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                        <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-sm">Failed to load submission</h4>
                            <p className="text-xs mt-1">It may not have been submitted or does not belong to this exam.</p>
                        </div>
                    </div>
                )}

                {detail && (
                    <>
                        {/* Header Overview Card */}
                        <header className="rounded-xl border bg-card p-6 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{detail.examTitle}</h1>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1 font-semibold text-foreground">
                                            <User className="size-4 text-muted-foreground" />
                                            {detail.studentName || `Student #${detail.studentId}`}
                                        </span>
                                        <span>·</span>
                                        <span>{detail.studentEmail}</span>
                                    </div>
                                </div>
                                <Badge
                                    variant={
                                        detail.status === "EXPIRED"
                                            ? "destructive"
                                            : detail.status === "SUBMITTED"
                                            ? "default"
                                            : "secondary"
                                    }
                                    className="text-xs px-2.5 py-1"
                                >
                                    {ESSAY_STATUS_LABEL[detail.status] || detail.status}
                                </Badge>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4 text-sm">
                                <div>
                                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Attempt
                                    </span>
                                    <span className="mt-1 font-semibold text-base text-foreground">
                                        #{detail.attemptNumber}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Objective Score
                                    </span>
                                    <span className="mt-1 font-semibold text-base text-foreground">
                                        {formatScore(detail.objectiveScore ?? 0)} / {formatScore(detail.maxScore ?? 10)} pts
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Final Score
                                    </span>
                                    <span className={`mt-1 font-bold text-base ${detail.finalScore != null ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                                        {detail.finalScore != null
                                            ? `${formatScore(detail.finalScore)} / ${formatScore(detail.maxScore ?? 10)} pts`
                                            : "Pending Review"}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Clock className="size-3 text-muted-foreground" /> Submitted At
                                    </span>
                                    <span className="mt-1 font-medium text-sm text-foreground">
                                        {formatDateTime(detail.submittedAt)}
                                    </span>
                                </div>
                            </div>
                        </header>

                        {/* Tabs Bar */}
                        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1" role="tablist">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === "essay"}
                                onClick={() => setSelectedTab("essay")}
                                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
                                    tab === "essay"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Câu hỏi tự luận ({detail.essays.length})
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={tab === "coding"}
                                onClick={() => setSelectedTab("coding")}
                                className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${
                                    tab === "coding"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
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
                            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
                                <FileText className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                                <p className="font-medium text-sm">This exam attempt contains no essay questions.</p>
                            </div>
                        )}

                        {tab === "essay" &&
                            detail.essays.map((essay, index) => {
                                const draft = draftGrades[essay.questionId] || { score: "", feedback: "" };
                                const proposal = aiProposals[essay.questionId];

                                return (
                                    <article
                                        key={essay.questionId}
                                        id={`essay-card-${essay.questionId}`}
                                        className="flex scroll-mt-24 flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md"
                                    >
                                        {/* Question Header */}
                                        <div className="flex items-center justify-between border-b pb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                                    {index + 1}
                                                </span>
                                                <h2 className="font-bold text-base text-foreground">
                                                    Question {index + 1}
                                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                                        (Max: {formatScore(essay.maxScore ?? essay.points)} points · weight {essay.points})
                                                    </span>
                                                </h2>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                Essay
                                            </Badge>
                                        </div>

                                        {/* Question Prompt */}
                                        <div>
                                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <HelpCircle className="size-3.5 text-muted-foreground" />
                                                Question Prompt
                                            </span>
                                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground font-normal">
                                                {essay.content}
                                            </p>
                                        </div>

                                        {/* Student Submitted Answer */}
                                        <div className="rounded-lg border bg-muted/30 p-4">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <FileText className="size-3.5 text-muted-foreground" />
                                                Student Submitted Answer
                                            </span>
                                            {essay.answerText?.trim() ? (
                                                <div className="mt-2 rounded bg-background/80 p-3 border font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words">
                                                    {essay.answerText}
                                                </div>
                                            ) : (
                                                <p className="mt-2 text-xs italic text-muted-foreground">
                                                    [No answer submitted by student]
                                                </p>
                                            )}
                                        </div>

                                        {/* Saved Criteria from Question Bank */}
                                        {essay.gradingCriteria && essay.gradingCriteria.length > 0 && (
                                            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/60 dark:bg-sky-950/20">
                                                <span className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300">
                                                    Question Bank Grading Criteria
                                                </span>
                                                <ul className="mt-2 grid gap-2">
                                                    {essay.gradingCriteria.map((criterion, criterionIndex) => (
                                                        <li key={`${criterion.name}-${criterionIndex}`} className="text-xs">
                                                            <span className="font-semibold text-foreground">{criterion.name}</span>
                                                            <span className="ml-2 font-medium text-sky-800 dark:text-sky-400">
                                                                {criterion.weightPercentage}%
                                                            </span>
                                                            {criterion.description && (
                                                                <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                                                                    {criterion.description}
                                                                </p>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <p className="mt-2 text-[11px] text-muted-foreground">
                                                    These bank criteria serve as the default rubric for AI grading if no custom guidelines are submitted below.
                                                </p>
                                            </div>
                                        )}

                                        {/* Redesigned Optional Guidelines & Rubric for AI */}
                                        <QuestionGuidelinesEditor
                                            examId={numericExamId}
                                            questionId={essay.questionId}
                                            displayOrder={index + 1}
                                            initialReferenceAnswer={essay.referenceAnswer}
                                            initialReferenceSubmittedAt={essay.referenceSubmittedAt}
                                            initialRubric={essay.rubric}
                                            initialRubricSubmittedAt={essay.rubricSubmittedAt}
                                            onGuidelineUpdated={() => {
                                                void queryClient.invalidateQueries({
                                                    queryKey: ["essay-attempt", numericExamId, numericAttemptId],
                                                });
                                            }}
                                        />

                                        {/* Redesigned AI Evaluation Proposal */}
                                        {proposal && (
                                            <div className="rounded-xl border border-purple-200 bg-gradient-to-b from-purple-50/50 to-background p-5 shadow-sm dark:border-purple-900/60 dark:from-purple-950/20">
                                                {/* Header bar */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-200/60 pb-3 dark:border-purple-900/60">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="flex size-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                                                            <Bot className="size-4" />
                                                        </span>
                                                        <span className="text-sm font-bold text-purple-950 dark:text-purple-200">
                                                            AI Evaluation Proposal
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className="border-purple-300 bg-purple-100/70 text-purple-800 text-[11px] dark:border-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-medium"
                                                        >
                                                            Google Gemini ({aiModelUsed || "gemini-3.5-flash-lite"})
                                                        </Badge>
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                                                        onClick={() => handleApplyAiProposal(essay.questionId)}
                                                    >
                                                        <Check className="size-3.5" />
                                                        Apply to Draft Grade
                                                    </Button>
                                                </div>

                                                {/* Ambiguity Alert (if any) */}
                                                {proposal.flagAmbiguous && (
                                                    <div className="mt-3.5 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 text-xs leading-relaxed">
                                                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <span className="font-bold">Teacher Review Recommended: </span>
                                                            {proposal.flagReason ||
                                                                "The submission contains ambiguous reasoning or an alternative solution path. Teacher verification advised."}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Score Summary & Comparison Grid */}
                                                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-purple-200/80 bg-background/80 p-4 dark:border-purple-900/40">
                                                    <div>
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                            Suggested Score
                                                        </span>
                                                        <div className="mt-1 flex items-baseline gap-2">
                                                            <span className="text-2xl font-extrabold tracking-tight text-purple-950 dark:text-purple-50">
                                                                {formatScore(proposal.proposedScore)}
                                                            </span>
                                                            <span className="text-xs font-semibold text-muted-foreground">
                                                                / {formatScore(essay.maxScore ?? essay.points)} pts
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                                        <div className="flex flex-col items-center rounded border bg-purple-50/60 px-2.5 py-1 dark:bg-purple-950/30">
                                                            <span className="text-[10px] uppercase text-muted-foreground">AI Suggestion</span>
                                                            <span className="font-bold text-purple-800 dark:text-purple-300">
                                                                {formatScore(proposal.proposedScore)} pts
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-center rounded border bg-card px-2.5 py-1">
                                                            <span className="text-[10px] uppercase text-muted-foreground">Teacher Draft</span>
                                                            <span className="font-bold text-foreground">
                                                                {draft.score ? `${draft.score} pts` : "—"}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col items-center rounded border bg-card px-2.5 py-1">
                                                            <span className="text-[10px] uppercase text-muted-foreground">Confirmed Grade</span>
                                                            <span className={`font-bold ${essay.score != null ? "text-emerald-700 dark:text-emerald-400" : "text-amber-600"}`}>
                                                                {essay.score != null ? `${formatScore(essay.score)} pts` : "Pending"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Solution Analysis & Reasoning */}
                                                {(proposal.analysis || proposal.reasoning) && (
                                                    <div className="mt-4 text-xs text-foreground">
                                                        <span className="block font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 mb-1.5">
                                                            AI Solution Analysis & Reasoning:
                                                        </span>
                                                        <div className="rounded-lg border bg-background/70 p-3 leading-relaxed whitespace-pre-wrap">
                                                            {proposal.analysis || proposal.reasoning}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Rubric Criterion Breakdown Table */}
                                                {proposal.criterionScores && proposal.criterionScores.length > 0 && (
                                                    <div className="mt-4 space-y-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                                                            <CheckCheck className="size-4 text-purple-600" />
                                                            Rubric Criterion Breakdown:
                                                        </span>
                                                        <div className="overflow-x-auto rounded-lg border border-purple-200 bg-card shadow-xs dark:border-purple-800">
                                                            <table className="w-full text-xs text-left">
                                                                <thead className="bg-purple-100/70 text-purple-950 font-semibold border-b border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800">
                                                                    <tr>
                                                                        <th className="py-2.5 px-3">Criterion</th>
                                                                        <th className="py-2.5 px-3 w-28 text-center">Score Awarded</th>
                                                                        <th className="py-2.5 px-3 w-24 text-center">Percentage</th>
                                                                        <th className="py-2.5 px-3">Evaluation / Justification</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-purple-100 dark:divide-purple-900/40">
                                                                    {proposal.criterionScores.map((c, i) => {
                                                                        const pct =
                                                                            c.maxPoints && c.maxPoints > 0
                                                                                ? Math.round((c.awardedPoints / c.maxPoints) * 100)
                                                                                : null;
                                                                        return (
                                                                            <tr key={i} className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20">
                                                                                <td className="py-2.5 px-3 font-semibold text-foreground">
                                                                                    {c.criterion}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center font-bold text-purple-900 dark:text-purple-300">
                                                                                    {c.awardedPoints} / {c.maxPoints ?? "—"}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-center">
                                                                                    {pct !== null ? (
                                                                                        <Badge
                                                                                            variant={
                                                                                                pct >= 80
                                                                                                    ? "default"
                                                                                                    : pct >= 50
                                                                                                    ? "secondary"
                                                                                                    : "destructive"
                                                                                            }
                                                                                            className="text-[10px] py-0"
                                                                                        >
                                                                                            {pct}%
                                                                                        </Badge>
                                                                                    ) : (
                                                                                        "—"
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2.5 px-3 text-muted-foreground leading-relaxed">
                                                                                    {c.explanation || c.comment || "—"}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Constructive Student Feedback */}
                                                {proposal.feedback && (
                                                    <div className="mt-4 rounded-lg border border-purple-200/70 bg-background/70 p-3.5 dark:border-purple-900/40">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                                                            Constructive Student Feedback:
                                                        </span>
                                                        <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground italic border-l-2 border-purple-400 pl-3">
                                                            "{proposal.feedback}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Teacher Official Grading Section */}
                                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                                            <div className="flex items-center justify-between pb-3 border-b mb-3">
                                                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                                    <Pencil className="size-4 text-primary" />
                                                    Teacher Official Grade & Feedback
                                                </h3>
                                                <span className="text-xs text-muted-foreground">
                                                    Max Points: {formatScore(essay.maxScore ?? essay.points)}
                                                </span>
                                            </div>
                                            <div className="grid gap-4 sm:grid-cols-4">
                                                <div className="sm:col-span-1">
                                                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                                                        Official Score (0 - {formatScore(essay.maxScore ?? essay.points)})
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={essay.maxScore ?? essay.points}
                                                        step="0.01"
                                                        className="mt-1 font-bold text-base"
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
                                                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                                                        Grader Feedback & Comments
                                                    </label>
                                                    <Textarea
                                                        rows={2}
                                                        className="mt-1 resize-y text-xs leading-relaxed"
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
                                        </div>
                                    </article>
                                );
                            })}
                    </>
                )}

                {detail && tab === "essay" && detail.essays.length > 0 && (
                    <div className="flex justify-end border-t pt-4">
                        <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                            onClick={handleInitiateSave}
                            disabled={saveGradeMutation.isPending || aiSuggestMutation.isPending}
                        >
                            {saveGradeMutation.isPending ? (
                                <Loader2 className="mr-1.5 size-4 animate-spin" />
                            ) : (
                                <Save className="mr-1.5 size-4" />
                            )}
                            {saveGradeMutation.isPending ? "Saving..." : "Confirm & Save"}
                        </Button>
                    </div>
                )}

                {/* Confirm Overwrite Dialog */}
                <Dialog open={isOverwriteModalOpen} onOpenChange={setIsOverwriteModalOpen}>
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
