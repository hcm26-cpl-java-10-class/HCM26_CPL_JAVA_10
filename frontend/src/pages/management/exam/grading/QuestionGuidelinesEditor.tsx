import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    AlertTriangle,
    Bot,
    Check,
    FileText,
    ListChecks,
    Loader2,
    Pencil,
    Save,
    Sparkles,
} from "lucide-react";

interface QuestionGuidelinesEditorProps {
    examId: number;
    questionId: number;
    displayOrder?: number;
    initialReferenceAnswer?: string | null;
    initialReferenceSubmittedAt?: string | null;
    initialRubric?: string | null;
    initialRubricSubmittedAt?: string | null;
    onGuidelineUpdated?: () => void;
}

type SubmissionState = "idle" | "submitting" | "submitted" | "failed" | "dirty";

export function QuestionGuidelinesEditor({
    examId,
    questionId,
    displayOrder,
    initialReferenceAnswer,
    initialReferenceSubmittedAt,
    initialRubric,
    initialRubricSubmittedAt,
    onGuidelineUpdated,
}: QuestionGuidelinesEditorProps) {
    // Modal open states
    const [isRefModalOpen, setIsRefModalOpen] = useState(false);
    const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);

    // Loading states when fetching latest guidelines from backend
    const [isLoadingRef, setIsLoadingRef] = useState(false);
    const [isLoadingRubric, setIsLoadingRubric] = useState(false);

    // Reference answer state
    const [refDraft, setRefDraft] = useState(initialReferenceAnswer ?? "");
    const [refSubmitted, setRefSubmitted] = useState(initialReferenceAnswer ?? "");
    const [refSubmittedAt, setRefSubmittedAt] = useState<string | null>(initialReferenceSubmittedAt ?? null);
    const [refState, setRefState] = useState<SubmissionState>(() => {
        if (initialReferenceSubmittedAt || (initialReferenceAnswer && initialReferenceAnswer.trim().length > 0)) {
            return "submitted";
        }
        return "idle";
    });

    // Rubric state
    const [rubricDraft, setRubricDraft] = useState(initialRubric ?? "");
    const [rubricSubmitted, setRubricSubmitted] = useState(initialRubric ?? "");
    const [rubricSubmittedAt, setRubricSubmittedAt] = useState<string | null>(initialRubricSubmittedAt ?? null);
    const [rubricState, setRubricState] = useState<SubmissionState>(() => {
        if (initialRubricSubmittedAt || (initialRubric && initialRubric.trim().length > 0)) {
            return "submitted";
        }
        return "idle";
    });

    // Synchronize if initial props change (e.g. page reload or query refetch)
    useEffect(() => {
        const refVal = initialReferenceAnswer ?? "";
        setRefSubmitted(refVal);
        setRefSubmittedAt(initialReferenceSubmittedAt ?? null);
        if (refState !== "dirty") {
            setRefDraft(refVal);
            if (initialReferenceSubmittedAt || refVal.trim().length > 0) {
                setRefState("submitted");
            } else {
                setRefState("idle");
            }
        }
    }, [initialReferenceAnswer, initialReferenceSubmittedAt]);

    useEffect(() => {
        const rubVal = initialRubric ?? "";
        setRubricSubmitted(rubVal);
        setRubricSubmittedAt(initialRubricSubmittedAt ?? null);
        if (rubricState !== "dirty") {
            setRubricDraft(rubVal);
            if (initialRubricSubmittedAt || rubVal.trim().length > 0) {
                setRubricState("submitted");
            } else {
                setRubricState("idle");
            }
        }
    }, [initialRubric, initialRubricSubmittedAt]);

    // Handle reference draft change
    const handleRefDraftChange = (val: string) => {
        setRefDraft(val);
        if (val.trim() === refSubmitted.trim()) {
            setRefState(refSubmitted.trim() ? "submitted" : "idle");
        } else {
            setRefState("dirty");
        }
    };

    // Handle rubric draft change
    const handleRubricDraftChange = (val: string) => {
        setRubricDraft(val);
        if (val.trim() === rubricSubmitted.trim()) {
            setRubricState(rubricSubmitted.trim() ? "submitted" : "idle");
        } else {
            setRubricState("dirty");
        }
    };

    // Open Reference Modal and fetch latest from backend
    const handleOpenRefModal = async () => {
        setIsRefModalOpen(true);
        if (refState !== "dirty") {
            setIsLoadingRef(true);
            try {
                const data = await examApi.getQuestionGuidelines(examId, questionId);
                const val = data.referenceAnswer ?? "";
                setRefSubmitted(val);
                setRefDraft(val);
                setRefSubmittedAt(data.referenceSubmittedAt ?? null);
                setRefState(val.trim() ? "submitted" : "idle");
            } catch {
                setRefDraft(refSubmitted);
            } finally {
                setIsLoadingRef(false);
            }
        }
    };

    // Cancel Reference edits: discard unsubmitted changes and reset to submitted
    const handleCancelRef = () => {
        setRefDraft(refSubmitted);
        setRefState(refSubmitted.trim() ? "submitted" : "idle");
        setIsRefModalOpen(false);
    };

    // Save Reference Answer
    const handleSaveReference = async () => {
        setRefState("submitting");
        try {
            const res = await examApi.submitReferenceAnswer(examId, questionId, refDraft);
            const savedVal = res.referenceAnswer ?? refDraft;
            setRefSubmitted(savedVal);
            setRefDraft(savedVal);
            setRefSubmittedAt(res.referenceSubmittedAt ?? new Date().toISOString());
            setRefState(savedVal.trim() ? "submitted" : "idle");
            toast.success("Reference / Model Answer saved successfully.");
            setIsRefModalOpen(false);
            onGuidelineUpdated?.();
        } catch (err: any) {
            setRefState("failed");
            toast.error(err?.response?.data?.message || "Failed to save Reference Answer.");
        }
    };

    // Open Rubric Modal and fetch latest from backend
    const handleOpenRubricModal = async () => {
        setIsRubricModalOpen(true);
        if (rubricState !== "dirty") {
            setIsLoadingRubric(true);
            try {
                const data = await examApi.getQuestionGuidelines(examId, questionId);
                const val = data.rubric ?? "";
                setRubricSubmitted(val);
                setRubricDraft(val);
                setRubricSubmittedAt(data.rubricSubmittedAt ?? null);
                setRubricState(val.trim() ? "submitted" : "idle");
            } catch {
                setRubricDraft(rubricSubmitted);
            } finally {
                setIsLoadingRubric(false);
            }
        }
    };

    // Cancel Rubric edits: discard unsubmitted changes and reset to submitted
    const handleCancelRubric = () => {
        setRubricDraft(rubricSubmitted);
        setRubricState(rubricSubmitted.trim() ? "submitted" : "idle");
        setIsRubricModalOpen(false);
    };

    // Save Rubric & Criteria
    const handleSaveRubric = async () => {
        setRubricState("submitting");
        try {
            const res = await examApi.submitRubric(examId, questionId, rubricDraft);
            const savedVal = res.rubric ?? rubricDraft;
            setRubricSubmitted(savedVal);
            setRubricDraft(savedVal);
            setRubricSubmittedAt(res.rubricSubmittedAt ?? new Date().toISOString());
            setRubricState(savedVal.trim() ? "submitted" : "idle");
            toast.success("Grading Rubric & Criteria saved successfully.");
            setIsRubricModalOpen(false);
            onGuidelineUpdated?.();
        } catch (err: any) {
            setRubricState("failed");
            toast.error(err?.response?.data?.message || "Failed to save Rubric & Criteria.");
        }
    };

    const formatTimestamp = (iso?: string | null) => {
        if (!iso) return "Not saved yet";
        try {
            const d = new Date(iso);
            return (
                d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
                ", " +
                d.toLocaleDateString([], { month: "short", day: "numeric" })
            );
        } catch {
            return "Saved";
        }
    };

    // Render Badge based on submission status
    const renderStatusBadge = (state: SubmissionState) => {
        switch (state) {
            case "submitted":
                return (
                    <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-[10px] font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                        <Check className="mr-1 size-3" /> Submitted
                    </Badge>
                );
            case "dirty":
                return (
                    <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                        <AlertTriangle className="mr-1 size-3" /> Changes not submitted
                    </Badge>
                );
            case "submitting":
                return (
                    <Badge
                        variant="outline"
                        className="border-blue-300 bg-blue-50 text-[10px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    >
                        <Loader2 className="mr-1 size-3 animate-spin" /> Saving
                    </Badge>
                );
            case "failed":
                return (
                    <Badge variant="destructive" className="text-[10px] font-medium">
                        Failed
                    </Badge>
                );
            case "idle":
            default:
                return (
                    <Badge variant="secondary" className="text-[10px] font-medium text-muted-foreground">
                        Not submitted
                    </Badge>
                );
        }
    };

    const hasCustomConfig = Boolean(
        refSubmitted.trim() || rubricSubmitted.trim() || refDraft.trim() || rubricDraft.trim()
    );

    return (
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/10 p-4 shadow-sm transition-all hover:border-purple-300 dark:hover:border-purple-900/50">
            {/* Header Section */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        <Sparkles className="size-4" />
                    </span>
                    <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            Optional Grading Guidelines & Rubric for AI {displayOrder ? `(Question ${displayOrder})` : ""}
                            {hasCustomConfig && (
                                <Badge
                                    variant="outline"
                                    className="border-purple-300 bg-purple-50 text-[10px] text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                >
                                    Customized
                                </Badge>
                            )}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Click directly on either card below to configure standard model answer or point criteria.
                        </p>
                    </div>
                </div>
            </div>

            {/* Outer Summary Grid: 2 Interactive Clickable Cards (No edit buttons) */}
            <div className="grid gap-3 pt-1 md:grid-cols-2">
                {/* Card 1: Reference Answer - Entire card is clickable to open Popup */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleOpenRefModal}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleOpenRefModal();
                        }
                    }}
                    className="group relative flex flex-col justify-between rounded-lg border bg-card p-4 shadow-sm space-y-3 cursor-pointer select-none transition-all duration-200 hover:border-purple-400 hover:bg-muted/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1"
                >
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <FileText className="size-4 text-purple-600 transition-transform group-hover:scale-110" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                                    Reference / Model Answer
                                </span>
                            </div>
                            {renderStatusBadge(refState)}
                        </div>

                        {/* Short snippet / preview of submitted reference answer */}
                        {refSubmitted.trim() ? (
                            <div className="rounded-md border bg-muted/30 px-3.5 py-2.5 text-xs font-mono text-foreground/90 line-clamp-2 max-h-16 overflow-hidden whitespace-pre-line leading-relaxed group-hover:border-purple-200 dark:group-hover:border-purple-800">
                                {refSubmitted}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic py-1">
                                No reference answer submitted yet. Click anywhere to set reference answer.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-muted-foreground">
                        <span>
                            {refSubmittedAt ? `Saved: ${formatTimestamp(refSubmittedAt)}` : "Not saved yet"}
                        </span>
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Pencil className="size-3" /> Click anywhere to edit
                        </span>
                    </div>
                </div>

                {/* Card 2: Grading Criteria / Rubric - Entire card is clickable to open Popup */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleOpenRubricModal}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleOpenRubricModal();
                        }
                    }}
                    className="group relative flex flex-col justify-between rounded-lg border bg-card p-4 shadow-sm space-y-3 cursor-pointer select-none transition-all duration-200 hover:border-purple-400 hover:bg-muted/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1"
                >
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <ListChecks className="size-4 text-purple-600 transition-transform group-hover:scale-110" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                                    Grading Criteria / Rubric
                                </span>
                            </div>
                            {renderStatusBadge(rubricState)}
                        </div>

                        {/* Short snippet / preview of submitted rubric */}
                        {rubricSubmitted.trim() ? (
                            <div className="rounded-md border bg-muted/30 px-3.5 py-2.5 text-xs font-mono text-foreground/90 line-clamp-2 max-h-16 overflow-hidden whitespace-pre-line leading-relaxed group-hover:border-purple-200 dark:group-hover:border-purple-800">
                                {rubricSubmitted}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground italic py-1">
                                No custom rubric submitted (using bank criteria). Click anywhere to set rubric.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t pt-2.5 text-[11px] text-muted-foreground">
                        <span>
                            {rubricSubmittedAt ? `Saved: ${formatTimestamp(rubricSubmittedAt)}` : "Not saved yet"}
                        </span>
                        <span className="text-xs font-medium text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Pencil className="size-3" /> Click anywhere to edit
                        </span>
                    </div>
                </div>
            </div>

            {/* AI Grading Confirmation Status */}
            <div className="mt-3 rounded-lg border border-purple-200/80 bg-purple-50/40 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-purple-900 dark:text-purple-300 text-xs uppercase tracking-wide">
                        <Bot className="size-4 text-purple-600" />
                        AI Grading Confirmation Status:
                    </span>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Reference:</span>
                            {refState === "submitted" ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] text-white">
                                    Submitted
                                </Badge>
                            ) : refState === "dirty" ? (
                                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-800">
                                    Changes not submitted
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                    Not submitted
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Grading Criteria:</span>
                            {rubricState === "submitted" ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px] text-white">
                                    Submitted
                                </Badge>
                            ) : rubricState === "dirty" ? (
                                <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-800">
                                    Changes not submitted
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                    Not submitted
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">AI Grading:</span>
                            <Badge className="bg-purple-700 text-white hover:bg-purple-800 text-[10px]">
                                <Sparkles className="mr-1 size-3" />
                                {refState === "submitted" || rubricState === "submitted"
                                    ? "Ready (Custom Guidelines)"
                                    : "Ready (Default Rubric)"}
                            </Badge>
                        </div>
                    </div>
                </div>

                {(refState === "dirty" || rubricState === "dirty") && (
                    <div className="mt-2.5 flex items-start gap-2 rounded border border-amber-200 bg-amber-50/90 p-2 text-[11px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-600 mt-0.5" />
                        <span>
                            <strong>Notice:</strong> Unsaved edits are pending in your browser. AI scoring will use the latest <em>Saved</em> version stored on the server. Open the popup and click <strong>Save</strong> to apply your new text.
                        </span>
                    </div>
                )}
            </div>

            {/* Popup 1: Reference Answer Modal - Large, Truly Centered (90vw, max-w-[1300px], 85vh, max-h-[90vh]) */}
            <Dialog
                open={isRefModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCancelRef();
                    }
                }}
            >
                <DialogContent className="w-[90vw] max-w-[1300px] sm:max-w-[1300px] h-[85vh] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl border bg-background shadow-2xl">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-background/95">
                        <div className="flex items-center justify-between gap-4 pr-8">
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300">
                                    <FileText className="size-5" />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-bold text-foreground">
                                        Reference Answer / Model Answer
                                        {displayOrder ? ` (Question ${displayOrder})` : ""}
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                        Expected solution, mathematical steps, key concepts, or standard answer to guide Gemini AI grading.
                                    </DialogDescription>
                                </div>
                            </div>
                            {renderStatusBadge(refState)}
                        </div>
                    </DialogHeader>

                    {/* Scrollable body with flexible large Textarea (min-h-[450px]) */}
                    <div className="p-6 flex-1 flex flex-col overflow-y-auto space-y-3 min-h-0 bg-background">
                        {isLoadingRef ? (
                            <div className="flex flex-1 items-center justify-center gap-3 text-sm text-muted-foreground">
                                <Loader2 className="size-5 animate-spin text-purple-600" />
                                Loading latest saved reference answer from server...
                            </div>
                        ) : (
                            <>
                                <Textarea
                                    className="w-full flex-1 min-h-[450px] font-mono text-sm leading-relaxed resize-none p-4 rounded-lg border bg-muted/20 focus:bg-background focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all"
                                    placeholder="e.g. Formula: S = a * b / 2. Steps:&#10;1) Find base: b = 5 cm&#10;2) Calculate height: h = 5 cm&#10;3) Conclude: S = 12.5 cm^2..."
                                    value={refDraft}
                                    onChange={(e) => handleRefDraftChange(e.target.value)}
                                />
                                <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 pt-1">
                                    <span>
                                        {refSubmittedAt
                                            ? `Last saved: ${formatTimestamp(refSubmittedAt)}`
                                            : "Not saved yet"}
                                    </span>
                                    <span>
                                        {refDraft.length} characters • {refDraft ? refDraft.split("\n").length : 0} lines
                                    </span>
                                </div>

                                {refState === "dirty" && (
                                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 shrink-0">
                                        <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                                        <span>
                                            You have unsaved changes. Click <strong>Save Reference</strong> to commit to the server, or <strong>Cancel</strong> to discard edits.
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-4 px-6 bg-muted/30 border-t shrink-0 flex items-center justify-end gap-3">
                        <Button
                            variant="outline"
                            size="default"
                            onClick={handleCancelRef}
                            disabled={refState === "submitting"}
                            className="px-5 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="default"
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-6 font-medium shadow-sm"
                            onClick={handleSaveReference}
                            disabled={
                                refState === "submitting" ||
                                (refState === "submitted" && refDraft === refSubmitted)
                            }
                        >
                            {refState === "submitting" ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            {refState === "submitting"
                                ? "Saving..."
                                : refState === "dirty"
                                ? "Save Reference"
                                : refState === "submitted"
                                ? "Saved"
                                : "Save Reference"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Popup 2: Grading Criteria / Rubric Modal - Large, Truly Centered (90vw, max-w-[1300px], 85vh, max-h-[90vh]) */}
            <Dialog
                open={isRubricModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCancelRubric();
                    }
                }}
            >
                <DialogContent className="w-[90vw] max-w-[1300px] sm:max-w-[1300px] h-[85vh] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-xl border bg-background shadow-2xl">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-background/95">
                        <div className="flex items-center justify-between gap-4 pr-8">
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300">
                                    <ListChecks className="size-5" />
                                </span>
                                <div>
                                    <DialogTitle className="text-lg font-bold text-foreground">
                                        Grading Criteria / Rubric
                                        {displayOrder ? ` (Question ${displayOrder})` : ""}
                                    </DialogTitle>
                                    <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                        Define point distribution, required sections, and evaluation criteria to guide Gemini AI scoring.
                                    </DialogDescription>
                                </div>
                            </div>
                            {renderStatusBadge(rubricState)}
                        </div>
                    </DialogHeader>

                    {/* Scrollable body with flexible large Textarea (min-h-[450px]) */}
                    <div className="p-6 flex-1 flex flex-col overflow-y-auto space-y-3 min-h-0 bg-background">
                        {isLoadingRubric ? (
                            <div className="flex flex-1 items-center justify-center gap-3 text-sm text-muted-foreground">
                                <Loader2 className="size-5 animate-spin text-purple-600" />
                                Loading latest saved rubric from server...
                            </div>
                        ) : (
                            <>
                                <Textarea
                                    className="w-full flex-1 min-h-[450px] font-mono text-sm leading-relaxed resize-none p-4 rounded-lg border bg-muted/20 focus:bg-background focus:ring-2 focus:ring-purple-400 focus:outline-none transition-all"
                                    placeholder="e.g.&#10;- Definition of core concept: 3 pts&#10;- Working implementation & tests: 4 pts&#10;- Edge-case analysis & complexity: 3 pts"
                                    value={rubricDraft}
                                    onChange={(e) => handleRubricDraftChange(e.target.value)}
                                />
                                <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 pt-1">
                                    <span>
                                        {rubricSubmittedAt
                                            ? `Last saved: ${formatTimestamp(rubricSubmittedAt)}`
                                            : "Not saved yet"}
                                    </span>
                                    <span>
                                        {rubricDraft.length} characters • {rubricDraft ? rubricDraft.split("\n").length : 0} lines
                                    </span>
                                </div>

                                {rubricState === "dirty" && (
                                    <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 shrink-0">
                                        <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                                        <span>
                                            You have unsaved changes. Click <strong>Save Criteria</strong> to commit to the server, or <strong>Cancel</strong> to discard edits.
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-4 px-6 bg-muted/30 border-t shrink-0 flex items-center justify-end gap-3">
                        <Button
                            variant="outline"
                            size="default"
                            onClick={handleCancelRubric}
                            disabled={rubricState === "submitting"}
                            className="px-5 font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="default"
                            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 px-6 font-medium shadow-sm"
                            onClick={handleSaveRubric}
                            disabled={
                                rubricState === "submitting" ||
                                (rubricState === "submitted" && rubricDraft === rubricSubmitted)
                            }
                        >
                            {rubricState === "submitting" ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Save className="size-4" />
                            )}
                            {rubricState === "submitting"
                                ? "Saving..."
                                : rubricState === "dirty"
                                ? "Save Criteria"
                                : rubricState === "submitted"
                                ? "Saved"
                                : "Save Criteria"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
