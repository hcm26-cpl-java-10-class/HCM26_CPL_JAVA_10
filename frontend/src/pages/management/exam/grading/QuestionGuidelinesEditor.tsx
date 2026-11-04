import { useState, useEffect } from "react";
import { examApi } from "@/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    AlertTriangle,
    Bot,
    Check,
    ChevronDown,
    ChevronUp,
    Loader2,
    Send,
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
    const [isOpen, setIsOpen] = useState(false);

    // Reference answer state
    const [refInput, setRefInput] = useState(initialReferenceAnswer ?? "");
    const [refSubmitted, setRefSubmitted] = useState(initialReferenceAnswer ?? "");
    const [refSubmittedAt, setRefSubmittedAt] = useState<string | null>(initialReferenceSubmittedAt ?? null);
    const [refState, setRefState] = useState<SubmissionState>(() => {
        if (initialReferenceSubmittedAt || (initialReferenceAnswer && initialReferenceAnswer.trim().length > 0)) {
            return "submitted";
        }
        return "idle";
    });

    // Rubric state
    const [rubricInput, setRubricInput] = useState(initialRubric ?? "");
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
        if (initialReferenceSubmittedAt || refVal.trim().length > 0) {
            setRefState("submitted");
        } else {
            setRefState("idle");
        }
    }, [initialReferenceAnswer, initialReferenceSubmittedAt]);

    useEffect(() => {
        const rubVal = initialRubric ?? "";
        setRubricSubmitted(rubVal);
        setRubricSubmittedAt(initialRubricSubmittedAt ?? null);
        if (initialRubricSubmittedAt || rubVal.trim().length > 0) {
            setRubricState("submitted");
        } else {
            setRubricState("idle");
        }
    }, [initialRubric, initialRubricSubmittedAt]);

    // Handle reference input change
    const handleRefChange = (val: string) => {
        setRefInput(val);
        if (val.trim() === refSubmitted.trim()) {
            setRefState(refSubmitted.trim() ? "submitted" : "idle");
        } else {
            setRefState("dirty");
        }
    };

    // Handle rubric input change
    const handleRubricChange = (val: string) => {
        setRubricInput(val);
        if (val.trim() === rubricSubmitted.trim()) {
            setRubricState(rubricSubmitted.trim() ? "submitted" : "idle");
        } else {
            setRubricState("dirty");
        }
    };

    // Submit Reference Answer
    const handleSubmitReference = async () => {
        setRefState("submitting");
        try {
            const res = await examApi.submitReferenceAnswer(examId, questionId, refInput);
            setRefSubmitted(res.referenceAnswer ?? refInput);
            setRefSubmittedAt(res.referenceSubmittedAt ?? new Date().toISOString());
            setRefState(refInput.trim() ? "submitted" : "idle");
            toast.success("Reference / Model Answer saved successfully.");
            onGuidelineUpdated?.();
        } catch (err: any) {
            setRefState("failed");
            toast.error(err?.response?.data?.message || "Failed to submit Reference Answer.");
        }
    };

    // Submit Rubric & Criteria
    const handleSubmitRubric = async () => {
        setRubricState("submitting");
        try {
            const res = await examApi.submitRubric(examId, questionId, rubricInput);
            setRubricSubmitted(res.rubric ?? rubricInput);
            setRubricSubmittedAt(res.rubricSubmittedAt ?? new Date().toISOString());
            setRubricState(rubricInput.trim() ? "submitted" : "idle");
            toast.success("Grading Rubric & Criteria saved successfully.");
            onGuidelineUpdated?.();
        } catch (err: any) {
            setRubricState("failed");
            toast.error(err?.response?.data?.message || "Failed to submit Rubric & Criteria.");
        }
    };

    const hasCustomConfig = Boolean(
        refSubmitted.trim() || rubricSubmitted.trim() || refInput.trim() || rubricInput.trim()
    );

    return (
        <div className="rounded-xl border border-muted-foreground/20 bg-muted/10 p-4 shadow-sm transition-all hover:border-purple-300 dark:hover:border-purple-900/50">
            {/* Header Accordion Bar */}
            <div
                role="button"
                tabIndex={0}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2"
                onClick={() => setIsOpen((prev) => !prev)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsOpen((prev) => !prev);
                    }
                }}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                        <Sparkles className="size-4" />
                    </span>
                    <div>
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            Optional Grading Guidelines & Rubric for AI {displayOrder ? `(Question ${displayOrder})` : ""}
                            {hasCustomConfig && (
                                <Badge variant="outline" className="border-purple-300 bg-purple-50 text-[10px] text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
                                    Customized
                                </Badge>
                            )}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            Provide standard model answer and point allocation to guide Gemini AI grading.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-foreground">
                        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                </div>
            </div>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="mt-4 space-y-4 border-t pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Reference / Model Answer Box */}
                        <div className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-sm">
                            <div>
                                <div className="flex items-center justify-between pb-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Reference / Model Answer <span className="font-normal text-muted-foreground/70">(Optional)</span>
                                    </label>
                                    {refState === "submitted" && (
                                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <Check className="mr-1 size-3" /> Submitted
                                        </Badge>
                                    )}
                                    {refState === "dirty" && (
                                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                            <AlertTriangle className="mr-1 size-3" /> Changes not submitted
                                        </Badge>
                                    )}
                                    {refState === "failed" && (
                                        <Badge variant="destructive" className="text-[10px]">
                                            Failed
                                        </Badge>
                                    )}
                                    {refState === "idle" && (
                                        <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                            Not submitted
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                    Expected solution, mathematical steps, key concepts, or standard answer.
                                </p>
                                <Textarea
                                    rows={4}
                                    className="resize-y text-xs font-mono leading-relaxed"
                                    placeholder="e.g. Formula: S = a * b / 2. Steps: 1) Find base, 2) Calculate height, 3) Conclude S = 12.5 cm^2..."
                                    value={refInput}
                                    onChange={(e) => handleRefChange(e.target.value)}
                                />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
                                <span className="text-[10px] text-muted-foreground">
                                    {refSubmittedAt
                                        ? `Last saved: ${new Date(refSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : "Not saved yet"}
                                </span>
                                <Button
                                    size="sm"
                                    variant={refState === "dirty" ? "default" : "outline"}
                                    className={`h-7 px-3 text-xs gap-1.5 ${refState === "dirty" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                                    onClick={handleSubmitReference}
                                    disabled={refState === "submitting" || (refState === "submitted" && refInput === refSubmitted)}
                                >
                                    {refState === "submitting" ? (
                                        <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                        <Send className="size-3" />
                                    )}
                                    {refState === "submitting"
                                        ? "Submitting..."
                                        : refState === "dirty"
                                        ? "Submit Changes"
                                        : refState === "submitted"
                                        ? "Submitted"
                                        : "Submit Reference"}
                                </Button>
                            </div>
                        </div>

                        {/* Grading Rubric & Criteria Box */}
                        <div className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-sm">
                            <div>
                                <div className="flex items-center justify-between pb-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Grading Rubric & Criteria <span className="font-normal text-muted-foreground/70">(Optional)</span>
                                    </label>
                                    {rubricState === "submitted" && (
                                        <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <Check className="mr-1 size-3" /> Submitted
                                        </Badge>
                                    )}
                                    {rubricState === "dirty" && (
                                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                            <AlertTriangle className="mr-1 size-3" /> Changes not submitted
                                        </Badge>
                                    )}
                                    {rubricState === "failed" && (
                                        <Badge variant="destructive" className="text-[10px]">
                                            Failed
                                        </Badge>
                                    )}
                                    {rubricState === "idle" && (
                                        <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                                            Not submitted
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">
                                    Breakdown of points per criteria (e.g. Method: 2 pts, Calculations: 2 pts).
                                </p>
                                <Textarea
                                    rows={4}
                                    className="resize-y text-xs font-mono leading-relaxed"
                                    placeholder="e.g. Definition of concept: 3 pts; Working code example: 4 pts; Edge-case analysis: 3 pts..."
                                    value={rubricInput}
                                    onChange={(e) => handleRubricChange(e.target.value)}
                                />
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
                                <span className="text-[10px] text-muted-foreground">
                                    {rubricSubmittedAt
                                        ? `Last saved: ${new Date(rubricSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : "Not saved yet"}
                                </span>
                                <Button
                                    size="sm"
                                    variant={rubricState === "dirty" ? "default" : "outline"}
                                    className={`h-7 px-3 text-xs gap-1.5 ${rubricState === "dirty" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
                                    onClick={handleSubmitRubric}
                                    disabled={rubricState === "submitting" || (rubricState === "submitted" && rubricInput === rubricSubmitted)}
                                >
                                    {rubricState === "submitting" ? (
                                        <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                        <Send className="size-3" />
                                    )}
                                    {rubricState === "submitting"
                                        ? "Submitting..."
                                        : rubricState === "dirty"
                                        ? "Submit Changes"
                                        : rubricState === "submitted"
                                        ? "Submitted"
                                        : "Submit Criteria"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Visual Status Confirmation Area */}
                    <div className="rounded-lg border border-purple-200/80 bg-purple-50/40 p-3 dark:border-purple-900/50 dark:bg-purple-950/20">
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
                                    <strong>Notice:</strong> Unsubmitted edits are pending in your browser. AI scoring will use the latest <em>Submitted</em> version stored on the server. Click <strong>Submit</strong> to apply your new text.
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
