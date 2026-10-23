import { examApi } from "@/api";
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
    ChevronLeft,
    Loader2,
    Save,
    Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ESSAY_STATUS_LABEL, formatDateTime } from "./EssayAttemptListPage";

interface DraftGrade {
    score: string;
    feedback: string;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
    const data = err?.response?.data;
    const fieldError = data?.errors ? (Object.values(data.errors).flat()[0]) : undefined;
    return fieldError || data?.message || fallback;
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
    const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState(false);

    const detailQuery = useQuery({
        queryKey: ["essay-attempt", numericExamId, numericAttemptId],
        queryFn: () => examApi.getEssayAttempt(numericExamId, numericAttemptId),
        enabled: validIds,
    });
    const detail = detailQuery.data;

    // Sync loaded grades into draft editable state
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

    // Mutation for Requesting AI Grading Proposal
    const aiSuggestMutation = useMutation({
        mutationFn: () => examApi.requestAiEssayGrading(numericExamId, numericAttemptId),
        onSuccess: (data) => {
            const map: Record<number, AiQuestionProposal> = {};
            for (const proposal of data.proposals) {
                map[proposal.questionId] = proposal;
            }
            setAiProposals(map);
            toast.success("AI score suggestions received. You can review and apply them below.");
        },
        onError: (error) => {
            toast.error(getErrorMessage(error, "AI grading request failed. You can continue grading manually."));
        },
    });

    // Mutation for Saving Official Grade
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
            if (scoreNum > essay.points) {
                toast.error(`Score for Essay Question ${essay.displayOrder} cannot exceed maximum points (${essay.points}).`);
                return null;
            }
            gradesList.push({
                questionId: essay.questionId,
                score: Math.round(scoreNum),
                feedback: draft.feedback.trim(),
            });
        }

        return { grades: gradesList };
    };

    const handleInitiateSave = () => {
        const validated = validateGrades();
        if (!validated) return;

        // If attempt was already graded, protect against silent overwrite
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

    return (
        <MainLayout pathName={{ exams: "Exam Management", grading: "Essay Grading", detail: "Submission Review" }}>
            <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={backToList}>
                        <ChevronLeft className="size-4" />
                        Back to submissions
                    </Button>

                    <div className="flex items-center gap-2">
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
                                    <span className="font-medium">{detail.objectiveScore ?? 0} / {detail.totalPoints} pts</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground">Final Score</span>
                                    <span className="font-medium">
                                        {detail.finalScore != null ? `${detail.finalScore} / ${detail.totalPoints} pts` : "Pending Grading"}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-muted-foreground">Submitted At</span>
                                    <span className="font-medium">{formatDateTime(detail.submittedAt)}</span>
                                </div>
                            </div>
                        </header>

                        {detail.essays.length === 0 && (
                            <p className="rounded-md border p-6 text-center text-muted-foreground">
                                This exam attempt contains no essay questions.
                            </p>
                        )}

                        {detail.essays.map((essay, index) => {
                            const draft = draftGrades[essay.questionId] || { score: "", feedback: "" };
                            const proposal = aiProposals[essay.questionId];

                            return (
                                <article
                                    key={essay.questionId}
                                    className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm"
                                >
                                    <div className="flex items-center justify-between border-b pb-3">
                                        <h2 className="font-semibold text-lg">
                                            Question {index + 1}
                                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                (Max: {essay.points} points)
                                            </span>
                                        </h2>
                                    </div>

                                    {/* Question Prompt */}
                                    <div>
                                        <span className="text-xs font-medium uppercase text-muted-foreground">Question Prompt</span>
                                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                            {essay.content}
                                        </p>
                                    </div>

                                    {/* Student Answer */}
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

                                    {/* Display AI-proposed score and feedback separately from official grade */}
                                    {proposal && (
                                        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Bot className="size-4 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                                                        AI Evaluation Proposal
                                                    </span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-1 border border-purple-300 dark:border-purple-800"
                                                    onClick={() => handleApplyAiProposal(essay.questionId)}
                                                >
                                                    <Check className="size-3.5" />
                                                    Apply to Draft Grade
                                                </Button>
                                            </div>

                                            <div className="mt-3 flex items-baseline gap-2">
                                                <span className="text-xs font-medium uppercase text-purple-800 dark:text-purple-400">
                                                    Suggested Score:
                                                </span>
                                                <span className="font-semibold text-base text-purple-950 dark:text-purple-100">
                                                    {proposal.proposedScore} / {essay.points} pts
                                                </span>
                                            </div>

                                            <div className="mt-2 text-sm text-purple-950 dark:text-purple-200">
                                                <span className="block text-xs font-medium uppercase text-purple-800 dark:text-purple-400">
                                                    AI Feedback:
                                                </span>
                                                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{proposal.feedback}</p>
                                            </div>

                                            {proposal.reasoning && (
                                                <div className="mt-2 text-xs italic text-purple-700 dark:text-purple-400">
                                                    Reasoning: {proposal.reasoning}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Manual official grading review and edit inputs */}
                                    <div className="grid gap-4 rounded-lg border bg-background p-4 sm:grid-cols-4">
                                        <div className="sm:col-span-1">
                                            <label className="text-xs font-medium uppercase text-muted-foreground">
                                                Official Score (0 - {essay.points})
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={essay.points}
                                                className="mt-1 font-semibold"
                                                placeholder={`0 - ${essay.points}`}
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

                {/* Confirm overwrite modal */}
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
                                    {detail?.finalScore != null ? `${detail.finalScore} pts` : "Graded"}
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